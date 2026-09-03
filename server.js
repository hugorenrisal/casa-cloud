// ============================================================================
//  Servidor "Casa" — app privada de una sola casa, sin cuentas.
//
//  No hay registro, ni contraseñas, ni email, ni sesiones. Los cuatro perfiles
//  (Hugo, Marcos, Carla y el Dashboard de los Papás) están fijados en
//  public/perfiles.js y el estado vive en una única fila de PostgreSQL.
//
//  Es deliberado: quien abre la app elige perfil y entra. Ver el comentario de
//  cabecera de routes/state.js para el porqué y sus límites.
// ============================================================================
require("dotenv").config();

const express = require("express");
const path = require("path");

const { hasDatabase } = require("./db");
const { runMigrations } = require("./db/schema");

const stateRoutes = require("./routes/state");

const app = express();

// Necesario detrás de proxies (Render, Heroku) para que las IPs de los logs
// sean las reales y no la del proxy.
app.set("trust proxy", 1);

app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Salud
app.get("/api/health", (req, res) => res.json({ ok: true, db: hasDatabase() }));

// ---------------------------------------------------------------------------
//  Demo pública (/demo)
//  Sirve la misma aplicación, pero el cliente carga demo.js, que sustituye la
//  capa de red por datos de ejemplo en memoria. Sirve para enseñar la app sin
//  tocar los datos de casa: en modo demo el navegador no llama a la API.
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
app.use("/api", stateRoutes);   // /api/state, /api/reset, /api/backup, /api/restore

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
      console.warn("    La app no podrá guardar nada.");
      console.warn("    Configura PostgreSQL (Neon recomendado) en .env\n");
    } else {
      await runMigrations();
    }
    app.listen(PORT, () => console.log(`Casa escuchando en :${PORT}`));
  } catch (e) {
    console.error("Error al arrancar:", e);
    process.exit(1);
  }
})();
