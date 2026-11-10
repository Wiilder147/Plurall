# 📋 Documentación de Módulos — Jeferson Lugo
## Proyecto PLURALL — Sistema de Información de Créditos

> **Integrante:** Jeferson Lugo  
> **Color asignado:** 🟡 Amarillo (`#FFFFF2CC`)  
> **Proyecto Formativo SENA** | Tecnólogo ADSO 
> **Stack:** Next.js 16 + Supabase (PostgreSQL) + Tailwind CSS

---

## Módulos Asignados

| # | Módulo | Tablas BD principales | Rutas involucradas |
|---|--------|----------------------|-------------------|
| 1 | **Créditos** | `credito`, `estado_credito`, `solicitud_credito` | `/dashboard/creditos`, `/dashboard/creditos/[id]`, `/api/admin/desembolsar/[id]` |
| 2 | **Plan de Pagos y Cuotas** | `plan_pago`, `cuota` | `/dashboard/cuotas`, `/dashboard/cuotas/[id]/pagar` |
| 3 | **Calculadora de Amortización** *(módulo transversal implementado)* | — (lógica pura, sin BD) | `lib/calculadora.js`, `/dashboard/creditos/solicitar` |

---

## 1. Módulo: Créditos

### 1.1 ¿Qué hace este módulo?
Registra el préstamo definitivo una vez que la solicitud fue aprobada y el analista da la orden de desembolso. Es el registro central del contrato de crédito: guarda el monto real entregado, la tasa pactada, las fechas, el estado financiero y el saldo pendiente actualizado.

### 1.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Mis Créditos (resumen del cliente) | `/dashboard/creditos` | Cliente autenticado |
| Detalle de crédito | `/dashboard/creditos/[id]` | Cliente autenticado |
| Dashboard de inicio (tarjeta de estado) | `/dashboard/inicio` | Cliente autenticado |
| Trigger de desembolso (admin) | `/api/admin/desembolsar/[id]` | Admin / Analista |

### 1.3 Metodología
- **Patrón del cliente:** Server Component que carga el crédito activo y el historial con 2 consultas separadas
- **Barra de progreso:** `(cuotas_pagadas / numero_cuotas) * 100` — se calcula en el servidor y se pasa como dato al HTML
- **Patrón de desembolso:** API Route `POST` que ejecuta una transacción lógica de 4 pasos: Crédito → PlanPago → Cuotas (bulk) → Estado solicitud
- **Service Role:** El desembolso usa `SUPABASE_SERVICE_ROLE_KEY` (sin restricciones de RLS) para poder escribir desde el servidor en nombre del sistema
- **Amortización francesa:** El plan de cuotas se genera con `calcularAmortizacion()` que implementa la fórmula de cuota fija

### 1.4 Tablas de Base de Datos

#### Tabla `credito`
```sql
CREATE TABLE credito (
  id_credito           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_solicitud         UUID REFERENCES solicitud_credito(id_solicitud),
  id_cliente           UUID REFERENCES cliente(id_cliente),
  monto_desembolsado   NUMERIC(14,2) NOT NULL,   -- Monto real entregado
  tasa_interes_anual   NUMERIC(8,4) NOT NULL,     -- TEA en % (ej: 28.0)
  tasa_interes_mensual NUMERIC(8,6) NOT NULL,     -- TEM decimal (ej: 0.020742)
  numero_cuotas        INTEGER NOT NULL,           -- Total de cuotas pactadas
  cuota_fija           NUMERIC(14,2) NOT NULL,    -- Cuota mensual fija calculada
  fecha_desembolso     TIMESTAMPTZ NOT NULL,
  fecha_primera_cuota  DATE NOT NULL,
  fecha_ultima_cuota   DATE NOT NULL,
  estado_credito       TEXT NOT NULL DEFAULT 'ACTIVO',  -- ACTIVO | EN_MORA | PAGADO | CANCELADO | CASTIGADO
  saldo_pendiente      NUMERIC(14,2) NOT NULL,    -- Se reduce con cada pago
  cuotas_pagadas       INTEGER DEFAULT 0,          -- Contador de cuotas pagadas
  cuotas_en_mora       INTEGER DEFAULT 0,          -- Contador de cuotas vencidas
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
```

