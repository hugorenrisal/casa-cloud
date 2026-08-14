# Compilar la app de Android (referencia técnica rápida)

> Si no te manejas con la terminal, usa **[GUIA-PLAY-STORE.md](GUIA-PLAY-STORE.md)**, que
> explica lo mismo paso a paso y sin dar nada por sabido.

## Qué hace falta

| Requisito | Comprobación |
|---|---|
| Node 18+ | `node -v` |
| JDK **17** (no vale el 8) | `java -version` |
| Android SDK (viene con Android Studio) | variable `ANDROID_HOME` definida |
| Bubblewrap | `npm i -g @bubblewrap/cli` |
| La app **desplegada en https** | abre tu dirección en el navegador |

> ⚠️ En el ordenador donde se escribió esto había **Java 8 y ningún Android SDK**, así que el
> `.aab` **no se ha generado ni probado**. Los pasos son los estándar de Bubblewrap.

## 1. Crear la clave de firma (una sola vez, para siempre)

```bash
keytool -genkeypair -v -keystore casa-firma.keystore -alias casa -keyalg RSA -keysize 2048 -validity 10000
```

Te pedirá una contraseña y algunos datos. **Apunta la contraseña en tu gestor de contraseñas.**

- Si **pierdes** este archivo o su contraseña, **no podrás publicar actualizaciones nunca más**.
- Si alguien te lo **roba**, puede firmar apps haciéndose pasar por ti.
- Está en `.gitignore`: no se sube a GitHub. Guarda una copia aparte (disco externo o gestor).

## 2. La dirección ya está puesta

`twa-manifest.json` apunta a `https://casa-cloud.onrender.com`. No hay que tocarlo.
(Solo si cambias de dominio: ver el comentario dentro de ese archivo.)

## 3. Generar el proyecto y compilar

```bash
cd casa-android
bubblewrap init --manifest https://casa-cloud.onrender.com/manifest.webmanifest
```

```bash
bubblewrap build
```

Sale `app-release-bundle.aab`. Eso es lo que se sube a Google Play.

## 4. Verificación de dominio (el paso que más se atasca)

El orden **importa**, porque la huella no existe hasta después de subir la app:

1. Sube el `.aab` a Play Console.
2. Ve a **Integridad de la app → Firma de apps de Google Play** y copia el **SHA-256**.
3. En Render: **Environment → Add Environment Variable** → `ANDROID_FINGERPRINT` = esa huella.
4. Espera al redespliegue y comprueba:

```bash
curl https://casa-cloud.onrender.com/.well-known/assetlinks.json
```

Debe devolver un JSON con tu huella. Si devuelve el error `Falta ANDROID_FINGERPRINT`, la
variable no ha llegado todavía.

Sin este paso la app **abre con la barra del navegador visible** en lugar de a pantalla completa.

## 5. Actualizaciones posteriores

La app es un envoltorio de la web: **los cambios de la app se publican solos** al desplegar en
Render, sin tocar Google Play. Solo hace falta subir un `.aab` nuevo si cambias el icono, el
nombre o la dirección. En ese caso sube `appVersionCode` en `twa-manifest.json` y repite el paso 3.
