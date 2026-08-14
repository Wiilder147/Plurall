-- ============================================================================
-- PLURALL — ESQUEMA DE BASE DE DATOS (ESTADO CONSOLIDADO)
-- ============================================================================
-- Generado por introspección de la BD viva (Supabase / proyecto Plurall-Fants)
-- el 2026-08-13. Refleja el estado REAL tras aplicar las migraciones db/01..23
-- (incluye la 23: eliminación de nombre_completo — nombres atómicos 1B+2A).
--
-- Propósito: documento de referencia del esquema. NO es la fuente de aplicación
-- (las migraciones se corren a mano en el SQL Editor, orden por número en db/).
-- Para reconstruir desde cero: correr este archivo sobre una BD Supabase limpia
-- (auth.users ya existe; los triggers sobre auth.users se crean al final).
--
-- Roles del sistema (4): ADMIN, SUPERVISOR, ASESOR, CLIENTE.
-- Convención: identidad canónica del cliente en columnas atómicas
--   (primer_nombre / segundo_nombre / primer_apellido / segundo_apellido);
--   concatenar en la app con fn_format_nombre / lib/nombre.js.
-- ============================================================================

-- ============================================================================
-- SECUENCIAS
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS agente_ticket_seq;

-- ============================================================================
-- TABLAS
-- ============================================================================

-- ---- Catálogos y parámetros --------------------------------------------------

