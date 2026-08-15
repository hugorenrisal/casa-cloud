// ============================================================================
//  Rutas de estado familiar (per-family). Reemplaza /api/state monolítica.
//  Todas requieren auth + email verificado + pertenencia a una familia.
// ============================================================================
const express = require("express");
const { query } = require("../db");
const { requireAuth, requireEmailVerified } = require("../middleware/requireAuth");
const { requireFamily, requireParent } = require("../middleware/requireFamily");
const { emptyFamilyState, syncMembers, listMembers, ensureFixedShape } =
  require("../services/familyService");
const { sanitizeState, applyChildLimits } = require("../services/stateGuard");
const { calcularRachas, cerrarSemanaRachas } = require("../services/rachas");
const { resumenDelMes } = require("../services/puntos");

const router = express.Router();

function isValidState(s) {
  return s && typeof s === "object"
    && Array.isArray(s.fixedTasks)
    && Array.isArray(s.extraTasks);
}

// ---------------------------------------------------------------------------
//  Ciclos de semana y mes.
//
//  Los decide el SERVIDOR, en el huso de la familia. Antes los disparaba el
//  reloj de cada dispositivo: bastaba con que un móvil tuviera la fecha mal
//  puesta para reiniciar la semana o el mes de toda la familia.
// ---------------------------------------------------------------------------
const TZ = process.env.TZ_FAMILIA || "Europe/Madrid";

function fechaLocal(d = new Date()) {
  const [y, m, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dia));
}
function claveMes(d = fechaLocal()) {
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
// Semana ISO-8601 "YYYY-Www" (empieza en lunes)
function claveSemana(d = fechaLocal()) {
  const t = new Date(d.getTime());
  const dia = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dia + 3);
  const primerJue = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const sem = 1 + Math.round(((t - primerJue) / 86400000 - 3 + ((primerJue.getUTCDay() + 6) % 7)) / 7);
  return t.getUTCFullYear() + "-W" + String(sem).padStart(2, "0");
}

// ---------------------------------------------------------------------------
//  Vencimientos automáticos.
//
//  Antes el padre tenía que marcar "vencida" a mano, tarea por tarea, y en la
//  práctica nadie lo hacía: las tareas sin hacer se quedaban eternamente en
//  "pendiente" y el reparto del mes siguiente arrancaba sucio.
//
//  Al cerrar la semana, lo que quedó sin entregar se marca como vencido. Lo
//  que el hijo SÍ entregó y el padre no llegó a mirar se respeta: no sería
//  justo penalizar por un descuido del padre.
// ---------------------------------------------------------------------------
function vencerPendientes(state) {
  let n = 0;
  // Tareas fijas semanales
  Object.keys(state.fixedState || {}).forEach((hijo) => {
    Object.keys(state.fixedState[hijo] || {}).forEach((tid) => {
      const casilla = state.fixedState[hijo][tid];
      if (casilla && casilla.status === "pending") { casilla.status = "late"; n++; }
    });
  });
  // Tareas adicionales
  (state.extras || []).forEach((x) => {
    if (x.status === "pending") { x.status = "late"; n++; }
  });
  return n;
}

function iniciarSemanaFijas(state) {
  state.fixedState = {};
  (state.members || []).filter((m) => m.role === "child").forEach((c) => {
    state.fixedState[c.id] = {};
    (state.fixedTasks || []).forEach((t) => {
      state.fixedState[c.id][t.id] = t.freq === "weekly"
        ? { status: "pending" }
        : { days: [false, false, false, false, false, false, false] };
    });
  });
}

// Día de la semana en el huso de la familia. 0 = lunes … 6 = domingo.
const hoyIdx = () => (fechaLocal().getUTCDay() + 6) % 7;

// Aplica los reinicios que toquen. Devuelve true si ha cambiado algo.
function aplicarCiclos(state) {
  const mes = claveMes(), semana = claveSemana();
  let cambio = false;

  if (state.currentMonth !== mes) {
    state.history = state.history || {};
    // Orden importante: primero se vence lo que quedó sin entregar, luego se
    // calcula el resumen (así refleja la realidad) y solo después se vacía.
    // Antes se archivaba state.monthPoints, un campo que nadie escribía nunca:
    // el historial guardaba ceros.
    vencerPendientes(state);
    state.history[state.currentMonth] = resumenDelMes(state);
    // La racha encadenada hay que guardarla antes de vaciar las casillas.
    cerrarSemanaRachas(state);
    state.currentMonth = mes;
    state.monthPoints = {};
    state.fixedState = {}; state.extras = []; state.generated = false;
    state.listings = []; state.offers = []; state.marketLog = [];
    state.currentWeek = semana;
    cambio = true;
  } else if (state.currentWeek !== semana) {
    cerrarSemanaRachas(state);
    // Aquí NO se vence nada a propósito: las casillas de fijas se reinician
    // acto seguido, así que marcarlas no dejaría rastro en ningún sitio. Y las
    // adicionales son mensuales, no semanales: vencerlas ahora sería injusto.
    state.currentWeek = semana;
    if (state.generated) iniciarSemanaFijas(state);
    cambio = true;
  }

  const formaCambio = ensureFixedShape(state);
  const rachaCambio = calcularRachas(state, hoyIdx());
  return formaCambio || rachaCambio || cambio;
}

