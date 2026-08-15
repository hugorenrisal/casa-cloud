// ============================================================================
//  Pruebas del borrado de cuenta.
//
//  Aquí lo que hay que demostrar no es una fórmula, sino que la SECUENCIA de
//  operaciones es correcta, porque el esquema tiene dos trampas:
//
//   - `families.created_by_user_id` NO tiene ON DELETE CASCADE: si se borra al
//     creador sin más, PostgreSQL rechaza la operación.
//   - Si se va el único padre, la familia se queda sin nadie que la administre.
//
//  Como no hay PostgreSQL en el entorno de pruebas, se inyecta una base de
//  datos falsa que apunta las consultas emitidas. No prueba PostgreSQL: prueba
//  QUE PEDIMOS LO CORRECTO Y EN EL ORDEN CORRECTO.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const ANA = "ana-uuid", PADRE = "padre-uuid", OTRO_PADRE = "otro-padre-uuid";
const FAMILIA = "fam-uuid";

// Inyecta un doble de ../db antes de que cuentaService lo pida.
function cargarConDbFalsa(respuestas) {
  const rutaDb = require.resolve("../db");
  const rutaServicio = require.resolve("../services/cuentaService");
  const emitidas = [];

  const responder = (sql) => {
    const limpio = sql.replace(/\s+/g, " ").trim();
    for (const [patron, filas] of respuestas) {
      if (limpio.includes(patron)) return { rows: filas, rowCount: filas.length };
    }
    return { rows: [], rowCount: 0 };
  };
  const query = async (sql, params) => {
    emitidas.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    return responder(sql);
  };

  require.cache[rutaDb] = {
    id: rutaDb, filename: rutaDb, loaded: true, exports: {
      query,
      // La transacción se ejecuta con el mismo doble.
      tx: async (fn) => fn({ query }),
    },
  };
  delete require.cache[rutaServicio];
  const servicio = require("../services/cuentaService");
  return { servicio, emitidas };
}

const emitio = (emitidas, fragmento) =>
  emitidas.some((q) => q.sql.includes(fragmento));
const indiceDe = (emitidas, fragmento) =>
  emitidas.findIndex((q) => q.sql.includes(fragmento));

// ---------------------------------------------------------------------------

