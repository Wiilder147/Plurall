-- ============================================================
-- PLURALL — Migración 33: no crear cliente fantasma sin celular
-- Ejecutar después de 32_fn_usuario_existe_por_celular.sql
-- ============================================================
-- Contexto:
--   handle_new_user_registration() crea un cliente para CADA usuario nuevo de
--   auth.users y, si el metadata no trae 'telefono', lo dejaba en '0000000000'.
--   Al ingresar con Google (solo para autocompletar el registro) Supabase crea
--   un usuario auth SIN telefono → se generaba un cliente fantasma con
--   0000000000. El registro real por celular siempre envía el telefono.
--
-- Fix: si el registro no trae celular, no se crea perfil ni cliente
--      (RETURN NEW). Así no quedan clientes con 0000000000.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_telefono  TEXT;
BEGIN
  -- Solo registramos cliente cuando el alta trae un celular real. El ingreso
  -- con Google (autocompletar) crea un usuario auth sin telefono: en ese caso
  -- no se crea cliente fantasma (evita el 0000000000).
  v_telefono := NULLIF(NEW.raw_user_meta_data->>'telefono', '');
  IF v_telefono IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id_rol            INTO v_rol_id    FROM public.rol            WHERE nombre_rol ILIKE 'CLIENTE' LIMIT 1;
  SELECT id_estado_cliente INTO v_estado_id FROM public.estado_cliente WHERE nombre    ILIKE 'ACTIVO'  LIMIT 1;

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
    INSERT INTO public.perfil_usuario (id, id_rol)
    VALUES (NEW.id, v_rol_id)
    ON CONFLICT (id) DO NOTHING;

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
      v_telefono
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.log_error_registro (id_auth_user, email_auth, error_detalle, metadata)
    VALUES (NEW.id, NEW.email, SQLERRM, NEW.raw_user_meta_data);
    RETURN NEW;
  END;

  RETURN NEW;
END;
$function$;
