-- ============================================================
-- PLURALL — Migración 12: Endurecimiento de seguridad
-- Ejecutar después de 11_ponderacion_score_numerico.sql
-- ============================================================
-- Contenido:
--   1. es_staff(): helper para ADMIN / SUPERVISOR / ASESOR.
--   2. Cierre de políticas RLS abiertas:
--      · pago: solo staff puede insertar con sesión de usuario
--        (el webhook de Wompi usa service role y no pasa por RLS).
--      · cliente: se elimina el INSERT abierto; el alta la hace el
--        trigger handle_new_user_registration (SECURITY DEFINER,
--        no pasa por RLS) o el service role de los scripts.
--   3. log_error_registro + handle_new_user_registration robusto:
--      ya no traga errores en silencio (usuarios fantasma).
-- ============================================================


-- ============================================================
-- 1. HELPER es_staff()
-- ============================================================

CREATE OR REPLACE FUNCTION es_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR', 'ASESOR')
          AND pu.activo = true
    );
$$;


-- ============================================================
-- 2. CIERRE DE POLÍTICAS RLS
-- ============================================================

-- pago: antes WITH CHECK (true) — cualquier usuario autenticado podía
-- insertar pagos. Ahora solo staff (los asesores registran pagos en
-- /api/asesor/gestion con sesión de usuario).
DROP POLICY IF EXISTS "sistema_insertar_pago" ON pago;
CREATE POLICY "staff_insertar_pago" ON pago
    FOR INSERT WITH CHECK (es_staff());

-- cliente: antes WITH CHECK (true). El alta de clientes ocurre vía
-- trigger SECURITY DEFINER sobre auth.users o con service role, ninguno
-- de los dos pasa por RLS, así que no se necesita política de INSERT
-- para usuarios finales.
DROP POLICY IF EXISTS "sistema_insertar_cliente" ON cliente;


-- ============================================================
-- 3. REGISTRO SIN ERRORES SILENCIOSOS
-- ============================================================

CREATE TABLE IF NOT EXISTS log_error_registro (
    id_log        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_auth_user  UUID,
    email_auth    TEXT,
    error_detalle TEXT,
    metadata      JSONB,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE log_error_registro IS
  'Errores del trigger handle_new_user_registration. Si hay filas aquí existen usuarios en auth.users sin fila en cliente/perfil_usuario que hay que reparar';

ALTER TABLE log_error_registro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_ver_log_registro" ON log_error_registro;
CREATE POLICY "admin_ver_log_registro" ON log_error_registro
    FOR SELECT USING (es_admin());

-- Misma lógica que antes, pero el EXCEPTION ahora deja evidencia
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_id UUID;
  v_estado_id UUID;
BEGIN
  SELECT id_rol INTO v_rol_id FROM public.rol WHERE nombre_rol ILIKE 'CLIENTE' LIMIT 1;
  SELECT id_estado_cliente INTO v_estado_id FROM public.estado_cliente WHERE nombre ILIKE 'ACTIVO' LIMIT 1;

  BEGIN
    INSERT INTO public.perfil_usuario (id, id_rol, nombre_completo)
    VALUES (NEW.id, v_rol_id, NEW.raw_user_meta_data->>'nombre_completo')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.cliente (
      id_usuario_cuenta,
      id_estado_cliente,
      nombre_completo,
      dni,
      email,
      telefono
    )
    VALUES (
      NEW.id,
      v_estado_id,
      NEW.raw_user_meta_data->>'nombre_completo',
      COALESCE(NEW.raw_user_meta_data->>'dni', 'SN-' || NEW.id),
      COALESCE(NEW.raw_user_meta_data->>'email_real', NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'telefono', '0000000000')
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- El usuario se crea igual en auth.users (no bloqueamos el registro),
    -- pero queda evidencia para reparar el usuario fantasma
    INSERT INTO public.log_error_registro (id_auth_user, email_auth, error_detalle, metadata)
    VALUES (NEW.id, NEW.email, SQLERRM, NEW.raw_user_meta_data);
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$;
