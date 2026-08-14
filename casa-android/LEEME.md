# Paquete para Google Play

Esta carpeta contiene todo lo necesario para publicar **Casa** en Google Play como app de
Android (TWA), en un canal **privado** de pruebas cerradas.

## Por dónde empezar

- **[GUIA-PLAY-STORE.md](GUIA-PLAY-STORE.md)** — la guía completa, paso a paso, sin jerga.
  Empieza por aquí.
- **[COMPILAR.md](COMPILAR.md)** — solo los comandos, si te manejas con la terminal.

## Estado

| | |
|---|---|
| Dirección configurada | `https://casa-cloud.onrender.com` (ya puesta en `twa-manifest.json`) |
| PWA en el servidor | hecha: `public/manifest.webmanifest`, `public/sw.js`, `public/iconos/` |
| Ruta de verificación | hecha: `/.well-known/assetlinks.json` en `server.js` |
| Política de privacidad | hecha: `public/privacidad.html` — **falta poner tu correo** |
| Archivo `.aab` | **no generado**: hace falta JDK 17 + Android SDK |
| Huella de firma | **pendiente**: la da Google Play tras subir la app (variable `ANDROID_FINGERPRINT`) |

## Antes de publicar

1. Abre `public/privacidad.html` y sustituye `RELLENA-TU-CORREO@ejemplo.com` por tu correo.
2. Despliega en Render (los archivos nuevos aún no están online).
3. Sigue la guía.

## Recordatorio

La app de Android es un **envoltorio** de la web: los cambios que hagas se publican al desplegar
en Render, **sin volver a pasar por Google Play**. Solo hay que subir un `.aab` nuevo si cambias
el icono, el nombre o la dirección.
