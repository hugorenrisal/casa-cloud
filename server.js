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
