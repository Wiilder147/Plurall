# 📋 Documentación de Módulos — Juan Cetina
## Proyecto PLURALL — Sistema de Información de Créditos

> **Integrante:** Juan Cetina  
> **Color asignado:** 🔵 Azul claro (`#FFCFE2F3`)  
> **Proyecto Formativo SENA** | Tecnólogo ADSO 
> **Stack:** Next.js 16 + Supabase (PostgreSQL) + Tailwind CSS

---

## Módulos Asignados

| # | Módulo | Tablas BD principales | Rutas involucradas |
|---|--------|----------------------|-------------------|
| 1 | **Formularios y Preguntas** | `pregunta`, `opcion_pregunta`, `respuesta_cliente`, `estado_cuestionario` | `/dashboard/creditos/solicitar` (Step 1 - Cotizador) |
| 2 | **Evaluación y Scoring** | `score`, `score_factor`, `modelo_score`, `evaluacion_regla` | `/api/creditos/solicitar` (motor de scoring) |
| 3 | **Panel de Administración** *(módulo adicional implementado)* | `perfil_usuario`, `rol`, `solicitud_credito`, `credito`, `cuota`, `pago` | `/admin`, `/admin/solicitudes`, `/admin/solicitudes/[id]` |

---

## 1. Módulo: Formularios y Preguntas

### 1.1 ¿Qué hace este módulo?
Define el banco de preguntas que el sistema utiliza para recopilar información del cliente durante el proceso de solicitud de crédito. Incluye las opciones de respuesta para preguntas cerradas y el registro de las respuestas dadas por cada cliente en cada solicitud.

### 1.2 ¿Dónde se visualiza?
| Vista | URL | Descripción |
|-------|-----|-------------|
| Formulario de solicitud (Paso 1) | `/dashboard/creditos/solicitar` | El cliente interactúa con sliders de monto y plazo (preguntas cuantitativas) |
| Paso 2 del formulario | `/dashboard/creditos/solicitar` → Step 2 | Upload de documentos KYC (cédula frontal y trasera) |

> **Nota técnica:** En el sistema actual (MVP), las preguntas del cuestionario crediticio se materializan como los controles del `Stepper` de solicitud: el slider de monto y el slider de plazo representan preguntas cuantitativas; la subida de documentos representa preguntas documentales.

### 1.3 Metodología
- **Patrón de UI:** Stepper multi-paso (3 pasos) con `useState` de React para navegar entre ellos
- **Tipo de componente:** `'use client'` — todo el formulario se ejecuta en el navegador para interactividad en tiempo real
- **Cálculo en vivo:** `useMemo` recalcula la cuota cada vez que cambia el monto o el plazo (sin re-renders innecesarios)
- **Upload de archivos:** Supabase Storage (bucket `documentos_kyc`) con nombres únicos: `{userId}_frontal_{timestamp}.ext`

### 1.4 Tablas de Base de Datos

#### Tabla `pregunta`
```sql
CREATE TABLE pregunta (
  id_pregunta   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enunciado     TEXT NOT NULL,    -- Texto de la pregunta (ej: "¿Cuál es su ingreso mensual?")
  tipo_pregunta TEXT NOT NULL     -- 'NUMERICA', 'SELECCION', 'TEXTO', 'DOCUMENTAL'
);
```

#### Tabla `opcion_pregunta`
```sql
CREATE TABLE opcion_pregunta (
  id_opcion   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pregunta UUID REFERENCES pregunta(id_pregunta),
  texto       TEXT NOT NULL,    -- Texto visible al cliente
  valor       TEXT             -- Valor interno (para scoring)
);
```

