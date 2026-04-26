# 📋 Documentación de Módulos — Juan Maurello
## Proyecto PLURALL — Sistema de Información de Créditos

> **Integrante:** Juan Maurello  
> **Color asignado:** 🟢 Verde (`#FF93C47D`)  
> **Proyecto Formativo SENA** | Tecnólogo ADSO 
> **Stack:** Next.js 16 + Supabase (PostgreSQL) + Tailwind CSS

---

## Módulos Asignados

| # | Módulo | Tablas BD principales | Rutas involucradas |
|---|--------|----------------------|-------------------|
| 1 | **Rechazos y Decisiones** | `motivo_rechazo`, `decision_solicitud`, `solicitud_credito` | `/api/admin/solicitud/[id]`, `/admin/solicitudes/[id]` |
| 2 | **Documentos del Sistema** *(módulo adicional implementado)* | `documento_cliente`, `credito`, `plan_pago`, `cuota` | `/dashboard/documentos`, `/api/documentos/*` |

---

## 1. Módulo: Rechazos y Decisiones

### 1.1 ¿Qué hace este módulo?
Es el sistema que estandariza y registra cada decisión tomada sobre una solicitud de crédito. Incluye el catálogo de **motivos de rechazo** (con versión pública y versión técnica) y la tabla de **decisiones de analista**, que guarda quién aprobó/rechazó, con qué condiciones financieras y cuándo.

### 1.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Detalle de solicitud (analista toma decisión) | `/admin/solicitudes/[id]` | Admin / Analista |
| Formulario de aprobación | `/admin/solicitudes/[id]` → botón "Aprobar" | Admin / Analista |
| Formulario de rechazo | `/admin/solicitudes/[id]` → botón "Rechazar" | Admin / Analista |
| Solicitud rechazada (resultado para el cliente) | `/dashboard/creditos` | Cliente |
| Alert de rechazo automático (Experian) | `/dashboard/creditos/solicitar` | Cliente |

### 1.3 Metodología
- **Separación de responsabilidades:** El `motivo_rechazo` tiene dos campos de descripción: uno interno (para el analista con detalles técnicos) y uno público (suavizado para el cliente)
- **Decisión de analista:** Toda decisión queda registrada en `decision_solicitud` con el ID del analista, timestamp y las condiciones exactas
- **Inmutabilidad:** Una vez que una solicitud está en `APROBADA` o `RECHAZADA`, la API bloquea cambios adicionales (HTTP 409 Conflict)
- **Evaluación automática vs. manual:** El scoring automático de Experian puede rechazar directamente; los casos `REVISION_MANUAL` requieren que el analista use esta interfaz

### 1.4 Tablas de Base de Datos

#### Tabla `motivo_rechazo`
```sql
CREATE TABLE motivo_rechazo (
  id_motivo           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion_interna TEXT NOT NULL,   -- Texto técnico para analistas
  descripcion_publica TEXT,            -- Texto suavizado para el cliente
  visible_cliente     BOOLEAN DEFAULT FALSE,  -- ¿Se muestra al cliente en la app?
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

**Catálogo de motivos disponibles:**
| Motivo interno | Mensaje público | ¿Visible? |
|---------------|-----------------|-----------|
| Historial crediticio negativo en Datacrédito | Su historial crediticio no cumple los requisitos mínimos | FALSE |
| Capacidad de endeudamiento al límite | Su nivel de endeudamiento actual no permite aprobar un nuevo crédito | FALSE |
| Documentación incompleta o inválida | Por favor verifica y reenvía tus documentos de identidad | TRUE |
| Cliente en listas restrictivas | No cumples los requisitos de elegibilidad en este momento | FALSE |

#### Tabla `decision_solicitud`
```sql
CREATE TABLE decision_solicitud (
  id_decision            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_solicitud           UUID REFERENCES solicitud_credito(id_solicitud),
  id_analista            UUID REFERENCES perfil_usuario(id),
  resultado              TEXT NOT NULL,     -- 'APROBADO', 'RECHAZADO'
  monto_aprobado         NUMERIC(14,2),     -- Solo si resultado = 'APROBADO'
  plazo_aprobado         INTEGER,           -- Meses aprobados
  tasa_interes_aprobada  NUMERIC(8,6),      -- Tasa efectiva mensual (decimal, ej: 0.0207)
  comentarios_cliente    TEXT,              -- Mensaje que verá el cliente
  comentarios_tecnicos   TEXT,              -- Notas internas del analista
  fecha_decision         TIMESTAMPTZ DEFAULT NOW()
);
```

#### Relación con `solicitud_credito`
```sql
-- Campos que se actualizan cuando se toma una decisión:
ALTER TABLE solicitud_credito ADD COLUMN id_motivo_rechazo UUID REFERENCES motivo_rechazo(id_motivo);
ALTER TABLE solicitud_credito ADD COLUMN id_usuario_evaluador UUID REFERENCES perfil_usuario(id);
ALTER TABLE solicitud_credito ADD COLUMN fecha_decision TIMESTAMPTZ;
ALTER TABLE solicitud_credito ADD COLUMN comentarios_analista TEXT;
```

### 1.5 Archivos del Módulo

#### `app/api/admin/solicitud/[id]/route.js`
**Tipo:** API Route — Next.js  
**Método HTTP:** `PATCH /api/admin/solicitud/:id`

**Autorización (doble capa):**
```javascript
// Capa 1: Supabase Auth (JWT válido)
const { data: { user } } = await supabase.auth.getUser()

