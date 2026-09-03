# 🏠 Casa

App de una casa: tareas fijas y adicionales, paga semanal, niveles, premios,
mercado de tareas entre hermanos y planificador de menús.

- **Backend:** Node.js + Express + PostgreSQL.
- **Sin cuentas:** ni registro, ni contraseñas, ni email, ni verificación.
- **Persistencia:** una única fila de PostgreSQL (Neon / Supabase / local).

> 📖 **¿No eres desarrollador?** Usa la **[GUÍA DE INSTALACIÓN](GUIA-INSTALACION.md)**.

## Los cuatro perfiles

Al abrir la app no hay pantalla de acceso: se elige quién eres y se entra.

| Id | Quién | Experiencia |
|---|---|---|
| `hugo` | Hugo | móvil (mobile-first) |
| `marcos` | Marcos | móvil (mobile-first) |
| `carla` | Carla | móvil (mobile-first) |
| `papas` | Dashboard de los Papás | escritorio (desktop-first) |

Están definidos en **[`public/perfiles.js`](public/perfiles.js)**, un único
archivo que cargan tanto el servidor (`require`) como el navegador
(`<script src>`). Es el sitio donde se cambia un nombre o un color.

Los ids son **estables**: van dentro del estado guardado (casillas de tareas,
asignaciones, canjes, mercado, historial). Cambiar un id equivale a borrar el
historial de esa persona.

El perfil elegido se recuerda en `localStorage` de cada dispositivo y se cambia
desde el botón de la barra superior.

### Elegir perfil no es identificarse

Cualquiera que abra la app puede elegir cualquier perfil. Es **intencionado**:
es una app privada de una casa y pedirle una contraseña a un niño de diez años
solo conseguiría que dejara de usarla.

Lo que sí se conserva son las reglas de **producto**, y se aplican en el
servidor porque en la interfaz se saltan con las herramientas del navegador:

- un hijo puede marcar sus tareas como hechas, pero **no aprobárselas**;
- un hijo **no puede tocar las tareas de sus hermanos**;
- la paga, el valor del punto, los catálogos, las rachas y el historial son de
  los papás;
- las rachas las **calcula el servidor**; el cliente no las escribe nunca.

El dispositivo declara su perfil en la cabecera `X-Perfil`. No es una
credencial: no hay nada que verificar.

## Requisitos

- Node.js 18+
- PostgreSQL alcanzable por `DATABASE_URL` (recomendado: [Neon Free](https://neon.tech))

## Setup local

```bash
npm install
cp .env.example .env
npm start
```

Abre `http://localhost:3000`. Hay también una demo sin base de datos en
`http://localhost:3000/demo`, que sustituye la capa de red por datos de ejemplo
en memoria y **no hace ni una petición al servidor**.

## Variables de entorno

Ver `.env.example`.

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | sí | PostgreSQL con SSL |
| `TZ_FAMILIA` | no | por defecto `Europe/Madrid`; decide cuándo cambia la semana y el mes |
| `PORT` | no | por defecto 3000 |
| `ANDROID_FINGERPRINT` | solo para Google Play | SHA-256 que da Play Console |

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/state` | Estado de la casa (con perfiles y ciclos ya aplicados) |
| PUT | `/api/state` | Guardar estado (con control de versión) |
| GET | `/api/backup` | Descargar copia (papás) |
| POST | `/api/restore` | Restaurar copia (papás) |
| POST | `/api/reset` | Volver al estado de ejemplo (papás) |
| GET | `/api/health` | Salud del servicio |

Todas aceptan la cabecera `X-Perfil` (`hugo` \| `marcos` \| `carla` \| `papas`).
Si falta o no es válida, se asume `papas`.

## Estructura

```
casa/
├── server.js                   # Express + montaje de rutas
├── db/
│   ├── index.js                # Pool PostgreSQL
│   ├── schema.js               # Ejecutor de migraciones
│   └── migrations/*.sql        # Idempotentes; 001-007 son legado (ver 008)
├── routes/
│   └── state.js                # Toda la API: estado, ciclos, copias
├── services/
│   ├── estadoService.js        # Semilla, perfiles, forma del estado, BD
│   ├── stateGuard.js           # Saneado + límites por perfil
│   ├── puntos.js               # Resumen del mes
│   └── rachas.js               # Cálculo de rachas
├── public/
│   ├── perfiles.js             # LOS CUATRO PERFILES (servidor y navegador)
│   ├── index.html              # La app entera
│   ├── demo.js                 # Servidor falso en memoria para /demo
│   └── sw.js                   # Service worker (app instalable)
└── test/                       # node --test, sin dependencias
```

## Base de datos

El estado vive en `casa_state`, una tabla de **una sola fila**
(`CHECK (id = 1)`), sin claves foráneas ni usuarios.

La migración `008_casa_state.sql` la crea y copia dentro el estado que hubiera
en la `family_state` de la época de las cuentas. **No borra nada**: las tablas
antiguas (`users`, `user_profiles`, `families`, `family_members`,
`family_state`, `family_invitations` y las de tokens) siguen ahí, huérfanas,
por si hiciera falta consultarlas. Se pueden borrar a mano cuando ya no
interesen.

Los ids de miembro que venían dentro de aquel JSON eran UUID. Los traduce
`adoptarPerfiles()` en `services/estadoService.js`, emparejando **por nombre**
con Hugo, Marcos y Carla (y cualquier padre o madre con `papas`). Es una
operación idempotente y está cubierta por `test/perfiles.test.js`.

## Concurrencia

Cada guardado manda la versión de la que viene. Si alguien escribió en medio,
el servidor responde **409** y el cliente vuelve a aplicar sus campos sobre el
estado fresco en lugar de pisarlo en silencio.

Los reinicios de semana y de mes los decide el **reloj del servidor** en el
huso de `TZ_FAMILIA`, no el del móvil de cada uno.

## Pruebas

```bash
npm test
```

Runner incorporado de Node, sin dependencias. Cubre las reglas del dinero, el
reparto por peso, el saneado, los límites por perfil, las rachas, los menús, el
mercado, la fusión ante conflictos y la traducción de perfiles.

## Despliegue (Render + Neon)

1. Crea proyecto gratuito en **[Neon](https://neon.tech)** → copia la
   *Pooled connection string*.
2. Crea un **Web Service** en [Render](https://render.com): build `npm install`,
   start `npm start`.
3. Variables de entorno: `DATABASE_URL`, `TZ_FAMILIA`, `NODE_ENV=production`.
4. Despliega. Las migraciones corren solas al arrancar.

## Limitaciones conocidas

- Sin notificaciones push: los pendientes se ven con un contador en las pestañas.
- Sondeo cada 4 s para sincronizar entre dispositivos.
- Una sola casa por despliegue (es lo que se buscaba).

## Licencia

Privado — uso familiar.
