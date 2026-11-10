# PLURALL — Plataforma Fintech de Gestión de Créditos

> **Proyecto Formativo SENA** | Tecnólogo ADSO  
> Instructor: Jefry González  
> Equipo: Wilder Feo · Camila Avila · Juan Cetina · Juan Maurello · Jeferson Lugo

PLURALL es una plataforma fintech completa para el ciclo de vida de microcréditos dirigidos a comerciantes y emprendedores colombianos. Abarca perfilamiento KYC, motor de scoring crediticio, desembolso automático, cobranza y análisis de cartera en tiempo real.

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTES (Browser)                       │
│   Cliente · Asesor · Supervisor · Admin                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│                      Next.js 16 (App Router)                     │
│   Server Components (SSR) + API Routes (Lambdas)                 │
│   Middleware de sesión — Supabase SSR                            │
│   Sentry · Vercel Cron (mora diaria)                             │
└──────┬────────────────────┬────────────────┬────────────────────┘
       │                    │                │
  ┌────▼─────┐        ┌─────▼─────┐   ┌─────▼──────┐
  │ Supabase │        │   Wompi   │   │   Resend   │
  │ Postgres │        │  Pagos    │   │   Emails   │
  │ Auth RLS │        │  Webhook  │   │            │
  │ Storage  │        └───────────┘   └────────────┘
  │ pg_cron  │
  └──────────┘