**Estados del crédito:**
| Estado | Descripción | Color UI |
|--------|-------------|----------|
| `ACTIVO` | En curso, al día | Verde esmeralda |
| `EN_MORA` | Tiene cuotas vencidas | Rojo |
| `PAGADO` | Todas las cuotas canceladas | Azul |
| `CANCELADO` | Cancelado antes del vencimiento | Gris |
| `CASTIGADO` | Incobrable, dado de baja | Gris oscuro |

### 1.5 Archivos del Módulo

#### `app/dashboard/creditos/page.js`
**Tipo:** Server Component (renderizado en servidor)  
**Ruta:** `/dashboard/creditos`

**Consultas a la BD:**
```javascript
// Crédito activo (ACTIVO o EN_MORA) — máximo 1 por cliente
const { data: activo } = await supabase
  .from('credito')
  .select('*')
  .eq('id_cliente', clienteRow.id_cliente)
  .in('estado_credito', ['ACTIVO', 'EN_MORA'])
  .order('created_at', { ascending: false })
  .limit(1).single()

// Historial de créditos finalizados
const { data: historicos } = await supabase
  .from('credito')
  .select('*')
  .eq('id_cliente', clienteRow.id_cliente)
  .in('estado_credito', ['PAGADO', 'CANCELADO', 'CASTIGADO'])
  .order('created_at', { ascending: false })
```

**Datos mostrados:**
| Campo visual | Dato | Cálculo |
|-------------|------|---------|
| Monto del préstamo | `credito.monto_desembolsado` | `formatCOP()` |
| Cuota mensual | `credito.cuota_fija` | `formatCOP()` |
| Progreso (%) | `(cuotas_pagadas / numero_cuotas) * 100` | Barra CSS |
| Estado (Al día / En mora) | `credito.estado_credito` | Clase de color |
| Total desembolsado histórico | `SUM(monto_desembolsado)` | `reduce()` |

**Regla de negocio en UI:**
```javascript
// Si el cliente tiene un crédito activo → botón "Solicitar" se deshabilita (Lock)
{tieneActivo ? (
  <div className="... cursor-not-allowed">
    <Lock className="w-4 h-4" /> Crédito activo vigente
  </div>
) : (
  <Link href="/dashboard/creditos/solicitar">+ Solicitar Crédito</Link>
)}
```

#### `app/api/admin/desembolsar/[id]/route.js`
**Tipo:** API Route — Next.js (ejecuta la transacción de desembolso)  
**Método HTTP:** `POST /api/admin/desembolsar/:solicitudId`

**Flujo de desembolso (4 pasos atómicos):**

```
Paso 1: Verificar autorización (JWT + rol ADMIN/ANALISTA)
Paso 2: Leer solicitud y su decisión de aprobación (monto, plazo, tasa)
Paso 3: Validar RN-07 (cliente sin crédito activo)
         ↓
Paso 4: Calcular amortización francesa
  tasaEA = (1 + tasaEM)^12 - 1) * 100
  sim = calcularAmortizacion(monto, tasaEA, plazo)
         ↓
Paso 5: INSERT en 'credito'
  { id_solicitud, id_cliente, monto_desembolsado, tasa_interes_anual,
    tasa_interes_mensual, numero_cuotas, cuota_fija, fecha_desembolso,
    estado_credito: 'ACTIVO', saldo_pendiente: monto }
         ↓
Paso 6: INSERT en 'plan_pago'
  { id_credito, num_cuotas_totales, frecuencia_pago: 'MENSUAL',
    tasa_mora_diaria: 0.001 }
         ↓
Paso 7: BULK INSERT en 'cuota' (una fila por cada mes del plazo)
  [{ numero_cuota, monto_capital, monto_interes, monto_total_cuota,
     saldo_despues_pago, fecha_vencimiento, estado_cuota: 'PENDIENTE' }, ...]
         ↓
Paso 8: UPDATE 'solicitud_credito' → estado = 'DESEMBOLSADA'
```

