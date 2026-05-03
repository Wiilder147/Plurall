# Guía de Integración de Servicios — PLURALL

> **Versión:** Sprint 5+ (estado actual del proyecto)  
> **Costo mensual:** $0 COP bajo condiciones normales de desarrollo

---

## 1. Supabase (Base de Datos + Auth + Storage)

### Credenciales
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. **Project Settings → API** → copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### Configuración de Auth
- **Authentication → Providers → Email**: habilitar.
- **URL Configuration → Site URL**: `http://localhost:3000` (dev) / tu dominio (prod).
- **Redirect URLs**: agregar `http://localhost:3000/auth/callback`.

### Aplicar el esquema de BD
Ejecutar en orden en **SQL Editor**:
```
1. db/plurall_database_completa.sql   ← Esquema base (tablas, RLS, catálogos)
2. db/migration_v2_solicitar.sql      ← Campos de dirección y financieros
3. db/01_mejoras_integridad.sql       ← Constraints y trigger de saldos
4. db/02_vistas_reporteria.sql        ← Vistas materializadas de KPIs
5. db/03_cron_mora_automatica.sql     ← pg_cron mora diaria + trigger antifraude
```

También ejecutar los triggers de autenticación en `docs/triggers_y_funciones.md`.

### Storage — Bucket KYC
1. **Storage → New Bucket** → nombre: `documentos-kyc` → **privado**.
2. Aplicar política RLS:
```sql
CREATE POLICY "Clientes gestionan sus docs"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documentos-kyc'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'documentos-kyc'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Crear usuario ADMIN
```sql
-- 1. Registrar el usuario normalmente en la app (/registro)
-- 2. Cambiar su rol en SQL Editor:
UPDATE perfil_usuario
SET id_rol = (SELECT id_rol FROM rol WHERE nombre_rol = 'ADMIN')
WHERE id = 'UUID-DEL-USUARIO';
```

---

## 2. Wompi (Pasarela de Pagos)

1. Ir a [comercios.wompi.co](https://comercios.wompi.co) → crear cuenta.
2. **Desarrolladores → Llaves del comercio** → copiar:
   - `Llave Pública de Pruebas` → `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`
   - `Llave Privada de Pruebas` → `WOMPI_PRIVATE_KEY`
3. **Desarrolladores → Integridad** → copiar secreto → `WOMPI_INTEGRITY_SECRET`
4. **Desarrolladores → Webhooks** → agregar URL:
   - `https://TU-DOMINIO.vercel.app/api/webhooks/wompi`
   - Copiar el secreto → `WOMPI_EVENTS_SECRET`

---

## 3. Resend (Emails transaccionales)

> **Sandbox:** En modo gratuito solo puedes enviar al email de tu cuenta Resend.

1. Ir a [resend.com](https://resend.com) → crear cuenta.
2. **API Keys → Create API Key** → copiar → `RESEND_API_KEY`
3. Usar como remitente: `onboarding@resend.dev` → `RESEND_FROM_EMAIL`
4. Para producción con dominio propio: **Domains → Add Domain** y verificar DNS.

---

## 4. Upstash Redis (Rate Limiting)

1. Ir a [upstash.com](https://upstash.com) → crear cuenta.
2. **Create Database → Redis** → región `us-east-1` → nombre `plurall`.
3. **REST API** → copiar:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Usado en `/api/pagos/iniciar` para limitar 5 intentos de pago por usuario cada 10 minutos.

---

## 5. Sentry (Monitoreo de Errores)

1. Ir a [sentry.io](https://sentry.io) → crear cuenta → nuevo proyecto **Next.js**.
2. Copiar el **DSN** → `NEXT_PUBLIC_SENTRY_DSN`
3. Para subir source maps en producción (opcional):
   - **Settings → Auth Tokens → Create Token** → `SENTRY_AUTH_TOKEN`
   - Copiar organización → `SENTRY_ORG`
   - Copiar nombre del proyecto → `SENTRY_PROJECT`

> Sentry solo se activa en `NODE_ENV === 'production'`. En desarrollo no envía eventos.

---

## 6. Vercel Cron (Mora automática)

El archivo `apps/web/vercel.json` ya configura el cron:
```json
{ "crons": [{ "path": "/api/cron/mora", "schedule": "0 11 * * *" }] }
```
Esto ejecuta la detección de mora todos los días a las **6:00 AM Colombia** (11:00 UTC).

**Variable requerida:**
- Generar un secreto: `openssl rand -hex 32`
- Agregar en Vercel → Settings → Environment Variables: `CRON_SECRET`

**Alternativa con pg_cron** (ya configurado en `db/03_cron_mora_automatica.sql`):
```sql
SELECT cron.schedule('detectar-mora-diaria', '0 11 * * *', 'SELECT fn_detectar_mora()');
```

---

## 7. UptimeRobot (Monitoreo de disponibilidad)

1. Ir a [uptimerobot.com](https://uptimerobot.com) → crear cuenta.
2. **Add New Monitor → HTTP(S)** → URL: `https://TU-DOMINIO.vercel.app`
3. Intervalo: 5 minutos. Alertas al email del equipo.

---

## Variables de entorno completas (`.env.local`)

Copia `.env.example` como `.env.local` y completa todos los valores:

```bash
# ── Supabase ──────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Wompi ─────────────────────────────────────────────────────
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_INTEGRITY_SECRET=test_integrity_...
WOMPI_EVENTS_SECRET=test_events_...

# ── Resend ────────────────────────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev

# ── Upstash Redis ─────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# ── Sentry ────────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=tu-organizacion          # opcional, para source maps
SENTRY_PROJECT=plurall               # opcional, para source maps
SENTRY_AUTH_TOKEN=sntrys_...         # opcional, para source maps

# ── Cron ──────────────────────────────────────────────────────
CRON_SECRET=genera_con_openssl_rand_hex_32

# ── App ───────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=PLURALL
```

---

## Comandos de desarrollo

```bash
# Instalar dependencias
cd apps/web && npm install

# Levantar servidor de desarrollo
npm run dev
# → http://localhost:3000

# Compilar para producción
npm run build

# Ejecutar cron de mora manualmente (para pruebas)
curl -H "Authorization: Bearer TU_CRON_SECRET" http://localhost:3000/api/cron/mora

# Generar PDF de presentación DBA
node scripts/generar_pdf.mjs
```

---

## Scripts utilitarios (`apps/web/scripts/utilidades/`)

| Script | Descripción |
|--------|-------------|
| `seed.mjs` | Inserta datos de prueba en la BD |
| `inject_pagos.mjs` | Inyecta pagos históricos |
| `inject_historicos.mjs` | Inyecta créditos históricos |
| `inject_supervisor.mjs` | Crea usuario supervisor |
| `check_roles.mjs` | Verifica roles de usuarios |
| `fix_login.mjs` | Corrige problemas de login |
| `verify_data.mjs` | Verifica integridad de datos |
| `apply_db_fix.mjs` | Aplica parches de BD |
| `pagar_mora.mjs` | Simula pagos de cuotas en mora |
