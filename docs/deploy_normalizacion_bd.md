# Checklist de deploy — Normalización de la BD Plurall

**Rama:** `feat/normalizacion-bd` · **Proyecto Supabase:** Plurall-Fants (`bnemrismjmvmemypokaz`)

Estrategia **expand → migrate → contract** (sin downtime). Las migraciones se corren
a mano en el SQL Editor de Supabase (o vía MCP). Orden estricto: **código listo → SQL → deploy**.

## Orden de migraciones (db/)
| # | Archivo | Tipo | Efecto | Estado en dev |
|---|---------|------|--------|---------------|
| 24 | `24_normalizacion_tablas_nuevas.sql` | EXPAND | crea `direccion`, `negocio_cliente`, `perfil_financiero`, `cuenta_bancaria` + vista `vw_cliente_score`, RLS, triggers | ✅ aplicada |
| 25 | `25_normalizacion_backfill.sql` | MIGRATE | backfill desde `cliente`/`detalle_cliente` (fusiona duplicados) | ✅ aplicada |
| 26 | `26_direccion_municipio_backfill.sql` | MIGRATE | enriquece `direccion.id_municipio` (FK `municipio`) | ✅ aplicada |
| 27 | `27_normalizacion_contract.sql` | CONTRACT | **DROP** columnas legacy de `cliente` + **DROP TABLE `detalle_cliente`** | ✅ aplicada |

> ⚠️ La 27 es **irreversible**. Solo correrla cuando el código contract esté desplegado.

## Secuencia de deploy segura
1. **Aplicar 24** (additivo, sin riesgo). Verificar 4 tablas + vista + RLS.
2. **Aplicar 25 y 26** (backfill). Verificar origen==destino, 0 huérfanos, `direccion.id_municipio` poblado.
3. **Desplegar código EXPAND** (dual-write): `/api/perfil` escribe legacy + espeja a tablas nuevas. Reads ya usan tablas nuevas / `vw_cliente_score`.
4. **Smoke test** por portal (ver abajo). `npm run build` verde.
5. **Desplegar código CONTRACT**: `/api/perfil` deja de escribir columnas legacy; seeds actualizados.
6. **Aplicar 27** (DROP). Verificar 0 columnas legacy y datos preservados.
7. **Regenerar** `db/plurall_database_completa.sql` + `apps/web/lib/database.types.ts` desde la BD viva.
8. **Grep final** sin referencias muertas a columnas/tablas eliminadas.

## Modelo objetivo (post-27)
- `cliente`: identidad/contacto/nombre atómico. **Sin** negocio/ubicación/finanzas/score.
- `negocio_cliente` (1:N) · `direccion` (CASA/NEGOCIO, FK `municipio`) · `perfil_financiero` (1:1) · `cuenta_bancaria` (1:N, FK `banco`).
- Score: `vw_cliente_score` (último `score` real por cliente). **Decisión A**: no se conserva el `score_credito` de seed.

## Verificación post-DROP (SQL)
```sql
-- 0 columnas legacy en cliente:
SELECT column_name FROM information_schema.columns WHERE table_name='cliente'
  AND column_name IN ('direccion','ciudad','departamento','nombre_negocio','id_tipo_negocio',
  'descripcion_negocio','antiguedad_negocio_meses','score_credito','direccion_negocio',
  'ciudad_negocio','departamento_negocio','lat_negocio','lon_negocio','direccion_casa',
  'ciudad_casa','departamento_casa','lat_casa','lon_casa');
-- detalle_cliente no existe:
SELECT 1 FROM information_schema.tables WHERE table_name='detalle_cliente';
-- datos preservados:
SELECT (SELECT count(*) FROM cliente), (SELECT count(*) FROM negocio_cliente),
       (SELECT count(*) FROM direccion), (SELECT count(*) FROM perfil_financiero),
       (SELECT count(*) FROM vw_cliente_score);
```
Resultado en dev (2026-08-17): 0 columnas legacy, `detalle_cliente` inexistente, 85 clientes, 69 negocios, 69 direcciones, 3 perfiles, 7 scores.

## Smoke test por portal
- **CLIENTE** (`/dashboard`): perfil muestra negocio/ubicación/finanzas/score; editar perfil guarda (negocio→`negocio_cliente`, ubicación→`direccion`); solicitar/pagar.
- **ASESOR** (`/asesor`): clientes asignados, negocio/ciudad en cobranza.
- **SUPERVISOR** (`/supervisor`): búsqueda por nombre, score en listados, solicitudes, analítica por ciudad/departamento.
- **ADMIN** (`/admin`): listado y detalle de cliente (negocio/ubicación/finanzas/score), export CSV, desembolsar.

## Rollback
- 24–26 son additivos: se revierten con `DROP` de las tablas nuevas (sin pérdida, los datos legacy seguían en `cliente`/`detalle_cliente` hasta la 27).
- **Tras la 27 no hay rollback de datos**: los datos viven solo en las tablas nuevas. Restaurar requeriría backup previo a la 27.
