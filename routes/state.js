// ============================================================================
//  Rutas del estado de la casa.
//
//  No hay autenticación: esta app es privada y familiar (ver public/perfiles.js).
//  Lo que sí hay es una DECLARACIÓN de perfil en la cabecera `X-Perfil`, que
//  responde a "¿quién está usando este dispositivo?" y no a "¿quién eres?".
//  Se usa para dos cosas:
//
//    - decidir si quien escribe puede aprobar tareas (un móvil de hijo no),
//    - y para los ajustes de casa (economía, catálogos, copias de seguridad).
//
//  Es una barrera de PRODUCTO, no de seguridad: quien quiera saltársela solo
//  tiene que cambiar el perfil en la pantalla de inicio. Es intencionado. Sirve
//  para que la app signifique algo (los padres validan; los hijos reportan) sin
//  pedir contraseñas a un niño de diez años.
// ============================================================================
const express = require("express");
const {
  estadoVacio, adoptarPerfiles, ensureFixedShape, normalizarMenus,
  leerEstado, guardarEstado, guardarSiVersion, versionActual,
} = require("../services/estadoService");
const { esHijo, esPerfilValido, PERFIL_POR_DEFECTO } = require("../public/perfiles.js");
const { sanitizeState, applyChildLimits } = require("../services/stateGuard");
const { calcularRachas, cerrarSemanaRachas } = require("../services/rachas");
const { resumenDelMes } = require("../services/puntos");

const router = express.Router();

function isValidState(s) {
  return s && typeof s === "object"
    && Array.isArray(s.fixedTasks)
    && Array.isArray(s.extraTasks);
}

// Perfil declarado por el dispositivo. Si no llega uno válido se asume el de
// los papás, que es el que puede hacerlo todo: así una petición hecha a mano
// (una copia de seguridad desde el navegador, por ejemplo) no se queda tirada.
function perfilDe(req) {
  const p = String(req.get("X-Perfil") || "").trim();
  return esPerfilValido(p) ? p : PERFIL_POR_DEFECTO;
}

// Los ajustes de la casa los tocan los papás. Mismo criterio que arriba: es
// una separación de roles, no una contraseña.
function soloPapas(req, res, next) {
  if (esHijo(perfilDe(req))) return res.status(403).json({ error: "solo_papas" });
  next();
}

// ---------------------------------------------------------------------------
//  Ciclos de semana y mes.
//
//  Los decide el SERVIDOR, en el huso de la casa. Antes los disparaba el
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
//  que el hijo SÍ entregó y los papás no llegaron a mirar se respeta: no sería
//  justo penalizar por un descuido suyo.
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

// Día de la semana en el huso de la casa. 0 = lunes … 6 = domingo.
const hoyIdx = () => (fechaLocal().getUTCDay() + 6) % 7;

