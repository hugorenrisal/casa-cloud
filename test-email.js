// ============================================================================
//  test-email.js — Verifica que Resend está configurado correctamente.
//  Uso: node test-email.js tu@email.com
//  Envía un email de prueba y muestra el resultado en consola.
// ============================================================================
require("dotenv").config();
const { Resend } = require("resend");

const to = process.argv[2];
if (!to) {
  console.error("❌ Uso: node test-email.js tu@email.com");
  process.exit(1);
}

const key = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

if (!key) {
  console.error("❌ RESEND_API_KEY no definida en .env");
  process.exit(1);
}

console.log("🔑 API key encontrada:", key.slice(0, 8) + "...");
console.log("📧 Remitente:", from);
console.log("📬 Destinatario:", to);
console.log("Enviando email de prueba...\n");

const resend = new Resend(key);

resend.emails.send({
  from,
  to,
  subject: "✅ Casa Cloud — test de email",
  html: `
    <div style="font-family:Arial,sans-serif;padding:24px;background:#fef6ea;border-radius:12px">
      <h2 style="color:#ff7a59">🏠 Casa Cloud</h2>
      <p>Si recibes este email, <strong>Resend está configurado correctamente</strong>.</p>
      <p style="color:#9c8a76;font-size:12px">Test enviado desde test-email.js</p>
    </div>
  `,
  text: "Casa Cloud: test de email. Si recibes esto, Resend funciona correctamente.",
}).then(result => {
  if (result.error) {
    console.error("❌ Error de Resend:");
    console.error("   Código:", result.error.statusCode || "?");
    console.error("   Mensaje:", result.error.message);
    if ((result.error.message || "").includes("not verified") || (result.error.message || "").includes("domain")) {
      console.error("\n💡 Solución: cambia EMAIL_FROM a: onboarding@resend.dev");
    }
    process.exit(1);
  }
  console.log("✅ Email enviado correctamente!");
  console.log("   ID:", result.data?.id);
  console.log("   Revisa la bandeja de entrada de:", to);
  console.log("   (y la carpeta de spam por si acaso)\n");
}).catch(e => {
  console.error("❌ Excepción:", e.message);
  if (e.message.includes("API") || e.message.includes("401") || e.message.includes("403")) {
    console.error("💡 La API key puede ser incorrecta. Verifica en https://resend.com/api-keys");
  }
  process.exit(1);
});
