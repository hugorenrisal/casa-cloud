// ============================================================================
//  Invitaciones familiares por email.
//  - Crear: solo padres de la propia familia (rate-limited).
//  - Preview: público (con token) para mostrar info antes del registro/login.
//  - Aceptar: cualquier usuario autenticado con email verificado.
//  - Revocar / Reenviar: solo padres.
// ============================================================================
const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, tx } = require("../db");
const {
  generateOpaqueToken, hashOpaqueToken,
  isValidEmail, normalizeEmail,
} = require("../services/authService");
const emailService = require("../services/emailService");
const { requireAuth, requireEmailVerified } = require("../middleware/requireAuth");
const { requireFamily, requireOwnFamily, requireParent } = require("../middleware/requireFamily");
const { getFamilyById } = require("../services/familyService");

const router = express.Router();

const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 30,
  message: { error: "demasiadas_invitaciones" },
});

function statusOf(row) {
  if (row.revoked_at) return "revoked";
  if (row.accepted_at) return "accepted";
  if (new Date(row.expires_at) < new Date()) return "expired";
  return "pending";
}

// ---------------------------------------------------------------------------
// POST /api/families/:familyId/invitations { email, role }
// ---------------------------------------------------------------------------
router.post("/:familyId/invitations",
  requireAuth, requireEmailVerified, requireFamily, requireOwnFamily("familyId"), requireParent, inviteLimiter,
  async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const role = req.body?.role;
      if (!isValidEmail(email)) return res.status(400).json({ error: "email_invalido" });
      if (!["parent", "child"].includes(role)) return res.status(400).json({ error: "rol_invalido" });

      // Si ese email ya pertenece a la familia, error claro
      const inFam = await query(
        `SELECT 1 FROM family_members fm JOIN users u ON u.id=fm.user_id
         WHERE fm.family_id=$1 AND LOWER(u.email)=$2 AND fm.status='active'`,
        [req.params.familyId, email]
      );
      if (inFam.rowCount) return res.status(409).json({ error: "ya_es_miembro" });

      // Si hay invitación abierta para mismo email/familia/rol, evitamos duplicado
      const open = await query(
        `SELECT 1 FROM family_invitations
         WHERE family_id=$1 AND LOWER(invited_email)=$2 AND invited_role=$3
           AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
        [req.params.familyId, email, role]
      );
      if (open.rowCount) return res.status(409).json({ error: "invitacion_ya_pendiente" });

      const hours = parseInt(process.env.INVITATION_EXPIRES_HOURS || "168", 10);
      const { raw, hash } = generateOpaqueToken();
      const inv = await query(
        `INSERT INTO family_invitations
           (family_id, invited_email, invited_role, token_hash, expires_at, created_by_user_id)
         VALUES ($1, $2, $3, $4, now() + ($5 || ' hours')::interval, $6)
         RETURNING id, invited_email, invited_role, expires_at, created_at`,
        [req.params.familyId, email, role, hash, String(hours), req.user.id]
      );

      const fam = await getFamilyById(req.params.familyId);
      const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
      const acceptUrl = `${appUrl}/#/invite?token=${raw}`;
      await emailService.sendInvitationEmail({
        to: email,
        familyName: fam.name,
        inviterName: req.user.displayName,
        role,
        acceptUrl,
        expiresAt: inv.rows[0].expires_at,
      });

      res.status(201).json({
        ok: true,
        invitation: { ...inv.rows[0], status: "pending" },
      });
    } catch (e) {
      console.error("[invitations/create]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/families/:familyId/invitations
// ---------------------------------------------------------------------------
router.get("/:familyId/invitations",
  requireAuth, requireEmailVerified, requireFamily, requireOwnFamily("familyId"), requireParent,
  async (req, res) => {
    try {
      const r = await query(
        `SELECT id, invited_email, invited_role, expires_at, accepted_at, revoked_at, created_at
         FROM family_invitations WHERE family_id=$1 ORDER BY created_at DESC`,
        [req.params.familyId]
      );
      const items = r.rows.map(row => ({
        id: row.id,
        email: row.invited_email,
        role: row.invited_role,
        status: statusOf(row),
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
      }));
      res.json({ invitations: items });
    } catch (e) {
      console.error("[invitations/list]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/families/:familyId/invitations/:id/revoke
// ---------------------------------------------------------------------------
router.post("/:familyId/invitations/:id/revoke",
  requireAuth, requireEmailVerified, requireFamily, requireOwnFamily("familyId"), requireParent,
  async (req, res) => {
    try {
      const r = await query(
        `UPDATE family_invitations
         SET revoked_at = now()
         WHERE id=$1 AND family_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL
         RETURNING id`,
        [req.params.id, req.params.familyId]
      );
      if (!r.rowCount) return res.status(404).json({ error: "invitacion_no_revocable" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[invitations/revoke]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/families/:familyId/invitations/:id/resend
// ---------------------------------------------------------------------------
router.post("/:familyId/invitations/:id/resend",
  requireAuth, requireEmailVerified, requireFamily, requireOwnFamily("familyId"), requireParent, inviteLimiter,
  async (req, res) => {
    try {
      const r = await query(
        `SELECT id, invited_email, invited_role, expires_at, accepted_at, revoked_at
         FROM family_invitations WHERE id=$1 AND family_id=$2`,
        [req.params.id, req.params.familyId]
      );
      const inv = r.rows[0];
      if (!inv) return res.status(404).json({ error: "invitacion_no_existe" });
      if (inv.accepted_at || inv.revoked_at) return res.status(400).json({ error: "invitacion_no_reenviables" });

      // Renueva token (invalida el anterior) y extiende expiración
      const hours = parseInt(process.env.INVITATION_EXPIRES_HOURS || "168", 10);
      const { raw, hash } = generateOpaqueToken();
      const u = await query(
        `UPDATE family_invitations
         SET token_hash=$1, expires_at=now() + ($2 || ' hours')::interval
         WHERE id=$3 RETURNING expires_at`,
        [hash, String(hours), inv.id]
      );

      const fam = await getFamilyById(req.params.familyId);
      const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
      const acceptUrl = `${appUrl}/#/invite?token=${raw}`;
      await emailService.sendInvitationEmail({
        to: inv.invited_email,
        familyName: fam.name,
        inviterName: req.user.displayName,
        role: inv.invited_role,
        acceptUrl,
        expiresAt: u.rows[0].expires_at,
      });

      res.json({ ok: true });
    } catch (e) {
      console.error("[invitations/resend]", e);
      res.status(500).json({ error: "error_servidor" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/invitations/preview/:token   (PÚBLICO — sin auth)
// Devuelve info mínima para que la pantalla de aceptación tenga contexto.
// ---------------------------------------------------------------------------
const publicRouter = express.Router();

publicRouter.get("/preview/:token", async (req, res) => {
  try {
    const hash = hashOpaqueToken(String(req.params.token || ""));
    const r = await query(
      `SELECT fi.invited_email, fi.invited_role, fi.expires_at, fi.accepted_at, fi.revoked_at,
              f.name AS family_name,
              up.display_name AS inviter_name
       FROM family_invitations fi
       JOIN families f ON f.id = fi.family_id
       LEFT JOIN user_profiles up ON up.user_id = fi.created_by_user_id
       WHERE fi.token_hash=$1`,
      [hash]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: "invitacion_no_existe" });
    const status = statusOf(row);
    res.json({
      familyName: row.family_name,
      invitedEmail: row.invited_email,
      role: row.invited_role,
      inviterName: row.inviter_name,
      expiresAt: row.expires_at,
      status,
    });
  } catch (e) {
    console.error("[invitations/preview]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/invitations/accept { token } (requiere auth)
// ---------------------------------------------------------------------------
publicRouter.post("/accept", requireAuth, requireEmailVerified, async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "token_requerido" });

    const result = await tx(async (c) => {
      const hash = hashOpaqueToken(token);
      const r = await c.query(
        `SELECT id, family_id, invited_email, invited_role,
                expires_at, accepted_at, revoked_at
         FROM family_invitations WHERE token_hash=$1 FOR UPDATE`,
        [hash]
      );
      const inv = r.rows[0];
      if (!inv) throw new Error("token_invalido");
      if (inv.revoked_at) throw new Error("invitacion_revocada");
      if (inv.accepted_at) throw new Error("invitacion_ya_aceptada");
      if (new Date(inv.expires_at) < new Date()) throw new Error("token_expirado");

      // El email del usuario autenticado debe coincidir con el invitado
      if (req.user.email.toLowerCase() !== inv.invited_email.toLowerCase()) {
        throw new Error("email_no_coincide");
      }

      // El usuario no puede estar ya en otra familia (v1)
      const inOther = await c.query(
        "SELECT 1 FROM family_members WHERE user_id=$1 AND status='active'",
        [req.user.id]
      );
      if (inOther.rowCount) throw new Error("ya_en_familia");

      // Ajustar el rol del perfil si era distinto (ej: registrado sin rol)
      await c.query(
        `UPDATE user_profiles SET role=$1, onboarding_completed=true WHERE user_id=$2`,
        [inv.invited_role, req.user.id]
      );

      await c.query(
        `INSERT INTO family_members (family_id, user_id, role_in_family)
         VALUES ($1, $2, $3)`,
        [inv.family_id, req.user.id, inv.invited_role]
      );

      await c.query(
        `UPDATE family_invitations SET accepted_at=now() WHERE id=$1`, [inv.id]);

      return { familyId: inv.family_id, role: inv.invited_role };
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    const known = ["token_invalido", "invitacion_revocada", "invitacion_ya_aceptada",
                   "token_expirado", "email_no_coincide", "ya_en_familia"];
    if (known.includes(e.message)) return res.status(400).json({ error: e.message });
    console.error("[invitations/accept]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

module.exports = { router, publicRouter };