// Aplica los reinicios que toquen. Devuelve true si ha cambiado algo.
function aplicarCiclos(state) {
  const mes = claveMes(), semana = claveSemana();
  let cambio = false;

  if (state.currentMonth !== mes) {
    state.history = state.history || {};
    // Orden importante: primero se vence lo que quedó sin entregar, luego se
    // calcula el resumen (así refleja la realidad) y solo después se vacía.
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
  const menuCambio = normalizarMenus(state);
  const rachaCambio = calcularRachas(state, hoyIdx());
  return formaCambio || menuCambio || rachaCambio || cambio;
}

// GET /api/state — estado de la casa, con los perfiles ya adoptados
router.get("/state", async (req, res) => {
  try {
    const { estado, version } = await leerEstado();
    let v = version;

    // Los perfiles primero: si el estado viene de la época de las cuentas,
    // aquí es donde los UUID antiguos se traducen a hugo/marcos/carla.
    const perfilesCambio = adoptarPerfiles(estado);

    // Reinicios de ciclo y relleno de casillas: si cambió algo, se persiste.
    // Sin esto, el cliente rellenaría en local sin guardar y el sondeo vería
    // diferencia en cada vuelta (la pantalla se repintaba cada 4 segundos).
    if (aplicarCiclos(estado) || perfilesCambio) {
      v = await guardarEstado(estado);
    }
    // La versión viaja con el estado: el cliente la devuelve al guardar y así
    // el servidor sabe si escribió alguien más mientras tanto.
    estado._version = v;
    res.json(estado);
  } catch (e) {
    console.error("[state/get]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// PUT /api/state — guarda el estado completo de la casa.
// Los hijos pueden escribir (lo necesitan para marcar sus tareas), pero no
// pueden aprobárselas ni tocar las de sus hermanos.
router.put("/state", async (req, res) => {
  try {
    if (!isValidState(req.body)) return res.status(400).json({ error: "estado_invalido" });

    // Versión desde la que dice venir el cliente (sanitizeState la descarta,
    // así que se lee del cuerpo original).
    const versionCliente = Number(req.body._version) || 0;
    const perfil = perfilDe(req);
    const { estado: prev, version: versionServidor } = await leerEstado();

    // 1. Lo primero, si este dispositivo viene de una versión vieja: 409.
    //
    //    El orden importa. Si esta comprobación fuera después de las reglas de
    //    perfil, un hijo que hubiera leído el estado antes de que sus papás
    //    cambiaran algo recibiría un 403 ("no puedes tocar eso") en lugar de un
    //    409 ("recarga y reintenta"). El 403 no se reintenta: su cambio se
    //    perdería y en pantalla solo vería un aviso de desconexión.
    if (versionCliente !== 0 && versionCliente !== versionServidor) {
      return res.status(409).json({ error: "version_desfasada", version: versionServidor });
    }

    // 2. Sanear siempre: tipos, longitudes, enumerados y referencias colgantes.
    let incoming = sanitizeState(req.body);

    // 3. Reglas de perfil. Un hijo necesita escribir para marcar sus tareas,
    //    pero no puede aprobárselas ni tocar las de sus hermanos.
    if (esHijo(perfil)) {
      const { estado, rechazos } = applyChildLimits(incoming, prev, perfil);
      if (rechazos.length) {
        console.warn("[state/put] cambios rechazados a", perfil, rechazos);
        return res.status(403).json({ error: "cambio_no_permitido", detalles: rechazos.slice(0, 10) });
      }
      incoming = estado;
    }

    // Los ciclos los marca el reloj del servidor, no el del dispositivo. Si el
    // cliente escribe con una semana o un mes que ya no son los actuales, se
    // rechaza: su sondeo traerá el estado bueno en unos segundos.
    if (incoming.currentMonth !== claveMes() || incoming.currentWeek !== claveSemana()) {
      return res.status(409).json({ error: "ciclo_desfasado" });
    }

    // Los miembros son siempre los cuatro perfiles: nadie los inventa desde el
    // cliente. Y la forma de las casillas se deja completa aquí, para que el
    // GET no tenga que reescribirla (si no, sondeo en bucle).
    adoptarPerfiles(incoming);
    ensureFixedShape(incoming);
    normalizarMenus(incoming);
    // La racha la calcula siempre el servidor a partir de las casillas: nadie
    // puede escribirla desde el cliente.
    calcularRachas(incoming, hoyIdx());

    // Escritura con comprobación de versión. Si entre que este dispositivo
    // leyó el estado y lo guarda ha escrito alguien más, no se actualiza nada
    // y se responde 409: el cliente recarga y reaplica su cambio sobre el
    // estado fresco. Antes ganaba el último y el otro cambio desaparecía sin
    // que nadie se enterara.
    const nueva = await guardarSiVersion(incoming, versionCliente);
    if (nueva === null) {
      return res.status(409).json({ error: "version_desfasada", version: await versionActual() });
    }
    res.json({ ok: true, version: nueva });
  } catch (e) {
    console.error("[state/put]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// POST /api/reset — vuelve al estado de ejemplo (solo papás)
router.post("/reset", soloPapas, async (req, res) => {
  try {
    const fresco = estadoVacio();
    fresco.currentMonth = claveMes();
    fresco.currentWeek = claveSemana();
    ensureFixedShape(fresco);
    normalizarMenus(fresco);
    await guardarEstado(fresco);
    res.json({ ok: true });
  } catch (e) {
    console.error("[state/reset]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// GET /api/backup — descarga el estado actual (solo papás)
router.get("/backup", soloPapas, async (req, res) => {
  try {
    const { estado } = await leerEstado();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="casa-copia-${stamp}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(estado, null, 2));
  } catch (e) {
    console.error("[state/backup]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// POST /api/restore — restaura desde JSON (solo papás)
router.post("/restore", soloPapas, async (req, res) => {
  try {
    if (!isValidState(req.body)) return res.status(400).json({ error: "copia_invalida" });
    // Una copia puede venir de cualquier sitio: se sanea igual que un PUT.
    const restaurado = sanitizeState(req.body);
    adoptarPerfiles(restaurado);
    // La copia puede ser de otra semana: se sella con el ciclo actual.
    restaurado.currentMonth = claveMes();
    restaurado.currentWeek = claveSemana();
    ensureFixedShape(restaurado);
    normalizarMenus(restaurado);
    await guardarEstado(restaurado);
    res.json({ ok: true });
  } catch (e) {
    console.error("[state/restore]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

module.exports = router;