```

**Stack tecnológico:**

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 — App Router (JavaScript) |
| UI | Tailwind CSS 4.x, Recharts, Lucide React |
| Base de datos | Supabase (PostgreSQL 16 + RLS) |
| Autenticación | Supabase Auth — login por celular colombiano |
| Storage | Supabase Storage — documentos KYC |
| Pagos | Wompi — webhook HMAC SHA-256 |
| Emails | Resend — templates HTML transaccionales |
| Monitoreo | Sentry (errores + Session Replay) |
| Rate limiting | Upstash Redis |
| Hosting | Vercel (Serverless + Edge + Cron) |
| PDF | Puppeteer (headless Chrome en servidor) |

---

## Portales y Roles

PLURALL tiene **cuatro portales** con control de acceso por rol (RLS + verificación en layout):

### `/` — Landing Page pública
Hero con CTA, simulador de cuotas embebido (`CreditFunnelModal`), pasos del proceso y pie de página.

### `/dashboard` — Portal del Cliente
Autenticado. El cliente gestiona su relación crediticia completa:

| Ruta | Funcionalidad |
|------|--------------|
| `/dashboard/inicio` | KPIs: saldo, cuotas pagadas, estado mora, alerta vencimiento |
| `/dashboard/creditos` | Lista de solicitudes y créditos activos |
| `/dashboard/creditos/solicitar` | Stepper 4 pasos: cotizador → cuestionario → KYC → resumen |
| `/dashboard/creditos/[id]` | Detalle de crédito con timeline de estados |
| `/dashboard/cuotas` | Plan de pagos completo con estado por cuota |
| `/dashboard/cuotas/[id]/pagar` | Widget Wompi integrado para pago de cuota |
| `/dashboard/documentos` | Descarga de contrato, paz y salvo, estado de cuenta (PDF) |
| `/dashboard/perfil` | Editar datos de contacto + cambio de contraseña |
| `/dashboard/pqr` | Radicar Petición, Queja o Reclamo |
| `/dashboard/notificaciones` | Bandeja de notificaciones del sistema |

### `/asesor` — Portal del Asesor de Cobranza
Rol: `asesor`. Gestión de la cartera asignada:

| Ruta | Funcionalidad |
|------|--------------|
| `/asesor` | Dashboard: KPIs de cartera propia, mora, gestiones del mes |
| `/asesor/solicitudes` | Solicitudes asignadas con filtros de estado |
| `/asesor/clientes` | Clientes a cargo con estado crediticio |
| `/asesor/cobranza` | Cola de cobranza por cliente en mora |
| `/asesor/cobranza/[clienteId]` | Ficha cliente: crédito, cuotas, historial de gestiones |
| `/asesor/gestiones` | Registro de llamadas, visitas y promesas de pago |
| `/asesor/documentos` | Verificación de documentos KYC subidos |
| `/asesor/pagos` | Registro de abonos recibidos |
| `/asesor/pqr` | PQRs de clientes asignados |
| `/asesor/preaprobacion` | Cola de pre-aprobaciones automáticas |
| `/asesor/amortizacion` | Simulador de cuotas (amortización francesa) |

### `/supervisor` — Portal del Supervisor
Rol: `supervisor`. Visión completa de la operación:

| Ruta | Funcionalidad |
|------|--------------|
| `/supervisor` | Dashboard ejecutivo con gráficas Recharts (barras, líneas, pie) |
| `/supervisor/solicitudes` | Todas las solicitudes con búsqueda y filtros avanzados |
| `/supervisor/solicitudes/[id]` | Detalle + panel de decisión: aprobar / rechazar con motivo |
| `/supervisor/asesores` | Gestión de asesores: asignar, desactivar, ver carga |
| `/supervisor/mora` | Dashboard de mora: días, monto, distribución |
| `/supervisor/cartera` | Vista consolidada de toda la cartera activa |
| `/supervisor/funnel` | Analítica del funnel de originación (evento a evento) |
| `/supervisor/desembolsos` | Cola de desembolsos pendientes de confirmar |
| `/supervisor/auditoria` | Log de auditoría: quién hizo qué y cuándo |
| `/supervisor/buscar` | Búsqueda global por nombre, CC o celular |
| `/supervisor/puntaje` | Revisión del modelo de scoring |
| `/supervisor/motivos-rechazo` | CRUD de catálogo de motivos de rechazo |

### `/admin` — Portal Administrativo
Rol: `admin`. Configuración y reportes ejecutivos:

| Ruta | Funcionalidad |
|------|--------------|
| `/admin` | Dashboard: KPIs, cartera total, últimas solicitudes |
| `/admin/solicitudes` | Lista con tabs por estado (Pendiente / En estudio / Aprobada…) |
| `/admin/solicitudes/[id]` | Detalle completo: cliente, scoring, documentos, decisión, desembolso |
| `/admin/clientes` | Directorio con buscador (nombre, CC, celular) |
| `/admin/clientes/[id]` | Perfil completo + historial de créditos |
| `/admin/reportes` | Métricas ejecutivas, exportación CSV/XLSX |

---

## Flujos Críticos

### 1. Originación de Crédito

```
Cliente solicita → Paso 1: Cotizador (slider monto $500K–$10M, plazo 3–24 meses)
                → Paso 2: Cuestionario de perfil (scoring automático)
                → Paso 3: Upload KYC (cédula frontal + trasera → Supabase Storage)
                → Paso 4: Resumen + envío → POST /api/creditos/solicitar
                          ├── Calcula score (respuestas × factores ponderados)
                          ├── Si score ≥ umbral alto → APROBACION_AUTOMATICA
                          ├── Si score < umbral bajo  → RECHAZO_AUTOMATICO
                          └── Si entre umbrales       → REVISION_MANUAL
```

### 2. Flujo de Pago con Wompi

```
/dashboard/cuotas → Selecciona cuota → /cuotas/{id}/pagar
  → POST /api/pagos/iniciar
      ├── Rate limit: 5 intentos / 10 min (Upstash Redis)
      ├── Genera referencia PLR-XXXX-{timestamp}
      └── SHA256(referencia + monto + moneda + WOMPI_INTEGRITY_SECRET)
  → Widget Wompi renderizado en cliente
  → Cliente paga
  → Wompi redirige a /cuotas/confirmacion?status=APPROVED
  → POST /api/webhooks/wompi
      ├── Valida HMAC: SHA256(tx.id + status + amount + WOMPI_EVENTS_SECRET)
      ├── Marca cuota PAGADA
      ├── Actualiza saldo_pendiente + cuotas_pagadas en credito
      └── Envía email de confirmación (Resend)
