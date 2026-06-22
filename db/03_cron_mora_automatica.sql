-- ============================================================
-- ARCHIVO: 03_cron_mora_automatica.sql
-- DESCRIPCIÓN: Configuración del cron job de detección automática
--              de mora en créditos PLURALL.
--
-- MÉTODO PRINCIPAL: Vercel Cron (ya configurado en vercel.json)
--   → GET /api/cron/mora   cada día a las 11:00 UTC (6 AM Colombia)
--   → Requiere variable CRON_SECRET en Vercel Dashboard → Settings → Env Vars
--
-- ALTERNATIVA: Supabase pg_cron (fallback si no se usa Vercel)
--   → Requiere extensión pg_cron activa en
--     Supabase Dashboard → Database → Extensions
-- ============================================================

-- ============================================================
-- PASO 1: FUNCIÓN SQL — detectar_mora_y_actualizar()
-- Equivalente SQL al endpoint /api/cron/mora/route.js.
-- Úsala para:
--   a) Testing manual desde el SQL Editor de Supabase.
--   b) Invocación directa vía pg_cron (modo alternativo).
-- ============================================================
create or replace function detectar_mora_y_actualizar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy         date := current_date;
  v_cuotas      int  := 0;
  v_mora        int  := 0;
  v_recuperados int  := 0;
begin

  -- ── PASO 1: Marcar cuotas PENDIENTE vencidas → VENCIDA ──────────────────
  update cuota
  set    estado_cuota = 'VENCIDA',
         updated_at   = now()
  where  estado_cuota     = 'PENDIENTE'
  and    fecha_vencimiento < v_hoy;

  get diagnostics v_cuotas = row_count;

  -- ── PASO 2: Marcar créditos ACTIVO → EN_MORA si tienen cuotas VENCIDAS ──
  --    Calcula cuotas_en_mora y dias_mora_maximo en una sola pasada.
  update credito c
  set
    estado_credito   = 'EN_MORA',
    cuotas_en_mora   = (
      select count(*)
      from   cuota        q
      join   plan_pago   pp on pp.id_plan_pago = q.id_plan_pago
      where  pp.id_credito   = c.id_credito
      and    q.estado_cuota  = 'VENCIDA'
    ),
    dias_mora_maximo = (
      select greatest(0, (v_hoy - min(q.fecha_vencimiento::date)))
      from   cuota        q
      join   plan_pago   pp on pp.id_plan_pago = q.id_plan_pago
      where  pp.id_credito   = c.id_credito
      and    q.estado_cuota  = 'VENCIDA'
    ),
    updated_at       = now()
  where  c.estado_credito = 'ACTIVO'
  and    exists (
           select 1
           from   cuota      q
           join   plan_pago pp on pp.id_plan_pago = q.id_plan_pago
           where  pp.id_credito  = c.id_credito
           and    q.estado_cuota = 'VENCIDA'
         );

  get diagnostics v_mora = row_count;

  -- ── PASO 3: Recuperar créditos EN_MORA que ya pagaron todas sus vencidas ─
  update credito c
  set    estado_credito = 'ACTIVO',
         cuotas_en_mora = 0,
         updated_at     = now()
  where  c.estado_credito = 'EN_MORA'
  and    not exists (
           select 1
           from   cuota      q
           join   plan_pago pp on pp.id_plan_pago = q.id_plan_pago
           where  pp.id_credito  = c.id_credito
           and    q.estado_cuota = 'VENCIDA'
         );

  get diagnostics v_recuperados = row_count;

  -- Retorna resumen legible para monitoreo
  return jsonb_build_object(
    'fecha',                 v_hoy,
    'cuotas_marcadas_vencidas',  v_cuotas,
    'creditos_en_mora',          v_mora,
    'creditos_recuperados',      v_recuperados,
    'ejecutado_en',              now()
  );

end;
$$;

-- ============================================================
-- PASO 2 (OPCIONAL): PROGRAMAR CON pg_cron
-- Descomenta estas líneas si prefieres pg_cron a Vercel Cron.
-- La extensión pg_cron debe estar activa en Supabase Extensions.
-- ============================================================

-- Eliminar job anterior si existe (idempotente)
-- select cron.unschedule('plurall-mora-diaria');

-- Programar detección diaria a las 11:00 UTC (6:00 AM Colombia, UTC-5)
-- select cron.schedule(
--   'plurall-mora-diaria',
--   '0 11 * * *',
--   $$ select detectar_mora_y_actualizar(); $$
-- );

-- Verificar jobs activos
-- select jobid, jobname, schedule, command, active from cron.job;

-- ============================================================
-- PASO 3: TESTING MANUAL
-- Ejecutar desde Supabase SQL Editor para probar la función:
-- ============================================================

-- select detectar_mora_y_actualizar();

-- Consulta de diagnóstico — ver resumen de mora actual:
-- select
--   c.id_credito,
--   c.estado_credito,
--   c.cuotas_en_mora,
--   c.dias_mora_maximo,
--   count(q.id_cuota) filter (where q.estado_cuota = 'VENCIDA') as cuotas_vencidas_total
-- from credito c
-- left join plan_pago pp on pp.id_credito = c.id_credito
-- left join cuota q      on q.id_plan_pago = pp.id_plan_pago
-- where c.estado_credito in ('ACTIVO', 'EN_MORA')
-- group by c.id_credito
-- order by c.dias_mora_maximo desc nulls last;

-- ============================================================
-- NOTAS DE ARQUITECTURA
-- ============================================================
-- El flujo de detección de mora en PLURALL tiene tres capas:
--
--   1. Vercel Cron (producción) — vercel.json:
--      { "crons": [{ "path": "/api/cron/mora", "schedule": "0 11 * * *" }] }
--      → Requiere plan Pro o Enterprise en Vercel.
--
--   2. Esta función SQL (pg_cron o manual) — esta migración.
--      → Alternativa gratuita o complemento.
--
--   3. Trigger BD: fn_detectar_mora() en plurall_database_completa.sql
--      → Se dispara en cada INSERT a cuota (cobertura en tiempo real).
-- ============================================================
