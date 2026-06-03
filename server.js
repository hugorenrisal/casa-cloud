// ============================================================================
//  Servidor "Casa" — estado familiar compartido
//  Persiste en PostgreSQL (Neon) si está configurado; si no, en archivo local.
// ============================================================================
const express = require("express");
const path = require("path");
const storage = require("./storage");

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

function seed() {
  const now = new Date();
  return {
    view: "desk", profile: "parent",
    currentMonth: now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0"),
    currentWeek: null,
    rate: 0.05, fixedPay: 8,
    members: [
      { id: "ana", name: "Ana", role: "child", color: "#e0588f", load: "normal" },
      { id: "leo", name: "Leo", role: "child", color: "#2f9fd0", load: "reducida" },
      { id: "mia", name: "Mía", role: "child", color: "#2fae73", load: "normal" },
    ],
    fixedTasks: [
      { id: "f1", name: "Hacer la cama", icon: "\u{1F6CF}\uFE0F", freq: "daily" },
      { id: "f2", name: "Recoger tu plato", icon: "\u{1F37D}\uFE0F", freq: "daily" },
      { id: "f3", name: "Preparar la mochila", icon: "\u{1F392}", freq: "daily" },
      { id: "f4", name: "Poner una lavadora", icon: "\u{1F9FA}", freq: "weekly" },
    ],
    extraTasks: [
      { id: "e1", name: "Limpiar el ba\u00F1o", points: 40, icon: "\u{1F6C1}" },
      { id: "e2", name: "Aspirar el sal\u00F3n", points: 25, icon: "\u{1F9F9}" },
      { id: "e3", name: "Poner la lavadora", points: 20, icon: "\u{1F9FA}" },
      { id: "e4", name: "Sacar la basura", points: 10, icon: "\u{1F5D1}\uFE0F" },
      { id: "e5", name: "Pasear al perro", points: 15, icon: "\u{1F415}" },
    ],
    fixedState: {}, extras: [], generated: false,
    monthPoints: { ana: 0, leo: 0, mia: 0 },
    streak: { ana: 4, leo: 2, mia: 6 },
    history: {},
    dishes: ["Pasta con tomate", "Pollo al horno", "Lentejas", "Pescado y verdura", "Pizza casera", "Hamburguesas", "Arroz al horno", "Tortilla francesa", "Ensalada C\u00E9sar", "Macarrones", "Sopa y croquetas", "Tacos"],
    menu: { Lun: "Pasta con tomate", Mar: "Pollo al horno", "Mi\u00E9": "Lentejas", Jue: "Pescado y verdura", Vie: "Pizza casera", "S\u00E1b": "Hamburguesas", Dom: "Arroz al horno" },
    rewards: [
      { id: "r1", title: "1 h m\u00E1s de pantalla", cost: 60, type: "Tiempo" },
      { id: "r2", title: "Elegir la peli del finde", cost: 40, type: "Privilegio" },
      { id: "r3", title: "Noche sin tareas", cost: 120, type: "Privilegio" },
    ],
    listings: [], offers: [], marketLog: [],
  };
}

function valid(s) {
  return s && typeof s === "object" && Array.isArray(s.members) && Array.isArray(s.fixedTasks);
}

app.get("/api/state", async (req, res) => {
  try {
    let s = await storage.get();
    if (!s) { s = seed(); await storage.set(s); }
    res.json(s);
  } catch (e) { res.status(500).json({ error: "no se pudo leer el estado" }); }
});

app.put("/api/state", async (req, res) => {
  if (!valid(req.body)) return res.status(400).json({ error: "estado no v\u00E1lido" });
  try { await storage.set(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: "no se pudo guardar" }); }
});

app.post("/api/reset", async (req, res) => {
  try { const s = seed(); await storage.set(s); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: "no se pudo reiniciar" }); }
});

// Descargar copia de seguridad
app.get("/api/backup", async (req, res) => {
  try {
    const s = (await storage.get()) || seed();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", 'attachment; filename="casa-copia-' + stamp + '.json"');
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(s, null, 2));
  } catch (e) { res.status(500).json({ error: "no se pudo exportar" }); }
});

// Restaurar copia de seguridad
app.post("/api/restore", async (req, res) => {
  if (!valid(req.body)) return res.status(400).json({ error: "copia no v\u00E1lida" });
  try { await storage.set(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: "no se pudo restaurar" }); }
});

const PORT = process.env.PORT || 3000;
storage.init()
  .then(() => app.listen(PORT, () => console.log("Casa escuchando en el puerto " + PORT)))
  .catch((e) => { console.error("Error al iniciar el almacenamiento:", e.message); process.exit(1); });