CREATE TABLE rol (
  id_rol uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_rol character varying(50) NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE estado_cliente (
  id_estado_cliente uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying(50) NOT NULL,
  descripcion text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE estado_solicitud (
  id_estado_solicitud uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying(50) NOT NULL,
  descripcion text,
  orden integer,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE motivo_rechazo (
  id_motivo uuid NOT NULL DEFAULT gen_random_uuid(),
  descripcion_motivo text NOT NULL,
  visible_cliente boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE modelo_score (
  id_modelo_score uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_modelo character varying(100) NOT NULL,
  descripcion text,
  puntaje_minimo integer NOT NULL DEFAULT 600,
  puntaje_maximo integer NOT NULL DEFAULT 1000,
  activo boolean NOT NULL DEFAULT true,
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE tipo_documento_identidad (
  id_tipo_doc uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo character varying(10) NOT NULL,
  nombre character varying(50) NOT NULL,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE tipo_negocio (
  id_tipo_negocio uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying(100) NOT NULL,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE banco (
  id_banco uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying(100) NOT NULL,
  tipo character varying(20) NOT NULL,
  orden integer,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE departamento (
  id_departamento uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo_dane character varying(2) NOT NULL,
  nombre character varying(60) NOT NULL,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE municipio (
  id_municipio uuid NOT NULL DEFAULT gen_random_uuid(),
  id_departamento uuid NOT NULL,
  nombre character varying(80) NOT NULL,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE pregunta (
  id_pregunta uuid NOT NULL DEFAULT gen_random_uuid(),
  enunciado text NOT NULL,
  tipo_pregunta character varying(50) NOT NULL,
  orden integer,
  obligatoria boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  tipo_input character varying(20) NOT NULL DEFAULT 'TEXTO'::character varying
);

CREATE TABLE opcion_pregunta (
  id_opcion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_pregunta uuid NOT NULL,
  texto_opcion text NOT NULL,
  valor_puntos integer NOT NULL DEFAULT 0,
  orden integer,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE rango_puntaje_pregunta (
  id_rango uuid NOT NULL DEFAULT gen_random_uuid(),
  id_pregunta uuid NOT NULL,
  valor_min numeric(15,2) NOT NULL DEFAULT 0,
  valor_max numeric(15,2),
  puntos integer NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE tipo_documento_legal (
  id_tipo_doc_legal uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo character varying(30) NOT NULL,
  nombre character varying(100) NOT NULL,
  descripcion text,
  requiere_credito_cancelado boolean NOT NULL DEFAULT false,
  max_descargas_dia integer NOT NULL DEFAULT 2,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE tipo_notificacion (
  id_tipo_notif uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo character varying(50) NOT NULL,
  nombre character varying(100) NOT NULL,
  canal character varying(20) NOT NULL,
  plantilla_asunto text,
  plantilla_cuerpo text,
  activo boolean NOT NULL DEFAULT true
);

-- ---- Identidad / usuarios ----------------------------------------------------

CREATE TABLE perfil_usuario (
  id uuid NOT NULL,
  id_rol uuid NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  ultimo_login timestamp with time zone,
  intentos_fallidos integer NOT NULL DEFAULT 0,
  bloqueado_hasta timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  primer_nombre character varying(60),
  segundo_nombre character varying(60),
  primer_apellido character varying(60),
  segundo_apellido character varying(60)
);

CREATE TABLE cliente (
  id_cliente uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario_cuenta uuid NOT NULL,
  id_estado_cliente uuid NOT NULL,
  id_tipo_doc uuid,
  dni character varying(20) NOT NULL,
  email character varying(100) NOT NULL,
  telefono character varying(20) NOT NULL,
  direccion text,
  ciudad character varying(100),
  departamento character varying(100),
  nombre_negocio character varying(150),
  id_tipo_negocio uuid,
  descripcion_negocio text,
  antiguedad_negocio_meses integer,
  score_credito integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  direccion_negocio text,
  ciudad_negocio character varying(100),
  departamento_negocio character varying(100),
  lat_negocio numeric(10,7),
  lon_negocio numeric(10,7),
  direccion_casa text,
  ciudad_casa character varying(100),
  departamento_casa character varying(100),
  lat_casa numeric(10,7),
  lon_casa numeric(10,7),
  primer_nombre character varying(60) NOT NULL,
  segundo_nombre character varying(60),
  primer_apellido character varying(60) NOT NULL,
  segundo_apellido character varying(60)
);

CREATE TABLE detalle_cliente (
  id_detalle uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL,
  tipo_vivienda character varying(50),
  estrato integer,
  nivel_educativo character varying(50),
  estado_civil character varying(30),
  personas_cargo integer DEFAULT 0,
  ingresos_mensuales numeric(14,2),
  egresos_mensuales numeric(14,2),
  patrimonio_estimado numeric(14,2),
  otras_obligaciones numeric(14,2) DEFAULT 0,
  banco_preferido character varying(100),
  tipo_cuenta_bancaria character varying(30),
  numero_cuenta character varying(30),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  empleados_negocio integer DEFAULT 0,
  arriendo_negocio numeric(14,2) DEFAULT 0,
  arriendo_casa numeric(14,2) DEFAULT 0,
  dependientes integer DEFAULT 0,
  colaboracion_gastos boolean DEFAULT false,
  ahorros numeric(14,2) DEFAULT 0,
  tiene_vehiculo boolean DEFAULT false
);

CREATE TABLE documento_cliente (
  id_documento uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL,
  tipo_documento character varying(50) NOT NULL,
  url_archivo character varying(500) NOT NULL,
  mime_type character varying(100),
  tamanio_bytes bigint,
  estado_verificacion character varying(20) NOT NULL DEFAULT 'PENDIENTE'::character varying,
  motivo_rechazo_doc text,
  verificado_por uuid,
  verificado_at timestamp with time zone,
  fecha_vencimiento date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- ---- Núcleo financiero: solicitud → score → decisión → crédito → pagos -------

CREATE TABLE solicitud_credito (
  id_solicitud uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL,
  id_estado_solicitud uuid NOT NULL,
  id_usuario_evaluador uuid,
  id_motivo_rechazo uuid,
  monto_solicitado numeric(14,2) NOT NULL,
  plazo_meses integer NOT NULL,
  tasa_interes_propuesta numeric(9,6),
  proposito text,
  canal_solicitud character varying(20) NOT NULL DEFAULT 'WEB'::character varying,
  fecha_solicitud timestamp with time zone NOT NULL DEFAULT now(),
  fecha_asignacion timestamp with time zone,
  fecha_decision timestamp with time zone,
  comentarios_analista text,
  comentarios_cliente text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ip_solicitud character varying(45)
);

CREATE TABLE respuesta_cliente (
  id_respuesta uuid NOT NULL DEFAULT gen_random_uuid(),
  id_solicitud uuid NOT NULL,
  id_pregunta uuid NOT NULL,
  id_opcion uuid,
  respuesta_texto text,
  fecha_respuesta timestamp with time zone NOT NULL DEFAULT now(),
  respuesta_numerica numeric(15,2)
);

CREATE TABLE score (
  id_score uuid NOT NULL DEFAULT gen_random_uuid(),
  id_solicitud uuid NOT NULL,
  id_modelo_score uuid NOT NULL,
  puntaje_total integer NOT NULL DEFAULT 0,
  puntaje_maximo_posible integer,
  porcentaje numeric(5,2),
  recomendacion character varying(20),
  fecha_evaluacion timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE decision_solicitud (
  id_decision uuid NOT NULL DEFAULT gen_random_uuid(),
  id_solicitud uuid NOT NULL,
  id_motivo_rechazo uuid,
  id_analista uuid NOT NULL,
  resultado character varying(20) NOT NULL,
  monto_aprobado numeric(14,2),
  plazo_aprobado integer,
  tasa_interes_aprobada numeric(9,6),
  comentarios_tecnicos text,
  comentarios_cliente text,
  fecha_decision timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE credito (
  id_credito uuid NOT NULL DEFAULT gen_random_uuid(),
  id_solicitud uuid NOT NULL,
  id_cliente uuid NOT NULL,
  monto_desembolsado numeric(14,2) NOT NULL,
  tasa_interes_anual numeric(9,6) NOT NULL,
  tasa_interes_mensual numeric(9,6) NOT NULL,
  numero_cuotas integer NOT NULL,
  cuota_fija numeric(14,2) NOT NULL,
  fecha_desembolso timestamp with time zone NOT NULL,
  fecha_primera_cuota date NOT NULL,
  fecha_ultima_cuota date NOT NULL,
  estado_credito character varying(20) NOT NULL DEFAULT 'ACTIVO'::character varying,
  saldo_pendiente numeric(14,2) NOT NULL,
  cuotas_pagadas integer NOT NULL DEFAULT 0,
  cuotas_en_mora integer NOT NULL DEFAULT 0,
  dias_mora_maximo integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE plan_pago (
  id_plan_pago uuid NOT NULL DEFAULT gen_random_uuid(),
  id_credito uuid NOT NULL,
  num_cuotas_totales integer NOT NULL,
  frecuencia_pago character varying(20) NOT NULL DEFAULT 'MENSUAL'::character varying,
  fecha_inicio_cobro date NOT NULL,
  fecha_fin_cobro date NOT NULL,
  tasa_mora_diaria numeric(9,6) NOT NULL DEFAULT 0.001,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE cuota (
  id_cuota uuid NOT NULL DEFAULT gen_random_uuid(),
  id_plan_pago uuid NOT NULL,
  numero_cuota integer NOT NULL,
  monto_capital numeric(14,2) NOT NULL,
  monto_interes numeric(14,2) NOT NULL,
  monto_total_cuota numeric(14,2) NOT NULL,
  saldo_despues_pago numeric(14,2) NOT NULL,
  fecha_vencimiento date NOT NULL,
  estado_cuota character varying(20) NOT NULL DEFAULT 'PENDIENTE'::character varying,
  monto_pagado_real numeric(14,2),
  monto_mora_cobrada numeric(14,2) DEFAULT 0,
  fecha_pago_real date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pago (
  id_recibo uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cuota uuid NOT NULL,
  id_credito uuid NOT NULL,
  id_usuario_receptor uuid,
  monto_pagado numeric(14,2) NOT NULL,
  monto_capital numeric(14,2) NOT NULL DEFAULT 0,
  monto_interes numeric(14,2) NOT NULL DEFAULT 0,
  monto_mora numeric(14,2) NOT NULL DEFAULT 0,
  fecha_pago timestamp with time zone NOT NULL DEFAULT now(),
  metodo_pago character varying(50) NOT NULL,
  referencia_externa character varying(200),
  estado character varying(20) NOT NULL DEFAULT 'PROCESANDO'::character varying,
  intentos_cobro integer NOT NULL DEFAULT 1,
  comprobante_url character varying(500),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ---- Cobranza / asignación / gestiones ---------------------------------------

CREATE TABLE asignacion_asesor (
  id_asignacion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_asesor uuid NOT NULL,
  id_cliente uuid NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  fecha_asignacion timestamp with time zone DEFAULT now(),
  fecha_fin timestamp with time zone,
  notas text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE gestion_cobranza (
  id_gestion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_credito uuid NOT NULL,
  id_cliente uuid NOT NULL,
  id_asesor uuid NOT NULL,
  tipo_gestion character varying(30) NOT NULL,
  resultado character varying(30) NOT NULL,
  monto_prometido numeric(14,2),
  fecha_promesa date,
  monto_recibido numeric(14,2),
  observaciones text,
  fecha_gestion timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- ---- Documentos legales ------------------------------------------------------

CREATE TABLE documento_legal (
  id_documento_legal uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL,
  id_credito uuid,
  id_tipo_doc_legal uuid NOT NULL,
  url_archivo character varying(500) NOT NULL,
  mime_type character varying(50) NOT NULL DEFAULT 'application/pdf'::character varying,
  tamanio_bytes bigint,
  hash_archivo character varying(64),
  generado_at timestamp with time zone NOT NULL DEFAULT now(),
  vigente_hasta date,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE log_descarga_documento (
  id_log uuid NOT NULL DEFAULT gen_random_uuid(),
  id_documento_legal uuid NOT NULL,
  id_cliente uuid NOT NULL,
  ip_cliente character varying(45),
  user_agent text,
  descargado_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---- Notificaciones / PQR ----------------------------------------------------

CREATE TABLE notificacion (
  id_notificacion uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL,
  id_tipo_notif uuid NOT NULL,
  id_credito uuid,
  id_solicitud uuid,
  canal character varying(20) NOT NULL,
  destinatario character varying(200) NOT NULL,
  asunto character varying(200),
  cuerpo text,
  estado_envio character varying(20) NOT NULL DEFAULT 'PENDIENTE'::character varying,
  proveedor character varying(50),
  referencia_proveedor character varying(200),
  intentos integer NOT NULL DEFAULT 0,
  enviado_at timestamp with time zone,
  error_detalle text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pqr (
  id_pqr uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cliente uuid NOT NULL,
  tipo character varying(20) NOT NULL DEFAULT 'PETICION'::character varying,
  asunto character varying(160) NOT NULL,
  descripcion text NOT NULL,
  estado character varying(20) NOT NULL DEFAULT 'ABIERTO'::character varying,
  respuesta text,
  id_respondido_por uuid,
  fecha_respuesta timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---- Trazabilidad / operación ------------------------------------------------

CREATE TABLE auditoria (
  id_auditoria uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario_responsable uuid,
  tabla_afectada character varying(50) NOT NULL,
  id_registro_afectado text NOT NULL,
  accion_realizada character varying(10) NOT NULL,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  ip_origen character varying(45),
  user_agent text,
  fecha_evento timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE evento_funnel (
  id_evento uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario uuid NOT NULL,
  id_solicitud uuid,
  evento text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE otp_recuperacion (
  id_otp uuid NOT NULL DEFAULT gen_random_uuid(),
  celular character varying(20) NOT NULL,
  otp_code character varying(10) NOT NULL,
  expiracion timestamp with time zone NOT NULL,
  usado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE log_error_registro (
  id_log uuid NOT NULL DEFAULT gen_random_uuid(),
  id_auth_user uuid,
  email_auth text,
  error_detalle text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ---- Agente virtual de servicio al cliente -----------------------------------

CREATE TABLE agente_base_conocimiento (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pregunta text NOT NULL,
  respuesta text NOT NULL,
  fuente text NOT NULL DEFAULT 'inicial'::text,
  creado_en timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE agente_ticket (
  id text NOT NULL DEFAULT ('T'::text || lpad((nextval('agente_ticket_seq'::regclass))::text, 4, '0'::text)),
  pregunta text NOT NULL,
  canal text NOT NULL DEFAULT 'telegram'::text,
  usuario_id text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'::text,
  respuesta text,
  sentimiento text,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  resuelto_en timestamp with time zone
);

-- ============================================================================
-- CONSTRAINTS (PK / UNIQUE / CHECK / FK)
-- ============================================================================

-- Primary keys
ALTER TABLE rol                      ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);
ALTER TABLE estado_cliente           ADD CONSTRAINT estado_cliente_pkey PRIMARY KEY (id_estado_cliente);
ALTER TABLE estado_solicitud         ADD CONSTRAINT estado_solicitud_pkey PRIMARY KEY (id_estado_solicitud);
ALTER TABLE motivo_rechazo           ADD CONSTRAINT motivo_rechazo_pkey PRIMARY KEY (id_motivo);
ALTER TABLE modelo_score             ADD CONSTRAINT modelo_score_pkey PRIMARY KEY (id_modelo_score);
ALTER TABLE tipo_documento_identidad ADD CONSTRAINT tipo_documento_identidad_pkey PRIMARY KEY (id_tipo_doc);
ALTER TABLE tipo_negocio             ADD CONSTRAINT tipo_negocio_pkey PRIMARY KEY (id_tipo_negocio);
ALTER TABLE banco                    ADD CONSTRAINT banco_pkey PRIMARY KEY (id_banco);
ALTER TABLE departamento             ADD CONSTRAINT departamento_pkey PRIMARY KEY (id_departamento);
ALTER TABLE municipio                ADD CONSTRAINT municipio_pkey PRIMARY KEY (id_municipio);
ALTER TABLE pregunta                 ADD CONSTRAINT pregunta_pkey PRIMARY KEY (id_pregunta);
ALTER TABLE opcion_pregunta          ADD CONSTRAINT opcion_pregunta_pkey PRIMARY KEY (id_opcion);
ALTER TABLE rango_puntaje_pregunta   ADD CONSTRAINT rango_puntaje_pregunta_pkey PRIMARY KEY (id_rango);
ALTER TABLE tipo_documento_legal     ADD CONSTRAINT tipo_documento_legal_pkey PRIMARY KEY (id_tipo_doc_legal);
ALTER TABLE tipo_notificacion        ADD CONSTRAINT tipo_notificacion_pkey PRIMARY KEY (id_tipo_notif);
ALTER TABLE perfil_usuario           ADD CONSTRAINT perfil_usuario_pkey PRIMARY KEY (id);
ALTER TABLE cliente                  ADD CONSTRAINT cliente_pkey PRIMARY KEY (id_cliente);
ALTER TABLE detalle_cliente          ADD CONSTRAINT detalle_cliente_pkey PRIMARY KEY (id_detalle);
ALTER TABLE documento_cliente        ADD CONSTRAINT documento_cliente_pkey PRIMARY KEY (id_documento);
ALTER TABLE solicitud_credito        ADD CONSTRAINT solicitud_credito_pkey PRIMARY KEY (id_solicitud);
ALTER TABLE respuesta_cliente        ADD CONSTRAINT respuesta_cliente_pkey PRIMARY KEY (id_respuesta);
ALTER TABLE score                    ADD CONSTRAINT score_pkey PRIMARY KEY (id_score);
ALTER TABLE decision_solicitud       ADD CONSTRAINT decision_solicitud_pkey PRIMARY KEY (id_decision);
ALTER TABLE credito                  ADD CONSTRAINT credito_pkey PRIMARY KEY (id_credito);
ALTER TABLE plan_pago                ADD CONSTRAINT plan_pago_pkey PRIMARY KEY (id_plan_pago);
ALTER TABLE cuota                    ADD CONSTRAINT cuota_pkey PRIMARY KEY (id_cuota);
ALTER TABLE pago                     ADD CONSTRAINT pago_pkey PRIMARY KEY (id_recibo);
ALTER TABLE asignacion_asesor        ADD CONSTRAINT asignacion_asesor_pkey PRIMARY KEY (id_asignacion);
ALTER TABLE gestion_cobranza         ADD CONSTRAINT gestion_cobranza_pkey PRIMARY KEY (id_gestion);
ALTER TABLE documento_legal          ADD CONSTRAINT documento_legal_pkey PRIMARY KEY (id_documento_legal);
ALTER TABLE log_descarga_documento   ADD CONSTRAINT log_descarga_documento_pkey PRIMARY KEY (id_log);
ALTER TABLE notificacion             ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id_notificacion);
ALTER TABLE pqr                      ADD CONSTRAINT pqr_pkey PRIMARY KEY (id_pqr);
ALTER TABLE auditoria                ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);
ALTER TABLE evento_funnel            ADD CONSTRAINT evento_funnel_pkey PRIMARY KEY (id_evento);
ALTER TABLE otp_recuperacion         ADD CONSTRAINT otp_recuperacion_pkey PRIMARY KEY (id_otp);
ALTER TABLE log_error_registro       ADD CONSTRAINT log_error_registro_pkey PRIMARY KEY (id_log);
ALTER TABLE agente_base_conocimiento ADD CONSTRAINT agente_base_conocimiento_pkey PRIMARY KEY (id);
ALTER TABLE agente_ticket            ADD CONSTRAINT agente_ticket_pkey PRIMARY KEY (id);

-- Unique
ALTER TABLE rol                      ADD CONSTRAINT rol_nombre_rol_key UNIQUE (nombre_rol);
ALTER TABLE estado_cliente           ADD CONSTRAINT estado_cliente_nombre_key UNIQUE (nombre);
ALTER TABLE estado_solicitud         ADD CONSTRAINT estado_solicitud_nombre_key UNIQUE (nombre);
ALTER TABLE tipo_documento_identidad ADD CONSTRAINT tipo_documento_identidad_codigo_key UNIQUE (codigo);
ALTER TABLE tipo_negocio             ADD CONSTRAINT tipo_negocio_nombre_key UNIQUE (nombre);
ALTER TABLE banco                    ADD CONSTRAINT banco_nombre_key UNIQUE (nombre);
ALTER TABLE departamento             ADD CONSTRAINT departamento_codigo_dane_key UNIQUE (codigo_dane);
ALTER TABLE departamento             ADD CONSTRAINT departamento_nombre_key UNIQUE (nombre);
ALTER TABLE municipio                ADD CONSTRAINT municipio_id_departamento_nombre_key UNIQUE (id_departamento, nombre);
ALTER TABLE tipo_documento_legal     ADD CONSTRAINT tipo_documento_legal_codigo_key UNIQUE (codigo);
ALTER TABLE tipo_notificacion        ADD CONSTRAINT tipo_notificacion_codigo_key UNIQUE (codigo);
ALTER TABLE cliente                  ADD CONSTRAINT uq_cliente_dni UNIQUE (dni);
ALTER TABLE cliente                  ADD CONSTRAINT uq_cliente_email UNIQUE (email);
ALTER TABLE detalle_cliente          ADD CONSTRAINT uq_detalle_id_cliente UNIQUE (id_cliente);
ALTER TABLE asignacion_asesor        ADD CONSTRAINT uq_asesor_cliente UNIQUE (id_asesor, id_cliente);

-- Check
ALTER TABLE banco ADD CONSTRAINT banco_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['BANCO'::character varying, 'BILLETERA'::character varying])::text[])));
ALTER TABLE cliente ADD CONSTRAINT ck_telefono_len CHECK ((length(regexp_replace((telefono)::text, '\D'::text, ''::text, 'g'::text)) = 10));
ALTER TABLE credito ADD CONSTRAINT ck_credito_estado CHECK (((estado_credito)::text = ANY ((ARRAY['ACTIVO'::character varying, 'EN_MORA'::character varying, 'PAGADO'::character varying, 'CANCELADO'::character varying, 'CASTIGADO'::character varying])::text[])));
ALTER TABLE cuota ADD CONSTRAINT ck_cuota_estado CHECK (((estado_cuota)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PAGADA'::character varying, 'PAGADA_MORA'::character varying, 'VENCIDA'::character varying])::text[])));
ALTER TABLE decision_solicitud ADD CONSTRAINT ck_decision_resultado CHECK (((resultado IS NULL) OR ((resultado)::text = ANY ((ARRAY['APROBADO'::character varying, 'RECHAZADO'::character varying, 'PREAPROBADO'::character varying])::text[]))));
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_estado_civil CHECK (((estado_civil IS NULL) OR ((estado_civil)::text = ANY ((ARRAY['SOLTERO'::character varying, 'CASADO'::character varying, 'UNION_LIBRE'::character varying, 'SEPARADO'::character varying, 'VIUDO'::character varying])::text[]))));
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_estrato CHECK (((estrato IS NULL) OR ((estrato >= 1) AND (estrato <= 6))));
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_nivel_educativo CHECK (((nivel_educativo IS NULL) OR ((nivel_educativo)::text = ANY ((ARRAY['PRIMARIA'::character varying, 'BACHILLERATO'::character varying, 'TECNICO'::character varying, 'TECNOLOGO'::character varying, 'PROFESIONAL'::character varying, 'POSGRADO'::character varying, 'NINGUNO'::character varying])::text[]))));
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_tipo_cuenta CHECK (((tipo_cuenta_bancaria IS NULL) OR ((tipo_cuenta_bancaria)::text = ANY ((ARRAY['AHORROS'::character varying, 'CORRIENTE'::character varying, 'BILLETERA'::character varying])::text[]))));
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_tipo_vivienda CHECK (((tipo_vivienda IS NULL) OR ((tipo_vivienda)::text = ANY ((ARRAY['PROPIA'::character varying, 'ARRENDADA'::character varying, 'FAMILIAR'::character varying])::text[]))));
ALTER TABLE documento_cliente ADD CONSTRAINT ck_doc_estado_verif CHECK (((estado_verificacion)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'APROBADO'::character varying, 'RECHAZADO'::character varying])::text[])));
ALTER TABLE documento_cliente ADD CONSTRAINT ck_doc_tipo CHECK (((tipo_documento)::text = ANY ((ARRAY['CEDULA_FRONTAL'::character varying, 'CEDULA_TRASERA'::character varying, 'SELFIE'::character varying, 'RECIBO_PUBLICO'::character varying, 'FOTO_NEGOCIO'::character varying, 'RUT'::character varying, 'EXTRACTO_BANCARIO'::character varying, 'CAMARA_COMERCIO'::character varying, 'OTRO_COMPROBANTE'::character varying, 'OTRO'::character varying])::text[])));
ALTER TABLE pago ADD CONSTRAINT ck_pago_estado CHECK (((estado)::text = ANY ((ARRAY['CONFIRMADO'::character varying, 'PENDIENTE'::character varying, 'FALLIDO'::character varying, 'RECHAZADO'::character varying, 'REVERSADO'::character varying])::text[])));
ALTER TABLE pago ADD CONSTRAINT ck_pago_metodo CHECK (((metodo_pago)::text = ANY ((ARRAY['EFECTIVO'::character varying, 'PSE'::character varying, 'TRANSFERENCIA'::character varying, 'WOMPI'::character varying, 'TARJETA'::character varying, 'NEQUI'::character varying, 'DAVIPLATA'::character varying])::text[])));
ALTER TABLE pregunta ADD CONSTRAINT ck_pregunta_tipo_input CHECK (((tipo_input)::text = ANY ((ARRAY['SELECT'::character varying, 'TEXTO'::character varying, 'NUMERO'::character varying, 'MONEDA'::character varying, 'UBICACION'::character varying, 'BANCO'::character varying])::text[])));
ALTER TABLE rango_puntaje_pregunta ADD CONSTRAINT ck_rango_valido CHECK (((valor_max IS NULL) OR (valor_max > valor_min)));
ALTER TABLE score ADD CONSTRAINT ck_score_recomendacion CHECK (((recomendacion IS NULL) OR ((recomendacion)::text = ANY ((ARRAY['APROBAR'::character varying, 'RECHAZAR'::character varying, 'REVISAR_MANUAL'::character varying, 'REVISION_MANUAL'::character varying])::text[]))));
ALTER TABLE solicitud_credito ADD CONSTRAINT ck_solicitud_canal CHECK (((canal_solicitud)::text = ANY ((ARRAY['WEB'::character varying, 'APP'::character varying, 'PRESENCIAL'::character varying, 'TELEFONO'::character varying, 'ASESOR'::character varying])::text[])));

-- Foreign keys
ALTER TABLE municipio          ADD CONSTRAINT municipio_id_departamento_fkey FOREIGN KEY (id_departamento) REFERENCES departamento(id_departamento);
ALTER TABLE opcion_pregunta    ADD CONSTRAINT opcion_pregunta_id_pregunta_fkey FOREIGN KEY (id_pregunta) REFERENCES pregunta(id_pregunta) ON DELETE CASCADE;
ALTER TABLE rango_puntaje_pregunta ADD CONSTRAINT rango_puntaje_pregunta_id_pregunta_fkey FOREIGN KEY (id_pregunta) REFERENCES pregunta(id_pregunta) ON DELETE CASCADE;
ALTER TABLE perfil_usuario     ADD CONSTRAINT perfil_usuario_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE perfil_usuario     ADD CONSTRAINT perfil_usuario_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES rol(id_rol);
ALTER TABLE cliente            ADD CONSTRAINT cliente_id_usuario_cuenta_fkey FOREIGN KEY (id_usuario_cuenta) REFERENCES perfil_usuario(id) ON DELETE RESTRICT;
ALTER TABLE cliente            ADD CONSTRAINT cliente_id_estado_cliente_fkey FOREIGN KEY (id_estado_cliente) REFERENCES estado_cliente(id_estado_cliente);
ALTER TABLE cliente            ADD CONSTRAINT cliente_id_tipo_doc_fkey FOREIGN KEY (id_tipo_doc) REFERENCES tipo_documento_identidad(id_tipo_doc);
ALTER TABLE cliente            ADD CONSTRAINT cliente_id_tipo_negocio_fkey FOREIGN KEY (id_tipo_negocio) REFERENCES tipo_negocio(id_tipo_negocio);
ALTER TABLE detalle_cliente    ADD CONSTRAINT detalle_cliente_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE;
ALTER TABLE documento_cliente  ADD CONSTRAINT documento_cliente_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT;
ALTER TABLE documento_cliente  ADD CONSTRAINT documento_cliente_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES perfil_usuario(id);
ALTER TABLE solicitud_credito  ADD CONSTRAINT solicitud_credito_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT;
ALTER TABLE solicitud_credito  ADD CONSTRAINT solicitud_credito_id_estado_solicitud_fkey FOREIGN KEY (id_estado_solicitud) REFERENCES estado_solicitud(id_estado_solicitud);
ALTER TABLE solicitud_credito  ADD CONSTRAINT solicitud_credito_id_motivo_rechazo_fkey FOREIGN KEY (id_motivo_rechazo) REFERENCES motivo_rechazo(id_motivo);
ALTER TABLE solicitud_credito  ADD CONSTRAINT solicitud_credito_id_usuario_evaluador_fkey FOREIGN KEY (id_usuario_evaluador) REFERENCES perfil_usuario(id);
ALTER TABLE respuesta_cliente  ADD CONSTRAINT respuesta_cliente_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES solicitud_credito(id_solicitud) ON DELETE CASCADE;
ALTER TABLE respuesta_cliente  ADD CONSTRAINT respuesta_cliente_id_pregunta_fkey FOREIGN KEY (id_pregunta) REFERENCES pregunta(id_pregunta);
ALTER TABLE respuesta_cliente  ADD CONSTRAINT respuesta_cliente_id_opcion_fkey FOREIGN KEY (id_opcion) REFERENCES opcion_pregunta(id_opcion);
ALTER TABLE score              ADD CONSTRAINT score_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES solicitud_credito(id_solicitud) ON DELETE CASCADE;
ALTER TABLE score              ADD CONSTRAINT score_id_modelo_score_fkey FOREIGN KEY (id_modelo_score) REFERENCES modelo_score(id_modelo_score);
ALTER TABLE decision_solicitud ADD CONSTRAINT decision_solicitud_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES solicitud_credito(id_solicitud) ON DELETE RESTRICT;
ALTER TABLE decision_solicitud ADD CONSTRAINT decision_solicitud_id_motivo_rechazo_fkey FOREIGN KEY (id_motivo_rechazo) REFERENCES motivo_rechazo(id_motivo);
ALTER TABLE decision_solicitud ADD CONSTRAINT decision_solicitud_id_analista_fkey FOREIGN KEY (id_analista) REFERENCES perfil_usuario(id);
ALTER TABLE credito            ADD CONSTRAINT credito_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES solicitud_credito(id_solicitud) ON DELETE RESTRICT;
ALTER TABLE credito            ADD CONSTRAINT credito_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT;
ALTER TABLE plan_pago          ADD CONSTRAINT plan_pago_id_credito_fkey FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE CASCADE;
ALTER TABLE cuota              ADD CONSTRAINT cuota_id_plan_pago_fkey FOREIGN KEY (id_plan_pago) REFERENCES plan_pago(id_plan_pago) ON DELETE CASCADE;
ALTER TABLE pago               ADD CONSTRAINT pago_id_cuota_fkey FOREIGN KEY (id_cuota) REFERENCES cuota(id_cuota) ON DELETE RESTRICT;
ALTER TABLE pago               ADD CONSTRAINT pago_id_credito_fkey FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE RESTRICT;
ALTER TABLE pago               ADD CONSTRAINT pago_id_usuario_receptor_fkey FOREIGN KEY (id_usuario_receptor) REFERENCES perfil_usuario(id);
ALTER TABLE asignacion_asesor  ADD CONSTRAINT asignacion_asesor_id_asesor_fkey FOREIGN KEY (id_asesor) REFERENCES perfil_usuario(id) ON DELETE CASCADE;
ALTER TABLE asignacion_asesor  ADD CONSTRAINT asignacion_asesor_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE;
ALTER TABLE gestion_cobranza   ADD CONSTRAINT gestion_cobranza_id_credito_fkey FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE RESTRICT;
ALTER TABLE gestion_cobranza   ADD CONSTRAINT gestion_cobranza_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT;
ALTER TABLE gestion_cobranza   ADD CONSTRAINT gestion_cobranza_id_asesor_fkey FOREIGN KEY (id_asesor) REFERENCES perfil_usuario(id);
ALTER TABLE documento_legal    ADD CONSTRAINT documento_legal_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT;
ALTER TABLE documento_legal    ADD CONSTRAINT documento_legal_id_credito_fkey FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE RESTRICT;
ALTER TABLE documento_legal    ADD CONSTRAINT documento_legal_id_tipo_doc_legal_fkey FOREIGN KEY (id_tipo_doc_legal) REFERENCES tipo_documento_legal(id_tipo_doc_legal);
ALTER TABLE log_descarga_documento ADD CONSTRAINT log_descarga_documento_id_documento_legal_fkey FOREIGN KEY (id_documento_legal) REFERENCES documento_legal(id_documento_legal);
ALTER TABLE log_descarga_documento ADD CONSTRAINT log_descarga_documento_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente);
ALTER TABLE notificacion       ADD CONSTRAINT notificacion_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE;
ALTER TABLE notificacion       ADD CONSTRAINT notificacion_id_tipo_notif_fkey FOREIGN KEY (id_tipo_notif) REFERENCES tipo_notificacion(id_tipo_notif);
ALTER TABLE notificacion       ADD CONSTRAINT notificacion_id_credito_fkey FOREIGN KEY (id_credito) REFERENCES credito(id_credito);
ALTER TABLE notificacion       ADD CONSTRAINT notificacion_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES solicitud_credito(id_solicitud);
ALTER TABLE pqr                ADD CONSTRAINT pqr_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE;
ALTER TABLE pqr                ADD CONSTRAINT pqr_id_respondido_por_fkey FOREIGN KEY (id_respondido_por) REFERENCES perfil_usuario(id);
ALTER TABLE auditoria          ADD CONSTRAINT auditoria_id_usuario_responsable_fkey FOREIGN KEY (id_usuario_responsable) REFERENCES perfil_usuario(id);
ALTER TABLE evento_funnel      ADD CONSTRAINT evento_funnel_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE evento_funnel      ADD CONSTRAINT evento_funnel_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES solicitud_credito(id_solicitud) ON DELETE SET NULL;

-- ============================================================================
-- ÍNDICES (no respaldados por constraint)
-- ============================================================================
CREATE INDEX idx_asignacion_activa ON public.asignacion_asesor USING btree (activa);
CREATE INDEX idx_asignacion_asesor ON public.asignacion_asesor USING btree (id_asesor);
CREATE INDEX idx_asignacion_cliente ON public.asignacion_asesor USING btree (id_cliente);
CREATE UNIQUE INDEX ux_asignacion_asesor_cliente_activo ON public.asignacion_asesor USING btree (id_cliente) WHERE activa;
CREATE INDEX idx_audit_fecha ON public.auditoria USING btree (fecha_evento DESC);
CREATE INDEX idx_audit_registro ON public.auditoria USING btree (tabla_afectada, id_registro_afectado);
CREATE INDEX idx_audit_tabla ON public.auditoria USING btree (tabla_afectada);
CREATE INDEX idx_audit_usuario ON public.auditoria USING btree (id_usuario_responsable);
CREATE INDEX idx_cliente_dni ON public.cliente USING btree (dni);
CREATE INDEX idx_cliente_email ON public.cliente USING btree (email);
CREATE INDEX idx_cliente_estado ON public.cliente USING btree (id_estado_cliente);
CREATE INDEX idx_cliente_id_tipo_doc ON public.cliente USING btree (id_tipo_doc);
CREATE INDEX idx_cliente_id_tipo_negocio ON public.cliente USING btree (id_tipo_negocio);
CREATE INDEX idx_cliente_usuario ON public.cliente USING btree (id_usuario_cuenta);
CREATE INDEX idx_credito_cliente ON public.credito USING btree (id_cliente);
CREATE INDEX idx_credito_estado ON public.credito USING btree (estado_credito);
CREATE INDEX idx_credito_solicitud ON public.credito USING btree (id_solicitud);
CREATE INDEX idx_cuota_estado ON public.cuota USING btree (estado_cuota);
CREATE INDEX idx_cuota_estado_venc ON public.cuota USING btree (estado_cuota, fecha_vencimiento);
CREATE INDEX idx_cuota_plan ON public.cuota USING btree (id_plan_pago);
CREATE INDEX idx_cuota_vencimiento ON public.cuota USING btree (fecha_vencimiento);
CREATE INDEX idx_decision_id_analista ON public.decision_solicitud USING btree (id_analista);
CREATE INDEX idx_decision_id_motivo_rechazo ON public.decision_solicitud USING btree (id_motivo_rechazo);
CREATE INDEX idx_decision_id_solicitud ON public.decision_solicitud USING btree (id_solicitud);
CREATE INDEX idx_doc_cliente ON public.documento_cliente USING btree (id_cliente);
CREATE INDEX idx_doc_estado_verif ON public.documento_cliente USING btree (estado_verificacion);
CREATE INDEX idx_doccliente_verificado_por ON public.documento_cliente USING btree (verificado_por);
CREATE INDEX idx_doc_legal_cliente ON public.documento_legal USING btree (id_cliente);
CREATE INDEX idx_doc_legal_credito ON public.documento_legal USING btree (id_credito);
CREATE INDEX idx_doclegal_id_tipo_doc_legal ON public.documento_legal USING btree (id_tipo_doc_legal);
CREATE INDEX idx_evento_funnel_created ON public.evento_funnel USING btree (created_at DESC);
CREATE INDEX idx_evento_funnel_evento ON public.evento_funnel USING btree (evento);
CREATE INDEX idx_evento_funnel_id_solicitud ON public.evento_funnel USING btree (id_solicitud);
CREATE INDEX idx_evento_funnel_usuario ON public.evento_funnel USING btree (id_usuario);
CREATE INDEX idx_gestion_asesor ON public.gestion_cobranza USING btree (id_asesor);
CREATE INDEX idx_gestion_cliente ON public.gestion_cobranza USING btree (id_cliente);
CREATE INDEX idx_gestion_credito ON public.gestion_cobranza USING btree (id_credito);
CREATE INDEX idx_gestion_fecha ON public.gestion_cobranza USING btree (fecha_gestion DESC);
CREATE INDEX idx_log_descarga_cliente ON public.log_descarga_documento USING btree (id_cliente, descargado_at DESC);
CREATE INDEX idx_logdesc_id_documento_legal ON public.log_descarga_documento USING btree (id_documento_legal);
CREATE INDEX idx_municipio_departamento ON public.municipio USING btree (id_departamento);
CREATE INDEX idx_notif_cliente ON public.notificacion USING btree (id_cliente);
CREATE INDEX idx_notif_estado ON public.notificacion USING btree (estado_envio);
CREATE INDEX idx_notif_fecha ON public.notificacion USING btree (created_at DESC);
CREATE INDEX idx_notif_id_credito ON public.notificacion USING btree (id_credito);
CREATE INDEX idx_notif_id_solicitud ON public.notificacion USING btree (id_solicitud);
CREATE INDEX idx_notif_id_tipo_notif ON public.notificacion USING btree (id_tipo_notif);
CREATE INDEX idx_opcion_id_pregunta ON public.opcion_pregunta USING btree (id_pregunta);
CREATE INDEX idx_otp_recuperacion_celular ON public.otp_recuperacion USING btree (celular);
CREATE INDEX idx_pago_credito ON public.pago USING btree (id_credito);
CREATE INDEX idx_pago_cuota ON public.pago USING btree (id_cuota);
CREATE INDEX idx_pago_estado ON public.pago USING btree (estado);
CREATE INDEX idx_pago_fecha ON public.pago USING btree (fecha_pago DESC);
CREATE INDEX idx_pago_id_usuario_receptor ON public.pago USING btree (id_usuario_receptor);
CREATE INDEX idx_pago_referencia ON public.pago USING btree (referencia_externa);
CREATE INDEX idx_perfil_id_rol ON public.perfil_usuario USING btree (id_rol);
CREATE INDEX idx_plan_pago_credito ON public.plan_pago USING btree (id_credito);
CREATE INDEX idx_pqr_cliente ON public.pqr USING btree (id_cliente);
CREATE INDEX idx_pqr_estado ON public.pqr USING btree (estado);
CREATE INDEX idx_pqr_fecha ON public.pqr USING btree (created_at DESC);
CREATE INDEX idx_pqr_id_respondido_por ON public.pqr USING btree (id_respondido_por);
CREATE INDEX idx_rango_pregunta ON public.rango_puntaje_pregunta USING btree (id_pregunta) WHERE (activo = true);
CREATE INDEX idx_respuesta_id_opcion ON public.respuesta_cliente USING btree (id_opcion);
CREATE INDEX idx_respuesta_id_solicitud ON public.respuesta_cliente USING btree (id_solicitud);
CREATE INDEX idx_respuesta_numerica ON public.respuesta_cliente USING btree (id_pregunta, respuesta_numerica) WHERE (respuesta_numerica IS NOT NULL);
CREATE INDEX idx_score_id_modelo_score ON public.score USING btree (id_modelo_score);
CREATE INDEX idx_score_id_solicitud ON public.score USING btree (id_solicitud);
CREATE INDEX idx_solicitud_cliente ON public.solicitud_credito USING btree (id_cliente);
CREATE INDEX idx_solicitud_estado ON public.solicitud_credito USING btree (id_estado_solicitud);
CREATE INDEX idx_solicitud_evaluador ON public.solicitud_credito USING btree (id_usuario_evaluador);
CREATE INDEX idx_solicitud_fecha ON public.solicitud_credito USING btree (fecha_solicitud DESC);
CREATE INDEX idx_solicitud_id_motivo_rechazo ON public.solicitud_credito USING btree (id_motivo_rechazo);

-- ============================================================================
-- FUNCIONES
-- ============================================================================

-- Helpers de nombre (1FN) --------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_parse_nombre(p_nombre text, OUT primer_nombre text, OUT segundo_nombre text, OUT primer_apellido text, OUT segundo_apellido text)
 RETURNS record
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_format_nombre(p_primer_nombre text, p_segundo_nombre text DEFAULT NULL::text, p_primer_apellido text DEFAULT NULL::text, p_segundo_apellido text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT NULLIF(trim(concat_ws(' ',
    NULLIF(trim(p_primer_nombre), ''),
    NULLIF(trim(p_segundo_nombre), ''),
    NULLIF(trim(p_primer_apellido), ''),
    NULLIF(trim(p_segundo_apellido), '')
  )), '');
$function$;

-- Helpers de autorización / RLS --------------------------------------------
CREATE OR REPLACE FUNCTION public.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol = 'ADMIN'
          AND pu.activo = true
    );
$function$;

CREATE OR REPLACE FUNCTION public.es_analista_o_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR')
          AND pu.activo = true
    );
$function$;

CREATE OR REPLACE FUNCTION public.es_supervisor_o_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR')
          AND pu.activo = true
    );
$function$;

CREATE OR REPLACE FUNCTION public.es_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR', 'ASESOR')
          AND pu.activo = true
    );
$function$;

CREATE OR REPLACE FUNCTION public.es_asesor_de_cliente(p_id_cliente uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM asignacion_asesor aa
        WHERE aa.id_cliente = p_id_cliente
          AND aa.id_asesor  = auth.uid()
          AND aa.activa      = true
    );
$function$;

CREATE OR REPLACE FUNCTION public.mi_id_cliente()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT id_cliente FROM cliente
    WHERE id_usuario_cuenta = auth.uid()
    LIMIT 1;
$function$;

-- Triggers de mantenimiento ------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_registrar_auditoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id_registro TEXT;
    v_old JSONB;
    v_new JSONB;
BEGIN
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;

    v_id_registro := CASE
        WHEN TG_OP = 'DELETE' THEN
            COALESCE(v_old->>'id_credito', v_old->>'id_cuota', v_old->>'id_recibo', v_old->>'id_solicitud', v_old->>'id_cliente', 'unknown')
        ELSE
            COALESCE(v_new->>'id_credito', v_new->>'id_cuota', v_new->>'id_recibo', v_new->>'id_solicitud', v_new->>'id_cliente', 'unknown')
    END;

    INSERT INTO auditoria (
        id_usuario_responsable, tabla_afectada, id_registro_afectado,
        accion_realizada, valor_anterior, valor_nuevo, fecha_evento
    ) VALUES (
        auth.uid(), TG_TABLE_NAME, v_id_registro, TG_OP, v_old, v_new, NOW()
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$function$;

-- Variante alternativa de auditoría (usa headers de request) ----------------
CREATE OR REPLACE FUNCTION public.fn_auditar_registros()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    current_user_id UUID;
    v_record_id TEXT;
BEGIN
    current_user_id := auth.uid();

    IF TG_OP = 'DELETE' THEN
        v_record_id := COALESCE(OLD.id_cliente::text, OLD.id_credito::text, OLD.id_solicitud::text, 'DESC');
    ELSE
        v_record_id := COALESCE(NEW.id_cliente::text, NEW.id_credito::text, NEW.id_solicitud::text, 'DESC');
    END IF;

    INSERT INTO auditoria (
        id_usuario_responsable, tabla_afectada, id_registro_afectado,
        accion_realizada, valor_anterior, valor_nuevo, ip_origen, user_agent
    ) VALUES (
        current_user_id, TG_TABLE_NAME, v_record_id, TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        current_setting('request.headers', true)::json->>'x-forwarded-for',
        current_setting('request.headers', true)::json->>'user-agent'
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$function$;

-- Registro de usuarios (trigger sobre auth.users) --------------------------
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
BEGIN
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
      id_usuario_cuenta, id_estado_cliente,
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      dni, email, telefono
    )
    VALUES (
      NEW.id, v_estado_id, v_pn, v_sn, v_pa, v_sa, v_dni,
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
$function$;

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

-- Protección antifraude / negocio ------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_solicitud_trimestral()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_ultima TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT fecha_solicitud INTO v_fecha_ultima
  FROM public.solicitud_credito
  WHERE id_cliente = NEW.id_cliente
  ORDER BY fecha_solicitud DESC
  LIMIT 1;

  IF v_fecha_ultima IS NOT NULL
     AND v_fecha_ultima > (NOW() - INTERVAL '90 days') THEN
    RAISE EXCEPTION 'BLOQUEO_TRIMESTRAL: Solicitud reciente el %. Espera 90 días.',
      v_fecha_ultima
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- Elegibilidad / disponibilidad --------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_verificar_disponibilidad(p_email text DEFAULT NULL::text, p_dni text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_verificar_elegibilidad()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id_cliente UUID;
    v_ultima     TIMESTAMPTZ;
    v_dias       NUMERIC;
BEGIN
    SELECT id_cliente INTO v_id_cliente
    FROM cliente WHERE id_usuario_cuenta = auth.uid() LIMIT 1;

    IF v_id_cliente IS NULL THEN
        RETURN jsonb_build_object('elegible', false, 'codigo', 'CLIENTE_NO_ENCONTRADO',
            'mensaje', 'No encontramos tu perfil de cliente. Contacta a soporte.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM credito
        WHERE id_cliente = v_id_cliente
          AND (saldo_pendiente > 0 OR estado_credito IN ('ACTIVO', 'EN_MORA'))
    ) THEN
        RETURN jsonb_build_object('elegible', false, 'codigo', 'CREDITO_ACTIVO',
            'mensaje', 'Tienes un crédito activo. Debes finalizar todos los pagos antes de solicitar uno nuevo.');
    END IF;

    SELECT MAX(fecha_solicitud) INTO v_ultima
    FROM solicitud_credito WHERE id_cliente = v_id_cliente;

    IF v_ultima IS NOT NULL THEN
        v_dias := EXTRACT(EPOCH FROM (NOW() - v_ultima)) / 86400;
        IF v_dias < 90 THEN
            RETURN jsonb_build_object('elegible', false, 'codigo', 'BLOQUEO_TRIMESTRAL',
                'mensaje', format('Debes esperar %s días antes de realizar una nueva solicitud.', CEIL(90 - v_dias)),
                'dias_restantes', CEIL(90 - v_dias));
        END IF;
    END IF;

    RETURN jsonb_build_object('elegible', true);
END;
$function$;

-- Cron: detección de mora --------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_detectar_mora()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE cuota
    SET estado_cuota = 'VENCIDA', updated_at = NOW()
    WHERE fecha_vencimiento < CURRENT_DATE
      AND estado_cuota = 'PENDIENTE';

    UPDATE credito SET estado_credito = 'EN_MORA',
        cuotas_en_mora = (
            SELECT COUNT(*) FROM cuota c
            JOIN plan_pago pp ON pp.id_plan_pago = c.id_plan_pago
            WHERE pp.id_credito = credito.id_credito
              AND c.estado_cuota = 'VENCIDA'
        ), updated_at = NOW()
    WHERE id_credito IN (
        SELECT DISTINCT pp.id_credito FROM plan_pago pp
        JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
        WHERE c.estado_cuota = 'VENCIDA'
    ) AND estado_credito = 'ACTIVO';

    UPDATE credito SET estado_credito = 'ACTIVO',
        cuotas_en_mora = 0, updated_at = NOW()
    WHERE estado_credito = 'EN_MORA'
      AND id_credito NOT IN (
          SELECT DISTINCT pp.id_credito FROM plan_pago pp
          JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
          WHERE c.estado_cuota = 'VENCIDA'
      );
END;
$function$;

-- Descarga de documentos legales (rate limit) ------------------------------
CREATE OR REPLACE FUNCTION public.fn_puede_descargar_documento(p_id_cliente uuid, p_id_documento_legal uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_descargas_hoy INT;
    v_max_descargas INT;
BEGIN
    SELECT tl.max_descargas_dia INTO v_max_descargas
    FROM documento_legal dl
    JOIN tipo_documento_legal tl ON tl.id_tipo_doc_legal = dl.id_tipo_doc_legal
    WHERE dl.id_documento_legal = p_id_documento_legal;

    SELECT COUNT(*) INTO v_descargas_hoy
    FROM log_descarga_documento
    WHERE id_cliente = p_id_cliente
      AND id_documento_legal = p_id_documento_legal
      AND DATE(descargado_at) = CURRENT_DATE;

    RETURN v_descargas_hoy < v_max_descargas;
END;
$function$;

-- Asignación de asesor -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.asignar_asesor_a_cliente(p_id_cliente uuid, p_id_asesor uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id_asignacion UUID;
BEGIN
    UPDATE asignacion_asesor SET activa = false, fecha_fin = now()
    WHERE id_cliente = p_id_cliente AND activa AND id_asesor <> p_id_asesor;

    INSERT INTO asignacion_asesor (id_asesor, id_cliente, activa, fecha_asignacion)
    VALUES (p_id_asesor, p_id_cliente, true, now())
    ON CONFLICT (id_asesor, id_cliente) DO UPDATE
        SET activa = true, fecha_fin = NULL, fecha_asignacion = now()
    RETURNING id_asignacion INTO v_id_asignacion;

    RETURN v_id_asignacion;
END;
$function$;

-- RPC: crear solicitud completa (solicitud + respuestas + score + docs) ----
CREATE OR REPLACE FUNCTION public.fn_crear_solicitud_completa(p_monto numeric, p_plazo integer, p_respuestas jsonb DEFAULT '[]'::jsonb, p_docs jsonb DEFAULT '[]'::jsonb, p_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id_cliente     UUID;
    v_elegibilidad   JSONB;
    v_id_solicitud   UUID;
    v_modelo         RECORD;
    v_puntaje        INT := 0;
    v_hay_respuestas BOOLEAN;
    v_dictamen       TEXT;
    v_recomendacion  TEXT;
    v_estado_final   TEXT;
    v_id_estado      UUID;
    v_id_motivo      UUID;
    v_r              RECORD;
    v_doc            RECORD;
BEGIN
    SELECT id_cliente INTO v_id_cliente
    FROM cliente WHERE id_usuario_cuenta = auth.uid() LIMIT 1;

    IF v_id_cliente IS NULL THEN
        RETURN jsonb_build_object('error', 'CLIENTE_NO_ENCONTRADO',
            'message', 'No encontramos tu perfil de cliente.');
    END IF;

    v_elegibilidad := fn_verificar_elegibilidad();
    IF NOT (v_elegibilidad->>'elegible')::BOOLEAN THEN
        RETURN jsonb_build_object('error', v_elegibilidad->>'codigo',
            'message', v_elegibilidad->>'mensaje');
    END IF;

    IF p_monto IS NULL OR p_monto < 100000 OR p_monto > 10000000 THEN
        RETURN jsonb_build_object('error', 'MONTO_INVALIDO',
            'message', 'El monto debe estar entre $100.000 y $10.000.000.');
    END IF;
    IF p_plazo IS NULL OR p_plazo NOT IN (12, 24, 30) THEN
        RETURN jsonb_build_object('error', 'PLAZO_INVALIDO',
            'message', 'El plazo debe ser 12, 24 o 30 meses.');
    END IF;

    FOR v_r IN
        SELECT p.tipo_input,
               (e->>'respuesta_numerica')::NUMERIC AS num
        FROM jsonb_array_elements(p_respuestas) e
        JOIN pregunta p ON p.id_pregunta = (e->>'id_pregunta')::UUID
        WHERE p.tipo_input IN ('MONEDA', 'NUMERO')
    LOOP
        IF v_r.num IS NULL OR v_r.num < 0 THEN
            RETURN jsonb_build_object('error', 'RESPUESTA_NUMERICA_INVALIDA',
                'message', 'Las preguntas de montos o cantidades requieren un valor numérico válido.');
        END IF;
    END LOOP;

    SELECT id_estado_solicitud INTO v_id_estado
    FROM estado_solicitud WHERE nombre = 'PENDIENTE';

    INSERT INTO solicitud_credito (
        id_cliente, id_estado_solicitud, monto_solicitado,
        plazo_meses, canal_solicitud, ip_solicitud
    ) VALUES (
        v_id_cliente, v_id_estado, p_monto, p_plazo, 'WEB', p_ip
    )
    RETURNING id_solicitud INTO v_id_solicitud;

    INSERT INTO respuesta_cliente (id_solicitud, id_pregunta, id_opcion, respuesta_texto, respuesta_numerica)
    SELECT v_id_solicitud,
           (e->>'id_pregunta')::UUID,
           NULLIF(e->>'id_opcion', '')::UUID,
           NULLIF(e->>'respuesta_texto', ''),
           (e->>'respuesta_numerica')::NUMERIC
    FROM jsonb_array_elements(p_respuestas) e;

    v_hay_respuestas := jsonb_array_length(p_respuestas) > 0;

    SELECT id_modelo_score, puntaje_minimo, puntaje_maximo INTO v_modelo
    FROM modelo_score WHERE activo = true
    ORDER BY vigente_desde DESC LIMIT 1;

    IF v_hay_respuestas THEN
        SELECT COALESCE(SUM(o.valor_puntos), 0) INTO v_puntaje
        FROM respuesta_cliente rc
        JOIN opcion_pregunta o ON o.id_opcion = rc.id_opcion
        WHERE rc.id_solicitud = v_id_solicitud;

        v_puntaje := v_puntaje + COALESCE((
            SELECT SUM(rp.puntos)
            FROM respuesta_cliente rc
            JOIN rango_puntaje_pregunta rp
              ON rp.id_pregunta = rc.id_pregunta
             AND rp.activo
             AND rc.respuesta_numerica >= rp.valor_min
             AND (rp.valor_max IS NULL OR rc.respuesta_numerica < rp.valor_max)
            WHERE rc.id_solicitud = v_id_solicitud
              AND rc.respuesta_numerica IS NOT NULL
        ), 0);

        IF v_puntaje >= COALESCE(v_modelo.puntaje_minimo, 600) THEN
            v_recomendacion := 'APROBAR';        v_dictamen := 'PRE_APROBADO';
        ELSIF v_puntaje >= COALESCE(v_modelo.puntaje_minimo, 600) * 0.67 THEN
            v_recomendacion := 'REVISAR_MANUAL'; v_dictamen := 'REVISION_MANUAL';
        ELSE
            v_recomendacion := 'RECHAZAR';       v_dictamen := 'RECHAZAR';
        END IF;

        INSERT INTO score (id_solicitud, id_modelo_score, puntaje_total,
                           puntaje_maximo_posible, porcentaje, recomendacion)
        VALUES (v_id_solicitud, v_modelo.id_modelo_score, v_puntaje,
                COALESCE(v_modelo.puntaje_maximo, 1000),
                ROUND(v_puntaje::NUMERIC / COALESCE(v_modelo.puntaje_maximo, 1000) * 100, 2),
                v_recomendacion);
    ELSE
        v_puntaje  := 0;
        v_dictamen := 'REVISION_MANUAL';
    END IF;

    IF v_dictamen = 'RECHAZAR' THEN
        v_estado_final := 'RECHAZADA';
        SELECT id_motivo INTO v_id_motivo
        FROM motivo_rechazo WHERE descripcion_motivo ILIKE '%Historial%' LIMIT 1;
    ELSE
        v_estado_final := 'PENDIENTE';
    END IF;

    SELECT id_estado_solicitud INTO v_id_estado
    FROM estado_solicitud WHERE nombre = v_estado_final;

    UPDATE solicitud_credito
    SET id_estado_solicitud = v_id_estado,
        id_motivo_rechazo   = v_id_motivo,
        proposito           = CASE WHEN v_hay_respuestas
                                   THEN format('Score interno: %s pts', v_puntaje)
                                   ELSE 'Sin cuestionario — requiere revisión manual' END,
        updated_at          = NOW()
    WHERE id_solicitud = v_id_solicitud;

    FOR v_doc IN
        SELECT e->>'tipo' AS tipo, e->>'url' AS url,
               e->>'mime' AS mime, (e->>'tamanio')::BIGINT AS tamanio
        FROM jsonb_array_elements(p_docs) e
        WHERE COALESCE(e->>'url', '') <> ''
        LIMIT 12
    LOOP
        INSERT INTO documento_cliente (id_cliente, tipo_documento, url_archivo, mime_type, tamanio_bytes)
        VALUES (
            v_id_cliente,
            CASE WHEN v_doc.tipo IN ('CEDULA_FRONTAL','CEDULA_TRASERA','RECIBO_PUBLICO','FOTO_NEGOCIO',
                                     'RUT','EXTRACTO_BANCARIO','CAMARA_COMERCIO','OTRO_COMPROBANTE')
                 THEN v_doc.tipo ELSE 'OTRO_COMPROBANTE' END,
            v_doc.url, v_doc.mime, v_doc.tamanio
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success',        true,
        'solicitudId',    v_id_solicitud,
        'score',          v_puntaje,
        'resultado_buro', v_dictamen
    );
END;
$function$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- updated_at
CREATE TRIGGER trg_updated_perfil_usuario  BEFORE UPDATE ON public.perfil_usuario   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_cliente         BEFORE UPDATE ON public.cliente          FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_detalle_cliente BEFORE UPDATE ON public.detalle_cliente  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_solicitud       BEFORE UPDATE ON public.solicitud_credito FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_credito         BEFORE UPDATE ON public.credito          FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_cuota           BEFORE UPDATE ON public.cuota            FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_pago            BEFORE UPDATE ON public.pago             FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- auditoría
CREATE TRIGGER trg_audit_cliente   AFTER INSERT OR DELETE OR UPDATE ON public.cliente            FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_audit_credito   AFTER INSERT OR DELETE OR UPDATE ON public.credito            FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_audit_decision  AFTER INSERT OR DELETE OR UPDATE ON public.decision_solicitud FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_audit_pago      AFTER INSERT OR DELETE OR UPDATE ON public.pago               FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();
CREATE TRIGGER trg_audit_solicitud AFTER INSERT OR DELETE OR UPDATE ON public.solicitud_credito  FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

-- negocio
CREATE TRIGGER trigger_evitar_solicitudes_frecuentes BEFORE INSERT ON public.solicitud_credito FOR EACH ROW EXECUTE FUNCTION proteger_solicitud_trimestral();

-- Triggers sobre auth.users (registro y autoconfirmación de email)
CREATE TRIGGER trg_handle_new_user_registration AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_registration();
CREATE TRIGGER trg_auto_confirm_user            AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION auto_confirm_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE rol                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_cliente           ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_solicitud         ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivo_rechazo           ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelo_score             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_documento_identidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_negocio             ENABLE ROW LEVEL SECURITY;
ALTER TABLE banco                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamento             ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipio                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregunta                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE opcion_pregunta          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rango_puntaje_pregunta   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_documento_legal     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_notificacion        ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfil_usuario           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_cliente          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_cliente        ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_credito        ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuesta_cliente        ENABLE ROW LEVEL SECURITY;
ALTER TABLE score                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_solicitud       ENABLE ROW LEVEL SECURITY;
ALTER TABLE credito                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_pago                ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuota                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pago                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignacion_asesor        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_cobranza         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_legal          ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_descarga_documento   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacion             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pqr                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria                ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_funnel            ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_recuperacion         ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_error_registro       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agente_base_conocimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE agente_ticket            ENABLE ROW LEVEL SECURITY;

-- ---- Políticas ---------------------------------------------------------------
-- Catálogos: lectura para autenticados
CREATE POLICY "Lectura autenticados" ON modelo_score AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON opcion_pregunta AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON estado_cliente AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON estado_solicitud AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON pregunta AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON motivo_rechazo AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON rol AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON tipo_documento_identidad AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON tipo_negocio AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON tipo_notificacion AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Lectura autenticados" ON tipo_documento_legal AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "leer_bancos" ON banco AS PERMISSIVE FOR SELECT USING ((activo = true));
CREATE POLICY "admin_gestionar_bancos" ON banco AS PERMISSIVE FOR ALL USING (es_admin());
CREATE POLICY "leer_departamentos" ON departamento AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "leer_municipios" ON municipio AS PERMISSIVE FOR SELECT USING ((activo = true));
CREATE POLICY "admin_gestionar_municipios" ON municipio AS PERMISSIVE FOR ALL USING (es_admin());
CREATE POLICY "leer_rangos_autenticados" ON rango_puntaje_pregunta AS PERMISSIVE FOR SELECT USING ((activo = true));
CREATE POLICY "admin_gestionar_rangos" ON rango_puntaje_pregunta AS PERMISSIVE FOR ALL USING (es_admin());

-- perfil_usuario
CREATE POLICY "usuario_ver_su_perfil" ON perfil_usuario AS PERMISSIVE FOR SELECT USING (((id = auth.uid()) OR es_admin()));
CREATE POLICY "admin_gestionar_perfiles" ON perfil_usuario AS PERMISSIVE FOR ALL USING (es_admin());

-- cliente
CREATE POLICY "cliente_ver_su_registro" ON cliente AS PERMISSIVE FOR SELECT USING (((id_usuario_cuenta = auth.uid()) OR es_analista_o_admin()));
CREATE POLICY "cliente_actualizar_su_registro" ON cliente AS PERMISSIVE FOR UPDATE USING ((id_usuario_cuenta = auth.uid())) WITH CHECK ((id_usuario_cuenta = auth.uid()));
CREATE POLICY "cliente_registrarse" ON cliente AS PERMISSIVE FOR INSERT WITH CHECK (((id_usuario_cuenta = auth.uid()) OR es_analista_o_admin()));
CREATE POLICY "admin_gestionar_clientes" ON cliente AS PERMISSIVE FOR ALL USING (es_analista_o_admin());
CREATE POLICY "asesor_ver_clientes_asignados" ON cliente AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- detalle_cliente
CREATE POLICY "ver_detalle_propio" ON detalle_cliente AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
CREATE POLICY "admin_gestionar_detalle" ON detalle_cliente AS PERMISSIVE FOR ALL USING (es_analista_o_admin());
CREATE POLICY "asesor_ver_detalle_asignado" ON detalle_cliente AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- documento_cliente
CREATE POLICY "ver_documentos_propios" ON documento_cliente AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
CREATE POLICY "cliente_subir_documentos" ON documento_cliente AS PERMISSIVE FOR INSERT WITH CHECK ((id_cliente = mi_id_cliente()));
CREATE POLICY "admin_gestionar_documentos" ON documento_cliente AS PERMISSIVE FOR ALL USING (es_analista_o_admin());
CREATE POLICY "asesor_ver_documentos_asignados" ON documento_cliente AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- solicitud_credito
CREATE POLICY "ver_solicitudes_propias" ON solicitud_credito AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
CREATE POLICY "cliente_crear_solicitud" ON solicitud_credito AS PERMISSIVE FOR INSERT WITH CHECK ((id_cliente = mi_id_cliente()));
CREATE POLICY "analista_actualizar_solicitud" ON solicitud_credito AS PERMISSIVE FOR UPDATE USING (es_analista_o_admin());
CREATE POLICY "asesor_ver_solicitudes_asignadas" ON solicitud_credito AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- respuesta_cliente
CREATE POLICY "cliente_ver_sus_respuestas" ON respuesta_cliente AS PERMISSIVE FOR SELECT USING (((id_solicitud IN ( SELECT solicitud_credito.id_solicitud FROM solicitud_credito WHERE (solicitud_credito.id_cliente = mi_id_cliente()))) OR es_analista_o_admin()));
CREATE POLICY "cliente_insertar_respuestas" ON respuesta_cliente AS PERMISSIVE FOR INSERT WITH CHECK ((id_solicitud IN ( SELECT solicitud_credito.id_solicitud FROM solicitud_credito WHERE (solicitud_credito.id_cliente = mi_id_cliente()))));

-- score
CREATE POLICY "analista_ver_scores" ON score AS PERMISSIVE FOR SELECT USING (es_analista_o_admin());
CREATE POLICY "sistema_insertar_score" ON score AS PERMISSIVE FOR INSERT WITH CHECK (es_analista_o_admin());

-- decision_solicitud
CREATE POLICY "ver_decisiones_propias" ON decision_solicitud AS PERMISSIVE FOR SELECT USING (((id_analista = auth.uid()) OR es_analista_o_admin()));
CREATE POLICY "analista_crear_decision" ON decision_solicitud AS PERMISSIVE FOR INSERT WITH CHECK (es_analista_o_admin());
CREATE POLICY "analista_actualizar_decision" ON decision_solicitud AS PERMISSIVE FOR UPDATE USING (es_analista_o_admin());

-- credito
CREATE POLICY "ver_creditos_propios" ON credito AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
CREATE POLICY "admin_gestionar_creditos" ON credito AS PERMISSIVE FOR ALL USING (es_analista_o_admin());
CREATE POLICY "asesor_ver_creditos_asignados" ON credito AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- plan_pago
CREATE POLICY "ver_planes_propios" ON plan_pago AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1 FROM credito c WHERE ((c.id_credito = plan_pago.id_credito) AND ((c.id_cliente = mi_id_cliente()) OR es_analista_o_admin())))));
CREATE POLICY "asesor_ver_planes_asignados" ON plan_pago AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1 FROM credito c WHERE ((c.id_credito = plan_pago.id_credito) AND es_asesor_de_cliente(c.id_cliente)))));

-- cuota
CREATE POLICY "ver_cuotas_propias" ON cuota AS PERMISSIVE FOR SELECT USING (((id_plan_pago IN ( SELECT pp.id_plan_pago FROM (plan_pago pp JOIN credito c ON ((c.id_credito = pp.id_credito))) WHERE (c.id_cliente = mi_id_cliente()))) OR es_analista_o_admin()));
CREATE POLICY "asesor_ver_cuotas_asignadas" ON cuota AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1 FROM (plan_pago pp JOIN credito c ON ((c.id_credito = pp.id_credito))) WHERE ((pp.id_plan_pago = cuota.id_plan_pago) AND es_asesor_de_cliente(c.id_cliente)))));

-- pago
CREATE POLICY "ver_pagos_propios" ON pago AS PERMISSIVE FOR SELECT USING (((id_credito IN ( SELECT credito.id_credito FROM credito WHERE (credito.id_cliente = mi_id_cliente()))) OR es_analista_o_admin()));
CREATE POLICY "registrar_pago_autenticado" ON pago AS PERMISSIVE FOR INSERT WITH CHECK (((id_credito IN ( SELECT credito.id_credito FROM credito WHERE (credito.id_cliente = mi_id_cliente()))) OR es_analista_o_admin()));
CREATE POLICY "staff_insertar_pago" ON pago AS PERMISSIVE FOR INSERT WITH CHECK (es_staff());
CREATE POLICY "asesor_ver_pagos_asignados" ON pago AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1 FROM credito c WHERE ((c.id_credito = pago.id_credito) AND es_asesor_de_cliente(c.id_cliente)))));

-- asignacion_asesor
CREATE POLICY "asesor_ver_sus_asignaciones" ON asignacion_asesor AS PERMISSIVE FOR SELECT USING ((id_asesor = auth.uid()));
CREATE POLICY "supervisor_admin_gestionar_asignaciones" ON asignacion_asesor AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1 FROM (perfil_usuario pu JOIN rol r ON ((r.id_rol = pu.id_rol))) WHERE ((pu.id = auth.uid()) AND ((r.nombre_rol)::text = ANY ((ARRAY['ADMIN'::character varying, 'SUPERVISOR'::character varying])::text[]))))));

-- gestion_cobranza
CREATE POLICY "asesor_gestionar_sus_cobros" ON gestion_cobranza AS PERMISSIVE FOR ALL USING ((id_asesor = auth.uid()));
CREATE POLICY "supervisor_admin_ver_cobros" ON gestion_cobranza AS PERMISSIVE FOR SELECT USING ((EXISTS ( SELECT 1 FROM (perfil_usuario pu JOIN rol r ON ((r.id_rol = pu.id_rol))) WHERE ((pu.id = auth.uid()) AND ((r.nombre_rol)::text = ANY ((ARRAY['ADMIN'::character varying, 'SUPERVISOR'::character varying])::text[]))))));

-- documento_legal / log_descarga
CREATE POLICY "ver_documentos_legales_propios" ON documento_legal AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
CREATE POLICY "cliente_ver_sus_descargas" ON log_descarga_documento AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
CREATE POLICY "sistema_registrar_descarga" ON log_descarga_documento AS PERMISSIVE FOR INSERT WITH CHECK (true);

-- notificacion
CREATE POLICY "ver_notificaciones_propias" ON notificacion AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));

-- pqr
CREATE POLICY "cliente_ve_sus_pqr" ON pqr AS PERMISSIVE FOR SELECT USING ((id_cliente = mi_id_cliente()));
CREATE POLICY "cliente_crea_sus_pqr" ON pqr AS PERMISSIVE FOR INSERT WITH CHECK ((id_cliente = mi_id_cliente()));
CREATE POLICY "staff_gestiona_pqr" ON pqr AS PERMISSIVE FOR ALL USING ((EXISTS ( SELECT 1 FROM (perfil_usuario pu JOIN rol r ON ((r.id_rol = pu.id_rol))) WHERE ((pu.id = auth.uid()) AND ((r.nombre_rol)::text = ANY ((ARRAY['ADMIN'::character varying, 'SUPERVISOR'::character varying, 'ASESOR'::character varying])::text[])) AND (pu.activo = true)))));

-- auditoria
CREATE POLICY "solo_admin_ver_auditoria" ON auditoria AS PERMISSIVE FOR SELECT USING (es_admin());

-- evento_funnel
CREATE POLICY "servicio puede todo en funnel" ON evento_funnel AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);

-- otp_recuperacion (solo service_role: la app usa service key para leer/escribir)
CREATE POLICY "solo_service_role" ON otp_recuperacion AS PERMISSIVE FOR ALL USING (false);

-- log_error_registro
CREATE POLICY "admin_ver_log_registro" ON log_error_registro AS PERMISSIVE FOR SELECT USING (es_admin());

-- agente virtual
CREATE POLICY "agente lee conocimiento" ON agente_base_conocimiento AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "auth lee conocimiento" ON agente_base_conocimiento AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "agente aprende" ON agente_base_conocimiento AS PERMISSIVE FOR INSERT WITH CHECK (true);
CREATE POLICY "auth gestiona conocimiento" ON agente_base_conocimiento AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "agente lee tickets" ON agente_ticket AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "agente crea tickets" ON agente_ticket AS PERMISSIVE FOR INSERT WITH CHECK (true);
CREATE POLICY "agente resuelve tickets" ON agente_ticket AS PERMISSIVE FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "auth gestiona tickets" ON agente_ticket AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON TABLE rol IS 'Roles del sistema (4): ADMIN, SUPERVISOR, ASESOR, CLIENTE';
COMMENT ON TABLE estado_cliente IS 'Estados del cliente: ACTIVO, BLOQUEADO, INACTIVO';
COMMENT ON TABLE estado_solicitud IS 'Estados del flujo de solicitud de crédito';
COMMENT ON TABLE motivo_rechazo IS 'Catálogo de motivos de rechazo de solicitudes. visible_cliente indica si el cliente puede verlo';
COMMENT ON TABLE modelo_score IS 'Modelos de scoring crediticio. puntaje_minimo define el umbral de aprobación automática';
COMMENT ON TABLE tipo_documento_identidad IS 'Tipos de documento: CC, NIT, CE, PASAPORTE, PPT';
COMMENT ON TABLE tipo_negocio IS 'Categorías de negocio de los comerciantes/emprendedores';
COMMENT ON TABLE banco IS 'Bancos y billeteras digitales para el cuestionario. Reemplaza la constante BANCOS del frontend';
COMMENT ON TABLE departamento IS 'Departamentos de Colombia (código DANE) para normalizar ubicaciones';
COMMENT ON TABLE municipio IS 'Municipios de Colombia (fuente DANE) para normalizar ciudad. FK a departamento';
COMMENT ON TABLE pregunta IS 'Preguntas del formulario de solicitud. tipo_pregunta categoriza para el scoring';
COMMENT ON TABLE opcion_pregunta IS 'Opciones de respuesta con puntaje. valor_puntos se suma al score_total en la tabla score';
COMMENT ON TABLE rango_puntaje_pregunta IS 'Puntos de score por rango de valor para preguntas MONEDA/NUMERO. Un valor v aplica al rango si v >= valor_min y (valor_max es NULL o v < valor_max)';
COMMENT ON TABLE tipo_documento_legal IS 'Catálogo de documentos. requiere_credito_cancelado implementa RN-10 (paz y salvo). max_descargas_dia implementa RN-06';
COMMENT ON TABLE tipo_notificacion IS 'Tipos de notificación con plantillas. Canal: EMAIL/SMS/PUSH. Implementa RN-13 (recordatorio pago)';
COMMENT ON TABLE perfil_usuario IS 'Extiende auth.users. NO almacena contraseñas — Supabase Auth las maneja. intentos_fallidos implementa RN-02';
COMMENT ON TABLE cliente IS 'Comerciante/emprendedor. dni y email son únicos (RN-11). telefono validado a 10 dígitos (RN-01)';
COMMENT ON TABLE detalle_cliente IS 'Información financiera y socioeconómica del cliente para el scoring';
COMMENT ON TABLE documento_cliente IS 'Documentos KYC en Supabase Storage (bucket privado). estado_verificacion para flujo de aprobación';
COMMENT ON TABLE solicitud_credito IS 'Solicitud de crédito. plazo_meses y tasa_propuesta son críticos para la calculadora (RF-02)';
COMMENT ON TABLE respuesta_cliente IS 'Respuestas del formulario de solicitud. Puede ser opción múltiple o texto libre';
COMMENT ON TABLE score IS 'Resultado del motor de scoring. recomendacion guía la decisión del analista';
COMMENT ON TABLE decision_solicitud IS 'Decisión formal del analista. monto_aprobado puede diferir del solicitado. tasa_aprobada es la definitiva';
COMMENT ON TABLE credito IS 'Crédito activo. tasa_mensual y cuota_fija se congelan al desembolsar. Estado: ACTIVO/EN_MORA/CANCELADO/CASTIGADO';
COMMENT ON TABLE cuota IS 'Cuotas del plan. estado_cuota: PENDIENTE/PAGADA/VENCIDA. RN-08: VENCIDA se muestra en rojo en la UI';
COMMENT ON TABLE pago IS 'Registros de pago. referencia_externa para reconciliar con Wompi. RN-12: permite pagos parciales. RN-14: auditoría completa';
COMMENT ON TABLE asignacion_asesor IS 'Asignación de clientes a asesores para gestión de cobro y seguimiento';
COMMENT ON TABLE gestion_cobranza IS 'Registro de gestiones de cobro realizadas por asesores';
COMMENT ON TABLE documento_legal IS 'Documentos PDF generados. hash_archivo para integridad (RNM-04). Conservar 5 años (RN-15)';
COMMENT ON TABLE log_descarga_documento IS 'Log de descargas para aplicar RN-06: máximo 2 descargas/día por documento por cliente';
COMMENT ON TABLE notificacion IS 'Log de notificaciones enviadas. Implementa RN-13 (recordatorio 3 días antes del vencimiento)';
COMMENT ON TABLE pqr IS 'Peticiones, Quejas, Reclamos y Sugerencias de los clientes';
COMMENT ON TABLE auditoria IS 'Trazabilidad completa. Implementa RNM-10, RNF-04. valor_anterior/nuevo en JSONB para consultas eficientes';
COMMENT ON TABLE log_error_registro IS 'Errores del trigger handle_new_user_registration. Si hay filas aquí existen usuarios en auth.users sin fila en cliente/perfil_usuario que hay que reparar';
COMMENT ON TABLE agente_base_conocimiento IS 'Base de conocimiento del agente virtual de servicio al cliente. Crece automáticamente con las respuestas del equipo técnico.';
COMMENT ON TABLE agente_ticket IS 'Preguntas escaladas por el agente virtual al equipo técnico. Al resolverse alimentan la base de conocimiento.';

COMMENT ON COLUMN cliente.primer_nombre IS 'Fuente canónica del nombre del cliente (1FN). Concatenar en app con fn_format_nombre / formatNombre.';
COMMENT ON COLUMN cliente.primer_apellido IS 'Fuente canónica del primer apellido del cliente (1FN).';
COMMENT ON COLUMN perfil_usuario.primer_nombre IS 'Solo para roles internos (ASESOR/SUPERVISOR/ADMIN). Clientes: NULL; ver tabla cliente.';
COMMENT ON COLUMN pregunta.tipo_input IS 'SELECT | TEXTO | NUMERO | MONEDA | UBICACION | BANCO. NUMERO y MONEDA exigen respuesta numérica (respuesta_cliente.respuesta_numerica)';
COMMENT ON COLUMN respuesta_cliente.respuesta_numerica IS 'Valor numérico de la respuesta cuando la pregunta es MONEDA o NUMERO. Permite usarla en cálculos de score y métricas sin castear texto';

-- ============================================================================
-- FIN DEL ESQUEMA CONSOLIDADO (2026-08-13)
-- ============================================================================
