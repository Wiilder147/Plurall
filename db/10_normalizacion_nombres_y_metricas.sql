-- ============================================================
-- PLURALL — Migración 10: Normalización de nombres + métricas
-- Ejecutar después de 09_mejoras_produccion.sql
-- ============================================================
-- Contenido:
--   1. respuesta_cliente.respuesta_numerica — valor tipado para
--      preguntas MONEDA / NUMERO (cálculos de score y métricas).
--   2. CHECK en pregunta.tipo_input — dominio cerrado de tipos.
--   3. Normalización del nombre en cliente y perfil_usuario:
--      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido.
--      nombre_completo se conserva y se mantiene sincronizado por
--      trigger para no romper las +160 lecturas existentes en la app.
-- ============================================================


-- ============================================================
-- 1. RESPUESTA NUMÉRICA TIPADA
-- ============================================================

ALTER TABLE respuesta_cliente
  ADD COLUMN IF NOT EXISTS respuesta_numerica NUMERIC(15,2);

COMMENT ON COLUMN respuesta_cliente.respuesta_numerica IS
  'Valor numérico de la respuesta cuando la pregunta es MONEDA o NUMERO. Permite usarla en cálculos de score y métricas sin castear texto';

-- Backfill: convertir respuestas existentes de preguntas numéricas
UPDATE respuesta_cliente rc
SET respuesta_numerica = rc.respuesta_texto::NUMERIC(15,2)
FROM pregunta p
WHERE p.id_pregunta = rc.id_pregunta
  AND p.tipo_input IN ('MONEDA', 'NUMERO')
  AND rc.respuesta_numerica IS NULL
  AND rc.respuesta_texto ~ '^\d+(\.\d+)?$';

CREATE INDEX IF NOT EXISTS idx_respuesta_numerica
  ON respuesta_cliente(id_pregunta, respuesta_numerica)
  WHERE respuesta_numerica IS NOT NULL;


-- ============================================================
-- 2. DOMINIO CERRADO PARA pregunta.tipo_input
-- ============================================================

ALTER TABLE pregunta DROP CONSTRAINT IF EXISTS ck_pregunta_tipo_input;
ALTER TABLE pregunta
  ADD CONSTRAINT ck_pregunta_tipo_input
  CHECK (tipo_input IN ('SELECT', 'TEXTO', 'NUMERO', 'MONEDA', 'UBICACION', 'BANCO'));

COMMENT ON COLUMN pregunta.tipo_input IS
  'SELECT | TEXTO | NUMERO | MONEDA | UBICACION | BANCO. NUMERO y MONEDA exigen respuesta numérica (respuesta_cliente.respuesta_numerica)';


-- ============================================================
-- 3. NORMALIZACIÓN DEL NOMBRE (cliente y perfil_usuario)
-- ============================================================

-- 3.1 Columnas atómicas
ALTER TABLE cliente
  ADD COLUMN IF NOT EXISTS primer_nombre    VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_nombre   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS primer_apellido  VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_apellido VARCHAR(60);

ALTER TABLE perfil_usuario
  ADD COLUMN IF NOT EXISTS primer_nombre    VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_nombre   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS primer_apellido  VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_apellido VARCHAR(60);