// Capa 2: Rol en tabla perfil_usuario
const { data: perfil } = await supabase
  .from('perfil_usuario')
  .select('id_rol, rol ( nombre_rol )')
  .eq('id', user.id).single()

// Solo ADMIN o ANALISTA pueden ejecutar esta acción
if (!['ADMIN', 'ANALISTA'].includes(perfil?.rol?.nombre_rol?.toUpperCase())) {
  return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
}
```

**Validación de estado actual:**
```javascript
// Una solicitud solo puede transitionar desde PENDIENTE o EN_ESTUDIO
const estadoActual = sol.estado_solicitud?.nombre?.toUpperCase()
if (!['PENDIENTE', 'EN_ESTUDIO'].includes(estadoActual)) {
  return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 409 })
}
```

**Flujo completo de APROBAR:**
```
PATCH /api/admin/solicitud/{id}
Body: { accion: "APROBAR", monto_aprobado: 2000000, plazo_aprobado: 12, 
        tasa_interes_aprobada: 0.0207, comentarios_cliente: "...", comentarios_tecnicos: "..." }
  ↓
1. Verificar JWT + rol ADMIN/ANALISTA
2. Buscar solicitud, validar que esté en PENDIENTE/EN_ESTUDIO
3. Buscar UUID del estado 'APROBADA' en tabla estado_solicitud
4. Insertar en decision_solicitud {id_solicitud, id_analista, resultado: 'APROBADO', condiciones...}
5. UPDATE solicitud_credito SET id_estado_solicitud = {APROBADA_id}, id_usuario_evaluador = {analista_id}
6. Retornar { ok: true, resultado: 'APROBADA' }
```

**Flujo completo de RECHAZAR:**
```
PATCH /api/admin/solicitud/{id}
Body: { accion: "RECHAZAR", comentarios_cliente: "...", comentarios_tecnicos: "..." }
  ↓
1–3. Mismo que APROBAR
4. Insertar en decision_solicitud { resultado: 'RECHAZADO', monto_aprobado: null, ... }
5. UPDATE solicitud_credito SET id_estado_solicitud = {RECHAZADA_id}, ...
6. Retornar { ok: true, resultado: 'RECHAZADA' }
```

**Rechazo automático por Experian (en `app/api/creditos/solicitar/route.js`):**
```javascript
// Cuando el scoring dictamina RECHAZAR:
const experian = consultarExperian(cliente.dni)
if (experian.dictamen === 'RECHAZAR') {
  estadoNombre = 'RECHAZADA'
  rechazoMotivo = experian.motivo  // "Historial crediticio negativo en Datacrédito"
  
  // Buscar en catálogo de motivos_rechazo
  const { data: motQ } = await supabase
    .from('motivo_rechazo')
    .select('id_motivo')
    .ilike('descripcion_motivo', '%Historial%')
    .limit(1).single()
  idMotivo = motQ?.id_motivo || null
}

