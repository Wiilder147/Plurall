-- ============================================================
-- PLURALL — Migración 31: Saldo a favor (pago de monto libre)
-- Ejecutar después de 30_pago_multicuota.sql
-- ============================================================
-- Contexto:
--   El cliente puede pagar un monto libre (ej: $250 sobre cuotas de $100).
--   Se pagan las cuotas completas que el dinero alcance (en orden) y el
--   sobrante queda como SALDO A FAVOR del crédito, que se descuenta
--   automáticamente del próximo pago. NO se recalcula la amortización.
--
-- Contenido:
--   1. credito.saldo_a_favor : prepago acumulado que aún no completa una cuota.
--   2. pago.saldo_a_favor_delta : cambio (con signo) que este pago aplica al
--      saldo a favor del crédito cuando se confirma. Positivo = genera saldo;
--      negativo = consume saldo previo. NULL = pago sin lógica de saldo (legacy).
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE credito
  ADD COLUMN IF NOT EXISTS saldo_a_favor numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE pago
  ADD COLUMN IF NOT EXISTS saldo_a_favor_delta numeric(14,2);

COMMENT ON COLUMN credito.saldo_a_favor IS
  'Prepago del cliente que aún no completa una cuota. Se descuenta del próximo pago.';
COMMENT ON COLUMN pago.saldo_a_favor_delta IS
  'Cambio (con signo) aplicado a credito.saldo_a_favor al confirmar este pago. NULL = legacy.';
