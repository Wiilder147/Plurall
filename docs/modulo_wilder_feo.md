# 📋 Documentación de Módulos — Wilder Feo
## Proyecto PLURALL — Sistema de Información de Créditos

> **Integrante:** Wilder Feo  
> **Color asignado:** ⚫ Gris (`#FFCCCCCC`)  
> **Proyecto Formativo SENA** | Tecnólogo ADSO
> **Stack:** Next.js 16 + Supabase (PostgreSQL) + Tailwind CSS

---

## Módulos Asignados

| # | Módulo | Tablas BD principales | Rutas involucradas |
|---|--------|----------------------|-------------------|
| 1 | **Pagos** | `pago`, `cuota`, `credito` | `/dashboard/cuotas/[id]/pagar`, `/api/pagos/iniciar`, `/api/webhooks/wompi` |
| 2 | **Estados y Auditoría** | `historial_estado`, `log_auditoria`, `config_sistema` | `/dashboard/cuotas/confirmacion`, disparadores de BD |
| 3 | **Notificaciones** *(módulo adicional implementado)* | `solicitud_credito`, `cliente` | `/api/notificaciones/solicitud`, `/api/auth/lockout` |

---

## 1. Módulo: Pagos

### 1.1 ¿Qué hace este módulo?
Gestiona el ciclo completo de un pago: desde que el cliente decide pagar una cuota hasta que el banco confirma la transacción. Integra **Wompi** (pasarela de pagos colombiana) como proveedor y usa un **webhook seguro** para recibir la confirmación del pago y actualizar el estado de la cuota en la base de datos.

### 1.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Botón "Pagar" en la lista de cuotas | `/dashboard/cuotas` | Cliente autenticado |
| Pantalla de pago con widget Wompi | `/dashboard/cuotas/[id]/pagar` | Cliente autenticado |
| Confirmación exitosa post-pago | `/dashboard/cuotas/confirmacion` | Cliente autenticado |
| Webhook de confirmación (invisible) | `/api/webhooks/wompi` | Llamado por Wompi |

### 1.3 Metodología
- **Flujo de pago en 2 fases:**
  1. **Fase de inicialización:** El cliente clica "Pagar" → el servidor genera una firma HMAC SHA-256 → se abre el widget de Wompi con datos pre-llenados
  2. **Fase de confirmación:** Wompi llama al webhook POST → el servidor verifica la firma → actualiza cuota y saldo del crédito
- **Seguridad criptográfica:** Firma SHA-256 que Wompi usa para verificar el monto y la referencia. Si la firma es inválida → el widget no se abre (prevención de tampering)
- **Verificación del webhook:** El servidor recalcula el checksum HMAC y lo compara con el enviado por Wompi. Si no coinciden → HTTP 401 (prevención de spoofing)
- **Idempotencia:** Antes de procesar un pago, se verifica si ya existe un `pago` con esa `referencia_externa`. Si existe → se ignora (evita pagos dobles)
- **Service Role:** El webhook usa `SUPABASE_SERVICE_ROLE_KEY` porque se ejecuta sin sesión de usuario (Wompi no tiene cookies de sesión)

### 1.4 Tablas de Base de Datos

#### Tabla `pago`
```sql
CREATE TABLE pago (
  id_recibo           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cuota            UUID REFERENCES cuota(id_cuota),          -- Cuota que se está pagando
  id_credito          UUID REFERENCES credito(id_credito),
  monto_pagado        NUMERIC(14,2) NOT NULL,    -- Valor total del pago
  monto_capital       NUMERIC(14,2) DEFAULT 0,   -- Cuánto fue a capital
  monto_interes       NUMERIC(14,2) DEFAULT 0,   -- Cuánto fue a intereses
  monto_mora          NUMERIC(14,2) DEFAULT 0,   -- Intereses de mora (si aplica)
  metodo_pago         TEXT DEFAULT 'WOMPI',      -- 'WOMPI', 'PSE', 'EFECTIVO'
  referencia_externa  TEXT UNIQUE,               -- Referencia generada: PLR-XXXX-timestamp
  estado              TEXT DEFAULT 'CONFIRMADO', -- 'CONFIRMADO', 'FALLIDO', 'PROCESANDO'
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

**Formato de la referencia única:**
```
PLR-{primeros 8 chars del id_cuota en MAYÚSCULAS}-{timestamp Unix}
Ejemplo: PLR-A3B4C5D6-1745704800000
```

### 1.5 Archivos del Módulo

#### `app/api/pagos/iniciar/route.js`
**Tipo:** API Route — Next.js  
**Método HTTP:** `POST /api/pagos/iniciar`  
**Body:** `{ cuotaId: "UUID" }`

**¿Qué hace?**
1. Verifica JWT de sesión (usuario autenticado)
2. Busca la cuota con JOIN a `plan_pago → credito → id_cliente`
3. Verifica que la cuota pertenezca al cliente autenticado (protección contra IDOR)
4. Verifica que la cuota esté en estado `PENDIENTE` o `VENCIDA`
5. Genera una referencia única: `PLR-{cuotaId[:8].upper}-{Date.now()}`
6. Calcula el monto en centavos: `Math.round(cuota.monto_total_cuota * 100)`
7. Genera la firma de integridad SHA-256

**Generación de firma criptográfica:**
```javascript
import { createHash } from 'crypto'