#### Tabla `respuesta_cliente`
```sql
CREATE TABLE respuesta_cliente (
  id_respuesta  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_solicitud  UUID REFERENCES solicitud_credito(id_solicitud),
  id_pregunta   UUID REFERENCES pregunta(id_pregunta),
  id_opcion     UUID REFERENCES opcion_pregunta(id_opcion),  -- Si es selección
  valor_texto   TEXT,                                         -- Si es abierta o numérica
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabla `estado_cuestionario`
```sql
CREATE TABLE estado_cuestionario (
  id_estado UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre    TEXT NOT NULL    -- 'PENDIENTE', 'EN_PROCESO', 'COMPLETADO'
);
```

### 1.5 Archivos del Módulo

#### `app/dashboard/creditos/solicitar/page.js`
**Tipo:** Client Component (`'use client'`)  
**Ruta visible:** `/dashboard/creditos/solicitar`

**Step 1 — Cotizadora (Pregunta cuantitativa de monto y plazo):**
```javascript
// Pregunta: "¿Cuánto dinero necesitas?"
const [monto, setMonto] = useState(500000)  // Default: $500.000

// Pregunta: "¿A qué plazo lo quieres pagar?"
const [plazo, setPlazo] = useState(6)       // Default: 6 meses

// Resultado en tiempo real (useMemo para eficiencia)
const { cuotaMensual, totalPagar, totalIntereses } = useMemo(() => {
  return calcularAmortizacion(monto, TASA_ANUAL_DEFAULT, plazo)
}, [monto, plazo])
```

**Controles del formulario:**
| Control | Tipo | Rango | Paso |
|---------|------|-------|------|
| Slider monto | `<input type="range">` | $100.000 – $10.000.000 | $50.000 |
| Slider plazo | `<input type="range">` | 3 – 24 meses | 1 mes |

**Step 2 — Documentos KYC (Preguntas documentales):**
```javascript
// Manejo de archivos
const handleFileChange = (e, tipo) => {
  const file = e.target.files[0]
  if (tipo === 'frontal') setCedulaFrontal(file)  // Pregunta: "Cédula Frontal"
  if (tipo === 'trasera') setCedulaTrasera(file)  // Pregunta: "Cédula Trasera"
}

// Upload a Supabase Storage
const fileName = `${user.id}_frontal_${Date.now()}.${fileExt}`
await supabase.storage.from('documentos_kyc').upload(fileName, cedulaFrontal)
```

**Librerías usadas:**
- `react` — `useState`, `useMemo`, `useEffect`
- `next/navigation` — `useRouter` para redirección post-envío
- `lucide-react` — `Calculator`, `FileText`, `CheckSquare`, `UploadCloud`, `CheckCircle`, `Loader2`, `AlertTriangle`
- `@/lib/calculadora` — `calcularAmortizacion`, `formatCOP`
- `@/lib/supabase/client` — Conexión browser para Storage y Auth

---

## 2. Módulo: Evaluación y Scoring

### 2.1 ¿Qué hace este módulo?
Es el motor de riesgo crediticio de PLURALL. Evalúa cada solicitud consultando el buró de crédito (Experian — actualmente en modo mock/simulación) y genera un puntaje que determina si el crédito se pre-aprueba, requiere revisión manual, o se rechaza automáticamente.

### 2.2 ¿Dónde se visualiza?
| Momento | Descripción |
|---------|-------------|
| Al enviar el formulario | El cliente ve si fue pre-aprobado o rechazado mediante un `alert()` |
| Panel admin (detalle solicitud) | El analista ve el score y el dictamen del buró en la ficha de la solicitud |

### 2.3 Metodología
- **Patrón:** Función pura `consultarExperian(dni)` integrada en la API Route del servidor
- **Tipo:** Scoring deterministico basado en los últimos 2 dígitos del DNI (mock reproducible)
- **Escalabilidad:** En producción, `consultarExperian()` haría un `fetch()` real a `https://api.experian.com/...`
- **Seguridad:** El score nunca se calcula en el cliente; siempre ocurre en el servidor (API Route)
- **Tablas relacionadas:** La solicitud guarda el score en el campo `proposito` (`"Perfilamiento Auto Experian: 850 pts"`)

