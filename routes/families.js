// ============================================================================
//  Rutas de familias y miembros (todas requieren auth).
// ============================================================================
const express = require("express");
const { query } = require("../db");
const { requireAuth, requireEmailVerified } = require("../middleware/requireAuth");
const { requireFamily, requireOwnFamily, requireParent } = require("../middleware/requireFamily");
const { listMembers, getFamilyById, removeMember } = require("../services/familyService");

const router = express.Router();

// GET /api/families/current — info de la familia del usuario autenticado
router.get("/current", requireAuth, requireEmailVerified, requireFamily, async (req, res) => {
  try {
    const fam = await getFamilyById(req.user.familyId);
    if (!fam) return res.status(404).json({ error: "familia_no_existe" });
    const members = await listMembers(req.user.familyId);
    res.json({ family: fam, members, me: { roleInFamily: req.user.roleInFamily } });
  } catch (e) {
    console.error("[families/current]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// GET /api/families/:familyId/members
router.get("/:familyId/members",
  requireAuth, requireEmailVerified, requireFamily, requireOwnFamily("familyId"),
  async (req, res) => {
    try {
      const members = await listMembers(req.params.familyId);
      res.json({ members });
    } catch (e) {
      console.error("[families/members]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// PATCH /api/families/:familyId — renombrar (solo padre)
router.patch("/:familyId",
  requireAuth, requireEmailVerified, requireFamily, requireOwnFamily("familyId"), requireParent,
  async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim().slice(0, 60);
      if (name.length < 2) return res.status(400).json({ error: "nombre_invalido" });
      await query("UPDATE families SET name=$1, updated_at=now() WHERE id=$2",
        [name, req.params.familyId]);
      res.json({ ok: true });
    } catch (e) {
      console.error("[families/patch]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// DELETE /api/families/:familyId/members/:userId — expulsar (solo padre)
router.delete("/:familyId/members/:userId",
  requireAuth, requireEmailVerified, requireFamily, requireOwnFamily("familyId"), requireParent,
  async (req, res) => {
    try {
      if (req.params.userId === req.user.id) {
        return res.status(400).json({ error: "no_puedes_quitarte_tu_mismo" });
      }
      await removeMember({
        familyId: req.params.familyId,
        userId: req.params.userId,
        byUserId: req.user.id,
      });
      res.json({ ok: true });
    } catch (e) {
      if (["miembro_no_existe", "no_dejar_familia_sin_padres"].includes(e.message)) {
        return res.status(400).json({ error: e.message });
      }
      console.error("[families/delete-member]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

module.exports = router;
