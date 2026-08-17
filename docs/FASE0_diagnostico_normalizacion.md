# FASE 0 — Reporte de diagnóstico en vivo (normalización BD)

**Fecha:** 2026-08-13
**Método:** `apps/web/scripts/utilidades/diagnostico_normalizacion.mjs` (read-only, service role, sobre Supabase producción). Re-ejecutable.
**Universo:** 85 clientes, 3 filas en `detalle_cliente`.

## Estado REAL de las tablas

### `cliente` — 32 columnas
`id_cliente, id_usuario_cuenta, id_estado_cliente, id_tipo_doc, nombre_completo, dni, email, telefono, direccion, ciudad, departamento, nombre_negocio, id_tipo_negocio, descripcion_negocio, antiguedad_negocio_meses, score_credito, created_at, updated_at, direccion_negocio, ciudad_negocio, departamento_negocio, lat_negocio, lon_negocio, direccion_casa, ciudad_casa, departamento_casa, lat_casa, lon_casa, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido`

### `detalle_cliente` — 23 columnas
`id_detalle, id_cliente, tipo_vivienda, estrato, nivel_educativo, estado_civil, personas_cargo, ingresos_mensuales, egresos_mensuales, patrimonio_estimado, otras_obligaciones, banco_preferido, tipo_cuenta_bancaria, numero_cuenta, created_at, updated_at, empleados_negocio, arriendo_negocio, arriendo_casa, dependientes, colaboracion_gastos, ahorros, tiene_vehiculo`

## Hallazgos (con conteos)

| # | Hallazgo | Dato |
|---|----------|------|
| 1 | **`nombre_completo` sigue en `cliente`** → migración 23 (nombres) NO aplicada en Supabase | presente |
| 2 | Las finanzas casa/negocio están en `detalle_cliente`, no en `cliente` | corrige plan |
| 3 | Duplicación de concepto **dentro de `detalle_cliente`** | `dependientes` vs `personas_cargo`; `ahorros` vs `patrimonio_estimado` |
| 4 | Ubicación duplicada en `cliente` (direccion vs direccion_casa) pero **ambas vacías** | 0 / 85 llenas |
| 5 | Columnas de negocio/ubicación mayormente **vacías** | direccion_negocio, id_tipo_negocio, descripcion_negocio, antiguedad = 0 |
| 6 | `detalle_cliente` casi sin uso | 3 / 85 clientes |
| 7 | `banco_preferido` texto libre y **vacío** | 0 distintos |
| 8 | `ciudad`/`departamento` texto libre | 8 distintos c/u |
| 9 | `nombre_negocio` sí se usa | 69 / 85 |
| 10 | `score_credito` cacheado poblado | 69 / 85 > 0 |
| 11 | Integridad OK: 0 `detalle_cliente` huérfanos; 82 clientes sin detalle | — |

## Conclusiones para las fases siguientes

1. **Riesgo de datos: BAJO.** Casi todas las columnas a mover/eliminar están vacías. El backfill es mínimo (nombre_negocio, score, ciudad/departamento, 3 filas de finanzas).
2. **El grueso del esfuerzo es recablear código** (FASE 4/5), no migrar datos.
3. **Bloqueante previo:** decidir cómo secuenciar la **migración 23 de nombres** (aún no aplicada) respecto a esta normalización.
4. **Ajuste al modelo:** la fuente de finanzas es `detalle_cliente` (no `cliente`); la resolución de duplicados es intra-`detalle_cliente`.

## Mapa de origen → destino (revisado con datos reales)

| Destino | Origen real |
|---------|-------------|
| `cliente` (adelgazada) | conserva identidad/contacto/nombre atómico; se le quitan negocio, ubicación, score |
| `direccion` (CASA/NEGOCIO, FK municipio) | `cliente.direccion/ciudad/departamento` + `*_casa`/`*_negocio` (casi vacíos) |
| `negocio_cliente` | `cliente.nombre_negocio` (69), `id_tipo_negocio`, `descripcion_negocio`, `antiguedad_negocio_meses`, + `detalle_cliente.empleados_negocio`, `arriendo_negocio` |
| `perfil_financiero` | `detalle_cliente.*` (resolviendo `dependientes`↔`personas_cargo`, `ahorros`↔`patrimonio_estimado`) |
| `cuenta_bancaria` | `detalle_cliente.banco_preferido`(texto→FK), `tipo_cuenta_bancaria`, `numero_cuenta` |
| `vw_cliente_score` | último `score` por solicitud (elimina `cliente.score_credito`) |
