-- ============================================================
-- PLURALL — Migración 20: Disponibilidad de correo/documento en registro
-- Ejecutar después de 19_ampliar_ck_doc_tipo.sql
-- ============================================================
-- Problema: el registro crea la cuenta de auth con el CELULAR como identidad
-- única, pero el correo real y el documento (dni) solo se validan al insertar
-- en `cliente` (UNIQUE en email y dni). El trigger usaba ON CONFLICT DO NOTHING,
-- así que un correo/dni repetido se saltaba en SILENCIO y quedaba una "cuenta
-- fantasma": auth + perfil pero SIN cliente → "No encontramos tu perfil".
--
-- Solución:
--   1. fn_verificar_disponibilidad(): el frontend la llama ANTES de signUp
--      para avisar con un mensaje claro si el correo o el documento ya existen.
--   2. handle_new_user_registration(): se quita el ON CONFLICT silencioso del
--      insert de `cliente`; ahora un conflicto queda registrado en
--      log_error_registro (evidencia) en lugar de crear una cuenta fantasma.
-- ============================================================


-- ============================================================
-- 1. DISPONIBILIDAD DE CORREO / DOCUMENTO (pre-registro)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_verificar_disponibilidad(
  p_email TEXT DEFAULT NULL,
  p_dni   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_email_ok BOOLEAN := TRUE;
  v_dni_ok   BOOLEAN := TRUE;
BEGIN
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_email_ok := NOT EXISTS (
      SELECT 1 FROM cliente WHERE lower(email) = lower(trim(p_email))
    );
  END IF;

  IF p_dni IS NOT NULL AND length(trim(p_dni)) > 0 THEN
    v_dni_ok := NOT EXISTS (
      SELECT 1 FROM cliente WHERE dni = trim(p_dni)
    );
  END IF;

  RETURN jsonb_build_object(
    'email_disponible', v_email_ok,
    'dni_disponible',   v_dni_ok
  );
END;
$$;

-- El registro lo llama un usuario anónimo (aún no autenticado)
GRANT EXECUTE ON FUNCTION public.fn_verificar_disponibilidad(TEXT, TEXT) TO anon, authenticated;


-- ============================================================
-- 2. TRIGGER DE REGISTRO — sin conflicto silencioso en `cliente`
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_id    UUID;
  v_estado_id UUID;
  v_dni       TEXT;
  v_parsed    RECORD;
  v_pn        TEXT;
  v_sn        TEXT;
  v_pa        TEXT;
  v_sa        TEXT;
  v_raw_name  TEXT;
BEGIN
  SELECT id_rol            INTO v_rol_id    FROM public.rol            WHERE nombre_rol ILIKE 'CLIENTE' LIMIT 1;
  SELECT id_estado_cliente INTO v_estado_id FROM public.estado_cliente WHERE nombre    ILIKE 'ACTIVO'  LIMIT 1;

  -- Preferir partes atómicas; si no, parsear full_name / name / legado nombre_completo
  v_pn := NULLIF(trim(NEW.raw_user_meta_data->>'primer_nombre'), '');
  v_sn := NULLIF(trim(NEW.raw_user_meta_data->>'segundo_nombre'), '');
  v_pa := NULLIF(trim(NEW.raw_user_meta_data->>'primer_apellido'), '');
  v_sa := NULLIF(trim(NEW.raw_user_meta_data->>'segundo_apellido'), '');

  IF v_pn IS NULL THEN
    v_raw_name := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'nombre_completo', '')
    );
    SELECT * INTO v_parsed FROM fn_parse_nombre(v_raw_name);
    v_pn := v_parsed.primer_nombre;
    v_sn := v_parsed.segundo_nombre;
    v_pa := v_parsed.primer_apellido;
    v_sa := v_parsed.segundo_apellido;
  END IF;

  v_pn := COALESCE(NULLIF(trim(v_pn), ''), 'SIN');
  v_pa := COALESCE(NULLIF(trim(v_pa), ''), 'NOMBRE');

  v_dni := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'dni', ''),
    'SN' || substr(replace(NEW.id::text, '-', ''), 1, 16)
  );

  BEGIN
    -- Perfil de CLIENTE: sin nombre (canónico en cliente)
    INSERT INTO public.perfil_usuario (id, id_rol)
    VALUES (NEW.id, v_rol_id)
    ON CONFLICT (id) DO NOTHING;

    -- Sin ON CONFLICT: si el correo o el documento ya existen, el UNIQUE lanza
    -- excepción y cae al bloque EXCEPTION, dejando evidencia en log_error_registro
    -- (el frontend valida disponibilidad antes de llegar aquí).
    INSERT INTO public.cliente (
      id_usuario_cuenta,
      id_estado_cliente,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      dni,
      email,
      telefono
    )
    VALUES (
      NEW.id,
      v_estado_id,
      v_pn,
      v_sn,
      v_pa,
      v_sa,
      v_dni,
      COALESCE(NEW.raw_user_meta_data->>'email_real', NEW.email),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'telefono', ''), '0000000000')
    );
  EXCEPTION WHEN OTHERS THEN
    -- El usuario se crea igual en auth.users (no bloqueamos el registro),
    -- pero queda evidencia para reparar/depurar el usuario fantasma
    INSERT INTO public.log_error_registro (id_auth_user, email_auth, error_detalle, metadata)
    VALUES (NEW.id, NEW.email, SQLERRM, NEW.raw_user_meta_data);
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$;
