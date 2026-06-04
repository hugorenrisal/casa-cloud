// ============================================================================
//  Rutas de estado familiar (per-family). Reemplaza /api/state monolítica.
//  Todas requieren auth + email verificado + pertenencia a una familia.
// ============================================================================
const express = require("express");
const { query } = require("../db");
const { requireAuth, requireEmailVerified } = require("../middleware/requireAuth");
const { requireFamily, requireParent } = require("../middleware/requireFamily");
const { emptyFamilyState, syncMembers, listMembers } = require("../services/familyService");

const router = express.Router();

function isValidState(s) {
  return s && typeof s === "object"
    && Array.isArray(s.fixedTasks)
    && Array.isArray(s.extraTasks);
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
    const incoming = req.body;

    // Los hijos NO pueden modificar members, fixedTasks, extraTasks, rewards, fixedPay, rate
    if (req.user.roleInFamily === "child") {
      const cur = await query("SELECT data FROM family_state WHERE family_id=$1",
        [req.user.familyId]);
      const prev = cur.rows[0]?.data || emptyFamilyState();
      // Sobrescribimos campos protegidos con la versión anterior
      const PROTECTED = ["members", "fixedTasks", "extraTasks", "rewards", "fixedPay", "rate", "dishes"];
      PROTECTED.forEach(k => { if (k in prev) incoming[k] = prev[k]; });
    }

    // Siempre forzamos members desde la BD (fuente de verdad)
    const members = await listMembers(req.user.familyId);
    const synced = syncMembers(incoming, members);

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
      const members = await listMembers(req.user.familyId);
      const synced = syncMembers(req.body, members);
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