// Se registra en solicitud_credito.id_motivo_rechazo = idMotivo
```

**Librerías usadas:**
- `next/server` — `NextResponse` para respuestas HTTP estructuradas
- `@supabase/supabase-js` — `createClient` con `SERVICE_ROLE_KEY` para operaciones sin RLS
- `@/lib/supabase/server` — Cliente servidor para leer sesión del analista
- `@/lib/supabase/client` — `createBrowserClient` para el formulario del analista en el frontend

---

## 2. Módulo: Documentos del Sistema *(Módulo adicional implementado)*

### 2.1 ¿Qué hace este módulo?
Permite al cliente descargar en tiempo real los documentos oficiales de cada uno de sus créditos: contrato, plan de pagos, estado de cuenta y paz y salvo. Los documentos se generan dinámicamente en el servidor y se presentan como páginas HTML imprimibles (PDF con Ctrl+P).

### 2.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Centro de documentos del cliente | `/dashboard/documentos` | Cliente autenticado |
| Contrato de crédito (generado) | `/api/documentos/contrato/[creditoId]` | Cliente autenticado |
| Plan de pagos (generado) | `/api/documentos/plan-pagos/[creditoId]` | Cliente autenticado |
| Estado de cuenta (generado) | `/api/documentos/estado-cuenta/[creditoId]` | Cliente autenticado |
| Paz y salvo (generado) | `/api/documentos/paz-y-salvo/[creditoId]` | Cliente (solo crédito PAGADO) |

### 2.3 Metodología
- **Generación dinámica:** Cada documento es una API Route que devuelve HTML con `Content-Type: text/html` para ser visualizado en una nueva pestaña del navegador
- **PDF sin librerías externas:** El usuario usa Ctrl+P → Guardar como PDF (sin costo de herramientas como Puppeteer)
- **Control de acceso por estado:** `Paz y Salvo` solo está disponible si el crédito está en estado `PAGADO` o `CANCELADO`
- **Disponibilidad por estado:**

| Documento | ACTIVO | EN_MORA | CANCELADO | PAGADO |
|-----------|:------:|:-------:|:---------:|:------:|
| Contrato | ✅ | ✅ | ✅ | ❌ |
| Plan de Pagos | ✅ | ✅ | ✅ | ❌ |
| Estado de Cuenta | ✅ | ✅ | ✅ | ❌ |
| Paz y Salvo | ❌ | ❌ | ✅ | ✅ |

### 2.4 Tablas de Base de Datos

Las tablas ya descritas en otros módulos; el módulo de documentos **lee** (nunca escribe) estas tablas:

| Tabla | Datos utilizados |
|-------|-----------------|
| `credito` | Monto, tasa, cuotas, fecha desembolso, estado |
| `cliente` | Nombre, DNI, teléfono |
| `plan_pago` | Número total de cuotas, fechas |
| `cuota` | Capital, interés, total, fecha vencimiento, estado, saldo |
| `pago` | Pagos realizados, fechas, métodos |

### 2.5 Archivos del Módulo

#### `app/dashboard/documentos/page.js`
**Tipo:** Server Component  
**Ruta:** `/dashboard/documentos`

**Lógica de disponibilidad (array `DOCUMENTOS`):**
```javascript
const DOCUMENTOS = [
  {
    key:     'contrato',
    label:   'Contrato de Crédito',
    desc:    'Documento oficial con términos, condiciones y obligaciones del crédito.',
    icon:    FileText,
    estados: ['ACTIVO', 'EN_MORA', 'CANCELADO'],   // Estados en que está disponible
    accent:  'text-blue-600 bg-blue-50',
  },
  {
    key:     'paz-y-salvo',
    label:   'Paz y Salvo',
    desc:    'Certificado que acredita la cancelación total del crédito.',
    icon:    FileCheck,
    estados: ['PAGADO', 'CANCELADO'],   // Solo para créditos finalizados
    accent:  'text-emerald-600 bg-emerald-50',
  },
  // ... contrato, plan-pagos, estado-cuenta
]

