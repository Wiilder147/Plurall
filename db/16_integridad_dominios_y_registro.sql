-- ============================================================
-- PLURALL — Migración 16: Integridad, dominios y fix de registro
-- Ejecutar después de 15_fix_tipo_input_opciones.sql
-- ============================================================
-- Contenido (todo NO destructivo y compatible con la app actual):
--   1. FIX del trigger de registro OAuth (handle_new_user_registration):
--      · dni placeholder que cabe en varchar(20) (causa del error
--        "value too long for type character varying(20)" en logins Google).
--      · Soporta el nombre de Google (full_name / name), no solo
--        el 'nombre_completo' del registro propio.
--   2. Reparación de usuarios "fantasma" reales (auth.users sin perfil/cliente),
--      excluyendo las cuentas semilla @plurall.app.
--   3. CHECK constraints de dominio en columnas de estado tipo texto
--      (credito, cuota, pago, documento, decision, score, solicitud).
--   4. Índices de cobertura para las 21 FKs sin índice (rendimiento).
--   5. search_path fijo en 6 funciones (linter de seguridad Supabase).
--
-- NOTA: los refactores estructurales (precisión numeric, tabla
--   direccion_cliente, FK a banco/departamento, cifrado de PII) van en
--   una migración aparte (17) porque requieren recrear vistas de
--   reportería y ajustar el frontend. Ver comentarios al final.
-- ============================================================


-- ============================================================
-- 1. FIX DEL TRIGGER DE REGISTRO (OAuth Google + registro propio)
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

  -- dni: si el proveedor no lo entrega (OAuth), generar un placeholder
  -- único que quepa en cliente.dni varchar(20). 'SN' + 16 hex = 18 chars.
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
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- No bloqueamos el alta en auth.users; dejamos evidencia para reparar
    INSERT INTO public.log_error_registro (id_auth_user, email_auth, error_detalle, metadata)
    VALUES (NEW.id, NEW.email, SQLERRM, NEW.raw_user_meta_data);
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 2. REPARACIÓN DE USUARIOS FANTASMA REALES
--    (auth.users sin perfil, excluyendo cuentas semilla @plurall.app)
-- ============================================================

DO $$
DECLARE
  u          RECORD;
  v_rol_id   UUID;
  v_estado_id UUID;
  v_parsed   RECORD;
  v_pn       TEXT;
  v_sn       TEXT;
  v_pa       TEXT;
  v_sa       TEXT;
  v_raw_name TEXT;
  v_dni      TEXT;