-- 3.2 Función de parseo (convención colombiana)
--   1 token  → primer_nombre
--   2 tokens → primer_nombre + primer_apellido
--   3 tokens → primer_nombre + primer_apellido + segundo_apellido
--   4+ tokens→ primer_nombre + segundo_nombre(s) + primer_apellido + segundo_apellido
CREATE OR REPLACE FUNCTION fn_parse_nombre(
    p_nombre TEXT,
    OUT primer_nombre    TEXT,
    OUT segundo_nombre   TEXT,
    OUT primer_apellido  TEXT,
    OUT segundo_apellido TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    partes TEXT[];
    n INT;
BEGIN
    partes := regexp_split_to_array(
        trim(regexp_replace(COALESCE(p_nombre, ''), '\s+', ' ', 'g')), ' ');
    n := COALESCE(array_length(partes, 1), 0);

    IF n = 0 OR partes[1] = '' THEN
        RETURN;
    ELSIF n = 1 THEN
        primer_nombre := partes[1];
    ELSIF n = 2 THEN
        primer_nombre   := partes[1];
        primer_apellido := partes[2];
    ELSIF n = 3 THEN
        primer_nombre    := partes[1];
        primer_apellido  := partes[2];
        segundo_apellido := partes[3];
    ELSE
        primer_nombre    := partes[1];
        segundo_nombre   := array_to_string(partes[2:n-2], ' ');
        primer_apellido  := partes[n-1];
        segundo_apellido := partes[n];
    END IF;
END;
$$;

-- 3.3 Backfill de datos existentes
UPDATE cliente
SET (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido) =
    (SELECT p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido
       FROM fn_parse_nombre(cliente.nombre_completo) p)
WHERE primer_nombre IS NULL
  AND nombre_completo IS NOT NULL;

UPDATE perfil_usuario
SET (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido) =
    (SELECT p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido
       FROM fn_parse_nombre(perfil_usuario.nombre_completo) p)
WHERE primer_nombre IS NULL
  AND nombre_completo IS NOT NULL;

-- 3.4 Trigger de sincronización bidireccional
--   · Cambian las partes  → se recompone nombre_completo
--   · Cambia nombre_completo → se re-parsean las partes
--   Así nombre_completo deja de ser un dato duplicado que se
--   desincroniza: siempre es derivado de las columnas atómicas.
CREATE OR REPLACE FUNCTION fn_sincronizar_nombre()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_parsed RECORD;
    v_partes_cambiaron BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_partes_cambiaron := NEW.primer_nombre IS NOT NULL;
    ELSE
        v_partes_cambiaron :=
            NEW.primer_nombre    IS DISTINCT FROM OLD.primer_nombre    OR
            NEW.segundo_nombre   IS DISTINCT FROM OLD.segundo_nombre   OR
            NEW.primer_apellido  IS DISTINCT FROM OLD.primer_apellido  OR
            NEW.segundo_apellido IS DISTINCT FROM OLD.segundo_apellido;
    END IF;

    IF v_partes_cambiaron THEN
        NEW.nombre_completo := NULLIF(trim(concat_ws(' ',
            NEW.primer_nombre, NEW.segundo_nombre,
            NEW.primer_apellido, NEW.segundo_apellido)), '');
    ELSIF (TG_OP = 'INSERT' AND NEW.nombre_completo IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.nombre_completo IS DISTINCT FROM OLD.nombre_completo) THEN
        SELECT * INTO v_parsed FROM fn_parse_nombre(NEW.nombre_completo);
        NEW.primer_nombre    := v_parsed.primer_nombre;
        NEW.segundo_nombre   := v_parsed.segundo_nombre;
        NEW.primer_apellido  := v_parsed.primer_apellido;
        NEW.segundo_apellido := v_parsed.segundo_apellido;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nombre_cliente ON cliente;
CREATE TRIGGER trg_sync_nombre_cliente
    BEFORE INSERT OR UPDATE ON cliente
    FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_nombre();

DROP TRIGGER IF EXISTS trg_sync_nombre_perfil ON perfil_usuario;
CREATE TRIGGER trg_sync_nombre_perfil
    BEFORE INSERT OR UPDATE ON perfil_usuario
    FOR EACH ROW EXECUTE FUNCTION fn_sincronizar_nombre();

COMMENT ON COLUMN cliente.nombre_completo IS
  'Derivado: se sincroniza por trigger desde primer_nombre/segundo_nombre/primer_apellido/segundo_apellido (1FN). No editar directamente en nuevas features';

-- Refuerzo de seguridad (linter de Supabase): search_path fijo en las funciones
ALTER FUNCTION fn_parse_nombre(TEXT) SET search_path = public;
ALTER FUNCTION fn_sincronizar_nombre() SET search_path = public;


-- ============================================================
-- 4. VERIFICACIÓN
-- ============================================================

SELECT nombre_completo, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
FROM cliente
LIMIT 10;