### 2.4 Tablas de Base de Datos

#### Tabla `score`
```sql
CREATE TABLE score (
  id_score        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_solicitud    UUID REFERENCES solicitud_credito(id_solicitud),
  id_modelo_score UUID REFERENCES modelo_score(id_modelo_score),
  puntaje_total   INTEGER NOT NULL,      -- Score numérico (ej: 850)
  fecha_calculo   TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabla `score_factor`
```sql
CREATE TABLE score_factor (
  id_factor    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_score     UUID REFERENCES score(id_score),
  nombre       TEXT NOT NULL,    -- Ej: "Historial crediticio", "Capacidad de pago"
  puntaje      INTEGER,          -- Puntos aportados por este factor
  descripcion  TEXT
);
```

#### Tabla `modelo_score`
```sql
CREATE TABLE modelo_score (
  id_modelo_score UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,     -- Ej: "Experian v1.0", "Modelo Interno v2"
  version         TEXT,
  descripcion     TEXT,
  activo          BOOLEAN DEFAULT TRUE
);
```

#### Tabla `evaluacion_regla`
```sql
CREATE TABLE evaluacion_regla (
  id_evaluacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_solicitud  UUID REFERENCES solicitud_credito(id_solicitud),
  nombre_regla  TEXT NOT NULL,    -- Ej: "Edad mínima", "No en listas negras"
  cumple        BOOLEAN NOT NULL, -- TRUE si la regla se cumple
  descripcion   TEXT
);
```

### 2.5 Archivos del Módulo

#### `app/api/creditos/solicitar/route.js` — Función `consultarExperian`
**Tipo:** Función interna de API Route (se ejecuta 100% en el servidor)

**Lógica del motor de scoring (mock):**
```javascript
function consultarExperian(dni) {
  // Extrae los últimos 2 dígitos del DNI
  // Esto garantiza resultados CONSISTENTES y REPRODUCIBLES para demos
  const factor = Number(dni.substring(dni.length - 2) || '50')
  
  if (factor < 20) {
    // DNI termina en 00–19 → Perfil de ALTO RIESGO
    return { score: 450, dictamen: 'RECHAZAR', motivo: 'Historial crediticio negativo en Datacrédito' }
  } else if (factor < 60) {
    // DNI termina en 20–59 → Perfil MODERADO → Revisión humana
    return { score: 650, dictamen: 'REVISION_MANUAL', motivo: 'Capacidad de endeudamiento al límite' }
  } else {
    // DNI termina en 60–99 → Perfil EXCELENTE → Pre-aprobado automático
    return { score: 850, dictamen: 'PRE_APROBADO', motivo: 'Excelente historial crediticio' }
  }
}
```

**Tabla de decisión del motor:**
| Score | Dictamen | Estado de solicitud | Acción |
|-------|----------|--------------------|-|
| 450 | `RECHAZAR` | `RECHAZADA` | Busca motivo de rechazo en BD y lo registra |
| 650 | `REVISION_MANUAL` | `PENDIENTE` | La solicitud queda para que el analista la revise |
| 850 | `PRE_APROBADO` | `PENDIENTE` | La solicitud queda lista para que el analista desembolse |

**Flujo completo del motor en la API:**
```
1. Recibe monto, plazo, frontUrl, backUrl del cliente
2. Verifica autenticación (Supabase JWT)
3. Obtiene id_cliente y DNI desde tabla 'cliente'
4. Valida RN-07 (crédito activo) → 403 si aplica
5. Valida RN-08 (cooldown 90 días) → 403 si aplica
6. Llama a consultarExperian(dni) → obtiene { score, dictamen, motivo }
7. Busca UUID de estado_solicitud según dictamen
8. Guarda documentos en documento_cliente (upsert)
9. Inserta en solicitud_credito con estado y motivo
10. Retorna { success, resultado_buro, score }
```

**Respuesta de la API al navegador:**
```javascript
// Si fue pre-aprobado o revisión manual:
router.push('/dashboard/inicio?success=true')

