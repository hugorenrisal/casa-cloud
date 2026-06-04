// ============================================================================
//  emailService.js — STUB (verificación de email desactivada temporalmente).
//  Todas las funciones existen pero no envían nada.
//  El código original está en _email_disabled/emailService.js
// ============================================================================

async function sendMail({ to, subject }) {
  console.log("[email] STUB — envío desactivado. to=" + to + " subject=" + subject);
  return { ok: true, stub: true };
}

async function sendVerificationEmail({ to, displayName }) {
  console.log("[email] sendVerificationEmail stub — to=" + to);
  return { ok: true, stub: true };
}

async function sendInvitationEmail({ to, familyName, role }) {
  console.log("[email] sendInvitationEmail stub — to=" + to + " family=" + familyName + " role=" + role);
  return { ok: true, stub: true };
}

async function sendPasswordResetEmail({ to, displayName }) {
  console.log("[email] sendPasswordResetEmail stub — to=" + to);
  return { ok: true, stub: true };
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
};
