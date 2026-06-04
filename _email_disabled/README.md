# _email_disabled — Código de verificación de email (en pausa)

Esta carpeta contiene el código de verificación de email desactivado temporalmente.

## Qué está desactivado

- Envío de emails de verificación al registrarse
- Bloqueo de login hasta verificar email
- Middleware `requireEmailVerified` (ahora es un passthrough)
- Pantalla "verify-pending" en el frontend

## Archivos de backup

- `emailService.js` — servicio Resend completo con plantillas HTML
- `verify-routes.js` — endpoints `/api/auth/verify-email` y `/api/auth/resend-verify`

## Para reactivar cuando el email esté configurado

1. Copiar `_email_disabled/emailService.js` → `services/emailService.js`
2. En `routes/auth.js`:
   - Register: cambiar `email_verified_at = now()` → quitar ese campo del INSERT
   - Login: descomentar el bloqueo `if (!u.email_verified_at) → 403`
   - Añadir de vuelta los endpoints de `verify-routes.js`
3. En `middleware/requireAuth.js`:
   - Revertir `requireEmailVerified` al original (que bloquea si no verificado)
4. En `public/index.html` bootstrap:
   - Añadir de vuelta: `if (!ME.emailVerified) return Auth.show("verify-pending");`
5. Configurar en `.env`:
   - `RESEND_API_KEY=re_xxxxx`
   - `EMAIL_FROM=onboarding@resend.dev` (o dominio verificado)