```

### 3. Detección Automática de Mora

```
Vercel Cron (11:00 UTC = 6 AM Colombia)
  → GET /api/cron/mora (autenticado con CRON_SECRET)
      ├── cuota PENDIENTE con fecha_vencimiento < hoy → VENCIDA
      ├── credito ACTIVO con cuotas VENCIDAS → EN_MORA
      │       actualiza cuotas_en_mora, dias_mora_maximo
      └── credito EN_MORA sin cuotas VENCIDAS → recupera a ACTIVO
```

---

## Modelo de Base de Datos

```
auth.users (Supabase)
    └── perfil_usuario (id, id_rol, intentos_fallidos, bloqueado_hasta)
            └── rol (cliente | asesor | supervisor | admin)

cliente (id_cliente, dni, telefono, email, id_estado_cliente,
         primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)
    ├── direccion (casa / negocio, municipio, coordenadas)
    ├── negocio_cliente (tipo, descripción, antigüedad)
    ├── perfil_financiero (ingresos, egresos, score)
    ├── cuenta_bancaria
    └── documento_cliente (cedula_frontal, cedula_trasera → Storage)
    └── vw_cliente_score (vista con el score vigente)

solicitud_credito (monto, plazo, id_estado_solicitud, id_analista)
    ├── respuesta_cliente → score (puntaje, decision_automatica)
    └── decision_solicitud (APROBADO | RECHAZADO, analista, motivo)

credito (monto_desembolsado, tasa_interes_mensual, cuota_fija, estado_credito)
    └── plan_pago
            └── cuota × N (fecha_vencimiento, estado_cuota, PENDIENTE|VENCIDA|PAGADA)
                    └── pago (monto_pagado, referencia_wompi, fecha_pago)

-- Módulos de soporte
notificacion | pqr | gestion_cobranza | asignacion_asesor
evento_funnel | auditoria | otp_recuperacion | motivo_rechazo
vw_kpi_cartera | vw_cohortes_desembolso (vistas materializadas)
```

**Seguridad de datos:** 100% Row Level Security. Cada tabla tiene políticas RLS que garantizan que un `cliente` solo lee sus propios registros, mientras que `asesor` / `supervisor` / `admin` tienen acceso según su nivel de autorización.

---

## Estructura del Repositorio

```
Plurall/
├── apps/web/                    # Aplicación Next.js principal
│   ├── app/                     # App Router
│   │   ├── page.js              # Landing pública
│   │   ├── login/ registro/ recuperar/   # Autenticación
│   │   ├── auth/callback/       # Callback de Supabase Auth
│   │   ├── dashboard/           # Portal cliente
│   │   ├── asesor/              # Portal asesor
│   │   ├── supervisor/          # Portal supervisor
│   │   ├── admin/               # Portal admin
│   │   └── api/                 # 47 API Routes
│   │       ├── auth/            # Login servidor, OTP, portal redirect
│   │       ├── creditos/        # Solicitar (con scoring) y elegibilidad
│   │       ├── pagos/           # Wompi: cotizar, iniciar + webhook
│   │       ├── admin/           # Aprobar, rechazar, desembolsar, usuarios
│   │       ├── asesor/          # Gestiones de cobranza
│   │       ├── supervisor/      # KPIs, asignación, mora, motivos
│   │       ├── cliente/         # Cambio de celular con OTP
│   │       ├── documentos/      # PDF: contrato, plan pagos, estado cuenta, paz y salvo
│   │       ├── analitica/       # KPIs + drill-down
│   │       ├── eventos/         # Funnel tracking
│   │       ├── notificaciones/  # Email transaccional (Resend)
│   │       ├── pqr/             # CRUD peticiones / quejas / reclamos
│   │       ├── reportes/        # Export CSV / XLSX
│   │       └── cron/            # Mora y recordatorios (Vercel Cron)
│   ├── components/              # Componentes reutilizables
│   ├── lib/                     # Dominio: Supabase, scoring, cálculos, PDF, pagos, KYC
│   ├── tests/                   # Pruebas Vitest
│   ├── scripts/                 # Seeds, utilidades y herramientas de documentación
│   ├── proxy.js                 # Sesión y control de acceso por rol (Next 16)
│   ├── instrumentation.js       # Inicialización de Sentry en servidor/edge
│   └── vercel.json              # Crons de mora y recordatorios
├── db/                          # Migraciones SQL (01…45) + esquema consolidado
├── docs/                        # Documentación técnica vigente
│   ├── historial/               # Documentos de sprints y handoffs anteriores
│   └── diagramas/               # Diagramas Mermaid por requerimiento y de proyecto
├── tools/db/                    # Scripts manuales de datos de prueba
└── .github/workflows/           # CI: lint, test y build
```

---

## Inicio Rápido

### Requisitos previos
- Node.js 20.9+ (probado con Node 22 y 24)
- Cuenta Supabase (plan gratuito funciona)
- Cuenta Resend (sandbox gratuito)
- Cuenta Wompi (modo pruebas)

### 1. Instalar dependencias

```bash
cd apps/web
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local` con tus claves:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Wompi (pagos)
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_INTEGRITY_SECRET=test_integrity_...
WOMPI_EVENTS_SECRET=test_events_...

# Resend (emails)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev

# Upstash (rate limiting — opcional)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Sentry (monitoreo — opcional)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=genera_un_secreto_con_openssl_rand_hex_32

# Datos legales (documentos PDF)
PLURALL_RAZON_SOCIAL=PLURALL S.A.S.
PLURALL_NIT=901.567.890-1
PLURALL_CIUDAD=Bogotá D.C., Colombia
PLURALL_EMAIL=legal@plurall.app

# Tasa de usura vigente (% EA); se certifica mensualmente
TASA_USURA_EA=28.59
```

