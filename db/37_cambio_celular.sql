-- ============================================================
-- PLURALL — Migración 37: cambio de celular (historial + OTP)
-- Ejecutar después de 36_notificacion_staff.sql
-- ============================================================
-- Contexto:
--   El celular es la identidad de acceso del cliente. Cuando cambia:
--     1. El número anterior queda registrado (historial_celular) para saber
--        qué cliente lo tuvo — útil si más adelante se reasigna a otro.
--     2. Si el cliente lo solicita, el cambio se confirma con un OTP
--        (otp_cambio_celular) enviado a su correo real.
--     3. Al asignar un número ya usado por otro cliente, se puede alertar al
--        staff mostrando quién lo tenía antes.
-- ============================================================

-- 1. Historial de números liberados (el que tenía el cliente antes del cambio)
create table if not exists public.historial_celular (
  id_historial   uuid primary key default gen_random_uuid(),
  celular        varchar(10) not null,
  id_cliente     uuid not null references public.cliente(id_cliente) on delete cascade,
  fecha_liberado timestamptz not null default now(),
  liberado_por   uuid references public.perfil_usuario(id),  -- staff que hizo el cambio, o null si fue el cliente
  motivo         varchar(200)
);
create index if not exists idx_historial_celular_num on public.historial_celular (celular);
create index if not exists idx_historial_celular_cli on public.historial_celular (id_cliente);

-- 2. OTP para que el CLIENTE confirme el cambio de su propio celular
create table if not exists public.otp_cambio_celular (
  id_otp        uuid primary key default gen_random_uuid(),
  id_cliente    uuid not null references public.cliente(id_cliente) on delete cascade,
  nuevo_celular varchar(10) not null,
  otp_code      varchar(6) not null,
  expiracion    timestamptz not null,
  usado         boolean not null default false,
  created_at    timestamptz default now()
);
create index if not exists idx_otp_cambio_cel_cliente on public.otp_cambio_celular (id_cliente, usado);

-- 3. Función: ¿este celular fue usado antes por OTRO cliente? Devuelve el más
--    reciente (para la alerta de reúso). SECURITY DEFINER: la usa el backend.
create or replace function public.celular_usado_antes(cel text, cliente_actual uuid default null)
returns table (
  id_cliente uuid,
  primer_nombre text,
  segundo_nombre text,
  primer_apellido text,
  segundo_apellido text,
  fecha_liberado timestamptz
)
language sql
security definer
set search_path = public
as $$
  select h.id_cliente,
         c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido,
         h.fecha_liberado
  from historial_celular h
  join cliente c on c.id_cliente = h.id_cliente
  where h.celular = cel
    and (cliente_actual is null or h.id_cliente <> cliente_actual)
  order by h.fecha_liberado desc
  limit 1;
$$;

revoke all on function public.celular_usado_antes(text, uuid) from public, anon, authenticated;
grant execute on function public.celular_usado_antes(text, uuid) to service_role;
