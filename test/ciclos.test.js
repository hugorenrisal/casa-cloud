// ============================================================================
//  Pruebas de los ciclos de semana/mes y del relleno de casillas.
//  Se ejecutan con el runner incorporado de Node: npm test
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { ensureFixedShape, emptyFamilyState } = require("../services/familyService");

function familiaDePrueba() {
  const s = emptyFamilyState();
  s.members = [
    { id: "p1", name: "Carlos", role: "parent", color: "#8b6fd6", load: "normal" },
    { id: "h1", name: "Ana", role: "child", color: "#e0588f", load: "normal" },
    { id: "h2", name: "Leo", role: "child", color: "#2f9fd0", load: "reducida" },
  ];
  return s;
}

test("ensureFixedShape rellena las casillas que faltan", () => {
  const s = familiaDePrueba();
  assert.equal(Object.keys(s.fixedState).length, 0, "parte vacío");

  const cambio = ensureFixedShape(s);

  assert.equal(cambio, true, "informa de que ha cambiado algo");
  assert.deepEqual(Object.keys(s.fixedState).sort(), ["h1", "h2"], "solo los hijos");
  // 3 diarias + 1 semanal en la semilla
  assert.equal(Object.keys(s.fixedState.h1).length, 4);
  assert.ok(Array.isArray(s.fixedState.h1.f1.days), "las diarias llevan 7 días");
  assert.equal(s.fixedState.h1.f1.days.length, 7);
  assert.equal(s.fixedState.h1.f4.status, "pending", "las semanales llevan estado");
});

test("ensureFixedShape es idempotente (clave para no repintar en bucle)", () => {
  const s = familiaDePrueba();
  ensureFixedShape(s);
  // La segunda pasada no debe cambiar nada. Si devolviera true, el cliente
  // guardaría en cada render y la pantalla se repintaría sin parar.
  assert.equal(ensureFixedShape(s), false);
  assert.equal(ensureFixedShape(s), false);
});

test("ensureFixedShape conserva el progreso ya marcado", () => {
  const s = familiaDePrueba();
  ensureFixedShape(s);
  s.fixedState.h1.f1.days = [true, true, true, false, false, false, false];
  s.fixedState.h1.f4.status = "approved";

  ensureFixedShape(s);

  assert.deepEqual(s.fixedState.h1.f1.days, [true, true, true, false, false, false, false]);
  assert.equal(s.fixedState.h1.f4.status, "approved");
});

test("ensureFixedShape limpia hijos y tareas que ya no existen", () => {
  const s = familiaDePrueba();
  ensureFixedShape(s);
  // Un hijo que se fue de la familia y una tarea borrada del catálogo
  s.fixedState.fantasma = { f1: { days: [] } };
  s.fixedState.h1.tarea_borrada = { status: "pending" };

  const cambio = ensureFixedShape(s);

  assert.equal(cambio, true);
  assert.equal(s.fixedState.fantasma, undefined, "el hijo que ya no está se va");
  assert.equal(s.fixedState.h1.tarea_borrada, undefined, "la tarea inexistente se va");
});

test("ensureFixedShape rehace la casilla si cambia la frecuencia", () => {
  const s = familiaDePrueba();
  ensureFixedShape(s);
  // f1 pasa de diaria a semanal
  s.fixedTasks.find((t) => t.id === "f1").freq = "weekly";

  assert.equal(ensureFixedShape(s), true);
  assert.equal(s.fixedState.h1.f1.days, undefined);
  assert.equal(s.fixedState.h1.f1.status, "pending");
});
