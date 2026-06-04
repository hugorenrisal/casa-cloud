// ============================================================================
//  Rutas de autenticación: register, login, logout, me, verify, forgot/reset.
// ============================================================================
const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, tx } = require("../db");
const {
  hashPassword, comparePassword, signJwt,
  generateOpaqueToken, hashOpaqueToken,
  isValidEmail, normalizeEmail, isValidPassword,
  authCookieOptions, AUTH_COOKIE_NAME,
} = require("../services/authService");
const emailService = require("../services/emailService");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "demasiados_intentos" },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  message: { error: "demasiados_registros" },
});
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { error: "demasiadas_solicitudes" },
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const displayName = String(req.body?.displayName || "").trim().slice(0, 60);

    if (!isValidEmail(email)) return res.status(400).json({ error: "email_invalido" });
    if (!isValidPassword(password)) return res.status(400).json({ error: "password_corta_min_8" });
    if (!displayName) return res.status(400).json({ error: "nombre_requerido" });

    // ¿Existe ya?
    const exists = await query("SELECT 1 FROM users WHERE LOWER(email) = $1", [email]);
    if (exists.rowCount) return res.status(409).json({ error: "email_ya_registrado" });

    const pwdHash = await hashPassword(password);
    const verifyHours = parseInt(process.env.VERIFY_TOKEN_EXPIRES_HOURS || "24", 10);
    const { raw: rawToken, hash: tokenHash } = generateOpaqueToken();

    await tx(async (c) => {
      const u = await c.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email, pwdHash]
      );
      const uid = u.rows[0].id;
      await c.query(
        "INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)",
        [uid, displayName]
      );
      await c.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
        [uid, tokenHash, String(verifyHours)]
      );
    });

    const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
    const link = `${appUrl}/#/verify?token=${rawToken}`;
    await emailService.sendVerificationEmail({ to: email, displayName, verifyUrl: link });

    res.status(201).json({ ok: true, requiresEmailVerification: true });
  } catch (e) {
    console.error("[auth/register]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email
// ---------------------------------------------------------------------------
router.post("/verify-email", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "token_requerido" });
    const hash = hashOpaqueToken(token);

    const r = await query(
      `SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash=$1`,
      [hash]
    );
    const row = r.rows[0];
    if (!row) return res.status(400).json({ error: "token_invalido" });
    if (row.used_at) return res.status(400).json({ error: "token_ya_usado" });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: "token_expirado" });

    await tx(async (c) => {
      await c.query("UPDATE users SET email_verified_at = now() WHERE id=$1", [row.user_id]);
      await c.query("UPDATE email_verification_tokens SET used_at=now() WHERE id=$1", [row.id]);
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("[auth/verify-email]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verify
// ---------------------------------------------------------------------------
router.post("/resend-verify", forgotLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: "email_invalido" });

    const r = await query(
      `SELECT u.id, u.email_verified_at, up.display_name
       FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id
       WHERE LOWER(u.email)=$1`,
      [email]
    );
    // Respondemos OK incluso si no existe (evita enumeración)
    if (!r.rows[0] || r.rows[0].email_verified_at) return res.json({ ok: true });

    const user = r.rows[0];
    const { raw, hash } = generateOpaqueToken();
    const hours = parseInt(process.env.VERIFY_TOKEN_EXPIRES_HOURS || "24", 10);
    await query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
      [user.id, hash, String(hours)]
    );

    const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
    const link = `${appUrl}/#/verify?token=${raw}`;
    await emailService.sendVerificationEmail({
      to: email, displayName: user.display_name || "", verifyUrl: link,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[auth/resend-verify]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!isValidEmail(email)) return res.status(400).json({ error: "email_invalido" });
    if (!password) return res.status(400).json({ error: "password_requerida" });

    const r = await query(
      `SELECT u.id, u.password_hash, u.email_verified_at,
              up.role, up.onboarding_completed,
              fm.family_id, fm.role_in_family
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id=u.id
       LEFT JOIN family_members fm ON fm.user_id=u.id AND fm.status='active'
       WHERE LOWER(u.email)=$1`,
      [email]
    );
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: "credenciales_invalidas" });

    const ok = await comparePassword(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "credenciales_invalidas" });

    if (!u.email_verified_at) {
      return res.status(403).json({ error: "email_no_verificado" });
    }

    const token = signJwt({
      sub: u.id, role: u.role || null, familyId: u.family_id || null,
    });
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.json({
      ok: true,
      user: {
        id: u.id, email,
        role: u.role, onboardingCompleted: !!u.onboarding_completed,
        familyId: u.family_id || null, roleInFamily: u.role_in_family || null,
      },
    });
  } catch (e) {
    console.error("[auth/login]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...authCookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ error: "email_invalido" });

    const r = await query(
      `SELECT u.id, up.display_name FROM users u
       LEFT JOIN user_profiles up ON up.user_id=u.id
       WHERE LOWER(u.email)=$1`,
      [email]
    );
    // Siempre 200 OK (evita enumeración de cuentas)
    if (!r.rows[0]) return res.json({ ok: true });

    const user = r.rows[0];
    const { raw, hash } = generateOpaqueToken();
    const mins = parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || "60", 10);
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [user.id, hash, String(mins)]
    );

    const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
    const link = `${appUrl}/#/reset-password?token=${raw}`;
    await emailService.sendPasswordResetEmail({
      to: email, displayName: user.display_name || "", resetUrl: link, expiresMinutes: mins,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[auth/forgot-password]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------
router.post("/reset-password", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.password || "");
    if (!token) return res.status(400).json({ error: "token_requerido" });
    if (!isValidPassword(newPassword)) return res.status(400).json({ error: "password_corta_min_8" });

    const hash = hashOpaqueToken(token);
    const r = await query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash=$1`,
      [hash]
    );
    const row = r.rows[0];
    if (!row) return res.status(400).json({ error: "token_invalido" });
    if (row.used_at) return res.status(400).json({ error: "token_ya_usado" });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: "token_expirado" });

    const newHash = await hashPassword(newPassword);
    await tx(async (c) => {
      await c.query("UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2",
        [newHash, row.user_id]);
      await c.query("UPDATE password_reset_tokens SET used_at=now() WHERE id=$1", [row.id]);
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("[auth/reset-password]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

module.exports = router;
