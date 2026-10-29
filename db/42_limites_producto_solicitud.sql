-- =============================================================================
-- 42 · Límites de producto en la solicitud (decisión de negocio 29-oct-2026)
-- Monto $400.000–$10.000.000 (antes desde $100.000); plazos 12, 24 o 36 meses
-- (antes 12, 24, 30). Se parchea la definición DESPLEGADA del RPC reemplazando
-- solo esos fragmentos; aborta si alguno no se encuentra.
-- =============================================================================
DO $$
DECLARE
  d text := pg_get_functiondef('public.fn_crear_solicitud_completa(numeric,integer,jsonb,jsonb,text)'::regprocedure);
  n text := d;
  pares text[][] := ARRAY[
    ['p_monto < 100000 OR p_monto > 10000000',            'p_monto < 400000 OR p_monto > 10000000'],
    ['El monto debe estar entre $100.000 y $10.000.000.', 'El monto debe estar entre $400.000 y $10.000.000.'],
    ['p_plazo NOT IN (12, 24, 30)',                        'p_plazo NOT IN (12, 24, 36)'],
    ['El plazo debe ser 12, 24 o 30 meses.',               'El plazo debe ser 12, 24 o 36 meses.']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(pares, 1) LOOP
    IF position(pares[i][1] IN n) = 0 THEN
      RAISE EXCEPTION 'Fragmento no encontrado: %', pares[i][1];
    END IF;
    n := replace(n, pares[i][1], pares[i][2]);
  END LOOP;
  EXECUTE n;
END $$;
