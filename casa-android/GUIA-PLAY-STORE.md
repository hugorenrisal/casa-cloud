# 📱 Casa — Guía para publicar la app en Google Play

Esta guía te lleva desde lo que ya tienes hasta tener la app instalada en los móviles de tus
hijos **desde Google Play**, como cualquier otra app, en un **canal privado**: no aparece en
las búsquedas y solo puede instalarla quien tú invites por correo.

**Tiempo real:** unas 2-3 horas de trabajo repartidas, más **esperas** que no dependen de ti
(la verificación de identidad de Google puede tardar días).

---

## Antes de nada: lee esto

### Qué es realmente esta app de Android

No es una app "de verdad" con el código dentro. Es un **envoltorio** (se llama TWA) que abre
tu página web a pantalla completa, sin barra de navegador, con su icono en el móvil.

Esto tiene una consecuencia **muy buena**: cuando cambies algo de la app, se actualiza sola al
desplegar en Render. **No hay que volver a pasar por Google Play** cada vez.

Y una consecuencia importante: **sigue necesitando el servidor**. Si Render está caído o el
móvil no tiene internet, la app no funciona.

### ¿De verdad necesitas Play Store?

Sé honesto contigo mismo antes de gastar tiempo y dinero. Con la web ya puedes hacer
**"Añadir a pantalla de inicio"** en Android y en iPhone: queda con su icono, a pantalla
completa, y funciona igual. **Es gratis e inmediato.**

Play Store te aporta: instalación más "normal" para los chavales, actualizaciones gestionadas
y que no dependa de que nadie borre sin querer el acceso directo. Te cuesta: **25 $**, la
verificación de identidad y este rato de configuración.

Y hay algo que **no** te aporta: en iPhone esto no sirve de nada. Apple no permite TWAs; en
iPhone se seguirá usando "Añadir a pantalla de inicio".

### El acceso: no hay

Esta versión **no tiene cuentas**: ni registro, ni contraseñas, ni correo. Se entra eligiendo
uno de los cuatro perfiles fijos (Hugo, Marcos, Carla y el Dashboard de los Papás).

⚠️ **Piénsatelo dos veces antes de publicarla en Google Play.** Sin acceso, cualquiera que la
instale desde la tienda entra directamente en los datos de vuestra casa: la dirección del
servidor va dentro del paquete. Eso es razonable en una app privada cuya dirección solo
conocéis vosotros, pero deja de serlo en una tienda pública.

Si lo que querías era el icono en el móvil, **con "Añadir a pantalla de inicio" ya lo tienes**
(ver la guía de instalación) y no hace falta pasar por Play Store.

Lo único que sí debes comprobar antes de publicar: que la variable `DATABASE_URL` está puesta
en Render. Sin base de datos la app no puede guardar nada.

---

## PARTE 1 — Preparativos (aquí es donde se espera)

1. Entra en **https://play.google.com/console** con tu cuenta de Google.
2. Crea una **cuenta de desarrollador personal**: hay que pagar **25 $ una sola vez** (no es
   una suscripción).
3. Google te pedirá **verificar tu identidad** con un documento. **Esto puede tardar de unas
   horas a varios días.** No puedes hacer nada para acelerarlo; sigue con la Parte 2 mientras.

> **Dato importante y que sorprende a mucha gente:** los requisitos de "12 probadores durante
> 14 días" son para pasar a **producción pública**. Como vas a quedarte en **pruebas cerradas**,
> **no te aplican**. Puedes quedarte en ese canal indefinidamente.

---

## PARTE 2 — Instalar las herramientas (en tu ordenador)

1. **JDK 17.** Descárgalo de https://adoptium.net (elige "Temurin 17 (LTS)").
   ⚠️ Si ya tienes Java, comprueba la versión: **el Java 8 no vale**. Abre una terminal y
   escribe `java -version`.
2. **Android Studio**, de https://developer.android.com/studio. Al instalarlo, acepta las
   opciones por defecto: lo que necesitas es el **SDK** que trae dentro.
3. **Bubblewrap**, la herramienta que fabrica la app. En una terminal:

```bash
npm install -g @bubblewrap/cli
```

---

## PARTE 3 — Crear tu clave de firma

Es tu firma digital: demuestra a Google que las actualizaciones las mandas tú.

En una terminal, dentro de la carpeta `casa-android`:

```bash
keytool -genkeypair -v -keystore casa-firma.keystore -alias casa -keyalg RSA -keysize 2048 -validity 10000
```

Te pedirá inventarte una contraseña y unos datos (nombre, ciudad…; puedes poner lo que quieras).

> 🔴 **Lo más importante de toda la guía.**
> - **Guarda ese archivo `casa-firma.keystore` y su contraseña en tu gestor de contraseñas.**
> - Si los **pierdes**, no podrás volver a actualizar tu app **nunca**. Habría que publicar una
>   app nueva desde cero.
> - No los subas a GitHub (ya están excluidos en `.gitignore`).
> - Cuando Play Console te lo ofrezca, **activa "Play App Signing"**: Google guarda una copia
>   de seguridad de la clave por ti. Actívalo.

---

## PARTE 4 — Fabricar la app

Tu dirección (`https://casa-cloud.onrender.com`) **ya está configurada** en
`twa-manifest.json`. No tienes que editar nada.

En la terminal, dentro de la carpeta `casa-android`:

```bash
bubblewrap init --manifest https://casa-cloud.onrender.com/manifest.webmanifest
```

Te hará preguntas; casi todas ya vienen respondidas desde `twa-manifest.json`, así que puedes
aceptar pulsando Enter. Cuando pregunte por la clave, indícale `casa-firma.keystore` y `casa`.

