// ============================================================================
//  Servicio de email transaccional vía Resend.
//  Si RESEND_API_KEY no está definida, los emails se imprimen en consola
//  (útil en desarrollo). En producción siempre debe estar configurado.
// ============================================================================
let resendClient = null;

function getResend() {
  if (resendClient !== null) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    resendClient = false; // marca como "no configurado"
    return false;
  }
  const { Resend } = require("resend");
  resendClient = new Resend(apiKey);
  return resendClient;
}

function esc(s) {
  return String(s || "").replace(/[<>&"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

// Extrae URLs de un texto plano (para mostrarlas en consola cuando no hay SMTP real).
function extractUrls(text) {
  return (text || "").match(/https?:\/\/[^\s]+/g) || [];
}

function logEmailToConsole({ to, from, subject, text }) {
  const urls = extractUrls(text);
  console.log("\n\x1b[33m╔══════════════════════════════════════════════╗\x1b[0m");
  console.log("\x1b[33m  📧 EMAIL (modo consola — sin Resend real)\x1b[0m");
  console.log("\x1b[33m╚══════════════════════════════════════════════╝\x1b[0m");
  console.log("  Para:", to);
  console.log("  De:", from);
  console.log("  Asunto:", subject);
  if (urls.length) {
    console.log("\n\x1b[32m  🔗 ENLACE (cópialo en el navegador):\x1b[0m");
    urls.forEach(u => console.log("\x1b[36m  " + u + "\x1b[0m"));
  } else {
    console.log("  Texto:", text);
  }
  console.log("\x1b[33m══════════════════════════════════════════════\x1b[0m\n");
}

async function sendMail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || "Casa <noreply@example.com>";
  const r = getResend();
  if (!r) {
    logEmailToConsole({ to, from, subject, text });
    return { ok: true, dev: true };
  }
  try {
    const result = await r.emails.send({ from, to, subject, html, text });
    if (result.error) {
      const errMsg = result.error?.message || JSON.stringify(result.error);
      const hint = errMsg.includes("not verified") || errMsg.includes("domain")
        ? "\n  ⚠️  El dominio del remitente no está verificado en Resend.\n  → EMAIL_FROM debe usar un dominio verificado en https://resend.com/domains\n  → Para pruebas sin dominio: EMAIL_FROM=onboarding@resend.dev (solo tu propio email)"
        : "";
      console.error("\x1b[31m[email] Error Resend:\x1b[0m", errMsg, hint);
      // Fallback: mostrar el enlace en consola aunque Resend falle,
      // para que el dev pueda completar el flujo sin email real.
      logEmailToConsole({ to, from, subject, text });
      return { ok: false, error: errMsg };
    }
    console.log("\x1b[32m[email] Enviado OK ✓\x1b[0m id=" + (result.data?.id || "?") + " to=" + to);
    return { ok: true, id: result.data?.id };
  } catch (e) {
    console.error("\x1b[31m[email] Excepción:\x1b[0m", e.message);
    logEmailToConsole({ to, from, subject, text });
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------
function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#fef6ea;font-family:Arial,sans-serif;color:#43352a">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="background:#fff;border:1.5px solid #efe1cc;border-radius:18px;padding:28px;box-shadow:0 8px 22px rgba(180,120,70,.10)">
        <h1 style="font-size:22px;margin:0 0 18px;color:#ff7a59">🏠 Casa</h1>
        <h2 style="font-size:18px;margin:0 0 14px">${title}</h2>
        ${body}
      </div>
      <p style="text-align:center;color:#9c8a76;font-size:11px;margin-top:18px">
        Si no esperabas este email, ignóralo. Tu cuenta sigue segura.
      </p>
    </div></body></html>`;
}
function btn(url, label) {
  return `<a href="${esc(url)}" style="display:inline-block;background:#ff7a59;color:#fff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:14px;margin:12px 0">${esc(label)}</a>`;
}

async function sendVerificationEmail({ to, displayName, verifyUrl }) {
  const body = `
    <p>¡Hola${displayName ? ", " + esc(displayName) : ""}!</p>
    <p>Para terminar de crear tu cuenta en Casa, confirma tu correo:</p>
    ${btn(verifyUrl, "Confirmar mi cuenta")}
    <p style="font-size:12px;color:#9c8a76">El enlace caduca en 24 horas.</p>
    <p style="font-size:11px;color:#9c8a76;word-break:break-all">O copia esta URL: ${esc(verifyUrl)}</p>`;
  return sendMail({
    to, subject: "Confirma tu cuenta en Casa",
    html: layout("Confirma tu correo", body),
    text: `Hola${displayName ? " " + displayName : ""}. Confirma tu correo: ${verifyUrl}`,
  });
}

async function sendInvitationEmail({ to, familyName, inviterName, role, acceptUrl, expiresAt }) {
  const roleLabel = role === "parent" ? "padre/madre" : "hijo/a";
  const expires = new Date(expiresAt).toLocaleString("es-ES");
  const body = `
    <p>${esc(inviterName || "Un familiar")} te ha invitado a unirte a la familia <b>${esc(familyName)}</b> en Casa, como <b>${esc(roleLabel)}</b>.</p>
    ${btn(acceptUrl, "Aceptar invitación")}
    <p style="font-size:12px;color:#9c8a76">El enlace caduca el ${esc(expires)}.</p>
    <p style="font-size:11px;color:#9c8a76;word-break:break-all">O copia esta URL: ${esc(acceptUrl)}</p>`;
  return sendMail({
    to, subject: `Te han invitado a unirte a ${familyName} en Casa`,
    html: layout("Tienes una invitación familiar", body),
    text: `${inviterName || "Un familiar"} te invita a unirte a ${familyName}. Acepta aquí: ${acceptUrl}`,
  });
}

async function sendPasswordResetEmail({ to, displayName, resetUrl, expiresMinutes }) {
  const body = `
    <p>Hola${displayName ? ", " + esc(displayName) : ""}.</p>
    <p>Has solicitado restablecer tu contraseña en Casa. Haz clic abajo para crear una nueva:</p>
    ${btn(resetUrl, "Restablecer contraseña")}
    <p style="font-size:12px;color:#9c8a76">El enlace caduca en ${expiresMinutes} minutos.</p>
    <p style="font-size:11px;color:#9c8a76;word-break:break-all">O copia esta URL: ${esc(resetUrl)}</p>`;
  return sendMail({
    to, subject: "Restablece tu contraseña en Casa",
    html: layout("Restablece tu contraseña", body),
    text: `Restablece tu contraseña: ${resetUrl}`,
  });
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
};
