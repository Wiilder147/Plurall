-- =============================================================================
-- 44 · Score en escala 0–puntaje_maximo (W-05, opción B — decisión 29-oct-2026)
-- Antes: puntaje = suma cruda de puntos (máximo alcanzable 1400 con el
-- catálogo activo) mostrado como si fuera 0–1000 (se veían 1140, 1190).
-- Ahora: puntaje = round(crudo / máximo_alcanzable × puntaje_maximo), con el
-- máximo calculado del catálogo ACTIVO en cada evaluación.
-- Mínimo de pre-aprobación 600 (crudo) → 429 (escalado): equivalente exacto
-- (600/1400×1000 = 428,6). Verificado: mismos 13 de 15 scores pre-aprobables.
-- Se conserva el valor original en score.puntaje_crudo (trazabilidad).
-- =============================================================================
ALTER TABLE public.score ADD COLUMN IF NOT EXISTS puntaje_crudo integer;

DO $$
DECLARE
  n text := pg_get_functiondef('public.fn_crear_solicitud_completa(numeric,integer,jsonb,jsonb,text)'::regprocedure);
  pares text[][] := ARRAY[
    ['    v_puntaje        INT := 0;',
     '    v_puntaje        INT := 0;
    v_crudo          INT := 0;
    v_max_crudo      NUMERIC;'],
    ['        IF v_puntaje >= COALESCE(v_modelo.puntaje_minimo, 600) THEN',
     '        -- 44: escala 0–puntaje_maximo sobre el máximo alcanzable del catálogo activo
        v_crudo := v_puntaje;
        SELECT COALESCE((SELECT SUM(mx) FROM (SELECT MAX(o.valor_puntos) mx FROM opcion_pregunta o
                           JOIN pregunta p ON p.id_pregunta = o.id_pregunta
                          WHERE p.activo AND o.activo GROUP BY o.id_pregunta) a), 0)
             + COALESCE((SELECT SUM(mx) FROM (SELECT MAX(r.puntos) mx FROM rango_puntaje_pregunta r
                           JOIN pregunta p ON p.id_pregunta = r.id_pregunta
                          WHERE p.activo AND r.activo GROUP BY r.id_pregunta) b), 0)
          INTO v_max_crudo;
        IF v_max_crudo > 0 THEN
            v_puntaje := LEAST(COALESCE(v_modelo.puntaje_maximo, 1000),
                         GREATEST(0, ROUND(v_crudo::NUMERIC / v_max_crudo * COALESCE(v_modelo.puntaje_maximo, 1000))))::INT;
        END IF;

        IF v_puntaje >= COALESCE(v_modelo.puntaje_minimo, 600) THEN'],
    ['        INSERT INTO score (id_solicitud, id_modelo_score, puntaje_total,
                           puntaje_maximo_posible, porcentaje, recomendacion)
        VALUES (v_id_solicitud, v_modelo.id_modelo_score, v_puntaje,',
     '        INSERT INTO score (id_solicitud, id_modelo_score, puntaje_total, puntaje_crudo,
                           puntaje_maximo_posible, porcentaje, recomendacion)
        VALUES (v_id_solicitud, v_modelo.id_modelo_score, v_puntaje, v_crudo,']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(pares, 1) LOOP
    IF position(pares[i][1] IN n) = 0 THEN
      RAISE EXCEPTION 'Fragmento no encontrado: %', left(pares[i][1], 60);
    END IF;
    n := replace(n, pares[i][1], pares[i][2]);
  END LOOP;
  EXECUTE n;
END $$;

-- Mínimo equivalente en la nueva escala
UPDATE public.modelo_score SET puntaje_minimo = 429 WHERE activo AND puntaje_minimo = 600;

-- Reescalar los scores existentes (conservando el crudo)
WITH m AS (
  SELECT (SELECT COALESCE(SUM(mx),0) FROM (SELECT MAX(o.valor_puntos) mx FROM opcion_pregunta o JOIN pregunta p ON p.id_pregunta=o.id_pregunta WHERE p.activo AND o.activo GROUP BY o.id_pregunta) a)
       + (SELECT COALESCE(SUM(mx),0) FROM (SELECT MAX(r.puntos) mx FROM rango_puntaje_pregunta r JOIN pregunta p ON p.id_pregunta=r.id_pregunta WHERE p.activo AND r.activo GROUP BY r.id_pregunta) b) AS max_crudo
)
UPDATE public.score s
SET puntaje_crudo = s.puntaje_total,
    puntaje_total = LEAST(COALESCE(s.puntaje_maximo_posible, 1000), ROUND(s.puntaje_total::numeric / m.max_crudo * COALESCE(s.puntaje_maximo_posible, 1000)))::int,
    porcentaje    = ROUND(LEAST(COALESCE(s.puntaje_maximo_posible, 1000), ROUND(s.puntaje_total::numeric / m.max_crudo * COALESCE(s.puntaje_maximo_posible, 1000))) / COALESCE(s.puntaje_maximo_posible, 1000) * 100, 2)
FROM m
WHERE s.puntaje_crudo IS NULL AND m.max_crudo > 0;
