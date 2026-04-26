# 📋 Documentación de Módulos — Camila Avila
## Proyecto PLURALL — Sistema de Información de Créditos

> ⚠️ **ESTADO DEL PROYECTO:** EN DESARROLLO — Avance estimado **45%**. El backend está aproximadamente al 40% de completitud. Faltan vistas de Supervisor y Asesor, backend de mora automática, gestión avanzada de clientes y múltiples APIs.

> **Integrante:** Camila Avila  
> **Color asignado:** 🌸 Rosa (`#FFEAD1DC`)  
> **Proyecto Formativo SENA** | Tecnólogo ADSO
> **Stack:** Next.js 16 + Supabase (PostgreSQL) + Tailwind CSS

---

## Módulos Asignados

| # | Módulo | Tablas BD principales | Rutas involucradas |
|---|--------|----------------------|-------------------|
| 1 | **Clientes** | `cliente`, `estado_cliente`, `documento_cliente`, `historial_estado` | `/admin/clientes`, `/dashboard/perfil` |
| 2 | **Solicitud de Crédito** | `solicitud_credito`, `estado_solicitud`, `motivo_rechazo` | `/dashboard/creditos/solicitar`, `/api/creditos/solicitar` |
| 3 | **Autenticación** *(módulo adicional implementado)* | `perfil_usuario`, `rol`, `auth.users` (Supabase Auth) | `/login`, `/registro`, `/recuperar`, `/auth/callback` |

---

## 1. Módulo: Clientes

### 1.1 ¿Qué hace este módulo?
Centraliza los datos de identificación, contacto y estado de cada persona que se registra en PLURALL. Es el núcleo de toda la operación: sin un registro de cliente no puede existir solicitud, crédito, ni pago.

### 1.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Directorio de clientes (admin) | `/admin/clientes` | Solo administradores/analistas |
| Detalle de cliente individual | `/admin/clientes/[id]` | Solo administradores/analistas |
| Perfil propio del cliente | `/dashboard/perfil` | Cliente autenticado |

### 1.3 Metodología
- **Patrón:** Server Components de Next.js (rendering en el servidor, sin exposición de datos al cliente)
- **Acceso a datos:** Supabase SDK con `createServerClient` (cookies de sesión del servidor)
- **Seguridad:** Row Level Security (RLS) de Supabase + verificación de rol en API Routes
- **Búsqueda:** Filtro dinámico con `query params` (`?q=nombre`) usando `.ilike()` de Supabase para búsqueda insensible a mayúsculas

### 1.4 Tablas de Base de Datos

