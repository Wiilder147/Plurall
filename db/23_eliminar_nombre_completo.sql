-- ============================================================
-- PLURALL — Migración 23: Eliminar nombre_completo (1B + 2A)
-- Ejecutar en Supabase SQL Editor DESPUÉS de desplegar el código
-- que ya no selecciona/inserta nombre_completo (o en el mismo
-- release: SQL primero + deploy inmediato de la app).
-- ============================================================
-- Decisiones:
--   1B — Se elimina la columna nombre_completo (no generada).
--   2A — Nombre canónico de clientes solo en `cliente`.
--        En `perfil_usuario` las 4 partes quedan solo para roles
--        internos (ASESOR / SUPERVISOR / ADMIN).
-- ============================================================


-- ============================================================
-- 1. Asegurar columnas atómicas + fn_parse_nombre
-- ============================================================

ALTER TABLE cliente
  ADD COLUMN IF NOT EXISTS primer_nombre    VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_nombre   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS primer_apellido  VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_apellido VARCHAR(60);

ALTER TABLE perfil_usuario
  ADD COLUMN IF NOT EXISTS primer_nombre    VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_nombre   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS primer_apellido  VARCHAR(60),
  ADD COLUMN IF NOT EXISTS segundo_apellido VARCHAR(60);

CREATE OR REPLACE FUNCTION fn_parse_nombre(
    p_nombre TEXT,
    OUT primer_nombre    TEXT,
    OUT segundo_nombre   TEXT,
    OUT primer_apellido  TEXT,
    OUT segundo_apellido TEXT
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    partes TEXT[];
    n INT;
BEGIN
    partes := regexp_split_to_array(
        trim(regexp_replace(COALESCE(p_nombre, ''), '\s+', ' ', 'g')), ' ');
    n := COALESCE(array_length(partes, 1), 0);

    IF n = 0 OR partes[1] = '' THEN
        RETURN;
    ELSIF n = 1 THEN
        primer_nombre := partes[1];
    ELSIF n = 2 THEN
        primer_nombre   := partes[1];
        primer_apellido := partes[2];
    ELSIF n = 3 THEN
        primer_nombre    := partes[1];
        primer_apellido  := partes[2];
        segundo_apellido := partes[3];
    ELSE
        primer_nombre    := partes[1];
        segundo_nombre   := array_to_string(partes[2:n-2], ' ');
        primer_apellido  := partes[n-1];
        segundo_apellido := partes[n];
    END IF;
END;
$$;

-- Helper de presentación (opcional en SQL / reportes)
CREATE OR REPLACE FUNCTION fn_format_nombre(
  p_primer_nombre    TEXT,
  p_segundo_nombre   TEXT DEFAULT NULL,
  p_primer_apellido  TEXT DEFAULT NULL,
  p_segundo_apellido TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(trim(concat_ws(' ',
    NULLIF(trim(p_primer_nombre), ''),
    NULLIF(trim(p_segundo_nombre), ''),
    NULLIF(trim(p_primer_apellido), ''),
    NULLIF(trim(p_segundo_apellido), '')
  )), '');
$$;


-- ============================================================
-- 2. Backfill desde nombre_completo (si la columna aún existe)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cliente' AND column_name = 'nombre_completo'
  ) THEN
    UPDATE cliente
    SET (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido) =
        (SELECT p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido
           FROM fn_parse_nombre(cliente.nombre_completo) p)
    WHERE primer_nombre IS NULL
      AND nombre_completo IS NOT NULL
      AND trim(nombre_completo) <> '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'perfil_usuario' AND column_name = 'nombre_completo'
  ) THEN
    UPDATE perfil_usuario
    SET (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido) =
        (SELECT p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido
           FROM fn_parse_nombre(perfil_usuario.nombre_completo) p)
    WHERE primer_nombre IS NULL
      AND nombre_completo IS NOT NULL
      AND trim(nombre_completo) <> '';
  END IF;
END $$;

-- Mínimos usables en cliente antes del NOT NULL
UPDATE cliente
SET primer_nombre = COALESCE(NULLIF(trim(primer_nombre), ''), 'SIN')
WHERE primer_nombre IS NULL OR trim(primer_nombre) = '';

UPDATE cliente
SET primer_apellido = COALESCE(NULLIF(trim(primer_apellido), ''), 'NOMBRE')
WHERE primer_apellido IS NULL OR trim(primer_apellido) = '';


-- ============================================================
-- 3. Regla 2A — limpiar nombre en perfil_usuario de CLIENTES
-- ============================================================

UPDATE perfil_usuario p
SET
  primer_nombre    = NULL,
  segundo_nombre   = NULL,
  primer_apellido  = NULL,
  segundo_apellido = NULL
FROM rol r
WHERE p.id_rol = r.id_rol
  AND r.nombre_rol ILIKE 'CLIENTE';


-- ============================================================
-- 4. Quitar triggers de sync de nombre_completo
-- ============================================================

DROP TRIGGER IF EXISTS trg_sync_nombre_cliente ON cliente;
DROP TRIGGER IF EXISTS trg_sync_nombre_perfil ON perfil_usuario;
DROP FUNCTION IF EXISTS fn_sincronizar_nombre();


-- ============================================================
-- 5. Trigger de registro — metadata atómica + nombre solo en cliente
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
    INSERT INTO public.log_error_registro (id_auth_user, email_auth, error_detalle, metadata)
    VALUES (NEW.id, NEW.email, SQLERRM, NEW.raw_user_meta_data);
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 6. DROP nombre_completo
-- ============================================================

ALTER TABLE cliente        DROP COLUMN IF EXISTS nombre_completo;
ALTER TABLE perfil_usuario DROP COLUMN IF EXISTS nombre_completo;


-- ============================================================
-- 7. Constraints mínimos en cliente
-- ============================================================

ALTER TABLE cliente
  ALTER COLUMN primer_nombre SET NOT NULL,
  ALTER COLUMN primer_apellido SET NOT NULL;

COMMENT ON COLUMN cliente.primer_nombre IS
  'Fuente canónica del nombre del cliente (1FN). Concatenar en app con fn_format_nombre / formatNombre.';
COMMENT ON COLUMN cliente.primer_apellido IS
  'Fuente canónica del primer apellido del cliente (1FN).';
COMMENT ON COLUMN perfil_usuario.primer_nombre IS
  'Solo para roles internos (ASESOR/SUPERVISOR/ADMIN). Clientes: NULL; ver tabla cliente.';


-- ============================================================
-- 8. Verificación
-- ============================================================

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('cliente', 'perfil_usuario')
  AND column_name IN (
    'nombre_completo',
    'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'
  )
ORDER BY table_name, column_name;

SELECT id_cliente,
       fn_format_nombre(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido) AS nombre,
       primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
FROM cliente
LIMIT 10;
