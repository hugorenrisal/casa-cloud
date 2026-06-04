// ============================================================================
//  BACKUP: Endpoints de verificación de email (desactivados temporalmente).
//  Para reactivar:
//  1. Copiar servicios/emailService.js de este directorio de vuelta a services/
//  2. Pegar estas rutas en routes/auth.js (después del handler de register)
//  3. Revertir requireEmailVerified en middleware/requireAuth.js (quitar el passthrough)
//  4. Revertir el INSERT en register (quitar email_verified_at = now())
//  5. Revertir el bloqueo en login (descomentar el check de email_verified_at)
//  6. Revertir bootstrap en index.html (añadir el check de ME.emailVerified)
// ============================================================================

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