// Al renderizar: si el crédito no está en los 'estados' del documento → muestra candado
const disponible = doc.estados.includes(credito.estado_credito)
```

**URL de descarga dinámica:**
```javascript
// El botón "Descargar" abre en nueva pestaña la API Route del documento
<a href={`/api/documentos/${doc.key}/${credito.id_credito}`} target="_blank">
  Descargar
</a>
```

#### `app/api/documentos/contrato/[creditoId]/route.js`
**Tipo:** API Route — Genera HTML del contrato  
**Acceso:** `GET /api/documentos/contrato/:creditoId`

```javascript
// Retorna HTML con Content-Type text/html para vista previa en navegador
return new Response(html, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' }
})
```

**Datos incluidos en el contrato:**
- Encabezado PLURALL con número de contrato
- Datos del cliente: nombre, DNI, teléfono
- Condiciones financieras: monto, tasa efectiva anual, plazo, cuota fija
- Fechas: desembolso, primera cuota, última cuota
- Cláusulas del contrato
- Firmas (campo para imprimir)

#### `app/api/documentos/plan-pagos/[creditoId]/route.js`
**Tipo:** API Route — Tabla de amortización completa  
**Acceso:** `GET /api/documentos/plan-pagos/:creditoId`

Consulta `cuota` del plan y genera una tabla HTML con:
- N°, fecha vencimiento, capital, interés, cuota total, saldo después de pago, estado

#### `app/api/documentos/estado-cuenta/[creditoId]/route.js`
**Tipo:** API Route — Estado de cuenta actualizado  
**Acceso:** `GET /api/documentos/estado-cuenta/:creditoId`

Incluye: saldo pendiente, cuotas pagadas/pendientes/vencidas, historial de pagos realizados

#### `app/api/documentos/paz-y-salvo/[creditoId]/route.js`
**Tipo:** API Route — Certificado de paz y salvo  
**Acceso:** `GET /api/documentos/paz-y-salvo/:creditoId`  
**Validación:** Solo genera si `credito.estado_credito === 'PAGADO'`, si no → 403 Forbidden

**Librerías usadas:**
- `@/lib/supabase/server` — Autenticación y consultas de BD
- `next/navigation` — `redirect` para redirigir si no está autenticado
- `@/lib/calculadora` — `formatCOP` para moneda colombiana
- `lucide-react` — `FileText`, `Download`, `FileCheck`, `Receipt`, `BarChart3`, `CreditCard`, `Info`, `Lock`

---

## 3. Reglas de Negocio Cubiertas

| Código | Regla | Módulo | Estado |
|--------|-------|--------|--------|
| RN-03 | Rechazo debe registrar motivo | Rechazos | ✅ `id_motivo_rechazo` en solicitud |
| RN-09 | Solo admin/analista puede decidir | Rechazos | ✅ Verificación de rol |
| RN-10 | Registro de quién tomó la decisión | Rechazos | ✅ `decision_solicitud.id_analista` |
| RN-12 | Paz y Salvo solo si crédito pagado | Documentos | ✅ Validación por estado |
| RN-13 | Documentos disponibles por estado | Documentos | ✅ Array `estados` por documento |
| BD-04 | Inmutabilidad de decisiones tomadas | Rechazos | ✅ HTTP 409 si ya procesada |

---

## 4. Variables de Entorno Utilizadas

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL del proyecto Supabase
SUPABASE_SERVICE_ROLE_KEY=        # Clave de servicio (sin RLS — solo servidor)
NEXT_PUBLIC_APP_URL=              # URL base de la aplicación
```

---

## 5. Comandos para Ejecutar

```bash
cd apps/web && npm run dev

# Rutas de este módulo:
# http://localhost:3000/dashboard/documentos
# http://localhost:3000/api/documentos/contrato/{creditoId}
# http://localhost:3000/api/documentos/plan-pagos/{creditoId}
# http://localhost:3000/api/documentos/estado-cuenta/{creditoId}
# http://localhost:3000/api/documentos/paz-y-salvo/{creditoId}
```

