-- =============================================================================
-- 40 · Validaciones de monto, plazo y tasa en BD (M-15..M-18 — 29-oct-2026)
-- Se crean NOT VALID (aplican a toda fila nueva o modificada) y se validan las
-- que no tienen filas previas inválidas. Quedan SIN validar:
--   chk_credito_numero_cuotas y chk_decision_plazo: existe 1 crédito ACTIVO de
--   prueba con -36 cuotas y su decisión (caso M-18). Esa fila ya no podrá
--   modificarse sin corregir el plazo; requiere revisión manual.
-- =============================================================================
ALTER TABLE public.credito
  ADD CONSTRAINT chk_credito_numero_cuotas  CHECK (numero_cuotas > 0) NOT VALID,
  ADD CONSTRAINT chk_credito_monto          CHECK (monto_desembolsado > 0) NOT VALID,
  ADD CONSTRAINT chk_credito_tasas          CHECK (tasa_interes_anual >= 0 AND tasa_interes_mensual >= 0) NOT VALID,
  ADD CONSTRAINT chk_credito_saldo          CHECK (saldo_pendiente >= 0) NOT VALID;

ALTER TABLE public.decision_solicitud
  ADD CONSTRAINT chk_decision_monto CHECK (monto_aprobado IS NULL OR monto_aprobado > 0) NOT VALID,
  ADD CONSTRAINT chk_decision_plazo CHECK (plazo_aprobado IS NULL OR plazo_aprobado > 0) NOT VALID,
  ADD CONSTRAINT chk_decision_tasa  CHECK (tasa_interes_aprobada IS NULL OR tasa_interes_aprobada > 0) NOT VALID;

ALTER TABLE public.credito            VALIDATE CONSTRAINT chk_credito_monto;
ALTER TABLE public.credito            VALIDATE CONSTRAINT chk_credito_tasas;
ALTER TABLE public.credito            VALIDATE CONSTRAINT chk_credito_saldo;
ALTER TABLE public.decision_solicitud VALIDATE CONSTRAINT chk_decision_monto;
ALTER TABLE public.decision_solicitud VALIDATE CONSTRAINT chk_decision_tasa;