BEGIN
  SELECT id_rol            INTO v_rol_id    FROM public.rol            WHERE nombre_rol ILIKE 'CLIENTE' LIMIT 1;
  SELECT id_estado_cliente INTO v_estado_id FROM public.estado_cliente WHERE nombre    ILIKE 'ACTIVO'  LIMIT 1;

  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data AS md
    FROM auth.users au
    LEFT JOIN public.perfil_usuario p ON p.id = au.id
    WHERE p.id IS NULL
      AND au.email NOT ILIKE '%@plurall.app'   -- respeta cuentas semilla/técnicas
  LOOP
    v_pn := NULLIF(trim(u.md->>'primer_nombre'), '');
    v_sn := NULLIF(trim(u.md->>'segundo_nombre'), '');
    v_pa := NULLIF(trim(u.md->>'primer_apellido'), '');
    v_sa := NULLIF(trim(u.md->>'segundo_apellido'), '');

    IF v_pn IS NULL THEN
      v_raw_name := COALESCE(
        NULLIF(u.md->>'full_name', ''),
        NULLIF(u.md->>'name', ''),
        NULLIF(u.md->>'nombre_completo', '')
      );
      SELECT * INTO v_parsed FROM fn_parse_nombre(v_raw_name);
      v_pn := v_parsed.primer_nombre;
      v_sn := v_parsed.segundo_nombre;
      v_pa := v_parsed.primer_apellido;
      v_sa := v_parsed.segundo_apellido;
    END IF;

    v_pn := COALESCE(NULLIF(trim(v_pn), ''), 'SIN');
    v_pa := COALESCE(NULLIF(trim(v_pa), ''), 'NOMBRE');
    v_dni := COALESCE(NULLIF(u.md->>'dni',''), 'SN' || substr(replace(u.id::text,'-',''),1,16));

    INSERT INTO public.perfil_usuario (id, id_rol)
    VALUES (u.id, v_rol_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.cliente (
      id_usuario_cuenta, id_estado_cliente,
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      dni, email, telefono
    )
    VALUES (
      u.id, v_estado_id, v_pn, v_sn, v_pa, v_sa, v_dni,
      COALESCE(u.md->>'email_real', u.email),
      COALESCE(NULLIF(u.md->>'telefono',''), '0000000000')
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Reparado usuario fantasma: %', u.email;
  END LOOP;
END $$;


-- ============================================================
-- 3. DOMINIOS CERRADOS EN COLUMNAS DE ESTADO (CHECK constraints)
--    Domi­nios derivados de los datos actuales + literales usados en la app.
--    Se usa NOT VALID + VALIDATE para no bloquear la tabla en el ADD.
-- ============================================================

-- credito.estado_credito
ALTER TABLE credito DROP CONSTRAINT IF EXISTS ck_credito_estado;
ALTER TABLE credito ADD CONSTRAINT ck_credito_estado
  CHECK (estado_credito IN ('ACTIVO','EN_MORA','PAGADO','CANCELADO','CASTIGADO')) NOT VALID;
ALTER TABLE credito VALIDATE CONSTRAINT ck_credito_estado;

-- cuota.estado_cuota
ALTER TABLE cuota DROP CONSTRAINT IF EXISTS ck_cuota_estado;
ALTER TABLE cuota ADD CONSTRAINT ck_cuota_estado
  CHECK (estado_cuota IN ('PENDIENTE','PAGADA','PAGADA_MORA','VENCIDA')) NOT VALID;
ALTER TABLE cuota VALIDATE CONSTRAINT ck_cuota_estado;

-- pago.estado
ALTER TABLE pago DROP CONSTRAINT IF EXISTS ck_pago_estado;
ALTER TABLE pago ADD CONSTRAINT ck_pago_estado
  CHECK (estado IN ('CONFIRMADO','PENDIENTE','FALLIDO','RECHAZADO','REVERSADO')) NOT VALID;
ALTER TABLE pago VALIDATE CONSTRAINT ck_pago_estado;

-- pago.metodo_pago
ALTER TABLE pago DROP CONSTRAINT IF EXISTS ck_pago_metodo;
ALTER TABLE pago ADD CONSTRAINT ck_pago_metodo
  CHECK (metodo_pago IN ('EFECTIVO','PSE','TRANSFERENCIA','WOMPI','TARJETA','NEQUI','DAVIPLATA')) NOT VALID;
ALTER TABLE pago VALIDATE CONSTRAINT ck_pago_metodo;

-- documento_cliente.estado_verificacion
ALTER TABLE documento_cliente DROP CONSTRAINT IF EXISTS ck_doc_estado_verif;
ALTER TABLE documento_cliente ADD CONSTRAINT ck_doc_estado_verif
  CHECK (estado_verificacion IN ('PENDIENTE','APROBADO','RECHAZADO')) NOT VALID;
ALTER TABLE documento_cliente VALIDATE CONSTRAINT ck_doc_estado_verif;

-- documento_cliente.tipo_documento
ALTER TABLE documento_cliente DROP CONSTRAINT IF EXISTS ck_doc_tipo;
ALTER TABLE documento_cliente ADD CONSTRAINT ck_doc_tipo
  CHECK (tipo_documento IN ('CEDULA_FRONTAL','CEDULA_TRASERA','RECIBO_PUBLICO','SELFIE','RUT','OTRO')) NOT VALID;
ALTER TABLE documento_cliente VALIDATE CONSTRAINT ck_doc_tipo;

-- decision_solicitud.resultado (nullable)
ALTER TABLE decision_solicitud DROP CONSTRAINT IF EXISTS ck_decision_resultado;
ALTER TABLE decision_solicitud ADD CONSTRAINT ck_decision_resultado
  CHECK (resultado IS NULL OR resultado IN ('APROBADO','RECHAZADO','PREAPROBADO')) NOT VALID;
ALTER TABLE decision_solicitud VALIDATE CONSTRAINT ck_decision_resultado;

-- score.recomendacion (nullable; se aceptan las 2 variantes históricas)
ALTER TABLE score DROP CONSTRAINT IF EXISTS ck_score_recomendacion;
ALTER TABLE score ADD CONSTRAINT ck_score_recomendacion
  CHECK (recomendacion IS NULL OR recomendacion IN ('APROBAR','RECHAZAR','REVISAR_MANUAL','REVISION_MANUAL')) NOT VALID;
ALTER TABLE score VALIDATE CONSTRAINT ck_score_recomendacion;

-- solicitud_credito.canal_solicitud
ALTER TABLE solicitud_credito DROP CONSTRAINT IF EXISTS ck_solicitud_canal;
ALTER TABLE solicitud_credito ADD CONSTRAINT ck_solicitud_canal
  CHECK (canal_solicitud IN ('WEB','APP','PRESENCIAL','TELEFONO','ASESOR')) NOT VALID;
ALTER TABLE solicitud_credito VALIDATE CONSTRAINT ck_solicitud_canal;


-- ============================================================
-- 4. ÍNDICES DE COBERTURA PARA FKs (21 detectadas por el advisor)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cliente_id_tipo_doc                ON cliente(id_tipo_doc);
CREATE INDEX IF NOT EXISTS idx_cliente_id_tipo_negocio            ON cliente(id_tipo_negocio);
CREATE INDEX IF NOT EXISTS idx_decision_id_analista               ON decision_solicitud(id_analista);
CREATE INDEX IF NOT EXISTS idx_decision_id_motivo_rechazo         ON decision_solicitud(id_motivo_rechazo);
CREATE INDEX IF NOT EXISTS idx_decision_id_solicitud              ON decision_solicitud(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_doccliente_verificado_por          ON documento_cliente(verificado_por);
CREATE INDEX IF NOT EXISTS idx_doclegal_id_tipo_doc_legal         ON documento_legal(id_tipo_doc_legal);
CREATE INDEX IF NOT EXISTS idx_evento_funnel_id_solicitud         ON evento_funnel(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_logdesc_id_documento_legal         ON log_descarga_documento(id_documento_legal);
CREATE INDEX IF NOT EXISTS idx_notif_id_credito                   ON notificacion(id_credito);
CREATE INDEX IF NOT EXISTS idx_notif_id_solicitud                 ON notificacion(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_notif_id_tipo_notif                ON notificacion(id_tipo_notif);
CREATE INDEX IF NOT EXISTS idx_opcion_id_pregunta                 ON opcion_pregunta(id_pregunta);
CREATE INDEX IF NOT EXISTS idx_pago_id_usuario_receptor           ON pago(id_usuario_receptor);
CREATE INDEX IF NOT EXISTS idx_perfil_id_rol                      ON perfil_usuario(id_rol);
CREATE INDEX IF NOT EXISTS idx_pqr_id_respondido_por              ON pqr(id_respondido_por);
CREATE INDEX IF NOT EXISTS idx_respuesta_id_opcion                ON respuesta_cliente(id_opcion);
CREATE INDEX IF NOT EXISTS idx_respuesta_id_solicitud             ON respuesta_cliente(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_score_id_modelo_score              ON score(id_modelo_score);
CREATE INDEX IF NOT EXISTS idx_score_id_solicitud                 ON score(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitud_id_motivo_rechazo        ON solicitud_credito(id_motivo_rechazo);


-- ============================================================
-- 5. HARDENING: search_path fijo (linter Supabase 0011)
-- ============================================================

ALTER FUNCTION public.es_analista_o_admin()          SET search_path = public;
ALTER FUNCTION public.es_supervisor_o_admin()        SET search_path = public;
ALTER FUNCTION public.fn_auditar_registros()         SET search_path = public;
ALTER FUNCTION public.fn_registrar_auditoria()       SET search_path = public;
ALTER FUNCTION public.proteger_solicitud_trimestral() SET search_path = public;
ALTER FUNCTION public.auto_confirm_user()            SET search_path = public;


-- ============================================================
-- 6. VERIFICACIÓN
-- ============================================================
SELECT 'auth_sin_perfil_no_semilla' chk,
       count(*) n
FROM auth.users u
LEFT JOIN perfil_usuario p ON p.id = u.id
WHERE p.id IS NULL AND u.email NOT ILIKE '%@plurall.app';


-- ============================================================
-- FASE 2 (NO incluida aquí — requiere recrear vistas + tocar frontend):
--   A. Precisión numérica: dinero -> numeric(14,2), tasas -> numeric(9,6).
--      Bloqueado por vistas de reportería (02_vistas_reporteria) que
--      referencian estas columnas: hay que DROP/CREATE las vistas.
--   B. Tabla direccion_cliente(tipo CASA|NEGOCIO) para eliminar el grupo
--      repetido y los campos legacy direccion/ciudad/departamento en cliente.
--   C. FK real a banco (detalle_cliente.banco_preferido) y a departamento
--      (direccion) sustituyendo el texto libre.
--   D. Aislar y cifrar PII: cliente.dni y detalle_cliente.numero_cuenta
--      (pgcrypto / tabla cuenta_bancaria con RLS estricta) — Ley 1581.
-- ============================================================