const referencia      = `PLR-${cuotaId.slice(0, 8).toUpperCase()}-${Date.now()}`
const montoEnCentavos = Math.round(cuota.monto_total_cuota * 100)
const moneda          = 'COP'
const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || ''

// SHA256(referencia + montoEnCentavos + moneda + secreto)
const cadena = `${referencia}${montoEnCentavos}${moneda}${integritySecret}`
const hash   = createHash('sha256').update(cadena).digest('hex')
```

**Respuesta al navegador:**
```json
{
  "publicKey":       "pub_stagtest_XXXX",
  "referencia":      "PLR-A3B4C5D6-1745704800000",
  "montoEnCentavos": 19047600,
  "hash":            "a3b4c5d6e7f8...",
  "redirectUrl":     "https://plurall.vercel.app/dashboard/cuotas/confirmacion?referencia=PLR-...",
  "email":           "cliente@example.com",
  "nombre":          "Pedro García López",
  "telefono":        "3001234567",
  "dni":             "1234567890"
}
```

**Verificación de ownership (protección IDOR):**
```javascript
// Obtener el id_cliente del usuario autenticado
const { data: clienteRow } = await supabase
  .from('cliente').select('id_cliente, ...')
  .eq('id_usuario_cuenta', user.id).single()

// Comparar con el id_cliente del crédito de la cuota
if (!clienteRow || cuota.plan_pago.credito.id_cliente !== clienteRow.id_cliente) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
}
```

#### `app/api/webhooks/wompi/route.js`
**Tipo:** API Route — Next.js  
**Método HTTP:** `POST /api/webhooks/wompi`  
**Llamado por:** Wompi (servidor externo, no el navegador del cliente)

**Verificación de firma HMAC:**
```javascript
const tx      = evento?.data?.transaction
const secret  = process.env.WOMPI_EVENTS_SECRET || ''

// Wompi calcula: SHA256(tx.id + status + amount_in_cents + events_secret)
const checksum = evento?.signature?.checksum
const cadena   = `${tx.id}${tx.status}${tx.amount_in_cents}${secret}`
const esperado = createHash('sha256').update(cadena).digest('hex')

if (checksum !== esperado) {
  // ¡Posible ataque de spoofing! Rechazar inmediatamente
  return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
}
```

**Flujo de un pago APROBADO:**
```
1. Verificar firma HMAC (seguridad)
2. Solo procesar evento 'transaction.updated'
3. Verificar idempotencia: ¿ya existe pago con esta referencia_externa?
   → Sí: retornar { ok: true, msg: 'Pago ya procesado' }
4. Extraer prefix del cuotaId desde la referencia:
   referencia = PLR-{cuotaId[:8]}-{timestamp}
   prefijo    = partes[1].toLowerCase()
5. Buscar cuota: .ilike('id_cuota', `${prefijo}%`)
6. Buscar plan_pago → id_credito
7. INSERT en tabla 'pago' { id_cuota, id_credito, monto_pagado, monto_capital,
                             monto_interes, metodo_pago: 'WOMPI', referencia_externa,
                             estado: 'CONFIRMADO' }
8. UPDATE cuota SET estado_cuota = 'PAGADA', monto_pagado_real, fecha_pago_real
9. UPDATE credito:
   - saldo_pendiente = saldo_pendiente - monto_capital  (mín. 0)
   - cuotas_pagadas  = cuotas_pagadas + 1