// Si fue rechazado:
alert('Lamentablemente tu solicitud ha sido rechazada por políticas de nuestro comité de riesgo central.')
router.push('/dashboard/inicio')
```

---

## 3. Módulo: Panel de Administración *(Módulo adicional implementado)*

### 3.1 ¿Qué hace este módulo?
Es el centro de control de los analistas y administradores de PLURALL. Desde aquí se gestionan las solicitudes (aprobar/rechazar), se monitoran KPIs del portafolio y se accede al directorio de clientes.

### 3.2 ¿Dónde se visualiza?
| Vista | URL | Acceso |
|-------|-----|--------|
| Dashboard ejecutivo | `/admin` | Admin / Analista |
| Lista de solicitudes | `/admin/solicitudes` | Admin / Analista |
| Detalle de solicitud | `/admin/solicitudes/[id]` | Admin / Analista |
| Directorio de clientes | `/admin/clientes` | Admin / Analista |
| Reportes financieros | `/admin/reportes` | Admin / Analista |

### 3.3 Metodología
- **Patrón:** Server Components de Next.js — los datos se cargan en el servidor, sin exponer claves al cliente
- **KPIs paralelos:** `Promise.all()` para ejecutar 4+ consultas simultáneas (mejor performance)
- **Autorización:** Doble verificación: middleware de Next.js (ruta `/admin/*` → requiere login) + verificación de rol en cada API Route (`'ADMIN'` o `'ANALISTA'`)
- **Layout dedicado:** `app/admin/layout.js` con sidebar oscuro (`AdminSidebar`) independiente del dashboard del cliente

### 3.4 Archivos del Módulo

#### `app/admin/page.js` — Dashboard ejecutivo
**Tipo:** Server Component  
**Ruta:** `/admin`

**KPIs calculados en paralelo:**
```javascript
const [
  { count: totalSolicitudes },
  { count: pendientes },
  { count: totalClientes },
  { count: creditosActivos },
] = await Promise.all([
  supabase.from('solicitud_credito').select('*', { count: 'exact', head: true }),
  supabase.from('solicitud_credito').select('*', { count: 'exact', head: true })
    .in('estado_solicitud.nombre', ['PENDIENTE', 'EN_ESTUDIO']),
  supabase.from('cliente').select('*', { count: 'exact', head: true }),
  supabase.from('credito').select('*', { count: 'exact', head: true })
    .in('estado_credito', ['ACTIVO', 'EN_MORA']),
])
```

**Secciones del dashboard:**
| Sección | Descripción |
|---------|-------------|
| 4 tarjetas KPI | Solicitudes pendientes, clientes, créditos activos, cuotas vencidas |
| Banner de cartera | Suma de saldo pendiente de todos los créditos activos (`formatCOP`) |
| Feed de solicitudes recientes | Últimas 5 solicitudes con estado y monto |

#### `app/admin/solicitudes/page.js` — Gestión de solicitudes
**Tipo:** Server Component  
**Ruta:** `/admin/solicitudes`

**Filtros por estado (tabs):**
- Todas | Pendientes | En estudio | Aprobadas | Rechazadas

**Filtrado en memoria (cliente):**
```javascript
const solicitudes = filtro === 'TODOS'
  ? todas || []
  : (todas || []).filter(s => s.estado_solicitud?.nombre?.toUpperCase() === filtro)
```

**Mapa visual de estados:**
| Estado | Color | Icono |
|--------|-------|-------|
| PENDIENTE | Amarillo | `Clock` |
| EN_ESTUDIO | Azul | `Hourglass` |
| APROBADA | Verde esmeralda | `CheckCircle2` |
| DESEMBOLSADA | Verde | `TrendingUp` |
| RECHAZADA | Rojo | `XCircle` |
| CANCELADA | Gris | `XCircle` |

#### `app/api/admin/solicitud/[id]/route.js` — Aprobar/Rechazar
**Tipo:** API Route — Next.js  
**Método HTTP:** `PATCH /api/admin/solicitud/:id`

**Body del request:**
```json
{
  "accion": "APROBAR",
  "monto_aprobado": 2000000,
  "plazo_aprobado": 12,
  "tasa_interes_aprobada": 0.0207,
  "comentarios_cliente": "Aprobado con condiciones normales",
  "comentarios_tecnicos": "Score Experian: 850 — perfil bajo riesgo"
}
```

**Flujo del servidor:**
```
1. Verificar JWT de Supabase
2. Verificar que el rol sea ADMIN o ANALISTA
3. Obtener solicitud y validar que esté en PENDIENTE/EN_ESTUDIO
4. Registrar decisión en tabla 'decision_solicitud' (quién, cuándo, con qué condiciones)
5. Actualizar estado de 'solicitud_credito' a APROBADA o RECHAZADA
6. Retornar { ok: true, resultado }
```

#### `app/admin/reportes/page.js` — Reportes financieros
**Tipo:** Server Component  
**Ruta:** `/admin/reportes`

**Métricas calculadas:**
| Métrica | Cálculo |
|---------|---------|
| Cartera activa | `SUM(saldo_pendiente)` de créditos ACTIVO+EN_MORA |
| Total desembolsado | `SUM(monto_desembolsado)` de créditos activos |
| Recaudado | `SUM(monto_pagado)` de pagos CONFIRMADO |
| En mora (capital) | `SUM(monto_total_cuota)` de cuotas VENCIDA |
| Indicador de mora | `(cartera_en_mora / total_desembolsado) * 100` → referencia sana < 5% |

**Gráfica de barras horizontal (CSS puro):**
```javascript
// Cada barra mide su ancho relativo al estado con más solicitudes
const pct = Math.round((count / maxEstado) * 100)
<div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${pct}%` }} />
```

**Librerías usadas en todo el módulo:**
- `@supabase/supabase-js` — Cliente con `SERVICE_ROLE_KEY` para operaciones de admin
- `lucide-react` — `BarChart3`, `TrendingUp`, `TrendingDown`, `AlertTriangle`, `DollarSign`, `Users`, `Clock`, `Hourglass`, `CheckCircle2`, `XCircle`
- `next/link` — Navegación entre rutas del panel admin
- `@/lib/calculadora` — `formatCOP` para moneda colombiana

---

## 4. Reglas de Negocio Cubiertas

| Código | Regla | Módulo | Estado |
|--------|-------|--------|--------|
| RN-04 | Score automático al crear solicitud | Evaluación/Scoring | ✅ Mock Experian |
| RN-05 | Revisión manual si score es moderado | Evaluación/Scoring | ✅ Estado PENDIENTE |
| RN-06 | Rechazo automático si score < umbral | Evaluación/Scoring | ✅ Estado RECHAZADA |
| RN-09 | Solo admin/analista puede aprobar | Panel Admin | ✅ Verificación de rol |
| RN-10 | Registro de analista que tomó la decisión | Panel Admin | ✅ `decision_solicitud` |
| BD-03 | Scoring guardado en solicitud | Evaluación/Scoring | ✅ Campo `proposito` |

---

## 5. Variables de Entorno Utilizadas

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Clave pública (RLS habilitado)
SUPABASE_SERVICE_ROLE_KEY=        # Clave de servicio (sin RLS — solo en servidor)
```

---

## 6. Comandos para Ejecutar

```bash
cd apps/web && npm run dev

# Rutas de este módulo:
# http://localhost:3000/admin
# http://localhost:3000/admin/solicitudes
# http://localhost:3000/admin/solicitudes/[id]
# http://localhost:3000/admin/reportes
# http://localhost:3000/dashboard/creditos/solicitar
```

---

## 7. Estado de Desarrollo y Tareas Pendientes

### ✅ Completado
| Funcionalidad | Archivo |
|--------------|--------|
| Stepper de solicitud (3 pasos con sliders) | `app/dashboard/creditos/solicitar/page.js` |
| Upload KYC a Supabase Storage | `app/dashboard/creditos/solicitar/page.js` |
| Motor de scoring Experian (mock) | `app/api/creditos/solicitar/route.js` |
| Dashboard admin con 4 KPIs | `app/admin/page.js` |
| Lista de solicitudes con tabs de filtro | `app/admin/solicitudes/page.js` |
| Reportes con métricas financieras CSS | `app/admin/reportes/page.js` |

### 🔄 En Desarrollo (incompleto)
| Funcionalidad | Problema actual |
|--------------|----------------|
| Detalle de solicitud `/admin/solicitudes/[id]` | La página existe pero el formulario de aprobación con condiciones financieras **no envía datos correctamente** — falta validación de campos |
| Scoring | Actualmente es un **mock basado en DNI**, no consulta API real de Experian/Datacrédito |
| Reportes | Las métricas se calculan en tiempo real pero **no hay exportación** a PDF o Excel |
| Formulario solicitud Step 3 | La confirmación final **no muestra resumen** de condiciones antes de enviar |

### ⏳ Pendiente — Por Implementar

#### Vista Supervisor — Aprobar/Desembolsar créditos (NO EXISTE)
```
/supervisor/solicitudes            → Cola de solicitudes pre-aprobadas esperando desembolso
/supervisor/solicitudes/[id]       → Ficha con:
    - Score del cliente (visual con gauge)
    - Documentos KYC adjuntos para revisar
    - Formulario de condiciones: monto final, tasa, plazo
    - Botones: "Aprobar y Desembolsar" / "Rechazar" / "Pedir más información"
/supervisor/solicitudes/[id]/kyc   → Visor de imágenes de cédula subidas por el cliente
```

#### Vista Supervisor — Reportería avanzada (NO EXISTE)
```
/supervisor/reportes               → Dashboard de reportería con gráficas reales
    - Gráfica de barras: solicitudes por semana (últimas 8 semanas)
    - Gráfica de dona: distribución por estado
    - Gráfica de línea: recaudo mensual vs proyección
    - Tabla de cartera por asesor
    - Exportar a CSV / Excel
/supervisor/reportes/mora          → Reporte de mora con detalle por cliente
/supervisor/reportes/cobranza      → Gestión de cobros con días de mora
```

#### APIs faltantes
```
GET  /api/admin/solicitudes/[id]/documentos  → URLs firmadas de los docs KYC
POST /api/admin/solicitudes/[id]/en-estudio  → Mover solicitud a EN_ESTUDIO
GET  /api/reportes/cartera                   → JSON con métricas de cartera para gráficas
GET  /api/reportes/mora                      → Detalle clientes en mora
GET  /api/reportes/export?formato=xlsx       → Exportar reportes a Excel
POST /api/scoring/recalcular/[id]            → Recalcular score con modelo actualizado
```

#### Mejoras al scoring pendientes
- [ ] Conectar a API real de Experian o TransUnion
- [ ] Motor de reglas configurable (tabla `evaluacion_regla` sin uso actualmente)
- [ ] Score multifactorial: ingresos + deudas + historial + tiempo en BD
- [ ] Panel admin para configurar umbrales de scoring
- [ ] A/B testing de modelos de scoring (tabla `modelo_score` sin uso)

#### BD pendiente
- [ ] Tabla `cuestionario_plantilla` (diseñador de formularios dinámicos)
- [ ] Poblar tabla `pregunta` y `opcion_pregunta` con preguntas reales
- [ ] Guardar respuestas en `respuesta_cliente` por cada solicitud
- [ ] Índice en `solicitud_credito.id_estado_solicitud` para filtros rápidos
