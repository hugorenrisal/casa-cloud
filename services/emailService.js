// ============================================================================
//  Servicio de email transaccional vía Gmail SMTP.
//  Envía con la cuenta de Gmail de la familia y su "contraseña de aplicación"
//  (GMAIL_USER + GMAIL_APP_PASSWORD). Sin dominio propio, sin verificación
//  de DNS: cualquier Gmail normal puede mandar así hasta ~500 correos/día,
//  de sobra para invitaciones familiares.
//  Si faltan las variables, los emails se imprimen en consola (desarrollo).
// ============================================================================
let transportador = null;

function getTransportador() {
  if (transportador !== null) return transportador;
  const usuario = process.env.GMAIL_USER;
  const clave = process.env.GMAIL_APP_PASSWORD;
  if (!usuario || !clave) {
    transportador = false; // marca como "no configurado"
    return false;
  }
  const nodemailer = require("nodemailer");
  transportador = nodemailer.createTransport({
    service: "gmail",
    auth: { user: usuario, pass: clave },
  });
  return transportador;
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
  console.log("\x1b[33m  📧 EMAIL (modo consola — sin Gmail configurado)\x1b[0m");
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
  const usuario = process.env.GMAIL_USER;
  const from = process.env.EMAIL_FROM || (usuario ? `Casa <${usuario}>` : "Casa <noreply@example.com>");
  const t = getTransportador();
  if (!t) {
    logEmailToConsole({ to, from, subject, text });
    return { ok: true, dev: true };
  }
  try {
    const info = await t.sendMail({ from, to, subject, html, text });
    console.log("\x1b[32m[email] Enviado OK ✓\x1b[0m id=" + (info.messageId || "?") + " to=" + to);
    return { ok: true, id: info.messageId };
  } catch (e) {
    const hint = /invalid login|username and password/i.test(e.message || "")
      ? "\n  ⚠️  Gmail rechazó las credenciales.\n" +
        "  → GMAIL_USER debe ser la dirección completa (tunombre@gmail.com).\n" +
        "  → GMAIL_APP_PASSWORD debe ser una CONTRASEÑA DE APLICACIÓN (16 letras),\n" +
        "    no la contraseña normal de la cuenta. Se genera en\n" +
        "    https://myaccount.google.com/apppasswords (requiere verificación en dos pasos activada)."
      : "";
    console.error("\x1b[31m[email] Error Gmail:\x1b[0m", e.message, hint);
    // Fallback: mostrar el enlace en consola aunque Gmail falle,
    // para que se pueda completar el flujo copiándolo a mano mientras tanto.
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
