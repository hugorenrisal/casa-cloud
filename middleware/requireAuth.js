// ============================================================================
//  requireAuth: valida el JWT de la cookie httpOnly y rellena req.user.
//  req.user = { id, email, emailVerified, role, familyId, roleInFamily }
// ============================================================================
const { verifyJwt, AUTH_COOKIE_NAME } = require("../services/authService");
const { query } = require("../db");

async function requireAuth(req, res, next) {
  try {
    const raw = req.cookies && req.cookies[AUTH_COOKIE_NAME];
    if (!raw) return res.status(401).json({ error: "no_autenticado" });

    let payload;
    try { payload = verifyJwt(raw); }
    catch (e) { return res.status(401).json({ error: "sesion_invalida" }); }

    // Hidratamos el usuario desde la BD para tener datos frescos
    // (rol/familia pueden haber cambiado desde la emisión del token).
    const { rows } = await query(
      `SELECT u.id, u.email, u.email_verified_at,
              up.role, up.display_name, up.onboarding_completed,
              fm.family_id, fm.role_in_family
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN family_members fm ON fm.user_id = u.id AND fm.status = 'active'
       WHERE u.id = $1`,
      [payload.sub]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "usuario_no_existe" });

    req.user = {
      id: u.id,
      email: u.email,
      emailVerified: !!u.email_verified_at,
      displayName: u.display_name,
      role: u.role,                       // 'parent' | 'child' | null si onboarding incompleto
      onboardingCompleted: !!u.onboarding_completed,
      familyId: u.family_id || null,
      roleInFamily: u.role_in_family || null,
    };
    next();
  } catch (e) {
    console.error("[requireAuth]", e);
    res.status(500).json({ error: "error_servidor" });
  }
}

// Verificación de email desactivada temporalmente (passthrough).
// Para reactivar: restaurar el original desde _email_disabled/README.md
function requireEmailVerified(req, res, next) {
  next(); // STUB: sin bloqueo de email
}

function requireOnboarded(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "no_autenticado" });
  if (!req.user.role) return res.status(403).json({ error: "rol_no_elegido" });
  next();
}

module.exports = { requireAuth, requireEmailVerified, requireOnboarded };
