# 🏠 Casa — Guía completa, paso a paso

Esta guía te lleva desde cero hasta tener la app funcionando en el ordenador de tu padre y en
los móviles de tus hermanos.

**No hace falta saber programar.** Todo se hace pinchando en páginas web.

---

## Índice

| Parte | Qué se hace | Tiempo | ¿Hace falta? |
|---|---|---|---|
| [1](#parte-1--comprobar-que-la-app-está-viva) | Comprobar que la app funciona | 1 min | Sí |
| [2](#parte-2--activar-el-envío-de-correos-gmail) | **Activar el envío de correos (Gmail)** | 10 min | Sí, para invitar |
| [3](#parte-3--comprobar-que-los-correos-salen) | Comprobar que los correos salen | 2 min | Sí |
| [4](#parte-4--tu-padre-crea-su-cuenta-y-la-familia) | Tu padre crea su cuenta y la familia | 3 min | Sí |
| [5](#parte-5--invitar-a-tus-hermanos) | Invitar a tus hermanos | 2 min | Sí |
| [6](#parte-6--instalar-la-app-en-cada-dispositivo) | Instalar la app en cada dispositivo | 2 min c/u | Sí |
| [7](#parte-7--si-algo-falla) | Si algo falla | — | Solo si hay problemas |

> **La dirección de tu app es:** `https://casa-cloud.onrender.com`
> Apúntala. Es la misma para todos los dispositivos.

---

## PARTE 1 — Comprobar que la app está viva

1. Abre en el navegador: **https://casa-cloud.onrender.com**
2. Debe aparecer una pantalla que dice **"Inicia sesión"**.

✅ **Si la ves:** perfecto, sigue a la Parte 2.

⏳ **Si tarda mucho o da error la primera vez:** es normal. El servidor es gratuito y **se
duerme tras 15 minutos sin uso**. Tarda entre 30 y 60 segundos en despertar. Espera un minuto
y recarga la página.

---

## PARTE 2 — Activar el envío de correos (Gmail)

**Por qué hace falta:** para que tu padre pueda invitar a tus hermanos, la app necesita poder
mandar correos. Vamos a usar una cuenta de Gmail normal para ello.

**Qué cuenta usar:** la de tu padre, o una que crees solo para esto. Los correos de invitación
saldrán desde esa dirección.

> ⚠️ **Importante:** no vale la contraseña normal de Gmail. Google obliga a usar una
> **"contraseña de aplicación"**, que es una clave distinta de 16 letras que solo sirve para
> esto. Eso es lo que vamos a generar.

### Paso 2.1 — Activar la verificación en dos pasos

Sin esto, Google no deja crear contraseñas de aplicación.

1. Entra en **https://myaccount.google.com/security** con la cuenta de Gmail elegida.
2. Busca **"Verificación en dos pasos"**.
3. Si pone **"Activada"** → ya está, pasa al 2.2.
4. Si pone **"Desactivada"** → pínchalo y sigue los pasos (te pedirá un número de móvil).

### Paso 2.2 — Crear la contraseña de aplicación

1. Entra en **https://myaccount.google.com/apppasswords**
2. Donde pide un nombre, escribe: `Casa`
3. Pulsa **"Crear"**.
4. Aparece un recuadro amarillo con **16 letras** en 4 grupos, algo así:

   ```
   abcd efgh ijkl mnop
   ```

5. **Cópialas y quita los espacios.** Te queda: `abcdefghijklmnop`
6. Guárdalas en un sitio seguro. Google **no te las vuelve a enseñar**.

> 💡 Si la página de contraseñas de aplicación dice que no está disponible, es porque el paso
> 2.1 no está hecho. Vuelve atrás y actívalo.

### Paso 2.3 — Meter los datos en Render

Render es donde vive tu app en internet. Ahí le decimos qué cuenta de Gmail usar.

1. Entra en **https://render.com** e inicia sesión.
2. Pincha en tu servicio (se llamará **casa-cloud** o parecido).
3. En el menú de la izquierda, pincha **"Environment"**.
4. Vas a añadir **4 variables**. Para cada una: pulsa **"Add Environment Variable"**, rellena
   los dos campos, y repite.

| Key (nombre) | Value (valor) |
|---|---|
| `GMAIL_USER` | La dirección completa. Ej: `mipadre@gmail.com` |
| `GMAIL_APP_PASSWORD` | Las 16 letras **sin espacios**. Ej: `abcdefghijklmnop` |
| `EMAIL_FROM` | `Casa <mipadre@gmail.com>` *(pon el mismo correo de arriba)* |
| `APP_URL` | `https://casa-cloud.onrender.com` |

5. Pulsa **"Save Changes"**.
6. Render se reinicia solo. **Espera 2 minutos.**

> ⚠️ **`APP_URL` es importante.** Si estuviera puesto en `http://localhost:3000`, los enlaces
> de los correos de invitación no funcionarían: llevarían a tus hermanos a una página en
> blanco. Comprueba que pone la dirección de internet.

---

## PARTE 3 — Comprobar que los correos salen

No des por hecho que funciona: compruébalo antes de invitar a nadie.

1. Vuelve a **https://casa-cloud.onrender.com**
2. Pulsa **"Crear cuenta"** y regístrate **con tu propio correo** (el tuyo, no el de tu padre).
3. Elige **"Soy padre / madre"** y crea una familia de prueba, ponle el nombre `Prueba`.
4. En el menú de la izquierda pincha **"Invitaciones"**.
5. En **"Invitar a alguien"**, escribe **otro correo tuyo cualquiera** y pulsa
   **"Enviar invitación"**.
6. Mira si llega el correo. **Revisa también la carpeta de spam.**

✅ **Si llega:** Gmail está bien configurado. Borra esa cuenta de prueba (o simplemente
ignórala) y sigue a la Parte 4 con la cuenta de verdad de tu padre.

❌ **Si no llega:** ve a la [Parte 7](#parte-7--si-algo-falla), apartado "No llegan los correos".

---

## PARTE 4 — Tu padre crea su cuenta y la familia

Esto lo hace **él**, en su ordenador.

1. Abre **https://casa-cloud.onrender.com** en Chrome o Edge.
2. Pulsa **"Crear cuenta"**.
3. Rellena: su correo, una contraseña y su nombre.
4. Le sale una pantalla para elegir quién es. Pulsa **"Soy padre / madre"**.
5. Le pide el nombre de la familia. Escribe el que queráis (ej: `Familia Riesco`) y pulsa
   **"Crear familia"**.
6. Ya está dentro del panel.

### Para que le quede como una aplicación de escritorio (opcional)

Así se abre en su propia ventana, con icono, sin barra de navegador:

- **En Chrome:** menú **⋮** (arriba derecha) → **"Guardar y compartir"** →
  **"Instalar página como aplicación…"**
- **En Edge:** menú **…** → **"Aplicaciones"** → **"Instalar este sitio como una aplicación"**

---

## PARTE 5 — Invitar a tus hermanos

Lo hace tu padre, desde su panel. **Cada hermano necesita su propio correo electrónico.**

1. En el menú de la izquierda, pincha **"Invitaciones"**.
2. En el recuadro **"Invitar a alguien"**:
   - **Correo:** el correo de tu hermano.
   - **Rol:** deja **"Hijo/a"**.
     *(Usa "Co-padre/madre" solo si quieres que tu madre también tenga panel de control.)*
3. Pulsa **"Enviar invitación"**.
4. Repite con cada hermano.

En esa misma pantalla puedes ver las invitaciones enviadas, **reenviarlas** si no llegan, o
**revocarlas** si te equivocaste de correo.

> Las invitaciones **caducan a los 7 días**. Si pasa, se reenvía y ya está.

---

## PARTE 6 — Instalar la app en cada dispositivo

### Paso 6.1 — Tu hermano acepta la invitación

1. Abre el correo **en el móvil**.
2. Pulsa el botón **"Aceptar invitación"**.
3. Pulsa **"Crear cuenta nueva"** y rellena contraseña y nombre.

   ⚠️ **Tiene que registrarse con el mismo correo al que le llegó la invitación.** Si usa otro,
   la app no le dejará entrar en la familia.
4. Ya está dentro, y ve sus tareas.

### Paso 6.2 — Poner el icono en la pantalla del móvil

Así queda como una app normal, con su icono y a pantalla completa.

**En Android (con Chrome):**
1. Abre `https://casa-cloud.onrender.com` en Chrome.
2. Menú **⋮** (arriba a la derecha).
3. Pulsa **"Instalar app"** (o **"Añadir a pantalla de inicio"**).
4. Confirma.

**En iPhone (con Safari — tiene que ser Safari, con Chrome no funciona):**
1. Abre `https://casa-cloud.onrender.com` en **Safari**.
2. Pulsa el botón **Compartir** (el cuadrado con la flecha hacia arriba, abajo en el centro).
3. Desliza hacia abajo y pulsa **"Añadir a pantalla de inicio"**.
4. Pulsa **"Añadir"**.

Aparece el icono de la casita naranja en la pantalla del móvil. Se abre como cualquier app.

---

## PARTE 7 — Si algo falla

### No llegan los correos

Ve probando en este orden:

**1. ¿Está en spam?** Mira la carpeta de correo no deseado. Es lo más habitual la primera vez.

**2. ¿Están bien puestas las variables en Render?**
Entra en Render → tu servicio → **Environment** y comprueba:
- `GMAIL_USER` → la dirección **completa**, con `@gmail.com`.
- `GMAIL_APP_PASSWORD` → 16 letras, **sin espacios**. Este es el fallo más común: si copiaste
  del recuadro de Google, lleva espacios y hay que quitarlos.
- `APP_URL` → tiene que ser `https://casa-cloud.onrender.com`, **no** `localhost`.

**3. Mira qué dice el servidor.**
En Render → tu servicio → pestaña **"Logs"**. Busca líneas que empiecen por `[email]`:

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| `[email] Enviado OK` | El correo salió bien | Está en spam, o el correo del destinatario está mal escrito |
| `Error Gmail: Invalid login` | Gmail rechazó la clave | La contraseña de aplicación está mal, o tiene espacios. Repite el paso 2.2 |
| `EMAIL (modo consola — sin Gmail configurado)` | Faltan las variables | No guardaste bien el paso 2.3 |

**4. Truco mientras lo arreglas:** aunque el correo no salga, **el enlace de invitación aparece
en esos mismos Logs de Render**. Búscalo (empieza por `https://casa-cloud.onrender.com/#/invite`),
cópialo y mándaselo a tu hermano por WhatsApp. Funciona exactamente igual.

### La app tarda mucho en abrir

Normal en el plan gratuito: se duerme a los 15 minutos y tarda ~1 minuto en despertar. Después
va fluido. Si os molesta, Render tiene un plan de pago (~7 $/mes) que la mantiene despierta.
*(Precio observado en 2026; compruébalo en su web.)*

### En el iPhone no aparece el icono

- Tiene que ser **Safari**, no Chrome.
- Si ya lo habías añadido antes, **bórralo y vuelve a añadirlo**: iOS guarda el icono en caché
  y no lo actualiza solo.

### Mi hermano no puede aceptar la invitación

- Tiene que registrarse con **el mismo correo** al que se envió.
- Si la invitación tiene más de 7 días, ha caducado: tu padre la reenvía desde **"Invitaciones"**.
- Un usuario solo puede estar en **una familia**. Si ya está en otra, hay que sacarlo primero.

### Quiero empezar de cero

Tu padre, en su panel: **Economía → "Reiniciar datos"**. Pide confirmación.
Esto borra tareas y puntos, pero **no** borra las cuentas ni la familia.

### He olvidado la contraseña

En la pantalla de inicio de sesión: **"¿Olvidaste tu contraseña?"**. Llega un correo con un
enlace para cambiarla — necesita que el envío de correos (Parte 2) esté funcionando.

---

## Resumen de las variables de Render

Por si necesitas revisarlas de un vistazo:

| Nombre | Valor | Para qué |
|---|---|---|
| `DATABASE_URL` | *(ya puesta)* | Guardar los datos |
| `JWT_SECRET` | *(ya puesta)* | Mantener las sesiones iniciadas |
| `GMAIL_USER` | `tucorreo@gmail.com` | Desde qué cuenta salen los correos |
| `GMAIL_APP_PASSWORD` | 16 letras sin espacios | Permiso de Gmail para enviar |
| `EMAIL_FROM` | `Casa <tucorreo@gmail.com>` | Nombre que ve quien recibe |
| `APP_URL` | `https://casa-cloud.onrender.com` | Base de los enlaces de los correos |

---

## Cosas que conviene saber

- **Todo se sincroniza solo** cada pocos segundos. El puntito verde de arriba indica que hay
  conexión con el servidor (se pone rojo si se pierde).
- **Cada uno tiene su cuenta.** Los datos de tu familia solo los ven los miembros de tu familia.
- **No se mueve dinero real:** la app solo calcula cuánto correspondería dar a cada hijo.
- **Las mejoras llegan solas.** Cuando se actualiza el código, la app se actualiza sola en
  todos los dispositivos. Nadie tiene que reinstalar nada.
- **¿Quieres la app en Google Play?** Hay una guía aparte en
  [`casa-android/GUIA-PLAY-STORE.md`](casa-android/GUIA-PLAY-STORE.md). No hace falta: con la
  Parte 6 ya queda instalada como app. Play Store solo cambia la forma de instalarla en Android.
