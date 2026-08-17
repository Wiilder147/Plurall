-- ============================================================
-- PLURALL — Migración 32: función para verificar si un celular está registrado
-- Ejecutar después de 31_saldo_a_favor.sql
-- ============================================================
-- Contexto:
--   El login y la recuperación de contraseña usan el "correo virtual"
--   {celular}@plurall.app en auth.users. El cliente no puede consultar
--   auth.users (protegido). Esta función SECURITY DEFINER permite al backend
--   (service role) saber si un celular corresponde a un usuario registrado,
--   para diferenciar "número no registrado" de "contraseña incorrecta" y no
--   iniciar el contador de bloqueo con números inexistentes.
-- ============================================================

create or replace function public.usuario_existe_por_celular(cel text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where email = lower(cel) || '@plurall.app'
  );
$$;

-- Solo el backend (service role) puede ejecutarla; nunca el cliente anónimo.
revoke all on function public.usuario_existe_por_celular(text) from public;
revoke all on function public.usuario_existe_por_celular(text) from anon, authenticated;
grant execute on function public.usuario_existe_por_celular(text) to service_role;
