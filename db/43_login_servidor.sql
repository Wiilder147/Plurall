-- =============================================================================
-- 43 · Soporte para login en servidor con bloqueo real (H3 — 29-oct-2026)
-- id_usuario_por_celular: igual que usuario_existe_por_celular pero devuelve el
--   id (cubre también staff, que no tiene fila en `cliente`).
-- registrar_intento_login_fallido: incremento + bloqueo en UN UPDATE atómico
--   (antes read-modify-write en la API: intentos concurrentes se perdían).
-- Ambas solo ejecutables por service_role (la ruta /api/auth/login).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.id_usuario_por_celular(cel text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE email = lower(cel) || '@plurall.app' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.registrar_intento_login_fallido(uid uuid, limite int, minutos int)
RETURNS TABLE (intentos int, bloqueado_hasta timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.perfil_usuario p
  SET intentos_fallidos = coalesce(p.intentos_fallidos, 0) + 1,
      bloqueado_hasta   = CASE WHEN coalesce(p.intentos_fallidos, 0) + 1 >= limite
                               THEN now() + make_interval(mins => minutos)
                               ELSE p.bloqueado_hasta END
  WHERE p.id = uid
  RETURNING p.intentos_fallidos, p.bloqueado_hasta;
$$;

REVOKE ALL ON FUNCTION public.id_usuario_por_celular(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_intento_login_fallido(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.id_usuario_por_celular(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_intento_login_fallido(uuid, int, int) TO service_role;