**Generación de fechas de cuotas:**
```javascript
const fechaPrimeraCuota = new Date(ahora.getFullYear(), ahora.getMonth() + 1, ahora.getDate())

const cuotasInsert = sim.tablaCuotas.map((c, idx) => {
  const fechaVenc = new Date(
    fechaPrimeraCuota.getFullYear(),
    fechaPrimeraCuota.getMonth() + idx,  // Mes 0 = hoy+1, Mes 1 = hoy+2, etc.
    fechaPrimeraCuota.getDate()
  )
  return {
    id_plan_pago:      planPago.id_plan_pago,
    numero_cuota:      c.numero,          // 1, 2, 3...N
    monto_capital:     c.capital,
    monto_interes:     c.interes,
    monto_total_cuota: c.cuota,
    saldo_despues_pago:c.saldo,
    fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
    estado_cuota:      'PENDIENTE',
  }
})

// Una sola inserción masiva (bulk)
await service.from('cuota').insert(cuotasInsert)
```

**Librerías usadas:**
- `@supabase/supabase-js` — `createClient` con SERVICE_ROLE_KEY
- `@/lib/supabase/server` — Lectura de sesión del analista
- `@/lib/calculadora` — `calcularAmortizacion` (amortización francesa)
- `lucide-react` — `CreditCard`, `Lock`, `ArrowRight`, `AlertCircle`, `CheckCircle2`, `History`, `Award`

---

## 2. Módulo: Plan de Pagos y Cuotas

### 2.1 ¿Qué hace este módulo?
Genera y gestiona el calendario de amortización de cada crédito desembolsado. Cada cuota contiene su desglose exacto de capital e interés, fecha de vencimiento y estado. El cliente puede ver su tabla completa y realizar pagos individuales.

### 2.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Plan de amortización completo | `/dashboard/cuotas` | Cliente autenticado |
| Pantalla de pago de cuota específica | `/dashboard/cuotas/[id]/pagar` | Cliente autenticado |
| Confirmación de pago (Wompi) | `/dashboard/cuotas/confirmacion` | Cliente autenticado |

### 2.3 Metodología
- **Patrón:** Server Component carga los datos de cuotas sin exponer claves al navegador
- **Consulta encadenada:** `cliente → credito → plan_pago → cuota` (4 consultas en secuencia para asegurar ownership)
- **Estados de cuota:** 5 posibles estados con colores y iconos diferenciados
- **Próxima cuota:** Se resalta siempre la primera cuota en estado `PENDIENTE` o `VENCIDA`
- **Alerta de mora:** Si `cuotasVencidas > 0`, se muestra un banner rojo prominente

### 2.4 Tablas de Base de Datos

