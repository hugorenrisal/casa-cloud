// ============================================================================
//  test-email.js — Verifica que Gmail SMTP está configurado correctamente.
//  Uso: node test-email.js tu@email.com
//  Envía un email de prueba y muestra el resultado en consola.
// ============================================================================
require("dotenv").config();
const nodemailer = require("nodemailer");

const to = process.argv[2];
if (!to) {
  console.error("❌ Uso: node test-email.js tu@email.com");
  process.exit(1);
}

const usuario = process.env.GMAIL_USER;
const clave = process.env.GMAIL_APP_PASSWORD;
const from = process.env.EMAIL_FROM || (usuario ? `Casa <${usuario}>` : "");

if (!usuario || !clave) {
  console.error("❌ Falta GMAIL_USER o GMAIL_APP_PASSWORD en .env");
  console.error("   Genera la contraseña de aplicación en: https://myaccount.google.com/apppasswords");
  process.exit(1);
}

console.log("👤 Cuenta Gmail:", usuario);
console.log("📧 Remitente:", from);
console.log("📬 Destinatario:", to);
console.log("Enviando email de prueba...\n");

const transportador = nodemailer.createTransport({
  service: "gmail",
  auth: { user: usuario, pass: clave },
});

transportador.sendMail({
  from, to,
  subject: "✅ Casa Cloud — test de email",
  html: `
    <div style="font-family:Arial,sans-serif;padding:24px;background:#fef6ea;border-radius:12px">
      <h2 style="color:#ff7a59">🏠 Casa Cloud</h2>
      <p>Si recibes este email, <strong>Gmail SMTP está configurado correctamente</strong>.</p>
      <p style="color:#9c8a76;font-size:12px">Test enviado desde test-email.js</p>
    </div>
  `,
  text: "Casa Cloud: test de email. Si recibes esto, Gmail SMTP funciona correctamente.",
}).then(info => {
  console.log("✅ Email enviado correctamente!");
  console.log("   ID:", info.messageId);
  console.log("   Revisa la bandeja de entrada de:", to);
  console.log("   (y la carpeta de spam por si acaso)\n");
}).catch(e => {
  console.error("❌ Error:", e.message);
  if (/invalid login|username and password/i.test(e.message)) {
    console.error("\n💡 Gmail rechazó las credenciales. Comprueba:");
    console.error("   - GMAIL_USER es la dirección completa (tunombre@gmail.com)");
    console.error("   - GMAIL_APP_PASSWORD es una contraseña de APLICACIÓN de 16 letras,");
    console.error("     no la contraseña normal de la cuenta");
    console.error("   - La verificación en dos pasos está activada en la cuenta");
  }
  process.exit(1);
});