// GET /api/state — devuelve estado de la familia del usuario, con members sincronizados
router.get("/state", requireAuth, requireEmailVerified, requireFamily, async (req, res) => {
  try {
    const r = await query("SELECT data FROM family_state WHERE family_id=$1", [req.user.familyId]);
    let state = r.rows[0]?.data;
    if (!state) {
      state = emptyFamilyState();
      await query(
        "INSERT INTO family_state (family_id, data) VALUES ($1, $2::jsonb)",
        [req.user.familyId, JSON.stringify(state)]
      );
    }
    const members = await listMembers(req.user.familyId);
    state = syncMembers(state, members);

    // Reinicios de ciclo y relleno de casillas: si cambió algo, se persiste.
    // Sin esto, el cliente rellenaría en local sin guardar y el sondeo vería
    // diferencia en cada vuelta (la pantalla se repintaba cada 4 segundos).
    if (aplicarCiclos(state)) {
      await query(
        `INSERT INTO family_state (family_id, data, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (family_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [req.user.familyId, JSON.stringify(state)]
      );
    }
    res.json(state);
  } catch (e) {
    console.error("[state/get]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// PUT /api/state — guarda el estado completo de la familia
// Hijos pueden actualizar (necesario para marcar tareas), pero no pueden cambiar
// members ni catálogos (validamos campo a campo en el server contra la BD).
router.put("/state", requireAuth, requireEmailVerified, requireFamily, async (req, res) => {
  try {
    if (!isValidState(req.body)) return res.status(400).json({ error: "estado_invalido" });

    // 1. Sanear siempre: tipos, longitudes, enumerados y referencias colgantes.
    let incoming = sanitizeState(req.body);

    // 2. Reglas de rol. Un hijo necesita escribir para marcar sus tareas, pero
    //    no puede aprobárselas ni tocar las de sus hermanos. Estas reglas
    //    tienen que estar aquí: en la interfaz se saltan con el navegador.
    if (req.user.roleInFamily === "child") {
      const cur = await query("SELECT data FROM family_state WHERE family_id=$1",
        [req.user.familyId]);
      const prev = cur.rows[0]?.data || emptyFamilyState();
      const { estado, rechazos } = applyChildLimits(incoming, prev, req.user.id);
      if (rechazos.length) {
        console.warn("[state/put] cambios rechazados a hijo", req.user.id, rechazos);
        return res.status(403).json({ error: "cambio_no_permitido", detalles: rechazos.slice(0, 10) });
      }
      incoming = estado;
    }

    // Los ciclos los marca el reloj del servidor, no el del dispositivo. Si el
    // cliente escribe con una semana o un mes que ya no son los actuales, se
    // rechaza: su sondeo traerá el estado bueno en unos segundos. Así un móvil
    // con la fecha mal puesta no puede reiniciar (ni resucitar) el ciclo.
    if (incoming.currentMonth !== claveMes() || incoming.currentWeek !== claveSemana()) {
      return res.status(409).json({ error: "ciclo_desfasado" });
    }

    // Siempre forzamos members desde la BD (fuente de verdad)
    const members = await listMembers(req.user.familyId);
    const synced = syncMembers(incoming, members);
    ensureFixedShape(synced); // se guarda ya con forma; el GET no reescribirá
    // La racha la calcula siempre el servidor a partir de las casillas: nadie
    // puede escribirla desde el cliente.
    calcularRachas(synced, hoyIdx());

    await query(
      `INSERT INTO family_state (family_id, data, updated_at)
         VALUES ($1, $2::jsonb, now())
       ON CONFLICT (family_id) DO UPDATE
         SET data = EXCLUDED.data, updated_at = now()`,
      [req.user.familyId, JSON.stringify(synced)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("[state/put]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// POST /api/reset — reinicia a un estado vacío (solo padres)
router.post("/reset", requireAuth, requireEmailVerified, requireFamily, requireParent,
  async (req, res) => {
    try {
      const fresh = emptyFamilyState();
      const members = await listMembers(req.user.familyId);
      const seeded = syncMembers(fresh, members);
      seeded.currentMonth = claveMes();
      seeded.currentWeek = claveSemana();
      ensureFixedShape(seeded);
      await query(
        `UPDATE family_state SET data=$1::jsonb, updated_at=now() WHERE family_id=$2`,
        [JSON.stringify(seeded), req.user.familyId]
      );
      res.json({ ok: true });
    } catch (e) {
      console.error("[state/reset]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// GET /api/backup — descarga el estado actual de la familia (solo padres)
router.get("/backup", requireAuth, requireEmailVerified, requireFamily, requireParent,
  async (req, res) => {
    try {
      const r = await query("SELECT data FROM family_state WHERE family_id=$1",
        [req.user.familyId]);
      const data = r.rows[0]?.data || emptyFamilyState();
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Disposition",
        `attachment; filename="casa-copia-${stamp}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("[state/backup]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// POST /api/restore — restaura desde JSON (solo padres)
router.post("/restore", requireAuth, requireEmailVerified, requireFamily, requireParent,
  async (req, res) => {
    try {
      if (!isValidState(req.body)) return res.status(400).json({ error: "copia_invalida" });
      // Una copia puede venir de cualquier sitio: se sanea igual que un PUT.
      const members = await listMembers(req.user.familyId);
      const synced = syncMembers(sanitizeState(req.body), members);
      // La copia puede ser de otra semana: se sella con el ciclo actual.
      synced.currentMonth = claveMes();
      synced.currentWeek = claveSemana();
      ensureFixedShape(synced);
      await query(
        `UPDATE family_state SET data=$1::jsonb, updated_at=now() WHERE family_id=$2`,
        [JSON.stringify(synced), req.user.familyId]
      );
      res.json({ ok: true });
    } catch (e) {
      console.error("[state/restore]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

module.exports = router;
