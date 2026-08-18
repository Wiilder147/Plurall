-- ============================================================
-- PLURALL — Migración 36: notificaciones in-app para el staff
-- Ejecutar después de 35_admin_listar_staff.sql
-- ============================================================
-- Contexto:
--   El helper crearNotificacionStaff() ya insertaba en notificacion_staff, pero
--   la tabla no existía. Se usa para avisar al asesor cuando se le asigna o
--   retira un cliente (RN de gestión de cartera), y sirve para futuros avisos
--   internos (desembolsos, alertas, etc.).
-- ============================================================

create table if not exists public.notificacion_staff (
  id_notificacion uuid primary key default gen_random_uuid(),
  id_usuario      uuid not null references public.perfil_usuario(id) on delete cascade,
  codigo_tipo     varchar(40) not null default 'GENERAL',
  titulo          varchar(160) not null,
  mensaje         text,
  metadata        jsonb default '{}'::jsonb,
  leida           boolean not null default false,
  created_at      timestamptz default now()
);

create index if not exists idx_notif_staff_usuario on public.notificacion_staff (id_usuario, leida, created_at desc);

alter table public.notificacion_staff enable row level security;

-- Cada usuario de staff ve y marca como leídas SOLO sus notificaciones.
drop policy if exists ver_mis_notif_staff on public.notificacion_staff;
create policy ver_mis_notif_staff on public.notificacion_staff
  for select using (id_usuario = auth.uid());

drop policy if exists actualizar_mis_notif_staff on public.notificacion_staff;
create policy actualizar_mis_notif_staff on public.notificacion_staff
  for update using (id_usuario = auth.uid()) with check (id_usuario = auth.uid());

-- La inserción la hace el backend con service role (ignora RLS).
