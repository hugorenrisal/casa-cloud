// ============================================================================
//  Servicio de familias: creación, miembros, estado inicial.
// ============================================================================
const { query, tx } = require("../db");

// Seed mínimo para family_state nuevo (no incluye hijos hardcoded;
// los hijos llegan por invitación y se registran como users).
function emptyFamilyState() {
  const now = new Date();
  const dish = (id, name, type, tags) => ({ id, name, type, tags: tags || [] });
  return {
    currentMonth: now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0"),
    currentWeek: null,
    rate: 0.05, fixedPay: 8,
    members: [],            // se sincroniza con family_members en cada GET
    fixedTasks: [
      { id: "f1", name: "Hacer la cama", icon: "🛏️", freq: "daily" },
      { id: "f2", name: "Recoger tu plato", icon: "🍽️", freq: "daily" },
      { id: "f3", name: "Preparar la mochila", icon: "🎒", freq: "daily" },
      { id: "f4", name: "Poner una lavadora", icon: "🧺", freq: "weekly" },
    ],
    extraTasks: [
      { id: "e1", name: "Limpiar el baño", points: 40, icon: "🛁" },
      { id: "e2", name: "Aspirar el salón", points: 25, icon: "🧹" },
      { id: "e3", name: "Poner la lavadora", points: 20, icon: "🧺" },
      { id: "e4", name: "Sacar la basura", points: 10, icon: "🗑️" },
      { id: "e5", name: "Pasear al perro", points: 15, icon: "🐕" },
    ],
    fixedState: {}, extras: [], generated: false,
    streak: {}, history: {},
    dishes: [
      dish("d1", "Tostadas con tomate", "desayuno", ["rápido"]),
      dish("d2", "Yogur con cereales", "desayuno", ["rápido"]),
      dish("d3", "Pasta con tomate", "comida", ["vegetariano"]),
      dish("d4", "Pollo al horno", "comida", []),
      dish("d5", "Lentejas", "comida", ["legumbres", "vegetariano"]),
      dish("d6", "Tortilla francesa", "cena", ["rápido", "vegetariano"]),
      dish("d7", "Ensalada César", "cena", []),
    ],
    menu: {
      Lun: { desayuno: "", comida: "", cena: "" },
      Mar: { desayuno: "", comida: "", cena: "" },
      "Mié": { desayuno: "", comida: "", cena: "" },
      Jue: { desayuno: "", comida: "", cena: "" },
      Vie: { desayuno: "", comida: "", cena: "" },
      "Sáb": { desayuno: "", comida: "", cena: "" },
      Dom: { desayuno: "", comida: "", cena: "" },
    },
    rewards: [
      { id: "r1", title: "1 h más de pantalla", cost: 60, type: "Tiempo", stock: null, active: true },
      { id: "r2", title: "Elegir la peli del finde", cost: 40, type: "Privilegio", stock: 1, active: true },
    ],
    redemptions: [],
    listings: [], offers: [], marketLog: [],
  };
}

// ---------------------------------------------------------------------------
//  Relleno de las casillas de tareas fijas.
//
//  Lo hace el SERVIDOR para que el estado que entrega venga ya completo.
//  Antes lo rellenaba solo el cliente y no lo guardaba: el sondeo veía
//  diferencia contra el servidor en cada vuelta, adoptaba el remoto, volvía a
//  rellenar... y la pantalla se repintaba cada 4 segundos sin parar.
//
//  Devuelve true si ha cambiado algo, para poder guardarlo.
// ---------------------------------------------------------------------------
function ensureFixedShape(state) {
  let cambio = false;
  if (!state.fixedState || typeof state.fixedState !== "object") {
    state.fixedState = {}; cambio = true;
  }
  const hijos = (state.members || []).filter((m) => m.role === "child");
  const tareas = state.fixedTasks || [];

  hijos.forEach((c) => {
    if (!state.fixedState[c.id]) { state.fixedState[c.id] = {}; cambio = true; }
    tareas.forEach((t) => {
      const cur = state.fixedState[c.id][t.id];
      const quiereDias = t.freq !== "weekly";
      if (!cur || quiereDias !== Array.isArray(cur.days)) {
        state.fixedState[c.id][t.id] = quiereDias
          ? { days: [false, false, false, false, false, false, false] }
          : { status: "pending" };
        cambio = true;
      }
    });
    // Tareas que ya no existen en el catálogo
    Object.keys(state.fixedState[c.id]).forEach((taskId) => {
      if (!tareas.some((t) => t.id === taskId)) {
        delete state.fixedState[c.id][taskId]; cambio = true;
      }
    });
  });

  // Casillas de miembros que ya no están en la familia
  Object.keys(state.fixedState).forEach((id) => {
    if (!hijos.some((c) => c.id === id)) { delete state.fixedState[id]; cambio = true; }
  });

  return cambio;
}

