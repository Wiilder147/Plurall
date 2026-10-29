-- =============================================================================
-- 39 · Un crédito por solicitud y celular único por cliente (M8, M2 — 29-oct-2026)
-- No se usa UNIQUE porque hay datos previos que lo violan (semilla de prueba con
-- 4 créditos en una misma solicitud; 4 clientes con '0000000000' y un par con el
-- mismo celular). Los triggers protegen TODA inserción/cambio nuevo sin
-- reescribir datos existentes. pg_advisory_xact_lock serializa por clave y evita
-- la carrera de dos inserciones concurrentes (doble desembolso).
-- SECURITY DEFINER: el EXISTS debe ver todas las filas aunque quien actualiza
-- sea un cliente bajo RLS (que solo ve su propia fila).
-- Cuando se depuren los duplicados, reemplazar por índices UNIQUE.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_credito_unico_por_solicitud()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.id_solicitud IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('credito_solicitud:' || NEW.id_solicitud::text));
  IF EXISTS (SELECT 1 FROM public.credito c
             WHERE c.id_solicitud = NEW.id_solicitud AND c.id_credito IS DISTINCT FROM NEW.id_credito) THEN
    RAISE EXCEPTION 'La solicitud % ya tiene un crédito desembolsado', NEW.id_solicitud
      USING errcode = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_credito_unico_por_solicitud ON public.credito;
CREATE TRIGGER trg_credito_unico_por_solicitud
  BEFORE INSERT OR UPDATE OF id_solicitud ON public.credito
  FOR EACH ROW EXECUTE FUNCTION public.fn_credito_unico_por_solicitud();

CREATE OR REPLACE FUNCTION public.fn_cliente_telefono_unico()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_tel text := regexp_replace(coalesce(NEW.telefono, ''), '\D', '', 'g');
BEGIN
  IF v_tel = '' THEN RETURN NEW; END IF;
  IF v_tel = '0000000000' THEN
    RAISE EXCEPTION 'Celular inválido' USING errcode = 'check_violation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('cliente_telefono:' || v_tel));
  IF EXISTS (SELECT 1 FROM public.cliente c
             WHERE regexp_replace(c.telefono, '\D', '', 'g') = v_tel
               AND c.id_cliente IS DISTINCT FROM NEW.id_cliente) THEN
    RAISE EXCEPTION 'Este número de celular ya está registrado'
      USING errcode = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cliente_telefono_unico ON public.cliente;
CREATE TRIGGER trg_cliente_telefono_unico
  BEFORE INSERT OR UPDATE OF telefono ON public.cliente
  FOR EACH ROW EXECUTE FUNCTION public.fn_cliente_telefono_unico();
