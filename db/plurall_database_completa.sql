-- ============================================================
-- PLURALL — SCRIPT SQL COMPLETO v1.0
-- Plataforma de Gestión de Créditos para Comerciantes
-- Proyecto Formativo SENA | Tecnólogo ADSO
-- Instructor: Jefry González
-- ============================================================
-- INSTRUCCIONES:
-- 1. Abrir Supabase → SQL Editor
-- 2. Copiar TODO este script
-- 3. Hacer clic en "Run" (botón verde)
-- 4. Verificar que aparezca "Success" al final
-- ============================================================


-- ============================================================
-- PASO 0: EXTENSIONES NECESARIAS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";


-- ============================================================
-- PASO 1: TABLAS CATÁLOGO (sin dependencias)
-- Estas tablas son las primeras porque las demás las referencian
-- ============================================================

-- 1.1 ROL
-- Define los tipos de usuario del sistema
CREATE TABLE rol (
    id_rol      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_rol  VARCHAR(50) NOT NULL UNIQUE,
    -- 'ADMIN', 'ANALISTA', 'CLIENTE'
    descripcion TEXT,
    activo      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE rol IS 'Roles del sistema: ADMIN, ANALISTA, CLIENTE';


-- 1.2 ESTADO_CLIENTE
-- Catálogo de estados posibles de un cliente
CREATE TABLE estado_cliente (
    id_estado_cliente UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre            VARCHAR(50) NOT NULL UNIQUE,
    -- 'ACTIVO', 'BLOQUEADO', 'INACTIVO'
    descripcion       TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE estado_cliente IS 'Estados del cliente: ACTIVO, BLOQUEADO, INACTIVO';


-- 1.3 ESTADO_SOLICITUD
-- Catálogo de etapas por las que pasa una solicitud de crédito
CREATE TABLE estado_solicitud (
    id_estado_solicitud UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(50) NOT NULL UNIQUE,
    -- 'PENDIENTE', 'EN_ESTUDIO', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'DESEMBOLSADA'
    descripcion         TEXT,
    orden               INT,  -- Para mostrar en orden de flujo
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE estado_solicitud IS 'Estados del flujo de solicitud de crédito';


-- 1.4 MOTIVO_RECHAZO
-- Catálogo de razones por las que se puede rechazar una solicitud
CREATE TABLE motivo_rechazo (
    id_motivo        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    descripcion_motivo TEXT  NOT NULL,
    visible_cliente  BOOLEAN NOT NULL DEFAULT false,
    -- Si es true, el cliente puede ver este motivo en su portal (RN-05 relacionado)
    activo           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE motivo_rechazo IS 'Catálogo de motivos de rechazo de solicitudes. visible_cliente indica si el cliente puede verlo';


-- 1.5 MODELO_SCORE
-- Modelos de evaluación de riesgo crediticio
CREATE TABLE modelo_score (
    id_modelo_score UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_modelo   VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    puntaje_minimo  INT          NOT NULL DEFAULT 600,
    -- Puntaje mínimo para aprobación automática
    puntaje_maximo  INT          NOT NULL DEFAULT 1000,
    activo          BOOLEAN      NOT NULL DEFAULT true,
    vigente_desde   DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE modelo_score IS 'Modelos de scoring crediticio. puntaje_minimo define el umbral de aprobación automática';


-- 1.6 TIPO_DOCUMENTO_IDENTIDAD
-- Tipos de documento de identidad aceptados
CREATE TABLE tipo_documento_identidad (
    id_tipo_doc UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      VARCHAR(10)  NOT NULL UNIQUE,
    -- 'CC', 'NIT', 'CE', 'PASAPORTE', 'PPT'
    nombre      VARCHAR(50)  NOT NULL,
    activo      BOOLEAN      NOT NULL DEFAULT true
);

COMMENT ON TABLE tipo_documento_identidad IS 'Tipos de documento: CC, NIT, CE, PASAPORTE, PPT';


-- 1.7 TIPO_NEGOCIO
-- Categorías de negocio de los comerciantes
CREATE TABLE tipo_negocio (
    id_tipo_negocio UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(100) NOT NULL UNIQUE,
    -- 'TIENDA DE BARRIO', 'RESTAURANTE', 'EMPRENDIMIENTO', etc.
    activo          BOOLEAN      NOT NULL DEFAULT true
);

COMMENT ON TABLE tipo_negocio IS 'Categorías de negocio de los comerciantes/emprendedores';


-- 1.8 PREGUNTA
-- Preguntas del formulario dinámico de solicitud de crédito
CREATE TABLE pregunta (
    id_pregunta   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    enunciado     TEXT        NOT NULL,
    tipo_pregunta VARCHAR(50) NOT NULL,
    -- 'SOCIECONOMICA', 'LABORAL', 'FINANCIERA', 'NEGOCIO'
    orden         INT,
    obligatoria   BOOLEAN     NOT NULL DEFAULT true,
    activo        BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE pregunta IS 'Preguntas del formulario de solicitud. tipo_pregunta categoriza para el scoring';


-- ============================================================
-- PASO 2: TABLAS DE USUARIO Y PERFIL
-- Extienden el sistema de Auth de Supabase
-- ============================================================

-- 2.1 PERFIL_USUARIO
-- Extiende auth.users de Supabase con datos adicionales del sistema
-- NO tiene campo contraseña — Supabase Auth maneja el hash con bcrypt
CREATE TABLE perfil_usuario (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- FK al sistema de autenticación de Supabase
    id_rol     UUID NOT NULL REFERENCES rol(id_rol),
    nombre_completo VARCHAR(150),
    activo     BOOLEAN NOT NULL DEFAULT true,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    -- Para implementar RN-02: bloqueo tras 3 intentos
    bloqueado_hasta   TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE perfil_usuario IS 'Extiende auth.users. NO almacena contraseñas — Supabase Auth las maneja. intentos_fallidos implementa RN-02';


-- ============================================================
-- PASO 3: TABLAS DE CLIENTE (comerciante/emprendedor)
-- ============================================================

-- 3.1 CLIENTE
-- Información principal del comerciante que solicita créditos
CREATE TABLE cliente (
    id_cliente        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario_cuenta UUID NOT NULL REFERENCES perfil_usuario(id) ON DELETE RESTRICT,
    -- Cuenta de acceso al portal
    id_estado_cliente UUID NOT NULL REFERENCES estado_cliente(id_estado_cliente),
    id_tipo_doc       UUID REFERENCES tipo_documento_identidad(id_tipo_doc),

    -- Datos personales
    nombre_completo   VARCHAR(150) NOT NULL,
    dni               VARCHAR(20)  NOT NULL,
    -- RN-11: DNI único en el sistema
    email             VARCHAR(100) NOT NULL,
    -- RN-11: Email único en el sistema
    telefono          VARCHAR(20)  NOT NULL,
    -- RN-01: 10 dígitos, código +57 se agrega automáticamente
    direccion         TEXT,
    ciudad            VARCHAR(100),
    departamento      VARCHAR(100),

    -- Datos del negocio
    nombre_negocio    VARCHAR(150),
    id_tipo_negocio   UUID REFERENCES tipo_negocio(id_tipo_negocio),
    descripcion_negocio TEXT,
    antiguedad_negocio_meses INT,

    -- Scoring interno
    score_credito     INT DEFAULT 0,
    -- Puntaje calculado por el motor de scoring (0-1000)

    -- Auditoría
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_cliente_dni   UNIQUE (dni),
    CONSTRAINT uq_cliente_email UNIQUE (email),
    CONSTRAINT ck_telefono_len  CHECK (LENGTH(REGEXP_REPLACE(telefono, '\D', '', 'g')) = 10)
);

COMMENT ON TABLE cliente IS 'Comerciante/emprendedor. dni y email son únicos (RN-11). telefono validado a 10 dígitos (RN-01)';


-- 3.2 DETALLE_CLIENTE
-- Información financiera y laboral adicional del cliente
CREATE TABLE detalle_cliente (
    id_detalle     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cliente     UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    tipo_vivienda  VARCHAR(50),
    -- 'PROPIA', 'ARRENDADA', 'FAMILIAR'
    estrato        INT,
    nivel_educativo VARCHAR(50),
    estado_civil   VARCHAR(30),
    personas_cargo INT DEFAULT 0,
    ingresos_mensuales    DECIMAL(15,2),
    egresos_mensuales     DECIMAL(15,2),
    patrimonio_estimado   DECIMAL(15,2),
    otras_obligaciones    DECIMAL(15,2) DEFAULT 0,
    -- Deudas con otros prestamistas
    banco_preferido       VARCHAR(100),
    tipo_cuenta_bancaria  VARCHAR(30),
    numero_cuenta         VARCHAR(30),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE detalle_cliente IS 'Información financiera y socioeconómica del cliente para el scoring';


-- 3.3 DOCUMENTO_CLIENTE
-- Documentos KYC subidos al sistema (Supabase Storage)
CREATE TABLE documento_cliente (
    id_documento         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cliente           UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
    tipo_documento       VARCHAR(50) NOT NULL,
    -- 'CEDULA_FRONTAL', 'CEDULA_TRASERA', 'RUT', 'EXTRACTO_BANCARIO', 'CAMARA_COMERCIO'
    url_archivo          VARCHAR(500) NOT NULL,
    -- URL en Supabase Storage (bucket privado)
    mime_type            VARCHAR(100),
    -- 'application/pdf', 'image/jpeg', 'image/png'
    tamanio_bytes        BIGINT,
    estado_verificacion  VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    -- 'PENDIENTE', 'APROBADO', 'RECHAZADO'
    motivo_rechazo_doc   TEXT,
    verificado_por       UUID REFERENCES perfil_usuario(id),
    verificado_at        TIMESTAMP WITH TIME ZONE,
    -- RN-10: documentos se conservan mínimo 5 años
    fecha_vencimiento    DATE,
    activo               BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE documento_cliente IS 'Documentos KYC en Supabase Storage (bucket privado). estado_verificacion para flujo de aprobación';


-- ============================================================
-- PASO 4: TABLAS DE SOLICITUD DE CRÉDITO
-- ============================================================

-- 4.1 SOLICITUD_CREDITO
CREATE TABLE solicitud_credito (
    id_solicitud          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cliente            UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
    id_estado_solicitud   UUID NOT NULL REFERENCES estado_solicitud(id_estado_solicitud),
    id_usuario_evaluador  UUID REFERENCES perfil_usuario(id),
    -- Analista asignado para revisar
    id_motivo_rechazo     UUID REFERENCES motivo_rechazo(id_motivo),

    -- Datos de la solicitud
    monto_solicitado      DECIMAL(15,2) NOT NULL,
    plazo_meses           INT NOT NULL,
    -- CRÍTICO: Campo faltante identificado en análisis v3
    tasa_interes_propuesta DECIMAL(5,4),
    -- Tasa mensual propuesta al momento de la solicitud
    proposito             TEXT,
    -- Para qué usará el dinero el comerciante
    canal_solicitud       VARCHAR(20) NOT NULL DEFAULT 'WEB',
    -- 'WEB', 'MOBILE', 'PRESENCIAL'

    -- Fechas del proceso
    fecha_solicitud       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_asignacion      TIMESTAMP WITH TIME ZONE,
    fecha_decision        TIMESTAMP WITH TIME ZONE,

    -- Observaciones
    comentarios_analista  TEXT,
    comentarios_cliente   TEXT,

    -- Auditoría
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE solicitud_credito IS 'Solicitud de crédito. plazo_meses y tasa_propuesta son críticos para la calculadora (RF-02)';


-- 4.2 OPCION_PREGUNTA
-- Opciones de respuesta para las preguntas del formulario
CREATE TABLE opcion_pregunta (
    id_opcion    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pregunta  UUID NOT NULL REFERENCES pregunta(id_pregunta) ON DELETE CASCADE,
    texto_opcion TEXT NOT NULL,
    valor_puntos INT  NOT NULL DEFAULT 0,
    -- Puntos que suma al score del cliente al seleccionar esta opción
    orden        INT,
    activo       BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE opcion_pregunta IS 'Opciones de respuesta con puntaje. valor_puntos se suma al score_total en la tabla score';


-- 4.3 RESPUESTA_CLIENTE
-- Respuestas dadas por el cliente al formulario de solicitud
CREATE TABLE respuesta_cliente (
    id_respuesta     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud     UUID NOT NULL REFERENCES solicitud_credito(id_solicitud) ON DELETE CASCADE,
    id_pregunta      UUID NOT NULL REFERENCES pregunta(id_pregunta),
    id_opcion        UUID REFERENCES opcion_pregunta(id_opcion),
    respuesta_texto  TEXT,
    -- Para preguntas de texto libre
    fecha_respuesta  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE respuesta_cliente IS 'Respuestas del formulario de solicitud. Puede ser opción múltiple o texto libre';


-- 4.4 SCORE
-- Resultado del scoring crediticio de una solicitud
CREATE TABLE score (
    id_score         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud     UUID NOT NULL REFERENCES solicitud_credito(id_solicitud) ON DELETE CASCADE,
    id_modelo_score  UUID NOT NULL REFERENCES modelo_score(id_modelo_score),
    puntaje_total    INT  NOT NULL DEFAULT 0,
    -- Suma de valor_puntos de todas las respuestas
    puntaje_maximo_posible INT,
    porcentaje       DECIMAL(5,2),
    -- puntaje_total / puntaje_maximo_posible * 100
    recomendacion    VARCHAR(20),
    -- 'APROBAR', 'RECHAZAR', 'REVISAR_MANUAL'
    fecha_evaluacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE score IS 'Resultado del motor de scoring. recomendacion guía la decisión del analista';


-- 4.5 DECISION_SOLICITUD
-- Decisión formal del analista sobre una solicitud
CREATE TABLE decision_solicitud (
    id_decision          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud         UUID NOT NULL REFERENCES solicitud_credito(id_solicitud) ON DELETE RESTRICT,
    id_motivo_rechazo    UUID REFERENCES motivo_rechazo(id_motivo),
    id_analista          UUID NOT NULL REFERENCES perfil_usuario(id),

    resultado            VARCHAR(20) NOT NULL,
    -- 'APROBADO', 'RECHAZADO', 'DEVUELTO'
    monto_aprobado       DECIMAL(15,2),
    -- Puede diferir del monto_solicitado
    plazo_aprobado       INT,
    tasa_interes_aprobada DECIMAL(5,4),
    -- Tasa mensual definitiva aprobada

    comentarios_tecnicos TEXT,
    -- Justificación interna del analista
    comentarios_cliente  TEXT,
    -- Lo que verá el cliente si el resultado es visible

    fecha_decision       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE decision_solicitud IS 'Decisión formal del analista. monto_aprobado puede diferir del solicitado. tasa_aprobada es la definitiva';


-- ============================================================
-- PASO 5: TABLAS DE CRÉDITO Y PLAN DE PAGOS
-- ============================================================

-- 5.1 CREDITO
-- Crédito activo (solo se crea cuando la solicitud fue APROBADA y desembolsada)
CREATE TABLE credito (
    id_credito            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud          UUID NOT NULL REFERENCES solicitud_credito(id_solicitud) ON DELETE RESTRICT,
    id_cliente            UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,

    -- Valores financieros (congelados al momento del desembolso — son un contrato)
    monto_desembolsado    DECIMAL(15,2) NOT NULL,
    tasa_interes_anual    DECIMAL(5,2)  NOT NULL,
    tasa_interes_mensual  DECIMAL(8,6)  NOT NULL,
    -- CRÍTICO: guardada al desembolsar, nunca recalcular
    -- Fórmula: (1 + tasa_anual/100)^(1/12) - 1
    numero_cuotas         INT           NOT NULL,
    cuota_fija            DECIMAL(15,2) NOT NULL,
    -- Valor fijo de cada cuota (amortización francesa)

    -- Fechas
    fecha_desembolso      TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_primera_cuota   DATE          NOT NULL,
    fecha_ultima_cuota    DATE          NOT NULL,

    -- Estado y seguimiento
    estado_credito        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO',
    -- 'ACTIVO', 'EN_MORA', 'CANCELADO', 'CASTIGADO'
    saldo_pendiente       DECIMAL(15,2) NOT NULL,
    cuotas_pagadas        INT           NOT NULL DEFAULT 0,
    cuotas_en_mora        INT           NOT NULL DEFAULT 0,
    dias_mora_maximo      INT           NOT NULL DEFAULT 0,
    -- Máximo de días de mora acumulados en este crédito

    -- RN-07: Un cliente solo puede tener UN crédito ACTIVO a la vez
    -- Este constraint se valida en el backend antes de crear el registro

    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE credito IS 'Crédito activo. tasa_mensual y cuota_fija se congelan al desembolsar. Estado: ACTIVO/EN_MORA/CANCELADO/CASTIGADO';


-- 5.2 PLAN_PAGO
-- Calendario de amortización del crédito
CREATE TABLE plan_pago (
    id_plan_pago          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_credito            UUID NOT NULL REFERENCES credito(id_credito) ON DELETE CASCADE,
    num_cuotas_totales    INT          NOT NULL,
    frecuencia_pago       VARCHAR(20)  NOT NULL DEFAULT 'MENSUAL',
    -- 'MENSUAL', 'QUINCENAL'
    fecha_inicio_cobro    DATE         NOT NULL,
    fecha_fin_cobro       DATE         NOT NULL,
    tasa_mora_diaria      DECIMAL(8,6) NOT NULL DEFAULT 0.001,
    -- Tasa diaria de mora para cálculo de intereses de mora
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE plan_pago IS 'Calendario del crédito. tasa_mora_diaria para calcular intereses cuando hay mora';


-- 5.3 CUOTA
-- Cada una de las cuotas del plan de pagos
CREATE TABLE cuota (
    id_cuota               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_plan_pago           UUID NOT NULL REFERENCES plan_pago(id_plan_pago) ON DELETE CASCADE,

    numero_cuota           INT          NOT NULL,
    -- Número secuencial: 1, 2, 3... hasta num_cuotas_totales

    -- Composición de la cuota (amortización francesa)
    monto_capital          DECIMAL(15,2) NOT NULL,
    monto_interes          DECIMAL(15,2) NOT NULL,
    monto_total_cuota      DECIMAL(15,2) NOT NULL,
    saldo_despues_pago     DECIMAL(15,2) NOT NULL,
    -- Saldo que queda después de pagar esta cuota

    -- Fechas y estado
    fecha_vencimiento      DATE          NOT NULL,
    estado_cuota           VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',
    -- 'PENDIENTE', 'PAGADA', 'VENCIDA', 'PAGADA_MORA', 'CONDONADA'

    -- Valores reales cuando se paga (pueden diferir si hay mora)
    monto_pagado_real      DECIMAL(15,2),
    monto_mora_cobrada     DECIMAL(15,2) DEFAULT 0,
    fecha_pago_real        DATE,

    -- RN-08: Las cuotas VENCIDAS se muestran en ROJO en la interfaz
    -- Esto lo maneja el frontend con estado_cuota = 'VENCIDA'

    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE cuota IS 'Cuotas del plan. estado_cuota: PENDIENTE/PAGADA/VENCIDA. RN-08: VENCIDA se muestra en rojo en la UI';


-- 5.4 PAGO
-- Registro de cada abono realizado por el cliente
CREATE TABLE pago (
    id_recibo            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cuota             UUID NOT NULL REFERENCES cuota(id_cuota) ON DELETE RESTRICT,
    id_credito           UUID NOT NULL REFERENCES credito(id_credito) ON DELETE RESTRICT,
    -- Redundante pero útil para queries directas de historial
    id_usuario_receptor  UUID REFERENCES perfil_usuario(id),
    -- Quien procesó el pago (puede ser null si es automático)

    -- Valores del pago
    monto_pagado         DECIMAL(15,2) NOT NULL,
    -- RN-12: Permite pagos parciales
    monto_capital        DECIMAL(15,2) NOT NULL DEFAULT 0,
    monto_interes        DECIMAL(15,2) NOT NULL DEFAULT 0,
    monto_mora           DECIMAL(15,2) NOT NULL DEFAULT 0,

    -- Información del pago
    fecha_pago           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metodo_pago          VARCHAR(50)  NOT NULL,
    -- 'EFECTIVO', 'PSE', 'WOMPI', 'TRANSFERENCIA', 'TARJETA_CREDITO', 'TARJETA_DEBITO'
    referencia_externa   VARCHAR(200),
    -- ID único devuelto por Wompi/PSE para reconciliación
    estado               VARCHAR(20)  NOT NULL DEFAULT 'PROCESANDO',
    -- 'PROCESANDO', 'CONFIRMADO', 'FALLIDO', 'REEMBOLSADO'
    -- CRÍTICO: Campo necesario para reconciliación de webhooks Wompi
    intentos_cobro       INT          NOT NULL DEFAULT 1,
    comprobante_url      VARCHAR(500),
    -- URL del recibo PDF generado en Supabase Storage

    -- RN-14: Todos los movimientos registrados con fecha, hora y usuario responsable
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE pago IS 'Registros de pago. referencia_externa para reconciliar con Wompi. RN-12: permite pagos parciales. RN-14: auditoría completa';


-- ============================================================
-- PASO 6: TABLAS DE DOCUMENTOS LEGALES
-- ============================================================

-- 6.1 TIPO_DOCUMENTO_LEGAL
-- Catálogo de tipos de documentos legales generados por el sistema
CREATE TABLE tipo_documento_legal (
    id_tipo_doc_legal UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo            VARCHAR(30)  NOT NULL UNIQUE,
    -- 'PAZ_Y_SALVO', 'ESTADO_CUENTA', 'CONTRATO', 'TRATAMIENTO_DATOS', 'TABLA_AMORTIZACION'
    nombre            VARCHAR(100) NOT NULL,
    descripcion       TEXT,
    requiere_credito_cancelado BOOLEAN NOT NULL DEFAULT false,
    -- RN-10: Si es true, solo disponible cuando el crédito está CANCELADO
    max_descargas_dia INT NOT NULL DEFAULT 2,
    -- RN-06: Máximo de descargas por día
    activo            BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE tipo_documento_legal IS 'Catálogo de documentos. requiere_credito_cancelado implementa RN-10 (paz y salvo). max_descargas_dia implementa RN-06';


-- 6.2 DOCUMENTO_LEGAL
-- Documentos legales generados y almacenados para el cliente
CREATE TABLE documento_legal (
    id_documento_legal UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cliente         UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
    id_credito         UUID REFERENCES credito(id_credito) ON DELETE RESTRICT,
    -- Puede ser null para documentos generales (ej: tratamiento de datos)
    id_tipo_doc_legal  UUID NOT NULL REFERENCES tipo_documento_legal(id_tipo_doc_legal),

    url_archivo        VARCHAR(500) NOT NULL,
    -- URL en Supabase Storage (bucket privado)
    mime_type          VARCHAR(50)  NOT NULL DEFAULT 'application/pdf',
    tamanio_bytes      BIGINT,
    hash_archivo       VARCHAR(64),
    -- SHA-256 para verificar integridad del documento (RNM-04)

    -- RN-10: El contrato se guarda obligatoriamente
    -- RN-15: Conservar 5 años tras cierre del crédito
    generado_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    vigente_hasta      DATE,
    -- Fecha de vencimiento del documento (ej: paz y salvo)
    activo             BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE documento_legal IS 'Documentos PDF generados. hash_archivo para integridad (RNM-04). Conservar 5 años (RN-15)';


-- 6.3 LOG_DESCARGA_DOCUMENTO
-- Registro de cada descarga de documento (para aplicar límite RN-06)
CREATE TABLE log_descarga_documento (
    id_log             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_documento_legal UUID NOT NULL REFERENCES documento_legal(id_documento_legal),
    id_cliente         UUID NOT NULL REFERENCES cliente(id_cliente),
    ip_cliente         VARCHAR(45),
    user_agent         TEXT,
    descargado_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE log_descarga_documento IS 'Log de descargas para aplicar RN-06: máximo 2 descargas/día por documento por cliente';


-- ============================================================
-- PASO 7: NOTIFICACIONES
-- ============================================================

-- 7.1 TIPO_NOTIFICACION
CREATE TABLE tipo_notificacion (
    id_tipo_notif UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo        VARCHAR(50)  NOT NULL UNIQUE,
    -- 'BIENVENIDA', 'SOLICITUD_RECIBIDA', 'SOLICITUD_APROBADA', 'SOLICITUD_RECHAZADA',
    -- 'RECORDATORIO_PAGO', 'PAGO_CONFIRMADO', 'CUOTA_VENCIDA', 'CREDITO_CANCELADO'
    nombre        VARCHAR(100) NOT NULL,
    canal         VARCHAR(20)  NOT NULL,
    -- 'EMAIL', 'SMS', 'PUSH', 'TODOS'
    plantilla_asunto TEXT,
    plantilla_cuerpo TEXT,
    activo        BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE tipo_notificacion IS 'Tipos de notificación con plantillas. Canal: EMAIL/SMS/PUSH. Implementa RN-13 (recordatorio pago)';


-- 7.2 NOTIFICACION
-- Registro de cada notificación enviada
CREATE TABLE notificacion (
    id_notificacion    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cliente         UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_tipo_notif      UUID NOT NULL REFERENCES tipo_notificacion(id_tipo_notif),
    id_credito         UUID REFERENCES credito(id_credito),
    id_solicitud       UUID REFERENCES solicitud_credito(id_solicitud),

    canal              VARCHAR(20)  NOT NULL,
    destinatario       VARCHAR(200) NOT NULL,
    -- Email o número de teléfono
    asunto             VARCHAR(200),
    cuerpo             TEXT,
    estado_envio       VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE',
    -- 'PENDIENTE', 'ENVIADO', 'FALLIDO', 'REBOTADO'
    proveedor          VARCHAR(50),
    -- 'RESEND', 'TWILIO', 'EXPO_PUSH'
    referencia_proveedor VARCHAR(200),
    -- ID del mensaje en el proveedor
    intentos           INT NOT NULL DEFAULT 0,
    enviado_at         TIMESTAMP WITH TIME ZONE,
    error_detalle      TEXT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE notificacion IS 'Log de notificaciones enviadas. Implementa RN-13 (recordatorio 3 días antes del vencimiento)';


-- ============================================================
-- PASO 8: AUDITORÍA
-- ============================================================

-- 8.1 AUDITORIA
-- Registro automático de todos los cambios en tablas críticas (RNM-10, RNF-04)
CREATE TABLE auditoria (
    id_auditoria           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario_responsable UUID REFERENCES perfil_usuario(id),
    -- Puede ser null si fue un proceso automático (cron, trigger)
    tabla_afectada         VARCHAR(50)  NOT NULL,
    id_registro_afectado   TEXT         NOT NULL,
    -- UUID del registro modificado como texto
    accion_realizada       VARCHAR(10)  NOT NULL,
    -- 'INSERT', 'UPDATE', 'DELETE'
    valor_anterior         JSONB,
    -- Estado antes del cambio (null en INSERT)
    valor_nuevo            JSONB,
    -- Estado después del cambio (null en DELETE)
    ip_origen              VARCHAR(45),
    user_agent             TEXT,
    fecha_evento           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auditoria IS 'Trazabilidad completa. Implementa RNM-10, RNF-04. valor_anterior/nuevo en JSONB para consultas eficientes';


-- ============================================================
-- PASO 9: ÍNDICES DE RENDIMIENTO
-- Críticos para cumplir RNF-02 (< 3 segundos de respuesta)
-- ============================================================

-- Índices en cliente
CREATE INDEX idx_cliente_usuario      ON cliente(id_usuario_cuenta);
CREATE INDEX idx_cliente_dni          ON cliente(dni);
CREATE INDEX idx_cliente_email        ON cliente(email);
CREATE INDEX idx_cliente_estado       ON cliente(id_estado_cliente);

-- Índices en solicitud_credito
CREATE INDEX idx_solicitud_cliente    ON solicitud_credito(id_cliente);
CREATE INDEX idx_solicitud_estado     ON solicitud_credito(id_estado_solicitud);
CREATE INDEX idx_solicitud_evaluador  ON solicitud_credito(id_usuario_evaluador);
CREATE INDEX idx_solicitud_fecha      ON solicitud_credito(fecha_solicitud DESC);

-- Índices en credito
CREATE INDEX idx_credito_cliente      ON credito(id_cliente);
CREATE INDEX idx_credito_estado       ON credito(estado_credito);
CREATE INDEX idx_credito_solicitud    ON credito(id_solicitud);

-- Índices en plan_pago y cuota
CREATE INDEX idx_plan_pago_credito    ON plan_pago(id_credito);
CREATE INDEX idx_cuota_plan           ON cuota(id_plan_pago);
CREATE INDEX idx_cuota_estado         ON cuota(estado_cuota);
CREATE INDEX idx_cuota_vencimiento    ON cuota(fecha_vencimiento);
CREATE INDEX idx_cuota_estado_venc    ON cuota(estado_cuota, fecha_vencimiento);
-- Índice compuesto para la función de mora diaria

-- Índices en pago
CREATE INDEX idx_pago_cuota           ON pago(id_cuota);
CREATE INDEX idx_pago_credito         ON pago(id_credito);
CREATE INDEX idx_pago_referencia      ON pago(referencia_externa);
CREATE INDEX idx_pago_estado          ON pago(estado);
CREATE INDEX idx_pago_fecha           ON pago(fecha_pago DESC);

-- Índices en documentos
CREATE INDEX idx_doc_cliente          ON documento_cliente(id_cliente);
CREATE INDEX idx_doc_estado_verif     ON documento_cliente(estado_verificacion);
CREATE INDEX idx_doc_legal_cliente    ON documento_legal(id_cliente);
CREATE INDEX idx_doc_legal_credito    ON documento_legal(id_credito);
CREATE INDEX idx_log_descarga_cliente ON log_descarga_documento(id_cliente, descargado_at DESC);

-- Índices en notificaciones
CREATE INDEX idx_notif_cliente        ON notificacion(id_cliente);
CREATE INDEX idx_notif_estado         ON notificacion(estado_envio);
CREATE INDEX idx_notif_fecha          ON notificacion(created_at DESC);

-- Índices en auditoría
CREATE INDEX idx_audit_usuario        ON auditoria(id_usuario_responsable);
CREATE INDEX idx_audit_tabla          ON auditoria(tabla_afectada);
CREATE INDEX idx_audit_fecha          ON auditoria(fecha_evento DESC);
CREATE INDEX idx_audit_registro       ON auditoria(tabla_afectada, id_registro_afectado);


-- ============================================================
-- PASO 10: FUNCIÓN HELPER PARA RLS
-- ============================================================

-- Verifica si el usuario actual es admin
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol = 'ADMIN'
          AND pu.activo = true
    );
$$;

-- Verifica si el usuario actual es analista o admin
CREATE OR REPLACE FUNCTION es_analista_o_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol IN ('ADMIN', 'ANALISTA')
          AND pu.activo = true
    );
$$;

-- Retorna el id_cliente del usuario autenticado (si es cliente)
CREATE OR REPLACE FUNCTION mi_id_cliente()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT id_cliente
    FROM cliente
    WHERE id_usuario_cuenta = auth.uid()
    LIMIT 1;
$$;


-- ============================================================
-- PASO 11: ROW LEVEL SECURITY (RLS)
-- OBLIGATORIO para plataforma financiera (RNM-01, RNM-08)
-- ============================================================

-- Activar RLS en todas las tablas sensibles
ALTER TABLE perfil_usuario       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente               ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_cliente       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_cliente     ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_credito     ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuesta_cliente     ENABLE ROW LEVEL SECURITY;
ALTER TABLE score                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_solicitud    ENABLE ROW LEVEL SECURITY;
ALTER TABLE credito               ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_pago             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuota                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pago                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_legal       ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_descarga_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacion          ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria             ENABLE ROW LEVEL SECURITY;


-- ── POLÍTICAS: perfil_usuario ──
CREATE POLICY "usuario_ver_su_perfil" ON perfil_usuario
    FOR SELECT USING (id = auth.uid() OR es_admin());

CREATE POLICY "admin_gestionar_perfiles" ON perfil_usuario
    FOR ALL USING (es_admin());


-- ── POLÍTICAS: cliente ──
CREATE POLICY "cliente_ver_su_registro" ON cliente
    FOR SELECT USING (id_usuario_cuenta = auth.uid() OR es_analista_o_admin());

CREATE POLICY "cliente_actualizar_su_registro" ON cliente
    FOR UPDATE USING (id_usuario_cuenta = auth.uid())
    WITH CHECK (id_usuario_cuenta = auth.uid());
-- RN-04: El usuario NO puede editar campos críticos, eso se valida en el backend

CREATE POLICY "admin_gestionar_clientes" ON cliente
    FOR ALL USING (es_analista_o_admin());

CREATE POLICY "sistema_insertar_cliente" ON cliente
    FOR INSERT WITH CHECK (true);
-- El backend valida antes de insertar


-- ── POLÍTICAS: detalle_cliente ──
CREATE POLICY "ver_detalle_propio" ON detalle_cliente
    FOR SELECT USING (
        id_cliente = mi_id_cliente() OR es_analista_o_admin()
    );

CREATE POLICY "admin_gestionar_detalle" ON detalle_cliente
    FOR ALL USING (es_analista_o_admin());


-- ── POLÍTICAS: documento_cliente ──
CREATE POLICY "ver_documentos_propios" ON documento_cliente
    FOR SELECT USING (
        id_cliente = mi_id_cliente() OR es_analista_o_admin()
    );

CREATE POLICY "cliente_subir_documentos" ON documento_cliente
    FOR INSERT WITH CHECK (id_cliente = mi_id_cliente());

CREATE POLICY "admin_gestionar_documentos" ON documento_cliente
    FOR ALL USING (es_analista_o_admin());


-- ── POLÍTICAS: solicitud_credito ──
CREATE POLICY "ver_solicitudes_propias" ON solicitud_credito
    FOR SELECT USING (
        id_cliente = mi_id_cliente() OR es_analista_o_admin()
    );

CREATE POLICY "cliente_crear_solicitud" ON solicitud_credito
    FOR INSERT WITH CHECK (id_cliente = mi_id_cliente());

CREATE POLICY "analista_actualizar_solicitud" ON solicitud_credito
    FOR UPDATE USING (es_analista_o_admin());


-- ── POLÍTICAS: credito ──
CREATE POLICY "ver_creditos_propios" ON credito
    FOR SELECT USING (
        id_cliente = mi_id_cliente() OR es_analista_o_admin()
    );

CREATE POLICY "admin_gestionar_creditos" ON credito
    FOR ALL USING (es_analista_o_admin());

-- 11.7 PLAN_PAGO
CREATE POLICY "ver_planes_propios" ON plan_pago
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM credito c 
            WHERE c.id_credito = plan_pago.id_credito 
              AND (c.id_cliente = mi_id_cliente() OR es_analista_o_admin())
        )
    );


-- ── POLÍTICAS: cuota ──
CREATE POLICY "ver_cuotas_propias" ON cuota
    FOR SELECT USING (
        id_plan_pago IN (
            SELECT pp.id_plan_pago FROM plan_pago pp
            JOIN credito c ON c.id_credito = pp.id_credito
            WHERE c.id_cliente = mi_id_cliente()
        ) OR es_analista_o_admin()
    );


-- ── POLÍTICAS: pago ──
CREATE POLICY "ver_pagos_propios" ON pago
    FOR SELECT USING (
        id_credito IN (
            SELECT id_credito FROM credito
            WHERE id_cliente = mi_id_cliente()
        ) OR es_analista_o_admin()
    );

CREATE POLICY "sistema_insertar_pago" ON pago
    FOR INSERT WITH CHECK (true);


-- ── POLÍTICAS: documento_legal ──
CREATE POLICY "ver_documentos_legales_propios" ON documento_legal
    FOR SELECT USING (
        id_cliente = mi_id_cliente() OR es_analista_o_admin()
    );


-- ── POLÍTICAS: notificacion ──
CREATE POLICY "ver_notificaciones_propias" ON notificacion
    FOR SELECT USING (
        id_cliente = mi_id_cliente() OR es_analista_o_admin()
    );


-- ── POLÍTICAS: auditoria ──
CREATE POLICY "solo_admin_ver_auditoria" ON auditoria
    FOR SELECT USING (es_admin());


-- ============================================================
-- PASO 12: TRIGGERS DE AUDITORÍA AUTOMÁTICA (RNM-10)
-- Se disparan en INSERT, UPDATE y DELETE de tablas críticas
-- ============================================================

CREATE OR REPLACE FUNCTION fn_registrar_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id_registro TEXT;
    v_old JSONB;
    v_new JSONB;
BEGIN
    -- Convertir las filas a JSONB de forma segura
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;

    -- Obtener el ID del registro afectado
    v_id_registro := CASE
        WHEN TG_OP = 'DELETE' THEN
            COALESCE(v_old->>'id_credito', v_old->>'id_cuota', v_old->>'id_recibo', v_old->>'id_solicitud', v_old->>'id_cliente', 'unknown')
        ELSE
            COALESCE(v_new->>'id_credito', v_new->>'id_cuota', v_new->>'id_recibo', v_new->>'id_solicitud', v_new->>'id_cliente', 'unknown')
    END;

    INSERT INTO auditoria (
        id_usuario_responsable,
        tabla_afectada,
        id_registro_afectado,
        accion_realizada,
        valor_anterior,
        valor_nuevo,
        fecha_evento
    ) VALUES (
        auth.uid(),
        TG_TABLE_NAME,
        v_id_registro,
        TG_OP,
        v_old,
        v_new,
        NOW()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger a tablas financieras críticas
CREATE TRIGGER trg_audit_credito
    AFTER INSERT OR UPDATE OR DELETE ON credito
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

CREATE TRIGGER trg_audit_pago
    AFTER INSERT OR UPDATE OR DELETE ON pago
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

CREATE TRIGGER trg_audit_solicitud
    AFTER INSERT OR UPDATE OR DELETE ON solicitud_credito
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

CREATE TRIGGER trg_audit_decision
    AFTER INSERT OR UPDATE OR DELETE ON decision_solicitud
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();

CREATE TRIGGER trg_audit_cliente
    AFTER INSERT OR UPDATE OR DELETE ON cliente
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();


-- ============================================================
-- PASO 13: TRIGGER updated_at AUTOMÁTICO
-- Actualiza updated_at en cada UPDATE sin intervención manual
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER trg_updated_perfil_usuario
    BEFORE UPDATE ON perfil_usuario
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_cliente
    BEFORE UPDATE ON cliente
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_detalle_cliente
    BEFORE UPDATE ON detalle_cliente
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_solicitud
    BEFORE UPDATE ON solicitud_credito
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_credito
    BEFORE UPDATE ON credito
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_cuota
    BEFORE UPDATE ON cuota
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_pago
    BEFORE UPDATE ON pago
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- PASO 14: FUNCIÓN DE MORA AUTOMÁTICA
-- Corre cada noche a las 6am via pg_cron (RN-08)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_detectar_mora()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Marcar cuotas vencidas e impagas
    UPDATE cuota
    SET estado_cuota = 'VENCIDA',
        updated_at   = NOW()
    WHERE fecha_vencimiento < CURRENT_DATE
      AND estado_cuota = 'PENDIENTE';

    -- 2. Marcar créditos en mora (tienen al menos 1 cuota VENCIDA)
    UPDATE credito
    SET estado_credito  = 'EN_MORA',
        cuotas_en_mora  = (
            SELECT COUNT(*) FROM cuota c
            JOIN plan_pago pp ON pp.id_plan_pago = c.id_plan_pago
            WHERE pp.id_credito = credito.id_credito
              AND c.estado_cuota = 'VENCIDA'
        ),
        updated_at = NOW()
    WHERE id_credito IN (
        SELECT DISTINCT pp.id_credito
        FROM plan_pago pp
        JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
        WHERE c.estado_cuota = 'VENCIDA'
    )
    AND estado_credito = 'ACTIVO';

    -- 3. Limpiar mora: si ya no hay cuotas VENCIDAS, volver a ACTIVO
    UPDATE credito
    SET estado_credito = 'ACTIVO',
        cuotas_en_mora = 0,
        updated_at     = NOW()
    WHERE estado_credito = 'EN_MORA'
      AND id_credito NOT IN (
          SELECT DISTINCT pp.id_credito
          FROM plan_pago pp
          JOIN cuota c ON c.id_plan_pago = pp.id_plan_pago
          WHERE c.estado_cuota = 'VENCIDA'
      );

    -- 4. Actualizar dias_mora_maximo en créditos en mora
    UPDATE credito
    SET dias_mora_maximo = GREATEST(
        dias_mora_maximo,
        (
            SELECT COALESCE(MAX(CURRENT_DATE - c.fecha_vencimiento), 0)
            FROM cuota c
            JOIN plan_pago pp ON pp.id_plan_pago = c.id_plan_pago
            WHERE pp.id_credito = credito.id_credito
              AND c.estado_cuota = 'VENCIDA'
        )
    )
    WHERE estado_credito = 'EN_MORA';

END;
$$;

-- Programar ejecución diaria a las 6:00 AM (hora Colombia = UTC-5)
-- En Supabase SQL Editor ejecutar esto por separado:
-- SELECT cron.schedule('detectar-mora-diaria', '0 11 * * *', 'SELECT fn_detectar_mora()');
-- Nota: 11 UTC = 6 AM Colombia (UTC-5)


-- ============================================================
-- PASO 15: FUNCIÓN PARA VERIFICAR LÍMITE DE DESCARGAS (RN-06)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_puede_descargar_documento(
    p_id_cliente         UUID,
    p_id_documento_legal UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_descargas_hoy  INT;
    v_max_descargas  INT;
BEGIN
    -- Obtener el límite del tipo de documento
    SELECT tl.max_descargas_dia INTO v_max_descargas
    FROM documento_legal dl
    JOIN tipo_documento_legal tl ON tl.id_tipo_doc_legal = dl.id_tipo_doc_legal
    WHERE dl.id_documento_legal = p_id_documento_legal;

    -- Contar descargas de hoy
    SELECT COUNT(*) INTO v_descargas_hoy
    FROM log_descarga_documento
    WHERE id_cliente = p_id_cliente
      AND id_documento_legal = p_id_documento_legal
      AND DATE(descargado_at) = CURRENT_DATE;

    RETURN v_descargas_hoy < v_max_descargas;
END;
$$;


-- ============================================================
-- PASO 16: DATOS INICIALES (CATÁLOGOS)
-- ============================================================

-- Roles del sistema
INSERT INTO rol (nombre_rol, descripcion) VALUES
('ADMIN',    'Administrador con acceso total al sistema'),
('ANALISTA', 'Analista de crédito que evalúa solicitudes'),
('CLIENTE',  'Comerciante o emprendedor que solicita créditos');

-- Estados del cliente
INSERT INTO estado_cliente (nombre, descripcion) VALUES
('ACTIVO',    'Cliente con cuenta activa y sin restricciones'),
('BLOQUEADO', 'Cuenta bloqueada temporalmente'),
('INACTIVO',  'Cliente inactivo o dado de baja');

-- Estados de la solicitud (en orden de flujo)
INSERT INTO estado_solicitud (nombre, descripcion, orden) VALUES
('PENDIENTE',     'Solicitud recibida, en espera de asignación', 1),
('EN_ESTUDIO',    'Asignada a un analista para evaluación',      2),
('APROBADA',      'Solicitud aprobada, pendiente de desembolso', 3),
('RECHAZADA',     'Solicitud rechazada por el analista',         4),
('CANCELADA',     'Solicitud cancelada por el cliente',          5),
('DESEMBOLSADA',  'Dinero entregado al cliente',                 6);

-- Motivos de rechazo
INSERT INTO motivo_rechazo (descripcion_motivo, visible_cliente) VALUES
('Capacidad de pago insuficiente según ingresos reportados', true),
('Historial crediticio negativo',                            true),
('Documentación incompleta o ilegible',                      true),
('No cumple antigüedad mínima del negocio',                  true),
('Monto solicitado supera el límite permitido',              true),
('Ya tiene un crédito activo en el sistema',                 true),
('Información inconsistente en el formulario',               false),
('Zona geográfica no cubierta actualmente',                  true),
('Cliente en lista de restricciones internas',               false);

-- Tipos de documento de identidad
INSERT INTO tipo_documento_identidad (codigo, nombre) VALUES
('CC',        'Cédula de Ciudadanía'),
('NIT',       'Número de Identificación Tributaria'),
('CE',        'Cédula de Extranjería'),
('PASAPORTE', 'Pasaporte'),
('PPT',       'Permiso por Protección Temporal');

-- Tipos de negocio
INSERT INTO tipo_negocio (nombre) VALUES
('Tienda de barrio / minimercado'),
('Restaurante / comidas rápidas'),
('Emprendimiento / producto artesanal'),
('Servicios profesionales independientes'),
('Comercio de ropa y calzado'),
('Peluquería / estética'),
('Ferretería / materiales'),
('Droguería / farmacia'),
('Transporte / domicilios'),
('Otro tipo de negocio');

-- Modelo de score inicial
INSERT INTO modelo_score (nombre_modelo, descripcion, puntaje_minimo, puntaje_maximo) VALUES
('Modelo PLURALL v1.0',
 'Modelo de scoring básico basado en formulario socioeconómico y financiero',
 600, 1000);

-- Tipos de documentos legales
INSERT INTO tipo_documento_legal (codigo, nombre, descripcion, requiere_credito_cancelado, max_descargas_dia) VALUES
('PAZ_Y_SALVO',
 'Paz y Salvo',
 'Certifica que el cliente no tiene deudas pendientes con Plurall',
 true,  2),  -- RN-10: Solo disponible cuando crédito está CANCELADO
('ESTADO_CUENTA',
 'Estado de Cuenta',
 'Resumen de movimientos y saldo actual del crédito',
 false, 2),
('CONTRATO',
 'Contrato de Crédito',
 'Documento legal que establece los términos y condiciones del crédito',
 false, 2),  -- RN-10: Se almacena obligatoriamente
('TRATAMIENTO_DATOS',
 'Autorización Tratamiento de Datos',
 'Autorización del cliente para el tratamiento de datos personales (Ley 1581/2012)',
 false, 5),
('TABLA_AMORTIZACION',
 'Tabla de Amortización',
 'Cronograma detallado de pagos del crédito',
 false, 5);

-- Preguntas del formulario de solicitud
INSERT INTO pregunta (enunciado, tipo_pregunta, orden, obligatoria) VALUES
('¿Cuánto tiempo lleva operando su negocio?',                'NEGOCIO',        1, true),
('¿Cuántas personas trabajan en su negocio?',                'NEGOCIO',        2, true),
('¿Cuál es el ingreso mensual promedio de su negocio?',      'FINANCIERA',     3, true),
('¿Cuál es su gasto mensual total (arriendo, servicios)?',   'FINANCIERA',     4, true),
('¿Tiene otras deudas o créditos activos?',                  'FINANCIERA',     5, true),
('¿Cuál es su nivel de educación?',                          'SOCIOECONOMICA', 6, true),
('¿Cuántas personas dependen económicamente de usted?',      'SOCIOECONOMICA', 7, true),
('¿Tiene cuenta bancaria activa?',                           'FINANCIERA',     8, true),
('¿Ha solicitado créditos anteriormente?',                   'FINANCIERA',     9, false),
('¿Para qué usará el crédito?',                              'NEGOCIO',        10, true);

-- Tipos de notificación
INSERT INTO tipo_notificacion (codigo, nombre, canal, plantilla_asunto, plantilla_cuerpo) VALUES
('BIENVENIDA',
 'Bienvenida al sistema',
 'EMAIL',
 'Bienvenido a PLURALL, {{nombre_cliente}}',
 'Hola {{nombre_cliente}}, tu cuenta ha sido creada exitosamente.'),

('SOLICITUD_RECIBIDA',
 'Solicitud de crédito recibida',
 'EMAIL',
 'Hemos recibido tu solicitud de crédito - PLURALL',
 'Tu solicitud por {{monto}} a {{plazo}} meses fue recibida y está siendo evaluada.'),

('SOLICITUD_APROBADA',
 'Solicitud de crédito aprobada',
 'EMAIL',
 '¡Tu crédito fue aprobado! - PLURALL',
 'Felicitaciones {{nombre_cliente}}, tu crédito por {{monto}} fue aprobado.'),

('SOLICITUD_RECHAZADA',
 'Solicitud de crédito rechazada',
 'EMAIL',
 'Resultado de tu solicitud de crédito - PLURALL',
 'Tu solicitud no fue aprobada en esta ocasión. Motivo: {{motivo}}'),

('RECORDATORIO_PAGO',
 'Recordatorio de pago próximo',
 'EMAIL',
 'Recordatorio: tu cuota vence en {{dias}} días - PLURALL',
 'Hola {{nombre_cliente}}, recuerda que la cuota {{numero_cuota}} de {{total_cuotas}} vence el {{fecha_vencimiento}}.'),
-- RN-13: Recordatorio 3 días antes del vencimiento

('PAGO_CONFIRMADO',
 'Confirmación de pago recibido',
 'EMAIL',
 'Pago recibido exitosamente - PLURALL',
 'Recibimos tu pago de {{monto}} para la cuota {{numero_cuota}}. Saldo restante: {{saldo}}.'),

('CUOTA_VENCIDA',
 'Cuota vencida - mora',
 'EMAIL',
 'Tu cuota está vencida - PLURALL',
 'La cuota {{numero_cuota}} de tu crédito venció el {{fecha_vencimiento}}. Por favor comunícate con nosotros.'),

('CREDITO_CANCELADO',
 'Crédito cancelado exitosamente',
 'EMAIL',
 '¡Tu crédito está completamente pagado! - PLURALL',
 'Felicitaciones {{nombre_cliente}}, has cancelado tu crédito en su totalidad. Ya puedes descargar tu paz y salvo.');


-- ============================================================
-- PASO 17: DATOS DE PRUEBA PARA DESARROLLO
-- (Solo para ambiente de desarrollo — NO ejecutar en producción)
-- ============================================================

-- NOTA: Los datos de usuarios de prueba se crean primero desde
-- Supabase Auth (dashboard o el formulario de registro de la app),
-- luego Jeferson inserta los registros de perfil y cliente aquí.
-- Ver docs/seed_instrucciones.md para el paso a paso completo.

-- Ejemplo de inserción de opciones para la primera pregunta
-- (¿Cuánto tiempo lleva operando su negocio?)
DO $$
DECLARE
    v_pregunta_1 UUID;
BEGIN
    SELECT id_pregunta INTO v_pregunta_1
    FROM pregunta
    WHERE orden = 1
    LIMIT 1;

    IF v_pregunta_1 IS NOT NULL THEN
        INSERT INTO opcion_pregunta (id_pregunta, texto_opcion, valor_puntos, orden) VALUES
        (v_pregunta_1, 'Menos de 6 meses',        100, 1),
        (v_pregunta_1, 'Entre 6 meses y 1 año',   200, 2),
        (v_pregunta_1, 'Entre 1 y 3 años',         300, 3),
        (v_pregunta_1, 'Entre 3 y 5 años',         400, 4),
        (v_pregunta_1, 'Más de 5 años',            500, 5);
    END IF;
END $$;


-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

-- Al ejecutar este query deberían aparecer todas las tablas creadas:
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c
     WHERE c.table_name = t.table_name
       AND c.table_schema = 'public') AS columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================
-- FIN DEL SCRIPT — PLURALL DATABASE v1.0
-- Total: 17 tablas principales + catálogos
-- Autor: Equipo PLURALL — SENA ADSO 2025
-- ============================================================
