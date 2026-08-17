-- ============================================================
-- PLURALL — Migración 29: Corregir estados válidos del pago + UNIQUE referencia
-- Ejecutar después de 28_wompi_pagos.sql
-- ============================================================
-- Contexto:
--   El flujo de pago Wompi pre-registra el pago en estado 'PROCESANDO'
--   (apps/web/app/api/pagos/iniciar/route.js) antes de redirigir al widget.
--   Sin embargo, ck_pago_estado (definido en db/16 y en el schema maestro)
--   NUNCA incluyó 'PROCESANDO', por lo que el INSERT del pre-registro violaba
--   el CHECK y devolvía 500 "No se pudo iniciar el pago. Intenta más tarde.".
--   Además, el DEFAULT de la columna es 'PROCESANDO', que contradecía su
--   propio CHECK.
--
-- Contenido:
--   1. Recrear ck_pago_estado incluyendo 'PROCESANDO' (estado transitorio del
--      flujo: PROCESANDO -> CONFIRMADO | FALLIDO).
--   2. Añadir el UNIQUE en pago.referencia_externa que la migración 28
--      pretendía crear pero no se aplicó en la BD (el webhook confía en él
--      para idempotencia — RN-21).
-- Idempotente: puede reejecutarse sin efectos secundarios.
-- ============================================================

-- 1. Estados válidos del pago (incluye el transitorio 'PROCESANDO')
ALTER TABLE pago DROP CONSTRAINT IF EXISTS ck_pago_estado;
ALTER TABLE pago ADD CONSTRAINT ck_pago_estado
  CHECK (estado IN ('PROCESANDO','CONFIRMADO','PENDIENTE','FALLIDO','RECHAZADO','REVERSADO')) NOT VALID;
ALTER TABLE pago VALIDATE CONSTRAINT ck_pago_estado;

-- 2. UNIQUE en referencia_externa (idempotencia del webhook)
--    Se limpia cualquier duplicado eventual (conserva la fila más antigua)
--    antes de crear la restricción. Los NULL no colisionan en Postgres.
DELETE FROM pago a
USING pago b
WHERE a.referencia_externa IS NOT NULL
  AND a.referencia_externa = b.referencia_externa
  AND a.created_at > b.created_at
  AND a.id_recibo <> b.id_recibo;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pago_referencia_externa_key'
  ) THEN
    ALTER TABLE pago
      ADD CONSTRAINT pago_referencia_externa_key UNIQUE (referencia_externa);
  END IF;
END $$;
