-- ============================================================
-- PLURALL — Migración 11: Ponderación del score con valores numéricos
-- Ejecutar después de 10_normalizacion_nombres_y_metricas.sql
-- ============================================================
-- Contenido:
--   1. Tabla rango_puntaje_pregunta: rangos configurables que asignan
--      puntos según el valor numérico respondido (análogo a
--      opcion_pregunta.valor_puntos para preguntas de opciones).
--      Semántica de rango: valor >= valor_min AND (valor_max IS NULL
--      OR valor < valor_max). valor_max NULL = sin tope.
--   2. Retipificación de preguntas numéricas que estaban como TEXTO
--      (ingreso, gasto, empleados, dependientes, antigüedad).
--   3. Backfill de respuesta_numerica para respuestas históricas.
--   4. Semilla de rangos de puntaje para las 6 preguntas numéricas.
-- ============================================================


-- ============================================================
-- 1. TABLA DE RANGOS DE PUNTAJE
-- ============================================================

CREATE TABLE IF NOT EXISTS rango_puntaje_pregunta (
    id_rango    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pregunta UUID NOT NULL REFERENCES pregunta(id_pregunta) ON DELETE CASCADE,
    valor_min   NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_max   NUMERIC(15,2),          -- NULL = sin tope superior
    puntos      INT NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT ck_rango_valido CHECK (valor_max IS NULL OR valor_max > valor_min)
);

COMMENT ON TABLE rango_puntaje_pregunta IS
  'Puntos de score por rango de valor para preguntas MONEDA/NUMERO. Un valor v aplica al rango si v >= valor_min y (valor_max es NULL o v < valor_max)';

CREATE INDEX IF NOT EXISTS idx_rango_pregunta
  ON rango_puntaje_pregunta(id_pregunta) WHERE activo = true;

ALTER TABLE rango_puntaje_pregunta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leer_rangos_autenticados" ON rango_puntaje_pregunta;
CREATE POLICY "leer_rangos_autenticados" ON rango_puntaje_pregunta
    FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS "admin_gestionar_rangos" ON rango_puntaje_pregunta;
CREATE POLICY "admin_gestionar_rangos" ON rango_puntaje_pregunta
    FOR ALL USING (es_admin());


-- ============================================================
-- 2. RETIPIFICAR PREGUNTAS NUMÉRICAS (estaban como TEXTO)
--    Se identifican por enunciado para no depender de UUIDs
-- ============================================================

UPDATE pregunta SET tipo_input = 'NUMERO',
       enunciado = '¿Cuántos meses lleva operando su negocio?'
WHERE enunciado = '¿Cuánto tiempo lleva operando su negocio?' AND tipo_input = 'TEXTO';

UPDATE pregunta SET tipo_input = 'NUMERO'
WHERE enunciado = '¿Cuántas personas trabajan en su negocio?' AND tipo_input = 'TEXTO';

UPDATE pregunta SET tipo_input = 'MONEDA'
WHERE enunciado = '¿Cuál es el ingreso mensual promedio de su negocio?' AND tipo_input = 'TEXTO';

UPDATE pregunta SET tipo_input = 'MONEDA'
WHERE enunciado = '¿Cuál es su gasto mensual total (arriendo, servicios)?' AND tipo_input = 'TEXTO';

UPDATE pregunta SET tipo_input = 'NUMERO'
WHERE enunciado = '¿Cuántas personas dependen económicamente de usted?' AND tipo_input = 'TEXTO';


-- ============================================================
-- 3. BACKFILL respuesta_numerica DE RESPUESTAS HISTÓRICAS
-- ============================================================

UPDATE respuesta_cliente rc
SET respuesta_numerica = REPLACE(REPLACE(TRIM(rc.respuesta_texto), '$', ''), '.', '')::NUMERIC(15,2)
FROM pregunta p
WHERE p.id_pregunta = rc.id_pregunta
  AND p.tipo_input IN ('MONEDA', 'NUMERO')
  AND rc.respuesta_numerica IS NULL
  AND REPLACE(REPLACE(TRIM(rc.respuesta_texto), '$', ''), '.', '') ~ '^\d+$';


-- ============================================================
-- 4. SEMILLA DE RANGOS DE PUNTAJE
--    Escala alineada al modelo_score (máximo 1000, mínimo 600).
--    Máximo aportable por preguntas numéricas: 790 puntos.
-- ============================================================

