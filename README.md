# 🏠 Casa Cloud

App familiar de gestión de tareas, paga semanal, menús y recompensas, con autenticación real y soporte multi-familia.

- **Backend:** Node.js + Express + PostgreSQL.
- **Auth:** propia (bcrypt + JWT en cookie httpOnly).
- **Email:** Gmail SMTP con la cuenta de la familia (o impresión por consola en dev).
- **Persistencia:** PostgreSQL (Neon / Supabase / local).

> 📖 **¿No eres desarrollador?** Usa la **[GUÍA DE INSTALACIÓN](GUIA-INSTALACION.md)**: explica
> paso a paso, sin jerga, cómo configurar el envío de correos y poner la app en el ordenador y
> en los móviles de la familia.

## Requisitos

- Node.js 18+
- PostgreSQL alcanzable por `DATABASE_URL` (recomendado: [Neon Free](https://neon.tech))
- (Opcional) una cuenta de Gmail con contraseña de aplicación si quieres enviar emails reales
  (https://myaccount.google.com/apppasswords)

## Setup local

```bash
git clone https://github.com/hugorenrisal/casa-cloud.git
cd casa-cloud
npm install
cp .env.example .env
# editar .env con DATABASE_URL, JWT_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD, etc.
npm start
```

Abre `http://localhost:3000`.

> Si no defines `GMAIL_USER` / `GMAIL_APP_PASSWORD`, los emails se imprimen por **consola** en lugar de enviarse — útil en desarrollo. Copia la URL del email desde la terminal y pégala en el navegador.
>
> Para probar el envío real: `node test-email.js tu@correo.com`

### Generar `JWT_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Variables de entorno

Ver `.env.example`. Las críticas:

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | sí | PostgreSQL con SSL |
| `JWT_SECRET` | sí | ≥32 caracteres aleatorios |
| `GMAIL_USER` | en producción | Gmail completo; si falta → emails a consola |
| `GMAIL_APP_PASSWORD` | en producción | contraseña de aplicación de 16 letras, no la normal |
| `EMAIL_FROM` | no | por defecto usa GMAIL_USER |
| `APP_URL` | sí | base de los enlaces de email |
| `PORT` | no | por defecto 3000 |

## Flujos

1. **Registro** → email + contraseña + nombre. La cuenta queda activa al momento.
2. ~~Verificación por email~~ → **desactivada temporalmente** (el código está en
   `_email_disabled/`, con instrucciones para reactivarlo en su `README.md`).
3. **Login** → JWT cookie httpOnly (7 días).
4. **Onboarding** → elige rol (padre o hijo).
5. **Padre** → crea familia. Invita por email a co-padres e hijos.
6. **Hijo** → acepta invitación. Queda unido a la familia.
7. **App** → padre ve dashboard; hijo ve vista móvil.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Crea cuenta, envía email |
| POST | `/api/auth/login` | Sesión + cookie |
| POST | `/api/auth/logout` | Borra cookie |
| GET | `/api/auth/me` | Info del usuario actual |
| POST | `/api/auth/verify-email` | Confirma email |
| POST | `/api/auth/resend-verify` | Reenvía email de verificación |
| POST | `/api/auth/forgot-password` | Envía email de reset |
| POST | `/api/auth/reset-password` | Cambia contraseña con token |
| POST | `/api/onboarding/role` | Elige rol (parent\|child) |
| POST | `/api/onboarding/create-family` | Solo padres |
| GET | `/api/families/current` | Familia + miembros |
| PATCH | `/api/families/:id` | Renombrar (padres) |
| DELETE | `/api/families/:id/members/:uid` | Expulsar (padres) |
| POST | `/api/families/:id/invitations` | Crear invitación |
| GET | `/api/families/:id/invitations` | Listar invitaciones |
| POST | `/api/families/:id/invitations/:inv/revoke` | Revocar |
| POST | `/api/families/:id/invitations/:inv/resend` | Reenviar |
| GET | `/api/invitations/preview/:token` | Info pública previa |
| POST | `/api/invitations/accept` | Aceptar (auth) |
| GET | `/api/state` | Estado de mi familia |
| PUT | `/api/state` | Guardar estado |
| GET | `/api/backup` | Descargar copia (padres) |
| POST | `/api/restore` | Restaurar copia (padres) |
| POST | `/api/reset` | Reinicio (padres) |

## Estructura

```
casa-cloud/
├── server.js                 # Bootstrap Express + montaje de rutas
├── db/
│   ├── index.js              # Pool PostgreSQL
│   ├── schema.js             # Ejecutor de migraciones
│   └── migrations/*.sql      # Migraciones idempotentes
├── middleware/
│   ├── requireAuth.js
│   └── requireFamily.js
├── routes/
│   ├── auth.js
│   ├── onboarding.js
│   ├── families.js
│   ├── invitations.js
│   └── state.js
├── services/
│   ├── authService.js        # bcrypt, JWT, tokens, validaciones
│   ├── emailService.js       # Gmail SMTP + plantillas
│   └── familyService.js
└── public/
    └── index.html            # SPA (auth + app)
```

## Despliegue (Render + Neon)

1. Crea proyecto gratuito en **[Neon](https://neon.tech)** → copia *Pooled connection string*.
2. Sube este repo a GitHub.
3. Crea **Web Service** en [Render](https://render.com): build `npm install`, start `npm start`.
4. Variables de entorno en Render:
   - `DATABASE_URL` (Neon)
   - `JWT_SECRET` (genera uno largo y aleatorio)
   - `GMAIL_USER=tunombre@gmail.com`
   - `GMAIL_APP_PASSWORD` (contraseña de aplicación, no la normal)
   - `APP_URL=https://<tu-app>.onrender.com`
   - `NODE_ENV=production`
5. Despliega. Las migraciones corren automáticamente al arrancar.

## Seguridad

- Hash de contraseñas con bcrypt (12 rondas).
- JWT firmado HS256 en cookie **httpOnly + SameSite=Lax** (Secure en producción).
- Tokens opacos (invitación, verify, reset) guardados como **SHA-256** — nunca en plano.
- Invitaciones con expiración 7 días + revocables + uso único.
- Rate limiting en login, registro, recuperación de contraseña e invitaciones.
- Validación server-side de ownership familiar en cada endpoint.
- Aislamiento total entre familias (toda lectura/escritura filtrada por `family_id`).

## Limitaciones conocidas (v1)

- Sin refresh tokens (JWT 7 días, sin blacklist).
- Sin eliminación de cuenta/datos por el usuario (RGPD).
- Una sola familia por usuario.
- Sin notificaciones push.
- Polling cada 4 s para sincronizar entre dispositivos.

## Licencia

Privado — uso familiar.