### 3. Aplicar migraciones de base de datos

En Supabase Dashboard → SQL Editor, ejecutar **en orden numérico** las migraciones
`db/01_*.sql` … `db/45_*.sql`. Para una base nueva, `db/plurall_database_completa.sql`
refleja el estado consolidado hasta la migración 23; después deben aplicarse las
migraciones 24–45. El orden detallado y las precondiciones están en
`docs/deploy_normalizacion_bd.md` y en la cabecera de cada archivo.

> Las migraciones se aplican manualmente. No hay una herramienta automática de
> migraciones en el repositorio.

### 4. Crear usuarios de prueba

Ejecutar los seeds desde la terminal (requieren `SUPABASE_SERVICE_ROLE_KEY`):

```bash
cd apps/web
node scripts/utilidades/seed_supervisor_asesor.mjs
```

Las credenciales de prueba no se versionan. Para pruebas de humo, definir
`SMOKE_<ROL>_CELULAR` y `SMOKE_<ROL>_PASSWORD` en el entorno local.

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abre `http://localhost:3000`.

---

## Despliegue en Producción (Vercel)

1. Conectar el repositorio en [vercel.com](https://vercel.com).
2. Configurar todas las variables de entorno en Vercel Dashboard → Settings → Environment Variables.
3. El `vercel.json` ya incluye los dos crons del sistema:
   ```json
   {
     "crons": [
       { "path": "/api/cron/mora", "schedule": "55 4 * * *" },
       { "path": "/api/cron/recordatorios", "schedule": "0 13 * * *" }
     ]
   }
   ```
4. Configurar el webhook de Wompi apuntando a `https://tu-dominio.vercel.app/api/webhooks/wompi`.

---

## API Routes — Resumen

| Método | Ruta | Propósito |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Login en servidor con bloqueo real por intentos (H3) |
| `POST` | `/api/auth/otp/enviar` | Enviar OTP de recuperación |
| `POST` | `/api/auth/otp/verificar` | Verificar OTP + cambiar contraseña |
| `POST` | `/api/creditos/solicitar` | Solicitud de crédito + scoring |
| `GET` | `/api/creditos/elegibilidad` | Validar elegibilidad y cooldown |
| `POST` | `/api/pagos/cotizar` | Cotización de crédito |
| `POST` | `/api/pagos/iniciar` | Generar firma Wompi (rate limited) |
| `POST` | `/api/webhooks/wompi` | Webhook HMAC — confirmar pagos |
| `PATCH` | `/api/admin/solicitud/[id]` | Aprobar / rechazar solicitud |
| `POST` | `/api/admin/desembolsar/[id]` | Crear crédito + cuotas + plan de pagos |
| `POST` | `/api/admin/desembolsar/batch` | Desembolso masivo |
| `GET/POST` | `/api/admin/usuarios` | Listar / crear staff |
| `GET` | `/api/staff/buscar` | Búsqueda unificada de clientes y staff |
| `GET` | `/api/documentos/contrato/[creditoId]` | PDF contrato de crédito |
| `GET` | `/api/documentos/plan-pagos/[creditoId]` | PDF plan de pagos |
| `GET` | `/api/documentos/estado-cuenta/[creditoId]` | PDF estado de cuenta |
| `GET` | `/api/documentos/paz-y-salvo/[creditoId]` | PDF paz y salvo |
| `GET` | `/api/analitica` | KPIs consolidados del negocio |
| `GET` | `/api/reportes/export` | Export CSV / XLSX |
| `GET` | `/api/cron/mora` | Detección automática de mora (Cron) |
| `GET` | `/api/cron/recordatorios` | Recordatorios de cuotas (Cron) |
| `POST` | `/api/notificaciones/solicitud` | Email transaccional vía Resend |
| `GET/POST` | `/api/pqr` | CRUD peticiones / quejas / reclamos |

---

## Seguridad

| Mecanismo | Implementación |
|-----------|----------------|
| Autenticación | Supabase Auth — celular → `[celular]@plurall.app` |
| Autorización | Row Level Security en todas las tablas |
| Anti-brute force | Login en servidor: 3 intentos → bloqueo 30 min (`perfil_usuario.bloqueado_hasta`) |
| Rate limiting | Upstash Redis — 5 intentos pago / 10 min por usuario |
| Webhook integrity | HMAC SHA-256 Wompi events + integrity secret |
| Headers HTTP | HSTS, X-Frame-Options, X-Content-Type-Options (next.config.mjs) |
| Sesión y roles | `proxy.js` + `lib/supabase/middleware.js` (Next 16) |
| Monitoreo | Sentry — captura errores, omite 401/403 esperados |
| Auditoría | Tabla `auditoria` con usuario, acción, IP y timestamp |

---

## Reglas de Negocio Principales

| Código | Regla |
|--------|-------|
| RN-01 | Celular colombiano de 10 dígitos — único identificador de acceso |
| RN-02 | Bloqueo de cuenta tras 3 intentos fallidos (30 minutos) |
| RN-03 | Cooldown de 90 días entre solicitudes de crédito |
| RN-04 | KYC obligatorio: cédula frontal + trasera antes de enviar solicitud |
| RN-05 | Analista asignado a cada solicitud para trazabilidad |
| RN-06 | Decisión inmutable: una vez APROBADA o RECHAZADA no puede cambiar |
| RN-07 | Un cliente puede tener un solo crédito ACTIVO simultáneo |
| RN-08 | Cuotas con `fecha_vencimiento < hoy` y estado PENDIENTE → VENCIDA automáticamente |
| RN-09 | Scoring visible para analista/supervisor en panel de decisión |
| RN-12 | Cada pago genera registro en tabla `pago` con referencia Wompi |
| BD-03 | Tasa de interés mensual congelada al momento del desembolso |

---

## Equipo

| Integrante | Módulo Principal |
|------------|-----------------|
| Wilder Feo | Infraestructura, Proxy/Sesión, Pagos Wompi, Cron Mora, Auditoría |
| Camila Avila | Autenticación, Perfil, Solicitud de Crédito, KYC, Gestiones Admin |
| Juan Cetina | Base de datos, Scoring, Panel Admin, Analytics |
| Juan Maurello | UI/Diseño, Landing, Documentos PDF, Decisiones, Cobranza |
| Jeferson Lugo | Calculadora, Dashboard Cliente, Cuotas, Despliegue Vercel |

---

*Desarrollado para el Proyecto Formativo SENA — Tecnólogo en Análisis y Desarrollo de Software (ADSO)*
