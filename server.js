// ============================================================================
//  Servidor "Casa Cloud" — autenticación real + familias + invitaciones.
//  - Auth propia (bcrypt + JWT en cookie httpOnly).
//  - Emails transaccionales vía Resend (o consola si falta API key).
//  - Persistencia en PostgreSQL (DATABASE_URL requerido en producción).
// ============================================================================
require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const { hasDatabase } = require("./db");
const { runMigrations } = require("./db/schema");

const authRoutes = require("./routes/auth");
const onboardingRoutes = require("./routes/onboarding");
const familiesRoutes = require("./routes/families");
const { router: invitationsRoutes, publicRouter: publicInvRoutes } = require("./routes/invitations");
const stateRoutes = require("./routes/state");

const app = express();

// Necesario detrás de proxies (Render, Heroku) para cookies Secure y rate-limit por IP.
app.set("trust proxy", 1);

app.use(express.json({ limit: "4mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Salud
app.get("/api/health", (req, res) => res.json({ ok: true, db: hasDatabase() }));

// ---------------------------------------------------------------------------
//  Demo pública (/demo)
//  Sirve la misma aplicación, pero el cliente carga demo.js, que sustituye la
//  capa de red por datos de ejemplo en memoria. Sirve para enseñar la app sin
//  dar contraseñas. No toca la base de datos ni salta ninguna comprobación de
//  sesión: en modo demo el navegador no llega a llamar a la API.
// ---------------------------------------------------------------------------
app.get("/demo", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------------------------------------------------------------
//  Verificación de dominio para la app de Android (TWA).
//  Es lo que permite que la app instalada abra a pantalla completa en vez de
//  con la barra del navegador. La huella SHA-256 la da Google Play DESPUÉS de
//  subir la app por primera vez; se pone en la variable de entorno
//  ANDROID_FINGERPRINT para no tener que tocar el código.
//  Ruta pública a propósito: Google la lee sin estar autenticado.
// ---------------------------------------------------------------------------
app.get("/.well-known/assetlinks.json", (req, res) => {
  const huella = (process.env.ANDROID_FINGERPRINT || "").trim();
  const paquete = process.env.ANDROID_PACKAGE || "com.casa.tareas";
  res.type("application/json");
  if (!huella) {
    return res.status(503).json({
      error: "Falta ANDROID_FINGERPRINT",
      comoArreglarlo:
        "Play Console -> Integridad de la app -> copia el SHA-256 de la clave de firma " +
        "y pegalo en la variable de entorno ANDROID_FINGERPRINT del servidor.",
    });
  }
  res.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: paquete,
      sha256_cert_fingerprints: huella.split(",").map((h) => h.trim()).filter(Boolean),
    },
  }]);
});

// API
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/families", familiesRoutes);
app.use("/api/families", invitationsRoutes);     // /api/families/:familyId/invitations/...
app.use("/api/invitations", publicInvRoutes);    // /api/invitations/preview/:token, /api/invitations/accept
app.use("/api", stateRoutes);                    // /api/state, /api/reset, /api/backup, /api/restore

// 404 para rutas /api desconocidas
app.use("/api", (req, res) => res.status(404).json({ error: "no_encontrado" }));

// Manejador final
app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "error_servidor" });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    if (!hasDatabase()) {
      console.warn("\n⚠️  DATABASE_URL no configurada.");
      console.warn("    Auth, familias e invitaciones NO funcionarán.");
      console.warn("    Configura PostgreSQL (Neon recomendado) en .env\n");
    } else {
      await runMigrations();
    }
    app.listen(PORT, () => console.log(`Casa Cloud escuchando en :${PORT}`));
  } catch (e) {
    console.error("Error al arrancar:", e);
    process.exit(1);
  }
})();