#### Tabla `plan_pago`
```sql
CREATE TABLE plan_pago (
  id_plan_pago       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_credito         UUID REFERENCES credito(id_credito) UNIQUE,  -- 1 plan por crédito
  num_cuotas_totales INTEGER NOT NULL,
  frecuencia_pago    TEXT DEFAULT 'MENSUAL',   -- 'MENSUAL', 'QUINCENAL', 'SEMANAL'
  fecha_inicio_cobro DATE NOT NULL,
  fecha_fin_cobro    DATE NOT NULL,
  tasa_mora_diaria   NUMERIC(6,4) DEFAULT 0.001,  -- 0.1% diario en mora
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabla `cuota`
```sql
CREATE TABLE cuota (
  id_cuota            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_plan_pago        UUID REFERENCES plan_pago(id_plan_pago),
  numero_cuota        INTEGER NOT NULL,          -- 1, 2, 3...N
  monto_capital       NUMERIC(14,2) NOT NULL,    -- Amortización del capital
  monto_interes       NUMERIC(14,2) NOT NULL,    -- Intereses del período
  monto_total_cuota   NUMERIC(14,2) NOT NULL,    -- capital + interes
  saldo_despues_pago  NUMERIC(14,2) NOT NULL,    -- Saldo restante luego del pago
  fecha_vencimiento   DATE NOT NULL,
  estado_cuota        TEXT DEFAULT 'PENDIENTE',  -- PENDIENTE | PAGADA | VENCIDA | PAGADA_MORA | CONDONADA
  monto_pagado_real   NUMERIC(14,2),             -- Lo que realmente pagó (puede incluir mora)
  fecha_pago_real     DATE,                      -- Fecha real del pago
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

**Estados de cuota y su significado:**
| Estado | Descripción | Color |
|--------|-------------|-------|
| `PENDIENTE` | Aún no vence, no pagada | Gris |
| `PAGADA` | Cancelada a tiempo | Verde esmeralda |
| `VENCIDA` | Fecha de vencimiento superada sin pago | Rojo |
| `PAGADA_MORA` | Pagada después del vencimiento (con mora) | Amarillo |
| `CONDONADA` | Perdonada por el sistema/admin | Morado |

### 2.5 Archivos del Módulo

#### `app/dashboard/cuotas/page.js`
**Tipo:** Server Component  
**Ruta:** `/dashboard/cuotas`

**Cadena de consultas:**
```javascript
// 1. Cliente del usuario logueado
const { data: clienteRow } = await supabase
  .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

// 2. Crédito activo del cliente
const { data: creditoData } = await supabase
  .from('credito').select('*')
  .eq('id_cliente', clienteRow.id_cliente)
  .in('estado_credito', ['ACTIVO', 'EN_MORA'])
  .order('created_at', { ascending: false }).limit(1).single()

// 3. Plan de pago del crédito
const { data: planData } = await supabase
  .from('plan_pago').select('*').eq('id_credito', credito.id_credito).single()

// 4. Todas las cuotas ordenadas
const { data: cuotasData } = await supabase
  .from('cuota').select('*')
  .eq('id_plan_pago', planPago.id_plan_pago)
  .order('numero_cuota', { ascending: true })
```

**Métricas calculadas en servidor:**
```javascript
const cuotasPendientes = cuotas.filter(c => c.estado_cuota === 'PENDIENTE').length
const cuotasVencidas   = cuotas.filter(c => c.estado_cuota === 'VENCIDA').length
const cuotasPagadas    = cuotas.filter(c => ['PAGADA','PAGADA_MORA','CONDONADA'].includes(c.estado_cuota)).length
const proximaCuota     = cuotas.find(c => c.estado_cuota === 'PENDIENTE' || c.estado_cuota === 'VENCIDA')
```

**Tabla de amortización:**
| Columna | Campo BD |
|---------|---------|
| # | `numero_cuota` |
| Vencimiento | `fecha_vencimiento` (formato `es-CO`) |
| Capital | `monto_capital` |
| Interés | `monto_interes` |
| Cuota | `monto_total_cuota` |
| Saldo | `saldo_despues_pago` |
| Estado | `estado_cuota` (badge de color) |
| Acción | Link a `/dashboard/cuotas/${c.id_cuota}/pagar` si es pagable |

**Tarjeta resumen del crédito (4 métricas):**
```javascript
// Saldo pendiente | Cuota mensual | Cuotas pagadas | Estado
// Tarjeta con gradiente oscuro y efecto naranja en esquina superior derecha
<div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
  <div className="absolute right-0 top-0 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl" />
  ...
</div>
```

**Mapa de estados de cuota (para colores e iconos):**
```javascript
const ESTADO_CUOTA = {
  PENDIENTE:   { label: 'Pendiente',    color: 'bg-slate-100 text-slate-600',    icon: Clock        },
  PAGADA:      { label: 'Pagada',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  VENCIDA:     { label: 'Vencida',      color: 'bg-red-100 text-red-700',         icon: AlertTriangle},
  PAGADA_MORA: { label: 'Pagada c/mora',color: 'bg-yellow-100 text-yellow-700',   icon: CheckCircle2 },
  CONDONADA:   { label: 'Condonada',    color: 'bg-purple-100 text-purple-700',   icon: CheckCircle2 },
}
```

**Librerías usadas:**
- `@/lib/supabase/server` — Consultas seguras en servidor
- `next/navigation` — `redirect` si no está autenticado
- `next/link` — Navegación a pantalla de pago
- `lucide-react` — `CreditCard`, `CheckCircle2`, `Clock`, `AlertTriangle`, `CalendarDays`, `TrendingDown`, `ArrowRight`, `DollarSign`
- `@/lib/calculadora` — `formatCOP`

---

## 3. Módulo: Calculadora de Amortización *(Módulo transversal)*

### 3.1 ¿Qué hace este módulo?
Implementa la **fórmula matemática de amortización francesa** (cuota fija, interés variable, capital variable). Es la biblioteca matemática central del sistema: la misma función se usa tanto en el simulador del cliente como en el motor de desembolso del servidor.

### 3.2 ¿Dónde se usa?
| Uso | Archivo | Contexto |
|-----|---------|---------|
| Simulador de crédito (cliente) | `app/dashboard/creditos/solicitar/page.js` | Navegador, en tiempo real |
| Motor de desembolso (servidor) | `app/api/admin/desembolsar/[id]/route.js` | Servidor, al desembolsar |
| Vista de cuotas | `app/dashboard/cuotas/page.js` | Formateo de moneda |
| Vista de créditos | `app/dashboard/creditos/page.js` | Formateo de moneda |
| Panel admin | `app/admin/clientes/page.js` | Formateo de moneda |

### 3.3 Metodología
- **Lenguaje puro:** JavaScript sin librerías externas — solo aritmética flotante
- **Isomorfismo:** La función corre tanto en el navegador (`'use client'`) como en el servidor (Node.js/Edge Runtime)
- **Precisión:** Se usa `Math.round(valor * 100) / 100` para evitar errores de punto flotante en moneda

### 3.4 Archivo: `lib/calculadora.js`

**Función principal: `calcularAmortizacion(monto, tasaAnual, plazoMeses)`**

```javascript
export function calcularAmortizacion(monto, tasaAnual, plazoMeses) {
  // 1. Convertir TEA a TEM (Tasa Efectiva Mensual)
  const tasaMensual = Math.pow(1 + tasaAnual / 100, 1 / 12) - 1
  // Ejemplo: TEA 28% → TEM ≈ 2.0742%

  // 2. Fórmula de cuota fija (amortización francesa):
  //    C = P × [i(1+i)^n] / [(1+i)^n - 1]
  //    Donde: P = monto, i = tasaMensual, n = plazoMeses
  const factor = Math.pow(1 + tasaMensual, plazoMeses)
  const cuotaMensual = Math.round((monto * tasaMensual * factor) / (factor - 1))

  // 3. Calcular totales
  const totalPagar    = cuotaMensual * plazoMeses
  const totalIntereses = totalPagar - monto

  // 4. Generar tabla de amortización (fila por fila)
  let saldoRestante = monto
  const tablaCuotas = []

  for (let i = 1; i <= plazoMeses; i++) {
    const interes  = Math.round(saldoRestante * tasaMensual * 100) / 100
    const capital  = Math.round((cuotaMensual - interes) * 100) / 100
    saldoRestante  = Math.round((saldoRestante - capital) * 100) / 100

    tablaCuotas.push({
      numero:  i,
      capital: capital,        // Parte de la cuota que va al capital
      interes: interes,        // Parte de la cuota que son intereses
      cuota:   cuotaMensual,   // Cuota total (siempre la misma)
      saldo:   Math.max(0, saldoRestante)  // Saldo después del pago
    })
  }

  return { cuotaMensual, totalPagar, totalIntereses, tablaCuotas }
}
```

**Función auxiliar: `formatCOP(valor)`**
```javascript
export function formatCOP(valor) {
  if (!valor && valor !== 0) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)
  // 1234567 → "$1.234.567"
}
```

**Ejemplo de cálculo:**
```
Entrada: monto=$2.000.000, TEA=28%, plazo=12 meses
TEM = (1 + 0.28)^(1/12) - 1 = 2.0742%

Cuota fija = $2.000.000 × [0.020742 × (1.020742)^12] / [(1.020742)^12 - 1]
           = $2.000.000 × [0.020742 × 1.2791] / [0.2791]
           = $190.476/mes

Total a pagar: $190.476 × 12 = $2.285.712
Total intereses: $285.712
```

---

## 4. Reglas de Negocio Cubiertas

| Código | Regla | Módulo | Estado |
|--------|-------|--------|--------|
| RN-07 | Un cliente solo puede tener 1 crédito activo | Créditos | ✅ Validación en desembolso |
| RN-14 | Cuota fija calculada con amortización francesa | Calculadora | ✅ `calcularAmortizacion()` |
| RN-15 | Plan de pagos generado automáticamente al desembolsar | Plan de Pagos | ✅ Bulk insert |
| RN-16 | Saldo se actualiza con cada pago | Créditos/Cuotas | ✅ Webhook de Wompi |
| RN-17 | Crédito marcado como EN_MORA si hay cuotas vencidas | Créditos | ✅ Estado en BD |
| BD-05 | Separación plan_pago (cabecera) y cuota (detalle) — 3FN | Plan de Pagos | ✅ 2 tablas separadas |

---

## 5. Variables de Entorno Utilizadas

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Clave pública (RLS)
SUPABASE_SERVICE_ROLE_KEY=        # Clave de servicio (desembolso)
```

---

## 6. Comandos para Ejecutar

```bash
cd apps/web && npm run dev

# Rutas de este módulo:
# http://localhost:3000/dashboard/creditos
# http://localhost:3000/dashboard/creditos/solicitar
# http://localhost:3000/dashboard/cuotas
# http://localhost:3000/dashboard/cuotas/{cuotaId}/pagar
# POST http://localhost:3000/api/admin/desembolsar/{solicitudId}
```

---

## 7. Estado de Desarrollo y Tareas Pendientes

### ✅ Completado
| Funcionalidad | Archivo |
|--------------|--------|
| `calcularAmortizacion()` y `formatCOP()` | `lib/calculadora.js` |
| Vista Mis Créditos con estado activo + historial | `app/dashboard/creditos/page.js` |
| API desembolso: crea crédito + plan + N cuotas bulk | `app/api/admin/desembolsar/[id]/route.js` |
| Plan de amortización completo con estados | `app/dashboard/cuotas/page.js` |
| Dashboard inicio con métricas y próxima cuota | `app/dashboard/inicio/page.js` |
| Pantalla de pago de cuota individual | `app/dashboard/cuotas/[id]/pagar/page.js` |

### 🔄 En Desarrollo (incompleto)
| Funcionalidad | Problema actual |
|--------------|----------------|
| Detalle de crédito `/dashboard/creditos/[id]` | La ruta **existe pero la página está vacía** — solo muestra el ID en la URL |
| Estado EN_MORA | El campo `estado_credito` se guarda pero **no hay proceso automático** que detecte cuotas vencidas y actualice el estado del crédito |
| Cuotas vencidas | La columna `cuotas_en_mora` en `credito` **no se actualiza automáticamente** — requiere un cron job |
| Pago parcial | Si el cliente paga **menos del total de la cuota**, el sistema no sabe cómo distribuir el pago entre capital e interés |

### ⏳ Pendiente — Por Implementar

#### Módulo Mora Automática (CRÍTICO — NO EXISTE)
```
El sistema NUNCA actualiza automáticamente el estado de las cuotas.
Actualmente las cuotas vencen pero siguen en estado "PENDIENTE" para siempre.

Pendiente implementar:
  GET/POST /api/cron/detectar-mora     → Job programado (Vercel Cron / pg_cron)
      1. SELECT cuotas WHERE fecha_vencimiento < NOW() AND estado_cuota = 'PENDIENTE'
      2. UPDATE cuota SET estado_cuota = 'VENCIDA'
      3. UPDATE credito SET estado_credito = 'EN_MORA', cuotas_en_mora += 1
      4. Registrar en historial_estado
      5. Disparar email de recordatorio al cliente
```

#### Módulo Reestructuración / Refinanciación (NO EXISTE)
```
/supervisor/creditos/[id]/reestructurar  → Formulario de reestructuración:
    - Extender plazo (más cuotas a menor valor)
    - Aplicar período de gracia (N meses sin pagar capital)
    - Condonar intereses de mora parcialmente
    - Generar nuevo plan de pagos y anular cuotas vencidas

API:
POST /api/admin/creditos/[id]/reestructurar
```

#### Módulo Pago Anticipado / Cancelación (NO EXISTE)
```
/dashboard/creditos/[id]/cancelar     → Vista de liquidación anticipada
    - Calcular monto exacto para cancelar hoy (saldo + intereses corridos)
    - Botón "Cancelar crédito" → genera paz y salvo inmediatamente
    - Descuento por pago anticipado según política

API:
GET  /api/creditos/[id]/liquidar     → Calcula monto de cancelación anticipada
POST /api/creditos/[id]/cancelar     → Registra la cancelación total
```

#### Vista Asesor — Estado de cartera asignada (NO EXISTE)
```
/asesor/cartera                       → Lista de créditos activos asignados al asesor
/asesor/cartera/mora                  → Clientes en mora para gestión de cobro
/asesor/clientes/[id]/credito         → Estado actual del crédito: saldo, mora, cuotas
/asesor/clientes/[id]/pago-manual     → Registrar pago en efectivo cobrado por el asesor
```

#### APIs faltantes de Créditos
```
GET  /api/creditos/[id]                     → Detalle completo de un crédito
GET  /api/creditos/[id]/estadisticas        → Métricas: capital pagado, intereses, mora
PUT  /api/creditos/[id]/estado              → Cambiar estado manualmente (solo ADMIN)
GET  /api/admin/cartera                     → Resumen cartera global por asesor/zona
GET  /api/admin/creditos/vencidos           → Créditos próximos a vencer (próximos 7 días)
POST /api/admin/creditos/[id]/condonar-mora → Condonar intereses de mora
POST /api/pagos/manual                      → Registrar pago en efectivo (asesor)
```

#### Calculadora — Mejoras pendientes
- [ ] `calcularMoraAcumulada(cuota, diasMora, tasaMora)` — calcula intereses de mora diaria
- [ ] `simularPagoAnticipado(credito, fechaPago)` — monto exacto para liquidar
- [ ] `calcularPeriodoGracia(credito, mesesGracia)` — recalcula plan con período de gracia
- [ ] `calcularRestructuracion(credito, nuevosPlazo)` — nuevo plan de pagos

#### BD pendiente
- [ ] Trigger `on UPDATE cuota WHERE estado_cuota = 'VENCIDA'` → actualizar `credito.cuotas_en_mora`
- [ ] Trigger `on UPDATE cuota WHERE estado_cuota = 'PAGADA'` → verificar si todas pagadas → `credito.estado_credito = 'PAGADO'`
- [ ] Tabla `pago_manual` para pagos en efectivo registrados por asesores
- [ ] Tabla `reestructuracion` para historial de restructuraciones
- [ ] Índice compuesto en `cuota(id_plan_pago, estado_cuota)` para queries de mora
