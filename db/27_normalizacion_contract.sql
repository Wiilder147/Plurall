-- ============================================================
-- PLURALL — Migración 27: normalización BD — CONTRACT (DROP legacy)
-- ⚠️ NO APLICAR hasta que: (1) el código contract esté desplegado
--    (api/perfil deja de escribir columnas legacy) y (2) haya OK explícito.
-- Ejecutar después de 26_direccion_municipio_backfill.sql
-- ============================================================
-- FASE 6 del plan (docs/HANDOFF_normalizacion_bd.md). Elimina las columnas
-- sobrecargadas de `cliente` y la tabla `detalle_cliente`, ya migradas a:
--   negocio_cliente · direccion · perfil_financiero · cuenta_bancaria · vw_cliente_score
--
-- Prerequisitos (verificar antes de correr):
--   - Backend/frontend recableados a las tablas nuevas (FASE 4 y 5). ✅
--   - `api/perfil` PATCH deja de escribir columnas legacy en `cliente`
--     (solo telefono en cliente; negocio/ubicación van a las tablas nuevas). ⛔ PENDIENTE
--   - Scripts de seed que insertan estas columnas actualizados o retirados. ⛔ PENDIENTE
--   - `npm run build` verde y smoke test por portal.
--   - Grep sin lecturas/escrituras de estas columnas fuera de database.types.ts.
--
-- Irreversible (destruye datos legacy). El backfill (25/26) ya copió todo a las
-- tablas nuevas y se verificó origen==destino, por eso es seguro dropear.
-- Idempotente: DROP ... IF EXISTS.
-- ============================================================

BEGIN;

-- 1. Columnas de negocio/ubicación/score en `cliente`
ALTER TABLE cliente
    DROP COLUMN IF EXISTS direccion,
    DROP COLUMN IF EXISTS ciudad,
    DROP COLUMN IF EXISTS departamento,
    DROP COLUMN IF EXISTS nombre_negocio,
    DROP COLUMN IF EXISTS id_tipo_negocio,
    DROP COLUMN IF EXISTS descripcion_negocio,
    DROP COLUMN IF EXISTS antiguedad_negocio_meses,
    DROP COLUMN IF EXISTS score_credito,
    DROP COLUMN IF EXISTS direccion_negocio,
    DROP COLUMN IF EXISTS ciudad_negocio,
    DROP COLUMN IF EXISTS departamento_negocio,
    DROP COLUMN IF EXISTS lat_negocio,
    DROP COLUMN IF EXISTS lon_negocio,
    DROP COLUMN IF EXISTS direccion_casa,
    DROP COLUMN IF EXISTS ciudad_casa,
    DROP COLUMN IF EXISTS departamento_casa,
    DROP COLUMN IF EXISTS lat_casa,
    DROP COLUMN IF EXISTS lon_casa;

-- 2. Tabla `detalle_cliente` (finanzas → perfil_financiero, banco → cuenta_bancaria)
DROP TABLE IF EXISTS detalle_cliente;

COMMIT;

-- ============================================================
-- VERIFICACIÓN (correr a mano tras aplicar)
-- ============================================================
-- `cliente` sin columnas legacy (debe devolver 0 filas):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='cliente' AND column_name IN
--   ('direccion','ciudad','departamento','nombre_negocio','id_tipo_negocio',
--    'descripcion_negocio','antiguedad_negocio_meses','score_credito',
--    'direccion_negocio','ciudad_negocio','departamento_negocio','lat_negocio','lon_negocio',
--    'direccion_casa','ciudad_casa','departamento_casa','lat_casa','lon_casa');
-- `detalle_cliente` no existe (0 filas):
--   SELECT 1 FROM information_schema.tables WHERE table_name='detalle_cliente';
-- Datos preservados en el modelo nuevo:
--   SELECT (SELECT count(*) FROM negocio_cliente), (SELECT count(*) FROM direccion),
--          (SELECT count(*) FROM perfil_financiero), (SELECT count(*) FROM vw_cliente_score);