test("avisa de que se llevará la familia si es el único padre", async () => {
  const { servicio } = cargarConDbFalsa([
    ["FROM family_members fm JOIN families f", [{ family_id: FAMILIA, role_in_family: "parent", name: "Familia Ejemplo" }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND role_in_family", [{ n: 1 }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND status", [{ n: 3 }]],
  ]);
  const info = await servicio.consecuenciasDeBorrar(PADRE);

  assert.equal(info.enFamilia, true);
  assert.equal(info.arrastraFamilia, true, "es el único padre");
  assert.equal(info.familyName, "Familia Ejemplo");
  assert.equal(info.otrosMiembros, 2, "quedan 2 personas más");
});

test("NO avisa de borrado de familia si hay otro padre", async () => {
  const { servicio } = cargarConDbFalsa([
    ["FROM family_members fm JOIN families f", [{ family_id: FAMILIA, role_in_family: "parent", name: "Familia Ejemplo" }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND role_in_family", [{ n: 2 }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND status", [{ n: 4 }]],
  ]);
  const info = await servicio.consecuenciasDeBorrar(PADRE);
  assert.equal(info.arrastraFamilia, false);
});

test("un hijo nunca arrastra la familia", async () => {
  const { servicio } = cargarConDbFalsa([
    ["FROM family_members fm JOIN families f", [{ family_id: FAMILIA, role_in_family: "child", name: "Familia Ejemplo" }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND role_in_family", [{ n: 1 }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND status", [{ n: 4 }]],
  ]);
  const info = await servicio.consecuenciasDeBorrar(ANA);
  assert.equal(info.arrastraFamilia, false, "aunque solo haya un padre, él no lo es");
});

test("el último padre: se borra la familia entera", async () => {
  const { servicio, emitidas } = cargarConDbFalsa([
    ["FROM family_members fm JOIN families f", [{ family_id: FAMILIA, role_in_family: "parent", name: "F" }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND role_in_family", [{ n: 1 }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND status", [{ n: 2 }]],
  ]);
  const r = await servicio.borrarCuenta(PADRE);

  assert.equal(r.familiaBorrada, true);
  assert.ok(emitio(emitidas, "DELETE FROM families WHERE id = $1"), "borra la familia");
  assert.ok(emitio(emitidas, "DELETE FROM users WHERE id = $1"), "borra el usuario");
  assert.ok(
    indiceDe(emitidas, "DELETE FROM families WHERE id = $1") < indiceDe(emitidas, "DELETE FROM users"),
    "la familia ANTES que el usuario: si no, la clave foránea lo impediría"
  );
});

test("con otro padre: solo sale él y se releva quién creó la familia", async () => {
  const { servicio, emitidas } = cargarConDbFalsa([
    ["FROM family_members fm JOIN families f", [{ family_id: FAMILIA, role_in_family: "parent", name: "F" }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND role_in_family", [{ n: 2 }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND status", [{ n: 4 }]],
    ["SELECT user_id FROM family_members", [{ user_id: OTRO_PADRE }]],
  ]);
  const r = await servicio.borrarCuenta(PADRE);

  assert.equal(r.familiaBorrada, false);
  assert.ok(!emitio(emitidas, "DELETE FROM families WHERE id = $1"), "la familia NO se borra");
  assert.ok(emitio(emitidas, "DELETE FROM family_members WHERE user_id = $1"), "sale de la familia");

  const relevo = emitidas.find((q) => q.sql.includes("UPDATE families SET created_by_user_id"));
  assert.ok(relevo, "reasigna quién creó la familia");
  assert.equal(relevo.params[0], OTRO_PADRE, "pasa al otro padre");
  assert.ok(
    indiceDe(emitidas, "UPDATE families SET created_by_user_id") < indiceDe(emitidas, "DELETE FROM users"),
    "el relevo ANTES de borrar al usuario: esa columna no tiene cascade"
  );
});

test("las invitaciones que dejó pendientes se retiran", async () => {
  const { servicio, emitidas } = cargarConDbFalsa([
    ["FROM family_members fm JOIN families f", [{ family_id: FAMILIA, role_in_family: "parent", name: "F" }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND role_in_family", [{ n: 2 }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND status", [{ n: 4 }]],
    ["SELECT user_id FROM family_members", [{ user_id: OTRO_PADRE }]],
  ]);
  await servicio.borrarCuenta(PADRE);

  assert.ok(emitio(emitidas, "DELETE FROM family_invitations WHERE created_by_user_id = $1"));
  assert.ok(
    indiceDe(emitidas, "DELETE FROM family_invitations") < indiceDe(emitidas, "DELETE FROM users"),
    "antes de borrar al usuario: created_by_user_id tampoco tiene cascade"
  );
});

test("una cuenta sin familia se borra sin más", async () => {
  const { servicio, emitidas } = cargarConDbFalsa([]);  // no pertenece a ninguna
  const r = await servicio.borrarCuenta(ANA);

  assert.equal(r.familiaBorrada, false);
  assert.ok(emitio(emitidas, "DELETE FROM users WHERE id = $1"));
  assert.ok(!emitio(emitidas, "DELETE FROM families WHERE id = $1"));
});

test("el usuario siempre se borra en último lugar", async () => {
  const { servicio, emitidas } = cargarConDbFalsa([
    ["FROM family_members fm JOIN families f", [{ family_id: FAMILIA, role_in_family: "parent", name: "F" }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND role_in_family", [{ n: 2 }]],
    ["COUNT(*)::int AS n FROM family_members WHERE family_id = $1 AND status", [{ n: 4 }]],
    ["SELECT user_id FROM family_members", [{ user_id: OTRO_PADRE }]],
  ]);
  await servicio.borrarCuenta(PADRE);

  const escrituras = emitidas.filter((q) => /^(DELETE|UPDATE)/.test(q.sql));
  const ultima = escrituras[escrituras.length - 1];
  assert.ok(ultima.sql.includes("DELETE FROM users"),
    "la última escritura debe ser el usuario, no: " + ultima.sql);
});
