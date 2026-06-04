// ============================================================================
//  Onboarding: elegir rol (parent/child) y crear familia (solo padres).
// ============================================================================
const express = require("express");
const { query } = require("../db");
const { requireAuth, requireEmailVerified } = require("../middleware/requireAuth");
const { createFamilyForUser } = require("../services/familyService");

const router = express.Router();

// POST /api/onboarding/role { role: "parent" | "child" }
router.post("/role", requireAuth, requireEmailVerified, async (req, res) => {
  try {
    const role = req.body?.role;
    if (!["parent", "child"].includes(role)) {
      return res.status(400).json({ error: "rol_invalido" });
    }
    if (req.user.role && req.user.role !== role) {
      return res.status(409).json({ error: "rol_ya_fijado" });
    }
    // Si pasa de child a parent o viceversa cuando ya hay familia, no permitir
    if (req.user.familyId) {
      return res.status(409).json({ error: "rol_ya_fijado_en_familia" });
    }
    // Si es child sin familia: marcamos rol, onboarding queda incompleto hasta unirse a una familia
    // Si es parent: marcamos rol, onboarding queda incompleto hasta crear familia
    await query(
      "UPDATE user_profiles SET role=$1 WHERE user_id=$2",
      [role, req.user.id]
    );
    res.json({ ok: true, role });
  } catch (e) {
    console.error("[onboarding/role]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// POST /api/onboarding/create-family { name: "Familia García" }
router.post("/create-family", requireAuth, requireEmailVerified, async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(403).json({ error: "solo_padres_crean" });
    }
    if (req.user.familyId) {
      return res.status(409).json({ error: "ya_en_familia" });
    }
    const familyName = String(req.body?.name || "").trim().slice(0, 60);
    if (familyName.length < 2) return res.status(400).json({ error: "nombre_familia_invalido" });

    const result = await createFamilyForUser({ userId: req.user.id, familyName });
    res.status(201).json({ ok: true, family: result });
  } catch (e) {
    if (["ya_en_familia", "solo_padres_crean", "nombre_familia_invalido"].includes(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    console.error("[onboarding/create-family]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

module.exports = router;