```bash
bubblewrap build
```

Al terminar tendrás el archivo **`app-release-bundle.aab`**. Ese es tu app.

---

## PARTE 5 — Subirla a Google Play

1. En Play Console: **"Crear una aplicación"**. Nombre: `Casa`. Idioma: español. Tipo:
   **Aplicación**. Gratuita.
2. En el menú izquierdo, ve a **"Pruebas" → "Pruebas cerradas"** → crea una versión.
3. Sube el archivo `app-release-bundle.aab`.
4. En **"Testers"**, añade los **correos de Gmail** de tu familia. Solo esas cuentas podrán
   instalarla.
5. Google te pedirá rellenar unos formularios obligatorios. Aquí van las respuestas:

### Ficha de Play Store
- **Descripción breve:** «Organiza las tareas del hogar en familia.»
- **Icono:** usa `public/iconos/icono-512.png` (ya está generado).
- **Capturas:** haz 2-3 fotos de pantalla desde el móvil de un hijo.
- **Política de privacidad:** `https://casa-cloud.onrender.com/privacidad.html`
  (ya está publicada; **abre ese archivo y pon tu correo** donde dice `RELLENA-TU-CORREO`).

### Formulario "Seguridad de los datos"

⚠️ Contesta esto con cuidado: una declaración falsa es motivo de retirada de la app. Esta
versión **no recoge correos ni contraseñas**, porque no tiene cuentas: lo único personal son
los nombres de pila y la actividad dentro de la app.

- ¿Recoge datos? **Sí.**
- **Información personal → Nombre:** sí. Recogido, no compartido. Obligatorio.
  Finalidad: funcionalidad de la app. Son nombres de pila, escritos en el propio código.
- **Información personal → Dirección de correo electrónico:** **no**. La app no pide correo.
- **Información personal → Contraseña (credenciales):** **no**. La app no tiene contraseñas.
- **Actividad en la app → Acciones en la app:** sí (tareas marcadas, puntos, intercambios).
- ¿Se cifran en tránsito? **Sí** (HTTPS).
- ¿Puede el usuario pedir que se borren sus datos? **Sí.**
- ¿Se comparten con terceros? **No.** La app no envía correos ni usa ningún servicio de
  mensajería, analítica o publicidad.

### Clasificación de contenido
Cuestionario normal: **sin violencia, sin contenido sexual, sin apuestas, sin compras**.
Saldrá apta para todos los públicos.

### Público objetivo
Aquí Google pregunta si va dirigida a menores. Como se distribuye **solo a tu familia en un
canal cerrado**, marca el rango de edad real de tus hijos y responde con sinceridad.
Al no ser pública, no entras en el programa "Aptas para toda la familia".

---

## PARTE 6 — La verificación de dominio (no te la saltes)

Es lo que hace que la app abra **a pantalla completa** en vez de con la barra del navegador.
El orden importa, porque el dato no existe hasta que subes la app:

1. En Play Console: **"Integridad de la app"** → **"Firma de apps de Google Play"**.
2. Copia la huella **SHA-256** (una ristra larga de números y letras separados por `:`).
3. En **Render** → **Environment** → **Add Environment Variable**:
   - **Key:** `ANDROID_FINGERPRINT`
   - **Value:** la huella que acabas de copiar
4. Guarda y espera al redespliegue.
5. Comprueba abriendo en el navegador:
   `https://casa-cloud.onrender.com/.well-known/assetlinks.json`

Si ves un JSON con tu huella, está bien. Si ves un error diciendo `Falta ANDROID_FINGERPRINT`,
la variable aún no ha llegado: espera un minuto y recarga.

---

## PARTE 7 — Instalarla en los móviles

1. En Play Console, en tu canal de pruebas cerradas, copia el **enlace de participación**.
2. Mándaselo a tus hijos (o ábrelo tú en su móvil).
3. Aceptan ser probadores y les aparece el botón de **instalar desde Google Play**.
4. Al abrirla, cada uno **crea su cuenta** (o acepta la invitación que le hayas mandado por
   correo desde la app) y entra en la familia.

---

## Preguntas que vas a tener

**¿Cada vez que cambie algo hay que volver a subir la app?**
No. La app abre tu web, así que los cambios llegan solos al desplegar en Render. Solo hay que
volver a Google Play si cambias el icono, el nombre o la dirección.

**¿Y el iPhone?**
Apple no admite esto. En iPhone se sigue usando Safari → Compartir → "Añadir a pantalla de
inicio". Con el trabajo ya hecho (icono y manifest), queda igual de bien.

**¿Sale la app si alguien la busca en Play Store?**
No. En pruebas cerradas solo la ve quien esté en tu lista de correos.

**Si quisiera publicarla en abierto algún día, ¿qué falta?**
Menos de lo que parece, porque las cuentas y las familias ya están hechas. Faltaría: cumplir
la **política de Familias** de Google (que exige, entre otras cosas, control parental
verificable y una revisión adicional de la ficha), revisar el **RGPD** con alguien que sepa
—son datos de menores— y añadir un flujo de borrado de cuenta accesible desde la propia app,
que Google exige a las apps que permiten registrarse.

**La app abre con la barra del navegador arriba.**
Falta la Parte 6, o la huella está mal copiada. Comprueba la dirección `/.well-known/assetlinks.json`.

**He perdido el archivo de la clave.**
Si activaste "Play App Signing", escribe al soporte de Google Play: pueden ayudarte a
restablecerla. Si no lo activaste, no hay solución: habría que publicar una app nueva.
