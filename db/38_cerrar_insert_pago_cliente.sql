-- =============================================================================
-- 38 · Cerrar inserción de pagos por el cliente (M4 — auditoría QA 29-oct-2026)
-- La política registrar_pago_autenticado permitía a un CLIENTE insertar filas en
-- `pago` de su propio crédito con cualquier estado (incl. CONFIRMADO) vía
-- PostgREST: recibos falsos en reportes de recaudo. Todas las inserciones
-- legítimas usan service-role (webhook Wompi, pagos/iniciar, asesor/gestion),
-- que no pasa por RLS. Se conserva staff_insertar_pago.
-- =============================================================================
DROP POLICY IF EXISTS registrar_pago_autenticado ON public.pago;
