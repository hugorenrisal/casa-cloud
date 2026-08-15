# 📊 Casa — Estado del proyecto

Revisión del código a 15 de agosto de 2026, **actualizada tras las fases 1-4 de correcciones**.
Compara **qué está hecho de verdad** con lo que se espera hoy de una aplicación publicada.

Los porcentajes miden **"listo para usar en producción"**, no "cuánto código hay". Un módulo
al 60% funciona pero le falta algo que un usuario echaría en falta.

---

## Resumen

| | Antes | Ahora |
|---|---|---|
| **Uso familiar privado** | ~78% | **~91%** |
| **Aplicación publicable en tienda** | ~52% | **~63%** |

La distancia entre las dos columnas son cosas que solo importan al publicar: borrado de cuenta,
cambio de contraseña y accesibilidad.

---

## Módulo por módulo

### 🟢 Terminado o casi

| Módulo | % | Estado |
|---|---|---|
| **Autenticación** | 90% | bcrypt (12 rondas), JWT en cookie httpOnly + SameSite, tokens opacos guardados como SHA-256, rate limiting. Falta: cambiar contraseña estando dentro |
| **Familias y aislamiento** | 90% | Cada consulta filtra por `family_id`. Crear familia, renombrar, expulsar. Falta: transferir la propiedad |
| **Invitaciones** | 85% | Token de un solo uso, caduca a 7 días, revocar y reenviar, el correo debe coincidir |
| **Base de datos** | 85% | PostgreSQL con migraciones idempotentes, 8 tablas, se ejecutan al arrancar |
| **Motor de tareas y dinero** | **95%** | Reglas del 75%/100%, reparto LPT, niveles, primas del mercado. **Ahora con 20 pruebas automáticas** |
| **Permisos y saneado** | **90%** | ✅ *Nuevo.* El servidor sanea todo lo que se guarda y hace cumplir los roles: un hijo no puede aprobarse tareas ni tocar las de sus hermanos |
| **Rachas** | **90%** | ✅ *Arreglado.* Se calculan de verdad en el servidor y se arrastran entre semanas. 14 pruebas |
| **Premios y canje** | **85%** | ✅ *Arreglado.* Flujo completo: el hijo pide (puntos reservados), el padre concede o deniega, con stock y editor de premios |
| **Menús** | **85%** | ✅ *Arreglado.* Estaban rotos en familias nuevas. Ahora desayuno/comida/cena por día, con base de platos por tipo. Falta la lista de la compra |
| **Mercado entre hermanos** | 80% | Publicar, "me la quedo", trueque, primas, historial. Falta: que el vendedor confirme el "me la quedo" |
| **PWA / instalación** | 85% | Manifest, service worker, iconos correctos en Android y iOS. Falta: aviso de versión nueva |
| **Demo pública** | 95% | `/demo` sin contraseña, sin tocar la red, con marco de móvil y cambio de rol |
| **Pruebas automatizadas** | **70%** | ✅ *Nuevo.* 62 pruebas (`npm test`) sobre dinero, reparto, saneado, permisos, rachas, canje y migraciones. Falta: pruebas de las rutas HTTP |

### 🟠 A medias

| Módulo | % | Qué falta |
|---|---|---|
| **Avisos** | 60% | Contador de pendientes en las pestañas (Validar, Premios, Mercado). No hay push ni correo |
| **Logros / insignias** | 55% | 8 insignias fijas, sin progresión ni aviso al desbloquear |
| **Copias de seguridad** | 70% | Exportar e importar funcionan. Falta: copia automática |
| **Validación de tareas** | 60% | El padre aprueba y rechaza. Falta: **prueba con foto**, y marcar "vencida" sigue siendo manual |

### 🔴 Sin empezar

| Módulo | % | Problema |
|---|---|---|
| **Penalizaciones automáticas** | 0% | Nada vence solo |
| **Borrado de cuenta** | 0% | ⚠️ Google Play **lo exige** a toda app con registro |
| **Cambio de contraseña** | 0% | Solo se puede recuperar por correo, no cambiar estando dentro |
| **Modo oscuro / accesibilidad** | 0% | Sin auditar |

---

## Deuda técnica que queda

### 🟠 Concurrencia "el último que escribe gana"

Cada guardado manda **el estado completo**. Si dos dispositivos editan con pocos segundos de
diferencia, uno pisa al otro sin avisar. Es la mayor debilidad que queda. La solución sería
pasar a acciones granulares (`POST /api/action`) en vez del blob entero.

### 🟠 Verificación de email desactivada

Apagada a propósito (`_email_disabled/`, con instrucciones para reactivarla). Se decidió dejarla
así para no poner fricción a los críos: como solo se entra por invitación a un correo concreto,
la invitación ya prueba que ese correo existe.

### 🟢 Todo el cliente en un único `index.html`

~1.700 líneas con estilos y lógica dentro. Funciona y se prueba, pero para crecer conviene
separarlo.

---

## Comparación con lo que se espera hoy

| Lo que se da por hecho en una app actual | Casa |
|---|---|
| Registro y sesión seguros | ✅ |
| Datos separados por cuenta | ✅ |
| Permisos comprobados en el servidor | ✅ |
| Instalable en el móvil | ✅ |
| Pruebas automatizadas | ✅ 62 |
| Aviso de privacidad | ✅ |
| Funciona sin conexión | 🟠 solo el cascarón |
| Avisos de pendientes | 🟠 contador, sin push |
| Borrado de cuenta | ❌ |
| Cambiar la contraseña | ❌ |
| Modo oscuro | ❌ |
| Accesibilidad revisada | ❌ sin auditar |

---

## Qué haría a continuación

1. **Confirmación del "me la quedo"** en el mercado: hoy se cierra directo y el vendedor se
   entera después.
2. **Penalizaciones por vencimiento**, para que el padre no tenga que marcar "vencida" a mano.
3. **Borrado de cuenta y cambio de contraseña** — los dos requisitos que faltan para Play Store.
4. **Pruebas de las rutas HTTP**, que hoy solo están cubiertas indirectamente.
5. **Concurrencia**: pasar de guardar el estado entero a acciones granulares.

---

## Lo que se arregló en las fases 1-4

| | Qué pasaba |
|---|---|
| **Bucle de repintado** | La pantalla se refrescaba sola cada 4 s. Medido ahora: **0 repintados en 26 s** |
| **Pestañas compartidas** | Cambiar de sección le movía la pantalla a los demás dispositivos |
| **Reinicio por reloj** | Un móvil con la fecha mal puesta reiniciaba el mes de toda la familia |
| **Menús rotos** | Las familias nuevas veían `[object Object]` |
| **XSS** | 48 sitios pintaban nombres, iconos y colores sin escapar |
| **Permisos** | Un hijo podía aprobarse sus tareas desde el navegador |
| **Rachas falsas** | Los "🔥 N días" eran números escritos a mano |
| **Canje que no canjeaba** | El botón solo cerraba la ventana |

---

## Nota sobre estos números

Son una valoración razonada, no una medida objetiva: no existe un estándar que diga "una app
está al 91%". Lo objetivo es la lista de lo que falta, que sale de leer el código. Si algún
porcentaje te parece optimista o pesimista, lo que importa son las filas de las tablas.
