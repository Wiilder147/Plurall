-- ============================================================
-- PLURALL — Migración 34: PQR cerrada es inmutable (trazabilidad)
-- Ejecutar después de 33_registro_requiere_celular.sql
-- ============================================================
-- Contexto:
--   Por auditoría, cuando una PQR se CIERRA su respuesta/solución no debe poder
--   modificarse ni reabrirse. Se garantiza a nivel de BD (además del control en
--   la API y la UI) para que la trazabilidad sea estática por cualquier vía.
--
-- La función bloquea cambios a los campos de la solución cuando el estado
-- previo ya era 'CERRADO'. Se permite tocar updated_at (no afecta el contenido).
-- ============================================================

create or replace function public.fn_pqr_inmutable_cerrado()
returns trigger
language plpgsql
as $$
begin
  if OLD.estado = 'CERRADO' then
    if NEW.respuesta         is distinct from OLD.respuesta
       or NEW.estado         is distinct from OLD.estado
       or NEW.id_respondido_por is distinct from OLD.id_respondido_por
       or NEW.fecha_respuesta   is distinct from OLD.fecha_respuesta then
      raise exception 'PQR cerrada: la respuesta es inmutable (trazabilidad de auditoría).'
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_pqr_inmutable_cerrado on public.pqr;
create trigger trg_pqr_inmutable_cerrado
  before update on public.pqr
  for each row
  execute function public.fn_pqr_inmutable_cerrado();
