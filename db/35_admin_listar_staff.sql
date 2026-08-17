-- ============================================================
-- PLURALL — Migración 35: listar staff (asesor/supervisor) con su celular
-- Ejecutar después de 34_pqr_inmutable_cerrado.sql
-- ============================================================
-- Contexto:
--   El módulo de administración para crear/gestionar usuarios de staff necesita
--   listar asesores y supervisores con su celular de acceso. El celular se
--   deriva del correo virtual {celular}@plurall.app en auth.users, que el
--   cliente no puede consultar. Esta función SECURITY DEFINER lo expone al
--   backend (service role).
-- ============================================================

create or replace function public.admin_listar_staff()
returns table (
  id uuid,
  nombre_rol text,
  primer_nombre text,
  segundo_nombre text,
  primer_apellido text,
  segundo_apellido text,
  celular text,
  activo boolean,
  created_at timestamptz
)
language sql
security definer
set search_path to public
as $$
  select pu.id,
         r.nombre_rol,
         pu.primer_nombre, pu.segundo_nombre, pu.primer_apellido, pu.segundo_apellido,
         split_part(u.email, '@', 1) as celular,
         pu.activo,
         pu.created_at
  from perfil_usuario pu
  join rol r        on r.id_rol = pu.id_rol
  join auth.users u on u.id = pu.id
  where r.nombre_rol in ('ASESOR', 'SUPERVISOR')
  order by r.nombre_rol, pu.created_at desc;
$$;

revoke all on function public.admin_listar_staff() from public, anon, authenticated;
grant execute on function public.admin_listar_staff() to service_role;
