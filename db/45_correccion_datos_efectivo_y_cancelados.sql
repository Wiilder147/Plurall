-- =============================================================================
-- 45 · Corrección de datos (autorizada por negocio 30-oct-2026)
--   A) J-06: 3 pagos en efectivo CONFIRMADOS ($3.200.000, crédito ef4ee675…)
--      que nunca se aplicaron a cuota ni crédito. Se aplican con la regla
--      vigente (mora → interés → capital, mora a la fecha de cada pago; el
--      excedente queda como saldo a favor), igual que /api/asesor/gestion.
--      Cálculo reproducido con lib/credito.js + lib/pagos.js (cuadra al centavo).
--   B) J-13: créditos CANCELADO con saldo 0 y TODAS sus cuotas pagadas → PAGADO.
-- Respaldo previo en el esquema `respaldo` (no expuesto por PostgREST).
-- Aborta si el estado actual no coincide con el inspeccionado.
-- =============================================================================
begin;

create schema if not exists respaldo;
revoke all on schema respaldo from public, anon, authenticated;

create table respaldo.pago_20261030 as
  select * from public.pago where id_credito = 'ef4ee675-f55d-40a6-b594-65d61c79a80f';
create table respaldo.cuota_20261030 as
  select c.* from public.cuota c join public.plan_pago pp on pp.id_plan_pago = c.id_plan_pago
  where pp.id_credito = 'ef4ee675-f55d-40a6-b594-65d61c79a80f';
create table respaldo.credito_20261030 as
  select * from public.credito
  where id_credito = 'ef4ee675-f55d-40a6-b594-65d61c79a80f' or estado_credito = 'CANCELADO';

do $$
declare n int;
begin
  -- ── Precondiciones A ──────────────────────────────────────────────────────
  select count(*) into n from public.credito
   where id_credito = 'ef4ee675-f55d-40a6-b594-65d61c79a80f'
     and saldo_pendiente = 3600000 and saldo_a_favor = 0 and cuotas_pagadas = 1;
  if n <> 1 then raise exception 'Crédito ef4ee675 cambió: abortar'; end if;

  select count(*) into n from public.cuota
   where id_cuota in ('7066a494-83ac-4854-8c1c-beffdce39abe','a2fc257d-ca53-4184-be09-773618d0dc1c',
                      'a9d2581a-8e32-429f-ac8f-a317a4b32613','3356117e-fc8e-4843-9aaa-a5c4ee2dac6b')
     and estado_cuota = 'VENCIDA' and coalesce(monto_pagado_real, 0) = 0 and monto_mora_cobrada = 0;
  if n <> 4 then raise exception 'Cuotas 2-5 cambiaron: abortar'; end if;

  select count(*) into n from public.pago
   where id_credito = 'ef4ee675-f55d-40a6-b594-65d61c79a80f' and metodo_pago = 'EFECTIVO' and estado = 'CONFIRMADO';
  if n <> 3 then raise exception 'Pagos del crédito cambiaron: abortar'; end if;

  -- ── A) Recibos: desglose real (antes inconsistente con el monto) ─────────
  update public.pago set monto_capital = 109001.24, monto_interes = 79118.62,  monto_mora = 11880.14, saldo_a_favor_delta = null
   where id_recibo = '33d3eeb4-dd26-4f65-990d-7a367787db23' and monto_pagado = 200000;
  update public.pago set monto_capital = 672635.35, monto_interes = 213452.79, monto_mora = 12484.34, saldo_a_favor_delta = 1101427.52
   where id_recibo = '8e015386-4c4e-4da7-a2f2-b7f0749cb405' and monto_pagado = 2000000;
  update public.pago set monto_capital = 0, monto_interes = 0, monto_mora = 0, saldo_a_favor_delta = 1000000
   where id_recibo = '9d5656e0-ecb5-4bcb-a1f4-ca1a6a563132' and monto_pagado = 1000000;

  -- ── A) Cuotas 2-5 pagadas el 17-ago-2026 (con mora) ───────────────────────
  update public.cuota set estado_cuota = 'PAGADA_MORA', monto_pagado_real = 280432.14, monto_mora_cobrada = 11880.14, fecha_pago_real = '2026-08-17'
   where id_cuota = '7066a494-83ac-4854-8c1c-beffdce39abe';
  update public.cuota set estado_cuota = 'PAGADA_MORA', monto_pagado_real = 276680.79, monto_mora_cobrada = 8128.79,  fecha_pago_real = '2026-08-17'
   where id_cuota = 'a2fc257d-ca53-4184-be09-773618d0dc1c';
  update public.cuota set estado_cuota = 'PAGADA_MORA', monto_pagado_real = 272768.71, monto_mora_cobrada = 4216.71,  fecha_pago_real = '2026-08-17'
   where id_cuota = 'a9d2581a-8e32-429f-ac8f-a317a4b32613';
  update public.cuota set estado_cuota = 'PAGADA_MORA', monto_pagado_real = 268690.84, monto_mora_cobrada = 138.84,   fecha_pago_real = '2026-08-17'
   where id_cuota = '3356117e-fc8e-4843-9aaa-a5c4ee2dac6b';

  -- ── A) Crédito: saldo − capital aplicado (781.636,59); cuotas 6 y 7 siguen vencidas
  update public.credito set saldo_pendiente = 2818363.41, cuotas_pagadas = 5, cuotas_en_mora = 2,
         saldo_a_favor = 2101427.52, estado_credito = 'EN_MORA'
   where id_credito = 'ef4ee675-f55d-40a6-b594-65d61c79a80f';

  -- ── B) CANCELADO saldado → PAGADO ─────────────────────────────────────────
  update public.credito cr set estado_credito = 'PAGADO'
   where cr.estado_credito = 'CANCELADO' and cr.saldo_pendiente = 0
     and exists (select 1 from public.plan_pago pp join public.cuota c on c.id_plan_pago = pp.id_plan_pago where pp.id_credito = cr.id_credito)
     and not exists (select 1 from public.plan_pago pp join public.cuota c on c.id_plan_pago = pp.id_plan_pago
                      where pp.id_credito = cr.id_credito and c.estado_cuota not in ('PAGADA','PAGADA_MORA'));
  get diagnostics n = row_count;
  if n <> 29 then raise exception 'Se esperaban 29 créditos CANCELADO→PAGADO, hubo %', n; end if;
end $$;

commit;
