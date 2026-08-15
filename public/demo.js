// ============================================================================
//  MODO DEMO — "Casa"
//
//  Sirve para enseñar la app a alguien sin darle una contraseña y sin que
//  toque los datos reales de ninguna familia.
//
//  CÓMO FUNCIONA
//  Toda la app habla con el servidor a través de una única función, api().
//  Aquí la sustituimos por una versión falsa que responde desde una familia
//  inventada guardada en memoria. Consecuencias:
//
//    - NO se hace ni una sola petición al servidor real.
//    - NO hay base de datos, ni cuentas, ni cookies de sesión.
//    - Lo que se toque se pierde al recargar (o al pulsar "Reiniciar demo").
//
//  Por eso la demo no abre ningún agujero de seguridad: no existe forma de
//  llegar desde aquí a los datos de una familia de verdad.
// ============================================================================
(function () {
  "use strict";

  // --- Identidades de mentira ----------------------------------------------
  const PADRE = {
    id: "demo-padre", email: "padre@ejemplo.com", emailVerified: true,
    displayName: "Carlos", role: "parent",
    onboardingCompleted: true, familyId: "demo-familia", roleInFamily: "parent",
  };
  const HIJA = {
    id: "ana", email: "ana@ejemplo.com", emailVerified: true,
    displayName: "Ana", role: "child",
    onboardingCompleted: true, familyId: "demo-familia", roleInFamily: "child",
  };

  // Quién está mirando la demo ahora mismo. Se puede cambiar en caliente con
  // el botón de la barra superior, que es lo que hace la demo interesante:
  // enseñar el panel del padre y la app del hijo sin dos dispositivos.
  let comoQuien = "parent";
  const usuarioActual = () => (comoQuien === "parent" ? PADRE : HIJA);

  // --- Fechas: la demo debe verse "de esta semana" sea cuando sea ----------
  function claveMes(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function claveSemana(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dia = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dia + 3);
    const primerJue = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const sem = 1 + Math.round(((t - primerJue) / 86400000 - 3 + ((primerJue.getUTCDay() + 6) % 7)) / 7);
    return t.getUTCFullYear() + "-W" + String(sem).padStart(2, "0");
  }
  const hoy = new Date();

  // Marca los N primeros días de la semana como hechos.
  // A propósito NO depende del día de hoy: si dependiera, un lunes la demo
  // aparecería casi vacía y no se entendería nada al enseñarla.
  function dias(n) {
    const d = [false, false, false, false, false, false, false];
    for (let i = 0; i < n && i < 7; i++) d[i] = true;
    return d;
  }

  // --- La familia de ejemplo ------------------------------------------------
  function estadoInicial() {
    return {
      view: "desk", profile: "parent", deskTab: "home", mobTab: "home",
      currentMonth: claveMes(hoy), currentWeek: claveSemana(hoy),
      rate: 0.05, fixedPay: 8,
      members: [
        { id: "demo-padre", name: "Carlos", role: "parent", color: "#8b6fd6", load: "normal" },
        { id: "ana", name: "Ana", role: "child", color: "#e0588f", load: "normal" },
        { id: "leo", name: "Leo", role: "child", color: "#2f9fd0", load: "reducida" },
        { id: "mia", name: "Mía", role: "child", color: "#2fae73", load: "normal" },
      ],
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
      // Los tres casos de la regla del dinero, para que se vean de un vistazo:
      //   Mía  22/22 = 100% → cobra la paga fija Y desbloquea las adicionales
      //   Ana  17/22 =  77% → cobra la paga fija, adicionales aún bloqueadas
      //   Leo   9/22 =  41% → por debajo del 75%: pierde la paga fija
      // (3 tareas diarias × 7 días + 1 semanal = 22 unidades por hijo)
      fixedState: {
        mia: { f1: { days: dias(7) }, f2: { days: dias(7) }, f3: { days: dias(7) }, f4: { status: "approved" } },
        ana: { f1: { days: dias(6) }, f2: { days: dias(6) }, f3: { days: dias(5) }, f4: { status: "submitted" } },
        leo: { f1: { days: dias(3) }, f2: { days: dias(3) }, f3: { days: dias(3) }, f4: { status: "pending" } },
      },
      extras: [
        { id: "x1", taskId: "e1", memberId: "ana", status: "approved", listed: false },
        { id: "x2", taskId: "e2", memberId: "mia", status: "submitted", listed: false },
        { id: "x3", taskId: "e3", memberId: "leo", status: "pending", listed: true },
        { id: "x4", taskId: "e5", memberId: "mia", status: "approved", listed: false,
          bounty: { points: 5, from: "leo", to: "mia" } },
        { id: "x5", taskId: "e4", memberId: "ana", status: "pending", listed: false },
      ],
      generated: true,
      monthPoints: { ana: 0, leo: 0, mia: 0 },
      streak: { ana: 6, leo: 1, mia: 12 },
      history: { "2026-07": { points: { ana: 210, leo: 95, mia: 260 } } },
      dishes: ["Pasta con tomate", "Pollo al horno", "Lentejas", "Pescado y verdura",
        "Pizza casera", "Hamburguesas", "Arroz al horno", "Tortilla francesa",
        "Ensalada César", "Macarrones", "Sopa y croquetas", "Tacos"],
      menu: { Lun: "Pasta con tomate", Mar: "Pollo al horno", "Mié": "Lentejas",
        Jue: "Pescado y verdura", Vie: "Pizza casera", "Sáb": "Hamburguesas", Dom: "Arroz al horno" },
      rewards: [
        { id: "r1", title: "1 h más de pantalla", cost: 60, type: "Tiempo" },
        { id: "r2", title: "Elegir la peli del finde", cost: 40, type: "Privilegio" },
        { id: "r3", title: "Noche sin tareas", cost: 120, type: "Privilegio" },
      ],
      listings: [{
        id: "l1", sellerId: "leo", assignmentId: "x3", taskId: "e3",
        pointsOffered: 8, acceptsTrade: true, note: "Tengo entreno, ¿alguien?",
        status: "open", createdAt: Date.now() - 3600000,
      }],
      offers: [],
      marketLog: [{
        kind: "take", taskId: "e5", from: "leo", to: "mia",
        points: 5, at: Date.now() - 86400000,
      }],
    };
  }

  let ESTADO = estadoInicial();

  const FAMILIA = {
    family: { id: "demo-familia", name: "Familia Ejemplo", created_at: "2026-01-15T10:00:00Z" },
    members: [
      { user_id: "demo-padre", display_name: "Carlos", email: "padre@ejemplo.com",
        role_in_family: "parent", joined_at: "2026-01-15T10:00:00Z" },
      { user_id: "ana", display_name: "Ana", email: "ana@ejemplo.com",
        role_in_family: "child", joined_at: "2026-01-15T11:20:00Z" },
      { user_id: "leo", display_name: "Leo", email: "leo@ejemplo.com",
        role_in_family: "child", joined_at: "2026-01-16T09:05:00Z" },
      { user_id: "mia", display_name: "Mía", email: "mia@ejemplo.com",
        role_in_family: "child", joined_at: "2026-01-16T09:40:00Z" },
    ],
  };

  const INVITACIONES = [
    { id: "i1", email: "abuela@ejemplo.com", role: "parent", status: "pending",
      expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      acceptedAt: null, revokedAt: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];

  // --- El servidor falso ----------------------------------------------------
  const copia = (o) => JSON.parse(JSON.stringify(o));

  function error(clave, codigo) {
    const e = new Error(clave);
    e.status = codigo || 400;
    e.payload = { error: clave };
    return e;
  }

  async function apiDemo(url, opts) {
    const metodo = ((opts && opts.method) || "GET").toUpperCase();
    const ruta = String(url).split("?")[0];
    // Pequeño retardo para que la interfaz se comporte como con un servidor real
    await new Promise((r) => setTimeout(r, 40));

    if (ruta === "/api/auth/me") return { user: copia(usuarioActual()) };

    if (ruta === "/api/state") {
      if (metodo === "PUT") {
        const cuerpo = opts.body;
        ESTADO = typeof cuerpo === "string" ? JSON.parse(cuerpo) : copia(cuerpo);
        return { ok: true };
      }
      return copia(ESTADO);
    }

    if (ruta === "/api/families/current") return copia(FAMILIA);

    if (/\/invitations$/.test(ruta)) {
      if (metodo === "POST") throw error("demo_solo_lectura", 403);
      return { invitations: copia(INVITACIONES) };
    }
    if (/\/invitations\//.test(ruta)) throw error("demo_solo_lectura", 403);

    if (ruta === "/api/reset") { ESTADO = estadoInicial(); return { ok: true }; }
    if (ruta === "/api/restore") throw error("demo_solo_lectura", 403);

    if (ruta === "/api/auth/logout") { salirDeLaDemo(); return { ok: true }; }

    // Registro, login, invitaciones, familias… nada de eso existe en la demo.
    if (ruta.indexOf("/api/auth/") === 0 ||
        ruta.indexOf("/api/onboarding/") === 0 ||
        ruta.indexOf("/api/families") === 0 ||
        ruta.indexOf("/api/invitations") === 0) {
      throw error("demo_solo_lectura", 403);
    }

    throw error("no_encontrado", 404);
  }

  // --- Barra de aviso -------------------------------------------------------
  function pintarBarraDemo() {
    if (document.getElementById("demoBar")) return;
    const barra = document.createElement("div");
    barra.id = "demoBar";
    barra.innerHTML =
      '<span class="demo-eti">DEMO</span>' +
      '<span class="demo-txt">Datos de ejemplo. No se guarda nada.</span>' +
      '<span class="demo-sep"></span>' +
      '<button id="demoRol" class="demo-btn"></button>' +
      '<button id="demoReset" class="demo-btn">Reiniciar</button>' +
      '<button id="demoSalir" class="demo-btn">Salir</button>';
    document.body.appendChild(barra);

    const estilo = document.createElement("style");
    estilo.textContent =
      "#demoBar{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;" +
      "gap:8px;padding:7px 12px;background:#43352a;color:#fff5e9;font:600 13px system-ui,sans-serif;" +
      "box-shadow:0 -4px 14px rgba(0,0,0,.2);white-space:nowrap;" +
      "padding-bottom:calc(7px + env(safe-area-inset-bottom))}" +
      "#demoBar .demo-eti{background:#ff7a59;color:#fff;padding:3px 9px;border-radius:7px;font-weight:800;" +
      "letter-spacing:.06em;font-size:11px;flex:none}" +
      "#demoBar .demo-txt{opacity:.85;overflow:hidden;text-overflow:ellipsis}" +
      "#demoBar .demo-sep{flex:1}" +
      "#demoBar .demo-btn{background:rgba(255,255,255,.12);color:inherit;border:1px solid rgba(255,255,255,.25);" +
      "border-radius:9px;padding:6px 11px;font:inherit;cursor:pointer;flex:none}" +
      "#demoBar .demo-btn:hover{background:rgba(255,255,255,.22)}" +
      // La app tiene su propia barra de navegación abajo en la vista móvil, y
      // hojas que suben desde abajo: se desplazan para que la barra de demo no
      // las tape (y viceversa).
      "body.demo-activa .nav{bottom:46px}" +
      "body.demo-activa .mob .phone{padding-bottom:160px}" +
      "body.demo-activa .sheet{bottom:46px}" +
      "body.demo-activa .modebar{top:0}" +
      // En pantallas estrechas se quita el texto largo para que todo quepa en
      // una sola línea.
      "@media(max-width:560px){#demoBar .demo-txt{display:none}#demoBar{gap:6px;padding-left:10px;padding-right:10px}" +
      "#demoBar .demo-btn{padding:6px 9px;font-size:12px}}";
    document.head.appendChild(estilo);
    document.body.classList.add("demo-activa");

    document.getElementById("demoRol").onclick = cambiarRol;
    document.getElementById("demoReset").onclick = reiniciarDemo;
    document.getElementById("demoSalir").onclick = salirDeLaDemo;
    actualizarBotonRol();
  }

  function actualizarBotonRol() {
    const b = document.getElementById("demoRol");
    if (!b) return;
    const estrecho = window.innerWidth < 560;
    b.textContent = comoQuien === "parent"
      ? (estrecho ? "👀 Hija" : "👀 Ver como hija")
      : (estrecho ? "👀 Padre" : "👀 Ver como padre");
  }
  window.addEventListener("resize", actualizarBotonRol);

  // Se rearranca la app entera en vez de tocar su variable ME: esa está
  // declarada con let dentro del script principal y no es accesible desde
  // aquí. Al rearrancar, la app vuelve a pedir /api/auth/me y recibe el
  // usuario nuevo de nuestro servidor falso.
  async function cambiarRol() {
    comoQuien = comoQuien === "parent" ? "child" : "parent";
    actualizarBotonRol();
    if (typeof window.bootstrap === "function") await window.bootstrap();
  }

  async function reiniciarDemo() {
    ESTADO = estadoInicial();
    comoQuien = "parent";
    actualizarBotonRol();
    if (typeof window.bootstrap === "function") await window.bootstrap();
  }

  function salirDeLaDemo() {
    location.href = "/";
  }

  // --- Arranque -------------------------------------------------------------
  window.api = apiDemo;              // a partir de aquí, nada sale a la red
  window.__DEMO__ = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pintarBarraDemo);
  } else {
    pintarBarraDemo();
  }
})();