-- Antigüedad del negocio (meses): más antigüedad = menos riesgo
INSERT INTO rango_puntaje_pregunta (id_pregunta, valor_min, valor_max, puntos)
SELECT id_pregunta, r.min, r.max, r.pts
FROM pregunta,
     (VALUES (0, 6, 20), (6, 12, 60), (12, 36, 100), (36, NULL::INT, 140)) AS r(min, max, pts)
WHERE enunciado = '¿Cuántos meses lleva operando su negocio?'
  AND NOT EXISTS (SELECT 1 FROM rango_puntaje_pregunta x WHERE x.id_pregunta = pregunta.id_pregunta);

-- Empleados del negocio
INSERT INTO rango_puntaje_pregunta (id_pregunta, valor_min, valor_max, puntos)
SELECT id_pregunta, r.min, r.max, r.pts
FROM pregunta,
     (VALUES (0, 2, 40), (2, 6, 80), (6, NULL::INT, 110)) AS r(min, max, pts)
WHERE enunciado = '¿Cuántas personas trabajan en su negocio?'
  AND NOT EXISTS (SELECT 1 FROM rango_puntaje_pregunta x WHERE x.id_pregunta = pregunta.id_pregunta);

-- Ingreso mensual promedio (COP)
INSERT INTO rango_puntaje_pregunta (id_pregunta, valor_min, valor_max, puntos)
SELECT id_pregunta, r.min, r.max, r.pts
FROM pregunta,
     (VALUES (0, 1000000, 40), (1000000, 3000000, 90),
             (3000000, 6000000, 140), (6000000, NULL::INT, 180)) AS r(min, max, pts)
WHERE enunciado = '¿Cuál es el ingreso mensual promedio de su negocio?'
  AND NOT EXISTS (SELECT 1 FROM rango_puntaje_pregunta x WHERE x.id_pregunta = pregunta.id_pregunta);

-- Gasto mensual total (COP): menos gasto = más puntos
INSERT INTO rango_puntaje_pregunta (id_pregunta, valor_min, valor_max, puntos)
SELECT id_pregunta, r.min, r.max, r.pts
FROM pregunta,
     (VALUES (0, 500000, 120), (500000, 1500000, 90),
             (1500000, 3000000, 60), (3000000, NULL::INT, 30)) AS r(min, max, pts)
WHERE enunciado = '¿Cuál es su gasto mensual total (arriendo, servicios)?'
  AND NOT EXISTS (SELECT 1 FROM rango_puntaje_pregunta x WHERE x.id_pregunta = pregunta.id_pregunta);

-- Deudas / créditos activos (COP): menos deuda = más puntos
INSERT INTO rango_puntaje_pregunta (id_pregunta, valor_min, valor_max, puntos)
SELECT id_pregunta, r.min, r.max, r.pts
FROM pregunta,
     (VALUES (0, 1, 150), (1, 1000000, 110), (1000000, 3000000, 70),
             (3000000, 6000000, 40), (6000000, NULL::INT, 10)) AS r(min, max, pts)
WHERE enunciado = 'Si tiene deudas o créditos activos, escriba el valor total (escriba 0 si no tiene)'
  AND NOT EXISTS (SELECT 1 FROM rango_puntaje_pregunta x WHERE x.id_pregunta = pregunta.id_pregunta);

-- Personas a cargo: menos dependientes = más capacidad de pago
INSERT INTO rango_puntaje_pregunta (id_pregunta, valor_min, valor_max, puntos)
SELECT id_pregunta, r.min, r.max, r.pts
FROM pregunta,
     (VALUES (0, 2, 90), (2, 4, 60), (4, NULL::INT, 30)) AS r(min, max, pts)
WHERE enunciado = '¿Cuántas personas dependen económicamente de usted?'
  AND NOT EXISTS (SELECT 1 FROM rango_puntaje_pregunta x WHERE x.id_pregunta = pregunta.id_pregunta);


-- ============================================================
-- 5. VERIFICACIÓN
-- ============================================================

SELECT p.enunciado, p.tipo_input, r.valor_min, r.valor_max, r.puntos
FROM rango_puntaje_pregunta r
JOIN pregunta p ON p.id_pregunta = r.id_pregunta
ORDER BY p.orden, r.valor_min;
