-- ============================================================
-- PLURALL — Migración 30: Pago de varias cuotas en una transacción
-- Ejecutar después de 29_fix_pago_estado_procesando.sql
-- ============================================================
-- Contexto:
--   Un pago Wompi podía cubrir una sola cuota (pago.id_cuota es un FK único).
--   Ahora el cliente puede pagar N cuotas por adelantado en una única
--   transacción. Para no romper el modelo (id_cuota sigue apuntando a la
--   primera cuota cubierta, para compatibilidad y visualización) se agrega
--   una columna jsonb con el detalle de TODAS las cuotas que el pago cubre.
--
-- Estructura de cada elemento de cuotas_cubiertas:
--   {
--     "id_cuota": uuid,
--     "numero_cuota": int,
--     "monto_total_cuota": numeric,
--     "monto_capital": numeric,
--     "monto_interes": numeric,
--     "monto_mora": numeric,
--     "estado_previo": text
--   }
--
-- NULL o [] => pago de una sola cuota (comportamiento legacy).
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE pago
  ADD COLUMN IF NOT EXISTS cuotas_cubiertas jsonb;

COMMENT ON COLUMN pago.cuotas_cubiertas IS
  'Detalle de las cuotas cubiertas por un pago multi-cuota (jsonb array). NULL = pago de una sola cuota (id_cuota).';
