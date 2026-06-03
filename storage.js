// ============================================================================
//  Almacenamiento del estado familiar.
//  - Si existe DATABASE_URL (Neon/Postgres): guarda en la base de datos (permanente).
//  - Si no: guarda en un archivo local (cómodo para probar en tu ordenador).
//  La interfaz pública es la misma en ambos casos: init(), get(), set(s).
// ============================================================================
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
const DATA_FILE = path.join(__dirname, "data.json");

let mode = "file";
let pool = null;

async function init() {
  if (DATABASE_URL) {
    const { Pool } = require("pg");
    // Neon requiere SSL. rejectUnauthorized:false evita problemas de certificado.
    pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await pool.query(
      "CREATE TABLE IF NOT EXISTS app_state (id INT PRIMARY KEY, data JSONB NOT NULL)"
    );
    mode = "pg";
    console.log("Almacenamiento: PostgreSQL (datos permanentes).");
  } else {
    mode = "file";
    console.log("Almacenamiento: archivo local (sin base de datos configurada).");
  }
}

async function get() {
  if (mode === "pg") {
    const r = await pool.query("SELECT data FROM app_state WHERE id = 1");
    return r.rows[0] ? r.rows[0].data : null;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return null;
  }
}

async function set(state) {
  if (mode === "pg") {
    await pool.query(
      "INSERT INTO app_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1",
      [state]
    );
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(state));
}

module.exports = { init, get, set, getMode: () => mode };
