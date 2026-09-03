# 📊 Casa — Estado del proyecto

Revisión a 3 de septiembre de 2026, tras **quitar las cuentas** y pasar a perfiles fijos.

Los porcentajes miden **"listo para usar a diario en casa"**, no "cuánto código hay". Un módulo
al 60% funciona pero le falta algo que se echaría en falta al usarlo.

---

## El cambio de rumbo

La app tenía registro, contraseñas, verificación por correo, invitaciones y soporte para varias
familias. Todo eso **se ha eliminado**. Ahora hay cuatro perfiles fijos —Hugo, Marcos, Carla y
el Dashboard de los Papás— y se entra eligiendo uno.

Es una decisión de producto, no un recorte: la app se usa en una casa, y pedirle una contraseña
a un niño de diez años solo conseguía que dejara de usarla.

**Lo que NO se ha eliminado es la identidad dentro de los datos.** Las tareas, los puntos, las
rachas, los canjes, el mercado y el historial siguen colgando de una persona; lo único que
cambió es de dónde sale esa persona: antes de la tabla `users`, ahora de `public/perfiles.js`.

| | Antes | Ahora |
|---|---|---|
| Para entrar | correo + contraseña + verificación | elegir perfil |
| Miembros | filas de `family_members` | los cuatro de `perfiles.js` |
| Estado | `family_state` por familia | `casa_state`, una sola fila |
| Dependencias | 8 | **3** (`express`, `pg`, `dotenv`) |
| Archivos de servidor | 16 | **6** |

---

## Módulo por módulo

### 🟢 Terminado o casi

| Módulo | % | Estado |
|---|---|---|
| **Perfiles** | 95% | Cuatro fijos, ids estables, un único archivo compartido por servidor y navegador. Se recuerda el elegido y se cambia en dos toques |
| **Motor de tareas y dinero** | 95% | Reglas del 75%/100%, reparto LPT, niveles, primas del mercado |
| **Dashboard de los Papás** | **90%** | ✅ *Nuevo.* Pestaña "Los hijos" con visión conjunta y ficha individual de cada uno: semana día a día, adicionales, premios pedidos, carga e historial |
| **Límites por perfil** | 90% | El servidor sanea lo que se guarda y hace cumplir los roles: un hijo no se aprueba tareas ni toca las de sus hermanos |
| **Rachas** | 90% | Las calcula el servidor y se arrastran entre semanas |
| **Premios y canje** | 85% | El hijo pide (puntos reservados), los papás conceden o deniegan, con stock y editor |
| **Menús** | 85% | Desayuno/comida/cena por día con base de platos por tipo. Falta la lista de la compra |
| **Mercado entre hermanos** | 90% | El vendedor acepta o rechaza; no se cierra el trato de golpe |
| **Base de datos** | 90% | Una fila, sin claves foráneas, migraciones idempotentes al arrancar |
| **Concurrencia** | 85% | Control por versión: el servidor rechaza escrituras sobre datos viejos y el cliente refunde sus cambios |
| **PWA / instalación** | 85% | Manifest, service worker, iconos correctos en Android y iOS |
| **Demo pública** | 90% | `/demo` sin tocar la red, con marco de móvil y los mismos cuatro perfiles |
| **Pruebas automatizadas** | 85% | **97 pruebas** (`npm test`), sin dependencias |

### 🟠 A medias

| Módulo | % | Qué falta |
|---|---|---|
| **Avisos** | 60% | Contador de pendientes en las pestañas. No hay push |
| **Logros / insignias** | 55% | 8 insignias fijas, sin progresión ni aviso al desbloquear |
| **Copias de seguridad** | 70% | Exportar e importar funcionan. Falta copia automática |
| **Validación de tareas** | 60% | Los papás aprueban y rechazan. Falta **prueba con foto** |

### 🔴 Sin empezar

| Módulo | % | Problema |
|---|---|---|
| **Notificaciones push** | 0% | Solo hay contador dentro de la app |
| **Modo oscuro / accesibilidad** | 0% | Sin auditar |
| **Validación con foto** | 0% | La aprobación sigue siendo de palabra |

---

## Deuda técnica que queda

### 🟠 La fusión de conflictos es gruesa

No se pierden cambios en silencio (control por versión + refundido), pero la fusión va **por
campo de primer nivel**: si dos dispositivos tocan el mismo campo, uno gana — avisando. La
solución fina sería pasar a acciones granulares (`POST /api/action`) en vez del blob entero.

### 🟠 Dos normalizaciones que tienen que coincidir

`normalizarMenus()` (servidor) y `ensureShape()` (cliente) hacen lo mismo con los platos y los
menús, y **tienen que dar el mismo resultado**. Si divergen vuelve el bucle de repintado. Está
comentado en ambos sitios, pero es una trampa que conviene recordar.

### 🟢 Las tablas viejas siguen en la base de datos

`users`, `families`, `family_members`, `family_state`, `family_invitations` y las de tokens
están huérfanas pero intactas. No estorban y sirven de red por si hubiera que consultar algo del
traslado. Borrarlas es una decisión aparte y a mano.

### 🟢 Todo el cliente en un único `index.html`

~1.800 líneas con estilos y lógica dentro. Funciona y se prueba, pero para crecer conviene
separarlo.

---

## Qué haría a continuación

1. **Accesibilidad**: contraste, tamaños de toque y lectores de pantalla. Sin auditar.
2. **Validación con foto** de las tareas, que estaba en el brief original.
3. **Notificaciones push**, si el contador dentro de la app se queda corto.
4. **Modo oscuro**.
5. **Acciones granulares** en vez del blob, para afinar la fusión de conflictos.

---

## Lo que se arregló por el camino

| | Qué pasaba |
|---|---|
| **Bucle de repintado** | Tres causas distintas, todas del mismo patrón: el cliente arreglaba la forma del estado en local y no la guardaba, así que el sondeo veía diferencia en cada vuelta. Ahora lo arregla el servidor y lo persiste |
| **Una escritura por cada lectura** | `JSON.stringify` comparaba objetos que PostgreSQL devuelve con las claves reordenadas: "no ha cambiado nada" se leía como un cambio. Afectaba a las rachas y a los miembros. Se compara con una huella independiente del orden |
| **Menús rotos** | El estado guardado tenía el texto literal `"[object Object]"` en los siete días |
| **Pestañas compartidas** | Cambiar de sección le movía la pantalla a los demás dispositivos |
| **Reinicio por reloj** | Un móvil con la fecha mal puesta reiniciaba el mes de toda la casa |
| **XSS** | 48 sitios pintaban nombres, iconos y colores sin escapar |
| **Permisos** | Un hijo podía aprobarse sus tareas desde el navegador |
| **Rachas falsas** | Los "🔥 N días" eran números escritos a mano |
| **Canje que no canjeaba** | El botón solo cerraba la ventana |
| **Mercado sin confirmar** | Un hermano se quedaba tu tarea sin que lo aprobaras |
| **Historial a ceros** | El archivo mensual guardaba 0 puntos siempre |
| **Cambios que se pisaban** | Dos dispositivos a la vez y uno perdía su cambio sin avisar |

---

## Nota sobre estos números

Son una valoración razonada, no una medida objetiva: no existe un estándar que diga "una app
está al 95%". Lo objetivo es la lista de lo que falta, que sale de leer el código. Si algún
porcentaje parece optimista o pesimista, lo que importa son las filas de las tablas.