10. Retornar { ok: true }
```

**Flujo de un pago FALLIDO / RECHAZADO:**
```javascript
} else if (['DECLINED', 'ERROR', 'VOIDED'].includes(estado)) {
  // Registrar el intento fallido para auditoría (sin asignar cuota)
  await supabase.from('pago').insert({
    id_cuota:           null,
    id_credito:         null,
    monto_pagado:       monto / 100,
    metodo_pago:        'WOMPI',
    referencia_externa: referencia,
    estado:             'FALLIDO',
  }).catch(() => null)  // Silenciamos errores (el constraint puede fallar si la referencia ya existe)
}
```

**Librerías usadas:**
- `node:crypto` — `createHash('sha256')` para firmas HMAC
- `@supabase/supabase-js` — Service client sin RLS
- `next/server` — `NextResponse`

---

## 2. Módulo: Estados y Auditoría

### 2.1 ¿Qué hace este módulo?
Proporciona trazabilidad completa de todos los cambios de estado en el sistema. Registra **quién cambió qué, cuándo y desde dónde**. Incluye también el registro de acciones de usuarios (log de auditoría) y la tabla de configuración global del sistema.

### 2.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Confirmación post-pago | `/dashboard/cuotas/confirmacion` | Cliente |
| Log de auditoría (futuro) | `/admin/auditoria` | Solo Admin (pendiente) |
| Dashboard de inicio (estado de mora) | `/dashboard/inicio` | Cliente |

### 2.3 Metodología
- **Historial de estados:** La tabla `historial_estado` funciona como un log append-only (nunca se actualiza, solo se inserta)
- **Log de auditoría:** Registra acciones no relacionadas con estados, como descargas de documentos o intentos fallidos de login
- **Configuración del sistema:** Parámetros globales que afectan comportamientos (tasas por defecto, límites de crédito, cooldowns)

### 2.4 Tablas de Base de Datos

#### Tabla `historial_estado`
```sql
CREATE TABLE historial_estado (
  id_historial         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_afectada       TEXT NOT NULL,    -- 'CLIENTE', 'SOLICITUD_CREDITO', 'CREDITO', 'CUOTA'
  id_registro          UUID NOT NULL,    -- ID del objeto que cambió de estado
  estado_anterior      TEXT,            -- Estado previo (null si es creación)
  estado_nuevo         TEXT NOT NULL,   -- Estado al que transicionó
  fecha_cambio         TIMESTAMPTZ DEFAULT NOW(),
  id_usuario_responsable UUID REFERENCES perfil_usuario(id),   -- Quién hizo el cambio
  origen               TEXT DEFAULT 'SISTEMA'  -- 'SISTEMA', 'ANALISTA', 'WOMPI_WEBHOOK'
);
```

**Eventos típicos registrados:**
| Tabla afectada | Estado anterior | Estado nuevo | Origen |
|---------------|----------------|-------------|--------|
| SOLICITUD_CREDITO | `PENDIENTE` | `APROBADA` | ANALISTA |
| SOLICITUD_CREDITO | `APROBADA` | `DESEMBOLSADA` | SISTEMA |
| CUOTA | `PENDIENTE` | `PAGADA` | WOMPI_WEBHOOK |
| CUOTA | `PENDIENTE` | `VENCIDA` | SISTEMA (tarea automática) |
| CREDITO | `ACTIVO` | `EN_MORA` | SISTEMA |

#### Tabla `log_auditoria`
```sql
CREATE TABLE log_auditoria (
  id_log        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario    UUID REFERENCES perfil_usuario(id),
  accion        TEXT NOT NULL,       -- Ej: 'DESCARGA_DOCUMENTO', 'LOGIN_FALLIDO', 'PAGO_INICIADO'
  detalle       TEXT,                -- Información adicional (qué documento, desde qué IP)
  ip_origen     TEXT,                -- IP del cliente
  user_agent    TEXT,                -- Navegador del cliente
  fecha_accion  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabla `config_sistema`
```sql
CREATE TABLE config_sistema (
  clave       TEXT PRIMARY KEY,    -- Identificador de la configuración
  valor       TEXT NOT NULL,       -- Valor (se parsea según el tipo)
  descripcion TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ejemplo de configuraciones:
INSERT INTO config_sistema VALUES
  ('TEA_DEFAULT',         '28',     'Tasa efectiva anual por defecto (%)'),
  ('COOLDOWN_DIAS',       '90',     'Días de espera entre solicitudes'),
  ('MONTO_MIN',           '100000', 'Monto mínimo de crédito en COP'),
  ('MONTO_MAX',           '10000000','Monto máximo de crédito en COP'),
  ('PLAZO_MIN',           '3',      'Plazo mínimo en meses'),
  ('PLAZO_MAX',           '24',     'Plazo máximo en meses'),
  ('MORA_DIARIA',         '0.001',  'Tasa de mora diaria (0.1%)'),
  ('MAX_INTENTOS_LOGIN',  '3',      'Intentos fallidos antes de bloquear');
```

### 2.5 Archivos del Módulo

#### `app/dashboard/cuotas/confirmacion/page.js`
**Tipo:** Client Component (necesita leer `searchParams` del navegador)  
**Ruta:** `/dashboard/cuotas/confirmacion`

**¿Qué hace?**
Después de que Wompi redirige al cliente de vuelta a la aplicación, esta pantalla:
1. Lee el parámetro `?referencia=PLR-...` de la URL
2. Muestra un mensaje de "Pago procesado exitosamente" con la referencia
3. Botón para volver al panel de cuotas

**Nota:** El estado real de la cuota ya fue actualizado por el webhook (server-side). Esta pantalla es solo feedback visual para el usuario.

#### `app/api/auth/lockout/route.js`
**Tipo:** API Route  
**Función:** Registra intentos fallidos de login. Si se superan 3 intentos, bloquea la cuenta temporalmente en Redis (Upstash).

```javascript
// POST /api/auth/lockout
// Body: { email: "usuario@example.com" }
// Incrementa contador en Redis con TTL de 15 minutos
// Si contador >= 3 → marcar cuenta como bloqueada
```

---

## 3. Módulo: Notificaciones *(Módulo adicional implementado)*

### 3.1 ¿Qué hace este módulo?
Envía notificaciones automáticas a los clientes cuando ocurren eventos importantes en sus solicitudes: aprobación, rechazo, o recordatorios de pago. Usa **Resend** como proveedor de email transaccional.

### 3.2 Metodología
- **Proveedor:** Resend (API de email transaccional moderno)
- **Templates:** HTML generado dinámicamente en el servidor con datos del cliente
- **Disparo:** Se llama desde otras API Routes (ej: después de aprobar una solicitud)

### 3.3 Archivos del Módulo

#### `app/api/notificaciones/solicitud/route.js`
**Tipo:** API Route  
**Método HTTP:** `POST /api/notificaciones/solicitud`

**Body del request:**
```json
{
  "tipo": "APROBACION",
  "clienteEmail": "pedro@example.com",
  "clienteNombre": "Pedro García",
  "monto": 2000000,
  "cuota": 190476,
  "plazo": 12
}
```

**Tipos de notificación:**
| Tipo | Asunto | Cuándo se dispara |
|------|--------|------------------|
| `APROBACION` | "¡Tu crédito Plurall fue aprobado!" | Al aprobar solicitud |
| `RECHAZO` | "Actualización sobre tu solicitud" | Al rechazar solicitud |
| `RECORDATORIO` | "Tienes una cuota próxima a vencer" | Tarea programada |

**Integración con Resend:**
```javascript
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from:    `Plurall <${process.env.RESEND_FROM_EMAIL}>`,
  to:      [clienteEmail],
  subject: '¡Tu crédito Plurall fue aprobado!',
  html:    generateEmailHtml({ clienteNombre, monto, cuota, plazo }),
})
```

---

## 4. Resumen del Ecosistema de Pagos (Flujo completo)

```
Cliente clica "Pagar cuota #3"
        ↓
GET /dashboard/cuotas/[id]/pagar
        ↓
POST /api/pagos/iniciar → { referencia, hash, publicKey, montoEnCentavos }
        ↓
Abre widget Wompi (JS externo cargado del CDN de Wompi)
        ↓ (el cliente ingresa datos de tarjeta en el widget de Wompi)
Wompi procesa el pago en sus servidores
        ↓
Wompi redirige al cliente → /dashboard/cuotas/confirmacion?referencia=PLR-...
Wompi envía webhook → POST /api/webhooks/wompi
        ↓
Webhook verifica firma SHA-256
Webhook registra pago en tabla 'pago' (idempotente)
Webhook actualiza cuota → estado: 'PAGADA'
Webhook actualiza crédito → saldo_pendiente -= capital, cuotas_pagadas += 1
```

---

## 5. Reglas de Negocio Cubiertas

| Código | Regla | Módulo | Estado |
|--------|-------|--------|--------|
| RN-20 | Pagos confirmados solo vía webhook firmado | Pagos | ✅ Verificación HMAC |
| RN-21 | Un pago no puede procesarse dos veces | Pagos | ✅ Idempotencia por referencia_externa |
| RN-22 | Cliente no puede pagar cuota de otro cliente | Pagos | ✅ Verificación de ownership (IDOR) |
| RN-23 | Solo cuotas PENDIENTE/VENCIDA son pagables | Pagos | ✅ Validación en iniciar |
| RN-24 | Registro de intentos fallidos de pago | Estados/Auditoría | ✅ Tabla pago estado=FALLIDO |
| RN-25 | Bloqueo de cuenta tras 3 intentos de login | Estados/Auditoría | ✅ Redis + Upstash |
| BD-06 | Historial de estados append-only | Estados/Auditoría | ✅ Solo INSERT, nunca UPDATE |

---

## 6. Variables de Entorno Utilizadas

```env
# Wompi (pagos)
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=     # Clave pública del widget de Wompi
WOMPI_PRIVATE_KEY=                # Clave privada para operaciones API
WOMPI_EVENTS_SECRET=              # Secreto para verificar firma del webhook
WOMPI_INTEGRITY_SECRET=           # Secreto para generar hash de integridad

# Supabase (base de datos)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Resend (emails)
RESEND_API_KEY=
RESEND_FROM_EMAIL=                # ej: noreply@plurall.app

# Redis (bloqueo de cuentas)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=              # URL de producción para redirect de Wompi
```

---

## 7. Comandos para Ejecutar

```bash
cd apps/web && npm run dev

# Rutas de este módulo:
# http://localhost:3000/dashboard/cuotas/{cuotaId}/pagar
# http://localhost:3000/dashboard/cuotas/confirmacion
# POST http://localhost:3000/api/pagos/iniciar
# POST http://localhost:3000/api/webhooks/wompi   (llamado por Wompi)
# POST http://localhost:3000/api/notificaciones/solicitud
# POST http://localhost:3000/api/auth/lockout
```

---

## 8. Estado de Desarrollo y Tareas Pendientes

### ✅ Completado
| Funcionalidad | Archivo |
|--------------|--------|
| API iniciar pago con firma HMAC SHA-256 | `app/api/pagos/iniciar/route.js` |
| Pre-registro del pago (PROCESANDO) al iniciar + cálculo de mora | `app/api/pagos/iniciar/route.js` |
| Webhook Wompi con verificación de checksum | `app/api/webhooks/wompi/route.js` |
| Idempotencia de pagos (referencia_externa UNIQUE) | `db/23_wompi_pagos.sql` + webhook |
| Actualización saldo y estado cuota tras pago | `app/api/webhooks/wompi/route.js` |
| Registro pagos fallidos en auditoría | `app/api/webhooks/wompi/route.js` |
| Confirmación de pago con verificación real + polling | `app/dashboard/cuotas/confirmacion/page.js` |
| API lockout (estructura base) | `app/api/auth/lockout/route.js` |
| API notificaciones (estructura base) | `app/api/notificaciones/solicitud/route.js` |

### 🔄 En Desarrollo (incompleto)
| Funcionalidad | Problema actual |
|--------------|----------------|
| Lockout de cuentas | El archivo `route.js` existe pero **no hay integración con Redis** (Upstash) — las variables de entorno están definidas pero la lógica no conecta |
| Notificaciones | La API existe pero **el template HTML del email es básico** y falta integración real con Resend en producción |
| Tabla `historial_estado` | Los triggers de migración 09 ya la pueblan automáticamente para `solicitud_credito`, `credito` y `cuota` ✅ |

### ⏳ Pendiente — Por Implementar

#### Pasarela PSE — Pago bancario (NO EXISTE)
```
Actualmente PLURALL solo soporta tarjetas de crédito/débito via Wompi widget.
Pendiente implementar PSE (Pago por Sistema de Eléctrico):
  POST /api/pagos/iniciar-pse    → Crea transacción PSE en Wompi
      Body: { cuotaId, bankCode, personType, docType, docNumber }
  GET  /api/pagos/estado-pse/[txId] → Consulta estado de transacción PSE asíncrona

Vista: /dashboard/cuotas/{id}/pagar → Agregar tab "Pagar con PSE"
```

#### Cron Job — Mora automática (CRÍTICO — NO EXISTE)
```
Sin este proceso, las cuotas NUNCA se marcan como vencidas automáticamente.
Pendiente:

1. Configurar Vercel Cron en vercel.json:
   { "crons": [{ "path": "/api/cron/mora", "schedule": "0 8 * * *" }] }

2. Implementar /api/cron/mora/route.js:
   - Seleccionar cuotas vencidas (fecha_vencimiento < HOY AND estado = 'PENDIENTE')
   - Calcular mora diaria: monto_cuota * tasa_mora_diaria * dias_vencidos
   - UPDATE cuota SET estado_cuota = 'VENCIDA'
   - UPDATE credito SET estado_credito = 'EN_MORA', cuotas_en_mora += N
   - INSERT historial_estado por cada cambio
   - Enviar email de recordatorio via Resend
```

#### Sistema de Auditoría completo (PARCIAL)
```
Pendiente poblar tabla historial_estado desde:
  - Webhook de Wompi (pago confirmado → PENDIENTE → PAGADA) ✅ implementar
  - API de decisión (PENDIENTE → APROBADA/RECHAZADA) ✅ implementar
  - API de desembolso (APROBADA → DESEMBOLSADA) ✅ implementar
  - Cron de mora (PENDIENTE → VENCIDA) ⏳ pendiente

Vista UI de auditoría (NO EXISTE):
  /admin/auditoria               → Log de todas las acciones del sistema
  /admin/auditoria/usuario/[id]  → Acciones de un usuario específico
  /supervisor/auditoria          → Vista filtrada del supervisor
```

#### Panel de Configuración del Sistema (NO EXISTE)
```
/admin/configuracion             → Panel para editar tabla config_sistema:
    - Tasas de interés por defecto
    - Montos mínimos/máximos de crédito
    - Cooldown entre solicitudes
    - Tasa de mora diaria
    - Intentos de login antes del bloqueo
    - Días de período de gracia

API:
GET  /api/config                  → Leer configuración
PUT  /api/config/[clave]          → Actualizar un parámetro (solo ADMIN)
```

#### Gestión de Cobro — Vista Asesor (NO EXISTE)
```
/asesor/cobranza                 → Lista de clientes en mora asignados
/asesor/cobranza/[clienteId]     → Registrar gestión de cobro:
    - Acordó pago para tal fecha
    - No contestó
    - Promesa de pago incumplida
    - Pago recibido en efectivo

API:
POST /api/cobranza/gestion       → Registrar gestión de cobro
POST /api/pagos/efectivo         → Registrar pago en efectivo cobrado por asesor
```

#### APIs faltantes de Pagos/Auditoría
```
GET  /api/pagos/historial/[creditoId]   → Historial completo de pagos
GET  /api/pagos/[pagoId]                → Detalle de un pago específico
POST /api/pagos/reversar/[pagoId]       → Reversar un pago erróneo (solo ADMIN)
GET  /api/auditoria                     → Log paginado de acciones del sistema
GET  /api/auditoria/usuario/[id]        → Log de acciones de un usuario
GET  /api/config                        → Parámetros actuales del sistema
POST /api/notificaciones/mora           → Email masivo a clientes en mora
POST /api/notificaciones/recordatorio   → Email recordatorio de próxima cuota
```

#### BD pendiente
- [ ] Trigger que popule `historial_estado` en cada cambio de `solicitud_credito.id_estado_solicitud`
- [ ] Trigger que popule `historial_estado` en cada cambio de `cuota.estado_cuota`
- [ ] Trigger que popule `historial_estado` en cada cambio de `credito.estado_credito`
- [ ] Tabla `gestion_cobranza` para registro de gestiones de cobro del asesor
- [ ] Índice en `pago.referencia_externa` para búsquedas rápidas del webhook
- [ ] Políticas RLS en tabla `log_auditoria` (solo ADMIN puede leer)
- [ ] Función `pg_cron` para mora automática si no se usa Vercel Cron
