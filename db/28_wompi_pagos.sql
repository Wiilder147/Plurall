-- ============================================================
-- PLURALL — Migración 23: Endurecimiento del módulo de pagos Wompi
-- Ejecutar después de 22_unique_asesor_activo.sql
-- ============================================================
-- Contenido:
--   1. UNIQUE en pago.referencia_externa: el webhook de Wompi
--      confía en esto para idempotencia (RN-21).
--   2. Índice para búsquedas rápidas del webhook y la página de
--      confirmación por referencia.
-- ============================================================

-- 1. Limpiar duplicados eventuales (se conserva la fila más antigua)
DELETE FROM pago a
USING pago b
WHERE a.referencia_externa IS NOT NULL
  AND a.referencia_externa = b.referencia_externa
  AND a.created_at > b.created_at
  AND a.id_recibo <> b.id_recibo;

-- 2. UNIQUE constraint — el webhook usa la referencia como llave natural
ALTER TABLE pago
  ADD CONSTRAINT pago_referencia_externa_key UNIQUE (referencia_externa);

-- 3. Índice para lookups por referencia (webhook + confirmación)
CREATE INDEX IF NOT EXISTS idx_pago_referencia_externa ON pago (referencia_externa);