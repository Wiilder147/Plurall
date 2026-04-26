-- ============================================================
-- MIGRACIÓN v2: Direcciones separadas + campos financieros
-- Plurall — Cuestionario de Solicitud de Crédito
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ── 1. Campos de dirección en cliente ────────────────────────
ALTER TABLE cliente
  ADD COLUMN IF NOT EXISTS direccion_negocio      TEXT,
  ADD COLUMN IF NOT EXISTS ciudad_negocio         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS departamento_negocio   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS lat_negocio            DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS lon_negocio            DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS direccion_casa         TEXT,
  ADD COLUMN IF NOT EXISTS ciudad_casa            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS departamento_casa      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS lat_casa               DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS lon_casa               DECIMAL(10,7);

-- ── 2. Campos financieros / personales en detalle_cliente ────
ALTER TABLE detalle_cliente
  ADD COLUMN IF NOT EXISTS empleados_negocio    INT             DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arriendo_negocio     DECIMAL(15,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arriendo_casa        DECIMAL(15,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dependientes         INT             DEFAULT 0,
  ADD COLUMN IF NOT EXISTS colaboracion_gastos  BOOLEAN         DEFAULT false,
  ADD COLUMN IF NOT EXISTS ahorros              DECIMAL(15,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiene_vehiculo       BOOLEAN         DEFAULT false;

-- ── 3. Restricción UNIQUE en detalle_cliente.id_cliente ──────
--    (permite ON CONFLICT upsert desde la app)
ALTER TABLE detalle_cliente
  DROP CONSTRAINT IF EXISTS uq_detalle_id_cliente;

ALTER TABLE detalle_cliente
  ADD CONSTRAINT uq_detalle_id_cliente UNIQUE (id_cliente);

-- ── 4. Verificación ──────────────────────────────────────────
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'cliente'
   AND column_name LIKE '%negocio%' OR column_name LIKE '%casa%'
 ORDER BY column_name;

SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'detalle_cliente'
 ORDER BY column_name;
