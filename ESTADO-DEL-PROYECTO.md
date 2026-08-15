# 📊 Casa — Estado del proyecto

Auditoría del código a 15 de agosto de 2026. Revisa **qué está hecho de verdad** frente a lo
que se espera hoy de una aplicación publicada.

Los porcentajes miden **"listo para usar en producción"**, no "cuánto código hay". Un módulo
al 60% funciona pero le falta algo que un usuario echaría en falta.

---

## Resumen

| | |
|---|---|
| **Uso familiar privado (lo que quieres ahora)** | **~78%** |
| **Aplicación publicable en tienda** | **~52%** |

La diferencia está en cosas que solo importan al publicar: borrado de cuenta, notificaciones,
avisos legales, pruebas automatizadas.

---

## Módulo por módulo

### 🟢 Terminado o casi

| Módulo | % | Estado |
|---|---|---|
| **Autenticación** | 90% | bcrypt (12 rondas), JWT en cookie httpOnly + SameSite, tokens opacos guardados como SHA-256, rate limiting en login/registro/recuperación. Falta: cambiar contraseña estando dentro, y la verificación de email está desactivada |
| **Familias y aislamiento** | 90% | Cada consulta filtra por `family_id`; una familia no puede ver otra. Crear familia, renombrar, expulsar miembros. Falta: transferir la propiedad, y que un usuario pueda estar en dos familias |
| **Invitaciones** | 85% | Token de un solo uso, caduca a 7 días, revocar y reenviar, comprobación de que el correo coincide. Depende de que el envío de correo esté configurado |
| **Base de datos** | 85% | PostgreSQL con migraciones idempotentes, 8 tablas, se ejecutan solas al arrancar. Falta: índices revisados y copia de seguridad automática |
| **Motor de tareas y dinero** | 85% | Fijas diarias/semanales, adicionales repartidas por peso (LPT), regla del 75%/100%, niveles y puntos. Probado numéricamente. Falta: el reparto no compensa entre semanas |
| **Mercado entre hermanos** | 80% | Publicar, "me la quedo", trueque con oferta y aceptación, primas en puntos, historial. Falta: que el vendedor confirme el "me la quedo" |
| **PWA / instalación** | 85% | Manifest, service worker, iconos correctos en Android y iOS, funciona sin conexión el cascarón. Falta: aviso en la app cuando hay versión nueva |
| **Demo pública** | 95% | `/demo` sin contraseña, sin tocar la red, con marco de móvil y cambio de rol |

### 🟠 A medias

| Módulo | % | Qué falta |
|---|---|---|
| **Menús** | 70% | Editar por día y generar semana funcionan. Falta la **lista de la compra** (se descartó, pero hoy se espera) |
| **Logros / insignias** | 55% | La rejilla existe y las condiciones se evalúan, pero son 8 fijas y no hay progresión ni aviso al desbloquear |
| **Copias de seguridad** | 70% | Exportar e importar JSON funcionan. Falta: copia automática programada |
| **Validación de tareas** | 60% | El padre aprueba/rechaza. Falta: **prueba con foto**, y marcar "vencida" es manual |

### 🔴 Incompleto o solo aparente

| Módulo | % | Problema |
|---|---|---|
| **Premios / canje** | **25%** | ⚠️ **El botón "Enviar solicitud" no hace nada**: llama a `closeSheet()` y se acaba ahí. No descuenta puntos, no crea ninguna solicitud, y al padre no le llega nada. Además el padre **no tiene ninguna pantalla para editar los premios**: están fijos en el código |
| **Rachas (🔥 días)** | **10%** | ⚠️ Los números que se ven (4, 2, 6 días) son **valores de ejemplo escritos a mano**. No se calculan nunca. La insignia "Racha 3" se basa en ese dato falso |
| **Notificaciones** | **0%** | No hay ninguna. Ni push, ni por correo, ni dentro de la app. Nadie se entera de que tiene algo por validar o de que le han aprobado una tarea |
| **Penalizaciones automáticas** | **0%** | Nada vence solo. El padre tiene que marcar "vencida" a mano tarea por tarea |
| **Borrado de cuenta** | **0%** | ⚠️ Google Play **lo exige** a toda app con registro. Hoy no hay forma de borrar una cuenta desde la app |
| **Pruebas automatizadas** | **0%** | No hay ni una. Cada cambio se comprueba a mano; una regresión puede pasar inadvertida |

---

## Deuda técnica que conviene conocer

### 🔴 Escapado de textos incompleto (XSS)

En `public/index.html`, los **nombres de miembros, los iconos y los colores** se insertan en el
HTML **sin escapar** (unas 40 apariciones). Además `esc()` no cubre la comilla simple.

Para explotarlo hay que **ser ya miembro de la familia**, así que no es un agujero abierto a
internet — pero un hijo podría inyectar contenido en el panel de su padre. Esto **ya se corrigió
en el prototipo** y **no se ha traído aquí**.

### 🔴 El servidor apenas valida el estado

`isValidState()` solo comprueba que `fixedTasks` y `extraTasks` sean arrays. Cualquier miembro
de la familia puede guardar prácticamente cualquier JSON, incluidos textos con HTML o
referencias a tareas que no existen (que rompen la pantalla de todos). El prototipo tiene un
saneador completo que tampoco se ha traído.

### 🟠 Concurrencia "el último que escribe gana"

Cada guardado manda **el estado completo**. Si dos dispositivos editan con pocos segundos de
diferencia, uno pisa al otro sin avisar. Lo vi ocurrir durante las pruebas.

### 🟠 Cualquier miembro puede escribir todo el estado

`PUT /api/state` solo pide estar en la familia. Un hijo podría, con las herramientas del
navegador, aprobarse sus propias tareas o cambiarse la paga. Las comprobaciones de rol están en
la interfaz, no en el servidor.

### 🟠 Verificación de email desactivada

Está apagada a propósito (`_email_disabled/`). Cualquiera puede registrarse con un correo que no
es suyo. Ahora que el envío funciona, se puede reactivar.

---

## Comparación con lo que se espera hoy

| Lo que se da por hecho en una app actual | Casa |
|---|---|
| Registro y sesión seguros | ✅ |
| Datos separados por cuenta | ✅ |
| Instalable en el móvil | ✅ |
| Funciona sin conexión | 🟠 solo el cascarón |
| Notificaciones | ❌ |
| Borrado de cuenta | ❌ |
| Cambiar la contraseña | ❌ |
| Modo oscuro | ❌ |
| Accesibilidad revisada | ❌ sin auditar |
| Pruebas automatizadas | ❌ |
| Aviso de privacidad | ✅ |

---

## Qué arreglaría, por orden

1. **Las rachas y el canje de premios**, o quitarlos de la interfaz. Hoy prometen algo que no
   ocurre, y eso en una app para niños se nota enseguida: pulsan "Canjear", no pasa nada, y
   pierden la confianza en el sistema.
2. **Traer el saneado y el escapado del prototipo.** Es trabajo ya hecho y probado.
3. **Comprobar los permisos en el servidor**, no solo en la pantalla.
4. **Notificaciones** — aunque sea un simple contador de "pendientes" al abrir.
5. **Borrado de cuenta**, imprescindible antes de publicar en Play Store.
6. **Unas pruebas mínimas** sobre las reglas del dinero y el reparto.

---

## Nota sobre estos números

Son una valoración razonada, no una medida objetiva: no existe un estándar que diga
"una app está al 73%". Lo que sí es objetivo es la lista de lo que falta, que sale de leer el
código. Si algún porcentaje te parece optimista o pesimista, lo importante son las filas de las
tablas, no la cifra.
