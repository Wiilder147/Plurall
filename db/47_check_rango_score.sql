-- =============================================================================
-- 47 · CHECK de rango del score (WF-05 — defensa en profundidad, 09-nov-2026)
--
-- La causa de WF-05 (score 1140) se corrigió en la migración 44: el RPC escala
-- el puntaje crudo sobre el máximo del catálogo activo. Este CHECK no recorta
-- nada: si algún flujo futuro intenta guardar un score fuera de 0..máximo, la
-- escritura falla en vez de mostrar un dato inválido como válido.
--
-- Diagnóstico previo (solo lectura, 09-nov-2026): 15 scores, 0 fuera de rango,
-- puntaje_maximo_posible = 1000 en todos. Por eso se valida de inmediato.
-- =============================================================================
ALTER TABLE public.score
  ADD CONSTRAINT chk_score_rango
  CHECK (puntaje_total >= 0 AND puntaje_total <= COALESCE(puntaje_maximo_posible, 1000)) NOT VALID;

ALTER TABLE public.score VALIDATE CONSTRAINT chk_score_rango;