#### Tabla `cliente`
```sql
CREATE TABLE cliente (
  id_cliente          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario_cuenta   UUID REFERENCES auth.users(id),
  id_estado_cliente   UUID REFERENCES estado_cliente(id_estado_cliente),
  nombre_completo     TEXT NOT NULL,
  dni                 TEXT UNIQUE NOT NULL,        -- Cédula de Ciudadanía
  email               TEXT,
  telefono            TEXT,
  score_credito       INTEGER DEFAULT 0,           -- Score calculado por Experian (mock)
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabla `estado_cliente`
```sql
CREATE TABLE estado_cliente (
  id_estado_cliente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            TEXT NOT NULL,               -- 'ACTIVO', 'BLOQUEADO', 'INACTIVO'
  descripcion       TEXT
);
```

#### Tabla `documento_cliente`
```sql
CREATE TABLE documento_cliente (
  id_documento    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente      UUID REFERENCES cliente(id_cliente),
  tipo_documento  TEXT,    -- 'CEDULA_FRONTAL', 'CEDULA_TRASERA'
  url_archivo     TEXT,    -- Path en Supabase Storage (bucket: documentos_kyc)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.5 Archivos del Módulo

#### `app/admin/clientes/page.js`
**Tipo:** Server Component (se renderiza en el servidor)  
**Ruta visible:** `/admin/clientes`

**¿Qué hace?**
1. Conecta a Supabase con permisos de servidor
2. Recibe el parámetro de búsqueda `?q=` de la URL
3. Consulta la tabla `cliente` con JOIN a `estado_cliente`, `solicitud_credito` (conteo) y `credito` (saldo activo)
4. Muestra una tabla responsiva con: nombre, documento, celular, score de crédito (color según rango), número de solicitudes, saldo activo y estado
5. El score se colorea: verde (≥700), amarillo (≥500), rojo (<500)

**Código clave — Consulta con relaciones:**
```javascript
let query = supabase
  .from('cliente')
  .select(`
    id_cliente, nombre_completo, dni, telefono, email,
    score_credito, created_at,
    estado_cliente ( nombre ),
    solicitud_credito ( count ),
    credito ( id_credito, estado_credito, saldo_pendiente, cuota_fija )
  `)
  .order('created_at', { ascending: false })

if (buscar) {
  query = query.or(`nombre_completo.ilike.%${buscar}%,dni.ilike.%${buscar}%,telefono.ilike.%${buscar}%`)
}
```

**Librerías usadas:**
- `@supabase/supabase-js` — Consultas a la BD
- `lucide-react` — Iconos (`Users`, `Search`, `ArrowRight`, `CheckCircle2`, `XCircle`, `Clock`)
- `next/link` — Navegación entre rutas
- `@/lib/calculadora` — Función `formatCOP` para moneda colombiana

---

## 2. Módulo: Solicitud de Crédito

### 2.1 ¿Qué hace este módulo?
Es la tabla que **orquesta la operación principal** del negocio. Registra cada solicitud formal de préstamo: quién la pidió, cuánto solicitó, en qué estado está y el resultado de la evaluación de riesgo.

### 2.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Formulario de solicitud (stepper) | `/dashboard/creditos/solicitar` | Cliente autenticado |
| Historial de solicitudes del cliente | `/dashboard/creditos` | Cliente autenticado |
| Detalle de solicitud (para admin) | `/admin/solicitudes/[id]` | Administrador |
| Lista de todas las solicitudes | `/admin/solicitudes` | Administrador |

### 2.3 Metodología
- **Patrón:** Formulario multi-paso (Stepper de 3 pasos) con Client Component (`'use client'`)
- **Validación doble:** Validación en el navegador (UI) + validación en el servidor (API Route) como fallback de seguridad
- **Scoring:** Mock de Experian (motor de decisión pseudo-aleatorio basado en DNI)
- **KYC:** Subida de documentos de identidad a Supabase Storage (bucket privado `documentos_kyc`)
- **Reglas de negocio implementadas:**
  - `RN-07`: Un cliente no puede tener más de un crédito activo simultáneo
  - `RN-08`: Cooldown de 90 días entre solicitudes

### 2.4 Tablas de Base de Datos

#### Tabla `solicitud_credito`
```sql
CREATE TABLE solicitud_credito (
  id_solicitud          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente            UUID REFERENCES cliente(id_cliente),
  id_estado_solicitud   UUID REFERENCES estado_solicitud(id_estado_solicitud),
  id_motivo_rechazo     UUID REFERENCES motivo_rechazo(id_motivo),
  monto_solicitado      NUMERIC(14,2) NOT NULL,
  plazo_meses           INTEGER NOT NULL,            -- Entre 3 y 24 meses
  proposito             TEXT,                        -- "Perfilamiento Auto Experian: 850 pts"
  canal_solicitud       TEXT DEFAULT 'WEB',
  fecha_solicitud       TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabla `estado_solicitud`
Valores posibles: `PENDIENTE`, `EN_ESTUDIO`, `APROBADA`, `RECHAZADA`, `DESEMBOLSADA`, `CANCELADA`

#### Tabla `motivo_rechazo`
```sql
CREATE TABLE motivo_rechazo (
  id_motivo          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion_motivo TEXT NOT NULL,       -- Ej: "Historial crediticio negativo en Datacrédito"
  visible_cliente    BOOLEAN DEFAULT FALSE
);
```

### 2.5 Archivos del Módulo

#### `app/dashboard/creditos/solicitar/page.js`
**Tipo:** Client Component (`'use client'`)  
**Ruta visible:** `/dashboard/creditos/solicitar`

**Flujo del Stepper:**
```
Step 1: Calculadora de Amortización
    → Sliders interactivos: monto ($100K–$10M) y plazo (3–24 meses)
    → Cálculo en tiempo real con calcularAmortizacion()
    → Muestra cuota mensual estimada (TEA 28%)

Step 2: Documentos KYC
    → Upload de Cédula Frontal y Cédula Trasera
    → Archivos al bucket 'documentos_kyc' de Supabase Storage
    → Formatos: image/* y .pdf

Step 3: Resumen y Confirmación
    → Resumen financiero: capital, plazo, cuota fija, total a pagar
    → Botón "Confirmar y Enviar" → llama a POST /api/creditos/solicitar
```

**Validación al cargar (useEffect):**
```javascript
// 1. Verifica si tiene crédito activo (ACTIVO o EN_MORA)
// 2. Verifica cooldown de 90 días desde la última solicitud
// Si alguna condición falla → muestra pantalla de bloqueo con mensaje
```

**Estado local (useState):**
| Variable | Tipo | Descripción |
|----------|------|-------------|
| `step` | `number` | Paso actual del stepper (1, 2 ó 3) |
| `monto` | `number` | Monto a solicitar (default: $500.000) |
| `plazo` | `number` | Plazo en meses (default: 6) |
| `cedulaFrontal` | `File\|null` | Archivo de imagen de cédula frontal |
| `cedulaTrasera` | `File\|null` | Archivo de imagen de cédula trasera |
| `bloqueo` | `object` | Estado de bloqueo: `{ isLoading, isBlocked, message }` |
| `isSubmitting` | `boolean` | Indicador de carga mientras se envía |

#### `app/api/creditos/solicitar/route.js`
**Tipo:** API Route — Next.js (se ejecuta en el servidor)  
**Método HTTP:** `POST /api/creditos/solicitar`

**Flujo del servidor:**
```
1. Verificar autenticación (JWT de Supabase)
2. Obtener id_cliente del usuario autenticado
3. Validar RN-07: ¿Tiene saldo pendiente > 0? → 403
4. Validar RN-08: ¿Última solicitud hace < 90 días? → 403
5. Consultar Experian (MOCK):
   - score < 20: RECHAZAR (score 450)
   - score 20–60: REVISION_MANUAL (score 650)
   - score > 60: PRE_APROBADO (score 850)
6. Guardar documentos en tabla documento_cliente
7. Insertar registro en solicitud_credito con estado y motivo
8. Retornar { success, resultado_buro, score }
```

**Mock Experian:**
```javascript
function consultarExperian(dni) {
  // Extrae los últimos 2 dígitos del DNI para determinar el resultado
  const factor = Number(dni.substring(dni.length - 2) || '50')
  if (factor < 20)  return { score: 450, dictamen: 'RECHAZAR', ... }
  if (factor < 60)  return { score: 650, dictamen: 'REVISION_MANUAL', ... }
  return { score: 850, dictamen: 'PRE_APROBADO', ... }
}
```

**Librerías usadas:**
- `next/server` — `NextResponse` para respuestas HTTP
- `@/lib/supabase/server` — Cliente servidor con cookies
- `@/lib/calculadora` — `calcularAmortizacion`, `formatCOP`
- `lucide-react` — Iconos del stepper y estados
- `react` — `useState`, `useMemo`, `useEffect`

---

## 3. Módulo: Autenticación *(Módulo adicional implementado)*

### 3.1 ¿Qué hace este módulo?
Gestiona el ciclo completo de identidad del usuario: registro, inicio de sesión, recuperación de contraseña y protección de rutas privadas. Se integra con **Supabase Auth** para delegar la seguridad de contraseñas y tokens.

### 3.2 ¿Dónde se visualiza?
| Vista | URL |
|-------|-----|
| Landing pública | `/` |
| Login | `/login` |
| Registro | `/registro` |
| Recuperar contraseña | `/recuperar` |
| Callback de auth | `/auth/callback` (API invisible) |

### 3.3 Metodología
- **Provider:** Supabase Auth (JWT + cookies HTTP-only)
- **SSR seguro:** `@supabase/ssr` para manejar sesiones en el servidor
- **Protección de rutas:** Middleware de Next.js (`middleware.js`) que bloquea rutas privadas
- **Registro automático:** Trigger SQL `trg_handle_new_user_registration` que sincroniza `auth.users` → `perfil_usuario` + `cliente`
- **Bypass de email:** Trigger `trg_auto_confirm_user` que auto-confirma el correo (flujo con celular como identificador)

### 3.4 Tablas de Base de Datos

#### Tabla `perfil_usuario`
```sql
CREATE TABLE perfil_usuario (
  id             UUID PRIMARY KEY REFERENCES auth.users(id),
  id_rol         UUID REFERENCES rol(id_rol),
  nombre_completo TEXT
);
```

#### Tabla `rol`
Valores: `CLIENTE`, `ADMIN`, `ANALISTA`

### 3.5 Archivos del Módulo

#### `app/login/page.js`
**Tipo:** Client Component  
**Funcionalidad:** Email + contraseña → `supabase.auth.signInWithPassword()` → redirect a `/dashboard/inicio`  
**Errores traducidos al español:** "Correo o contraseña incorrectos", "Debes confirmar tu correo"  
**UX:** Toggle de ojo (mostrar/ocultar contraseña), efecto glassmorphism

#### `app/registro/page.js`
**Tipo:** Client Component  
**Campos validados:**
| Campo | Validación |
|-------|-----------|
| Nombre completo | Requerido |
| Cédula (CC) | Máx 12 dígitos |
| Email | Formato válido, único en BD |
| Teléfono | Exactamente 10 dígitos |
| Contraseña | Mínimo 6 caracteres |
| Términos y condiciones | Checkbox obligatorio (Ley 1581/2012) |

**Flujo:** `supabase.auth.signUp()` → guarda metadatos → trigger SQL crea `cliente` + `perfil_usuario`

#### `app/recuperar/page.js`
**Tipo:** Client Component  
`supabase.auth.resetPasswordForEmail()` → email con link de recuperación → pantalla de confirmación

#### `app/auth/callback/route.js`
**Tipo:** API Route (servidor)  
Intercambia el `code` de Supabase por sesión válida: `supabase.auth.exchangeCodeForSession(code)` → redirect a `/dashboard/inicio`

#### `lib/supabase/client.js`
```javascript
// Cliente para componentes con 'use client'
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
```

#### `lib/supabase/server.js`
```javascript
// Cliente para Server Components y API Routes (accede a cookies)
import { createServerClient } from '@supabase/ssr'
```

#### `lib/supabase/middleware.js` + `middleware.js`
Protege todas las rutas privadas. Rutas públicas permitidas sin login: `/`, `/login`, `/registro`, `/recuperar`

#### `docs/triggers_y_funciones.md`
Documentación completa de los dos triggers SQL:
- `trg_auto_confirm_user` — Auto-confirma email en milisegundos
- `trg_handle_new_user_registration` — Sincroniza auth con tablas de negocio

---

## 4. Reglas de Negocio Cubiertas

| Código | Regla | Módulo | Estado |
|--------|-------|--------|--------|
| RN-01 | Teléfono: exactamente 10 dígitos colombianos | Autenticación | ✅ |
| RN-07 | Un cliente solo puede tener 1 crédito activo | Solicitud | ✅ |
| RN-08 | Cooldown de 90 días entre solicitudes | Solicitud | ✅ |
| RN-11 | DNI y email únicos en la BD | Clientes | ✅ UNIQUE constraint |
| RNM-01 | Habeas Data (Ley 1581/2012) | Autenticación | ✅ Checkbox obligatorio |
| RNM-08 | HTTPS forzado en producción | Auth/Infra | ✅ Vercel automático |
| BD-01 | IDs con UUID | Todos | ✅ |
| BD-02 | Auth delegado a Supabase | Autenticación | ✅ |

---

## 5. Variables de Entorno Utilizadas

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL del proyecto en Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Clave pública (lectura con RLS)
SUPABASE_SERVICE_ROLE_KEY=        # Clave de servicio (sin restricciones)
NEXT_PUBLIC_APP_URL=              # URL base de la aplicación
```

---

## 6. Comandos para Ejecutar

```bash
# Instalar dependencias
cd apps/web && npm install

# Levantar servidor de desarrollo
npm run dev
# → http://localhost:3000

# Rutas de este módulo:
# http://localhost:3000/login
# http://localhost:3000/registro
# http://localhost:3000/admin/clientes
# http://localhost:3000/dashboard/creditos/solicitar
```

---

## 7. Estado de Desarrollo y Tareas Pendientes

### ✅ Completado
| Funcionalidad | Archivo |
|--------------|--------|
| Landing page pública (`/`) | `app/page.js` |
| Login con email y contraseña | `app/login/page.js` |
| Registro con validación Habeas Data | `app/registro/page.js` |
| Recuperar contraseña | `app/recuperar/page.js` |
| Callback de Supabase Auth | `app/auth/callback/route.js` |
| Triggers SQL (auto-confirm + sync BD) | `docs/triggers_y_funciones.md` |
| Directorio de clientes admin (búsqueda básica) | `app/admin/clientes/page.js` |
| Perfil del cliente (lectura) | `app/dashboard/perfil/page.js` |

### 🔄 En Desarrollo (incompleto)
| Funcionalidad | Problema actual |
|--------------|----------------|
| Perfil del cliente | Solo lectura — falta formulario de **edición** de datos personales |
| Directorio admin clientes | Falta página de **detalle individual** `/admin/clientes/[id]` |
| Login | Falta implementar **bloqueo de cuenta** al tercer intento fallido (campo en BD existe, lógica no) |
| Registro | Falta validación de **cédula en listas restrictivas** (Datacrédito) |

### ⏳ Pendiente — Por Implementar

#### Módulo Supervisor (rol nuevo — no existe aún)
```
/supervisor                    → Dashboard ejecutivo del supervisor
/supervisor/clientes           → Lista de todos los clientes con filtros avanzados
/supervisor/clientes/[id]      → Ficha 360° del cliente (créditos, pagos, historial)
/supervisor/solicitudes        → Cola de solicitudes con priorización
/supervisor/solicitudes/[id]   → Formulario aprobar/rechazar/preguntar al asesor
```

#### Módulo Asesor (rol nuevo — no existe aún)
```
/asesor                        → Dashboard del asesor con clientes asignados
/asesor/clientes               → Lista de clientes en su cartera
/asesor/clientes/[id]          → Vista de estado actual del cliente (saldo, mora, pagos)
/asesor/seguimiento            → Lista de clientes en mora asignados para gestión
```

#### APIs faltantes
```
PUT  /api/clientes/[id]                → Editar datos del cliente
GET  /api/clientes/[id]/historial      → Historial completo de operaciones
POST /api/admin/clientes/[id]/bloquear → Bloquear/desbloquear cuenta de cliente
GET  /api/admin/clientes/[id]/kyc     → Ver documentos KYC subidos
POST /api/admin/kyc/verificar/[id]    → Aprobar/rechazar documentos KYC
GET  /api/admin/export/clientes       → Exportar directorio a CSV/Excel
```

#### Mejoras de seguridad pendientes
- [ ] Rate limiting en endpoints de auth (Upstash Redis — variable existe, lógica no)
- [ ] Validación CAPTCHA en formulario de registro
- [ ] 2FA (autenticación de dos factores) para supervisores
- [ ] Registro de IP y user-agent en cada login (tabla `log_auditoria`)
- [ ] Política de contraseña robusta (mayúsculas + números + especiales)

#### BD pendiente
- [ ] Tabla `lista_restrictiva` para bloqueo por cédula (CIFIN/Datacrédito)
- [ ] Tabla `sesion_usuario` para control de sesiones activas
- [ ] Tabla `asignacion_asesor` (cliente ↔ asesor)
- [ ] RLS policies completas para rol `SUPERVISOR` y `ASESOR`