// Sincroniza el array S.members con los miembros reales de la BD.
// Devuelve el state con members "frescos" (sin tocar fixedState/extras).
function syncMembers(state, dbMembers) {
  const COLORS = ["#e0588f", "#2f9fd0", "#2fae73", "#ff7a59", "#8b6fd6", "#f59331"];
  const out = { ...state };
  out.members = dbMembers.map((m, i) => ({
    id: m.user_id,
    name: m.display_name,
    role: m.role_in_family,
    color: m.avatar_color || COLORS[i % COLORS.length],
    load: (state.members?.find(x => x.id === m.user_id) || {}).load || "normal",
  }));
  return out;
}

async function createFamilyForUser({ userId, familyName }) {
  if (!familyName || familyName.length < 2) throw new Error("nombre_familia_invalido");
  return tx(async (c) => {
    // Verificar que el usuario no está ya en otra familia
    const existing = await c.query(
      "SELECT 1 FROM family_members WHERE user_id=$1 AND status='active'", [userId]);
    if (existing.rowCount) throw new Error("ya_en_familia");
    // Verificar rol parent
    const prof = await c.query("SELECT role FROM user_profiles WHERE user_id=$1", [userId]);
    if (prof.rows[0]?.role !== "parent") throw new Error("solo_padres_crean");

    const fam = await c.query(
      "INSERT INTO families (name, created_by_user_id) VALUES ($1, $2) RETURNING id, name",
      [familyName, userId]
    );
    const familyId = fam.rows[0].id;

    await c.query(
      `INSERT INTO family_members (family_id, user_id, role_in_family) VALUES ($1, $2, 'parent')`,
      [familyId, userId]
    );

    await c.query(
      `INSERT INTO family_state (family_id, data) VALUES ($1, $2::jsonb)`,
      [familyId, JSON.stringify(emptyFamilyState())]
    );

    await c.query(
      `UPDATE user_profiles SET onboarding_completed=true WHERE user_id=$1`, [userId]);

    return { familyId, familyName: fam.rows[0].name };
  });
}

async function listMembers(familyId) {
  const r = await query(
    `SELECT fm.user_id, fm.role_in_family, fm.status, fm.joined_at,
            u.email, up.display_name, up.avatar_color
     FROM family_members fm
     JOIN users u ON u.id = fm.user_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     WHERE fm.family_id=$1 AND fm.status='active'
     ORDER BY fm.joined_at ASC`,
    [familyId]
  );
  return r.rows;
}

async function getFamilyById(familyId) {
  const r = await query(`SELECT id, name, created_by_user_id, created_at FROM families WHERE id=$1`,
    [familyId]);
  return r.rows[0] || null;
}

async function removeMember({ familyId, userId, byUserId }) {
  // No permitir quitarse a uno mismo si es el último padre
  return tx(async (c) => {
    const target = await c.query(
      "SELECT role_in_family FROM family_members WHERE family_id=$1 AND user_id=$2 AND status='active'",
      [familyId, userId]
    );
    if (!target.rowCount) throw new Error("miembro_no_existe");
    if (target.rows[0].role_in_family === "parent") {
      const parents = await c.query(
        "SELECT COUNT(*) FROM family_members WHERE family_id=$1 AND role_in_family='parent' AND status='active'",
        [familyId]
      );
      if (parseInt(parents.rows[0].count, 10) <= 1) throw new Error("no_dejar_familia_sin_padres");
    }
    await c.query(
      "DELETE FROM family_members WHERE family_id=$1 AND user_id=$2", [familyId, userId]);
    return { ok: true };
  });
}

module.exports = {
  emptyFamilyState,
  ensureFixedShape,
  syncMembers,
  createFamilyForUser,
  listMembers,
  getFamilyById,
  removeMember,
};
