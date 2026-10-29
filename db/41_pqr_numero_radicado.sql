-- =============================================================================
-- 41 · Número de radicado de PQR (C-04 — 29-oct-2026)
-- Formato PQR-AAAA-NNNNNN (AAAA = año de radicación, hora Colombia).
-- Asignado siempre por el servidor (el cliente no puede fijarlo) e inmutable.
-- Backfill de las PQR existentes en orden de creación. No toca respuesta/estado
-- (compatible con trg_pqr_inmutable_cerrado).
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.pqr_radicado_seq;
ALTER TABLE public.pqr ADD COLUMN IF NOT EXISTS numero_radicado varchar(20);

CREATE OR REPLACE FUNCTION public.fn_pqr_radicado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.numero_radicado := 'PQR-'
      || to_char(coalesce(NEW.created_at, now()) AT TIME ZONE 'America/Bogota', 'YYYY')
      || '-' || lpad(nextval('public.pqr_radicado_seq')::text, 6, '0');
  ELSE
    NEW.numero_radicado := OLD.numero_radicado;
  END IF;
  RETURN NEW;
END $$;

UPDATE public.pqr p
SET numero_radicado = 'PQR-' || to_char(p.created_at AT TIME ZONE 'America/Bogota', 'YYYY')
                      || '-' || lpad(o.n::text, 6, '0')
FROM (SELECT id_pqr, row_number() OVER (ORDER BY created_at, id_pqr) AS n FROM public.pqr) o
WHERE o.id_pqr = p.id_pqr AND p.numero_radicado IS NULL;

SELECT setval('public.pqr_radicado_seq', greatest((SELECT count(*) FROM public.pqr), 1));

ALTER TABLE public.pqr ALTER COLUMN numero_radicado SET NOT NULL;
ALTER TABLE public.pqr ADD CONSTRAINT uq_pqr_numero_radicado UNIQUE (numero_radicado);

DROP TRIGGER IF EXISTS trg_pqr_radicado ON public.pqr;
CREATE TRIGGER trg_pqr_radicado
  BEFORE INSERT OR UPDATE OF numero_radicado ON public.pqr
  FOR EACH ROW EXECUTE FUNCTION public.fn_pqr_radicado();