---

## 6. Estado de Desarrollo y Tareas Pendientes

### ✅ Completado
| Funcionalidad | Archivo |
|--------------|--------|
| API PATCH aprobar/rechazar solicitud | `app/api/admin/solicitud/[id]/route.js` |
| Registro de decisión en `decision_solicitud` | `app/api/admin/solicitud/[id]/route.js` |
| Validación de inmutabilidad (HTTP 409) | `app/api/admin/solicitud/[id]/route.js` |
| Centro de documentos del cliente | `app/dashboard/documentos/page.js` |
| Generación HTML de contrato | `app/api/documentos/contrato/[creditoId]/route.js` |
| Generación HTML plan de pagos | `app/api/documentos/plan-pagos/[creditoId]/route.js` |
| Estado de cuenta | `app/api/documentos/estado-cuenta/[creditoId]/route.js` |
| Paz y salvo con control por estado | `app/api/documentos/paz-y-salvo/[creditoId]/route.js` |

### 🔄 En Desarrollo (incompleto)
| Funcionalidad | Problema actual |
|--------------|----------------|
| Detalle solicitud admin | La página `/admin/solicitudes/[id]` **muestra la info pero el formulario de decisión no envía** — falta el `<form>` con fetch al PATCH |
| Catálogo motivos de rechazo | Los motivos están **hardcodeados** en el scoring, no se consultan dinámicamente de `motivo_rechazo` |
| Documentos HTML | Los documentos generados tienen **estilos básicos** — faltan membrete, logos y firma digital |
| Rechazo por analista | Falta opción para que el analista elija el **motivo de rechazo** desde un dropdown |

### ⏳ Pendiente — Por Implementar

#### Vista Supervisor — Flujo de decisiones (NO EXISTE)
```
/supervisor/decisiones             → Bandeja de solicitudes que requieren decisión
/supervisor/solicitudes/[id]       → Vista completa con:
    - Datos del cliente (nombre, DNI, teléfono, historial)
    - Score visual (barra o gauge) con factores de riesgo
    - Imágenes de cédula (visor de documentos KYC)
    - Formulario: ¿Aprobar con qué condiciones? / ¿Rechazar por qué motivo?
    - Historial de decisiones anteriores del mismo cliente
```

#### Vista Asesor — Estado del cliente (NO EXISTE)
```
/asesor/clientes/[id]/decision     → Ver qué decisión se tomó sobre el crédito del cliente
/asesor/clientes/[id]/documentos   → Acceso a documentos del cliente para adjuntar
```

#### Notificaciones al cliente al tomar decisión (PARCIAL)
```
Actualmente: el cliente no recibe ningún email al aprobar/rechazar.
Pendiente:
  - Email de aprobación con condiciones del crédito
  - Email de rechazo con mensaje suavizado y motivo visible_cliente=TRUE
  - SMS via Twilio o WhatsApp Business API
  - Notificación push (web push API)
```

#### APIs faltantes
```
GET  /api/admin/solicitud/[id]/historial  → Historial de cambios de estado
POST /api/admin/solicitud/[id]/comentario → Agregar comentario sin cambiar estado
GET  /api/motivos-rechazo                 → Listar catálogo de motivos
POST /api/motivos-rechazo                 → Crear nuevo motivo (solo ADMIN)
GET  /api/documentos/certificado-deuda/[id] → Certificado de saldo de deuda vigente
```

#### Mejoras de documentos pendientes
- [ ] Generar PDF real con **Puppeteer** o **jsPDF** (actualmente solo HTML imprimible)
- [ ] Firma electrónica digital en contratos
- [ ] QR de verificación de autenticidad en documentos
- [ ] Logo de PLURALL en membrete de todos los documentos
- [ ] Versión en inglés de documentos (internacionalización)

#### BD pendiente
- [ ] Poblar catálogo `motivo_rechazo` con al menos 10 motivos reales
- [ ] Tabla `plantilla_documento` para versionar los templates HTML
- [ ] Tabla `firma_electronica` para trazabilidad de firmas
- [ ] Log de quién descargó qué documento y cuándo
