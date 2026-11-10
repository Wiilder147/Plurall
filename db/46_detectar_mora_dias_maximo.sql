-- =============================================================================
-- 46 · fn_detectar_mora refresca dias_mora_maximo y cuotas_en_mora (JM-04)
--
-- Causa raíz: el job pg_cron 'detectar-mora-diaria' (el único que corre a
-- diario contra la BD) nunca escribía dias_mora_maximo y solo contaba
-- cuotas_en_mora al pasar de ACTIVO a EN_MORA. El cron de Vercel
-- (/api/cron/mora) sí lo hace, pero no estaba corriendo: el 09-nov-2026 había
-- 41 créditos con dias_mora_maximo menor que el atraso real.
--
-- Definición (la misma de lib/credito.js → resumenMora y /api/cron/mora):
--   dias_mora_maximo = máximo HISTÓRICO de días de atraso de la obligación;
--   nunca disminuye. Atraso actual = días desde el vencimiento de la cuota no
--   pagada más antigua, contados con la fecha de Colombia.
--
-- No toca saldos, cuotas pagadas ni pagos: solo los indicadores derivados
-- (estado de cuota PENDIENTE→VENCIDA, estado del crédito, cuotas_en_mora,
-- dias_mora_maximo). Idempotente: se puede ejecutar varias veces el mismo día.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_detectar_mora()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    UPDATE cuota
    SET estado_cuota = 'VENCIDA', updated_at = NOW()
    WHERE fecha_vencimiento < v_hoy
      AND estado_cuota = 'PENDIENTE';

    UPDATE credito SET estado_credito = 'EN_MORA', updated_at = NOW()
    WHERE id_credito IN (
        SELECT DISTINCT pp.id_credito FROM plan_pago pp
        JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
        WHERE c.estado_cuota = 'VENCIDA'
    ) AND estado_credito = 'ACTIVO';

    UPDATE credito SET estado_credito = 'ACTIVO',
        cuotas_en_mora = 0, updated_at = NOW()
    WHERE estado_credito = 'EN_MORA'
      AND id_credito NOT IN (
          SELECT DISTINCT pp.id_credito FROM plan_pago pp
          JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
          WHERE c.estado_cuota = 'VENCIDA'
      );

    -- JM-04: refrescar TODOS los créditos en mora (también los que ya lo
    -- estaban), solo si algún valor cambió para no ensuciar la auditoría.
    UPDATE credito cr
    SET cuotas_en_mora   = v.vencidas,
        dias_mora_maximo = GREATEST(COALESCE(cr.dias_mora_maximo, 0), v.dias),
        updated_at       = NOW()
    FROM (
        SELECT pp.id_credito,
               COUNT(*)::int                      AS vencidas,
               (v_hoy - MIN(c.fecha_vencimiento)) AS dias
        FROM plan_pago pp
        JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
        WHERE c.estado_cuota = 'VENCIDA'
        GROUP BY pp.id_credito
    ) v
    WHERE cr.id_credito = v.id_credito
      AND cr.estado_credito = 'EN_MORA'
      AND (cr.cuotas_en_mora IS DISTINCT FROM v.vencidas
           OR COALESCE(cr.dias_mora_maximo, 0) < v.dias);
END;
$function$;

-- Verificación (solo lectura), después de ejecutar SELECT fn_detectar_mora():
--   SELECT count(*) FROM credito cr
--   WHERE cr.estado_credito = 'EN_MORA' AND EXISTS (
--     SELECT 1 FROM plan_pago pp JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
--     WHERE pp.id_credito = cr.id_credito AND c.estado_cuota NOT IN ('PAGADA','PAGADA_MORA')
--       AND ((now() AT TIME ZONE 'America/Bogota')::date - c.fecha_vencimiento) > COALESCE(cr.dias_mora_maximo,0));
--   -- esperado: 0
