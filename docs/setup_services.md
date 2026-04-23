# Guía de Creación e Integración de Cuentas (Terceros)

Este documento te guía paso a paso para crear, configurar e integrar las plataformas de terceros requeridas en **PLURALL v4.0** (SENA). Toda esta infraestructura tiene un costo mensual de **$0** bajo condiciones normales de desarrollo.

---

## 1. Supabase (Base de Datos + Auth + Storage)
Actualmente ya tienes la BD creada y me has proporcionado la Anon Key simulada: `sb_publishable_ANVkDRoDOJS_4n95vYveTg_vplrNMC6`. Sin embargo, es necesario obtener unas variables más.

**Paso a paso para obtener las credenciales:**
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard) y selecciona tu proyecto.
2. Ve a **Project Settings** (engranaje en la barra izquierda) -> **API**.
3. Copia el **Project URL** (ej. `https://XXXXX.supabase.co`).
4. Copia el **Project API keys** (la `anon public` y la `service_role secret`).
   *Nota: La que me diste parece distinta a un JWT normal de Supabase, que normalmente empieza por `eyJ...`*
5. Ve a **Authentication** -> **Providers** -> Habilita **Email** (desactiva "Confirm email" para desarrollo si se requiere probar rápido, o déjalo activo y en "URL Configuration" añade `http://localhost:3000/auth/callback`).

**Paso para aplicar restricciones a "Sólo con Cédula de Ciudadanía (CC)":**
Como mencionaste que no aceptas extranjeros y la BD ya está creada con la estructura original, puedes ejecutar esta pequeña consulta en Supabase SQL Editor para desactivar los otros documentos:
```sql
UPDATE tipo_documento_identidad 
SET activo = false 
WHERE codigo != 'CC';
```
De esta forma, en el Frontend filtraremos las opciones usando `WHERE activo = true` y solo mostrará CC.

---

## 2. Wompi (Pasarela de Pagos)

1. Ingresa a [Comercios Wompi (Bancolombia)](https://comercios.wompi.co/).
2. Haz clic en "Registrarme" (puedes crear cuenta de integración o pruebas).
3. Una vez en el Dashboard de Wompi, ve a la sección **Desarrolladores**.
4. Verás las **Llaves del comercio**. Copia la **Llave Pública** de Pruebas (`pub_test_XXXX`) y la **Llave Privada** de Pruebas (`prv_test_XXXX`).
5. En la misma pantalla, busca **Webhooks (Eventos de la transacción)**.
6. Añade la URL: `https://TU-DOMINIO-EN-VERCEL/api/webhooks/wompi` (cuando estés en producción) y copia el **Secreto de los eventos** (`WOMPI_EVENTS_SECRET`). Esto es para la validación HMAC.

---

## 3. Resend (Emails transaccionales)

¡Buena noticia! **No necesitas comprar un dominio** para el proyecto del SENA. Puedes usar Resend en modo **Sandbox**.

1. Ve a [Resend](https://resend.com) y crea tu cuenta (es gratis).
2. Haz clic en **API Keys** -> **Create API Key**. Llama esta llave "Plurall Dev" y copia el valor (`re_XXXXX`).
3. **NO** vayas a la sección Domains.
4. Por defecto, tu cuenta está en **Sandbox mode**. Esto significa que puedes enviar correos ilimitados (hasta 3000) *única y exclusivamente* a la dirección de correo con la que te acabas de registrar en Resend.
5. Usa como remitente en tus pruebas: `onboarding@resend.dev` (este es el remitente oficial de pruebas).
6. ¡Es todo! Tu proyecto enviará correos reales a tu propia bandeja para que demuestres al instructor que la lógica sí funciona.

---

## 4. Upstash (Rate Limiting)

1. Ve a [Upstash](https://upstash.com) y regístrate.
2. Da clic en **Create Database** (Redis). Selecciona el "Global database" (gratis) en una región cercana (ej. us-east-1). Configura el nombre como `plurall`.
3. Cuando la DB esté lista, haz scroll a la sección **REST API**.
4. Selecciona **@upstash/redis** y copia la **UPSTASH_REDIS_REST_URL** y el **UPSTASH_REDIS_REST_TOKEN**.

---

## 5. Sentry (Monitoreo de Errores)

1. Ve a [Sentry](https://sentry.io/). Crea cuenta de estudiante o Free.
2. Crea un proyecto nuevo: **Plataforma:** Next.js.
3. Al finalizar, Sentry te dará unos pasos. Principalmente copiamos el DSN proporcionado (ej: `https://abcd123@o1234.ingest.sentry.io/5678`) al ser integrado (lo haremos luego con `npx @sentry/wizard@latest -i nextjs`).

---

## 6. UptimeRobot (Monitoreo 99.5%)

1. Ve a [UptimeRobot](https://uptimerobot.com).
2. Crea una cuenta. Haz clic en **Add New Monitor**.
3. Tipo: **HTTP(S)**. URL: Tu dominio en Vercel (ej. `https://plurall.vercel.app`).
4. Intervalo de monitoreo: 5 minutos.
5. Selecciona que te envíe un alerta a tu email cuando caiga el servidor.

---

## ¿Cómo integro todas estas claves en el código?

En la carpeta raíz del framework Next.js (`apps/web`), crea o copia el archivo con nombre `.env.local` y reemplaza los valores de las Xs con las claves obtenidas. He dejado un archivo `.env.example` en la ruta `/apps/web/.env.example` para que puedas duplicarlo y utilizarlo:

```bash
# Ejemplo:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=ey...

WOMPI_PUBLIC_KEY=pub_test_xxxx
...
```

El código de Next.js se encargará de levantar y consumir estas variables automáticamente a lo largo de los *Sprints* de desarrollo usando `process.env`.
