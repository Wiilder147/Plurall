-- ============================================================
-- PLURALL — Migración 13: Solicitud de crédito atómica (RPC)
-- Ejecutar después de 12_seguridad_rls_y_registro.sql
-- ============================================================
-- Contenido:
--   1. fn_verificar_elegibilidad(): única fuente de verdad de las
--      reglas "crédito único activo" y "cooldown 90 días". La usan
--      el endpoint GET /api/creditos/elegibilidad (frontend) y la
--      RPC de creación (backend), eliminando la lógica duplicada.
--   2. fn_crear_solicitud_completa(): crea solicitud + respuestas +
--      score + estado final + documentos en UNA transacción. Si algo
--      falla a mitad no quedan solicitudes a medias (que además
--      activaban el bloqueo de 90 días injustamente).
--      · Valida monto y plazo en servidor (no confía en el slider).
--      · Sin cuestionario NUNCA pre-aprueba: va a revisión manual
--        (reemplaza el fallback pseudo-aleatorio por DNI).
-- ============================================================


-- ============================================================
-- 1. ELEGIBILIDAD (fuente única de verdad)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_verificar_elegibilidad()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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

    -- RN-07: un solo crédito vigente (criterio unificado: saldo pendiente
    -- o estado activo/en mora — antes frontend y backend usaban criterios distintos)
    IF EXISTS (
        SELECT 1 FROM credito
        WHERE id_cliente = v_id_cliente
          AND (saldo_pendiente > 0 OR estado_credito IN ('ACTIVO', 'EN_MORA'))
    ) THEN
        RETURN jsonb_build_object('elegible', false, 'codigo', 'CREDITO_ACTIVO',
            'mensaje', 'Tienes un crédito activo. Debes finalizar todos los pagos antes de solicitar uno nuevo.');
    END IF;

    -- Cooldown trimestral entre solicitudes
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
$$;


-- ============================================================
-- 2. CREACIÓN ATÓMICA DE SOLICITUD
-- ============================================================

CREATE OR REPLACE FUNCTION fn_crear_solicitud_completa(
    p_monto      NUMERIC,
    p_plazo      INT,
    p_respuestas JSONB DEFAULT '[]'::jsonb,  -- [{id_pregunta, id_opcion?, respuesta_texto?, respuesta_numerica?}]
    p_docs       JSONB DEFAULT '[]'::jsonb,  -- [{tipo, url, mime?, tamanio?}]
    p_ip         TEXT  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- ── Cliente ──
    SELECT id_cliente INTO v_id_cliente
    FROM cliente WHERE id_usuario_cuenta = auth.uid() LIMIT 1;

    IF v_id_cliente IS NULL THEN
        RETURN jsonb_build_object('error', 'CLIENTE_NO_ENCONTRADO',
            'message', 'No encontramos tu perfil de cliente.');
    END IF;

    -- ── Elegibilidad (fuente única) ──
    v_elegibilidad := fn_verificar_elegibilidad();
    IF NOT (v_elegibilidad->>'elegible')::BOOLEAN THEN
        RETURN jsonb_build_object('error', v_elegibilidad->>'codigo',
            'message', v_elegibilidad->>'mensaje');
    END IF;

    -- ── Validación de producto en servidor (no confiar en el slider) ──
    IF p_monto IS NULL OR p_monto < 100000 OR p_monto > 10000000 THEN
        RETURN jsonb_build_object('error', 'MONTO_INVALIDO',
            'message', 'El monto debe estar entre $100.000 y $10.000.000.');
    END IF;
    IF p_plazo IS NULL OR p_plazo NOT IN (12, 24, 30) THEN
        RETURN jsonb_build_object('error', 'PLAZO_INVALIDO',
            'message', 'El plazo debe ser 12, 24 o 30 meses.');
    END IF;

    -- ── Validación de respuestas numéricas en servidor ──
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

    -- ══ Desde aquí todo es una sola transacción: si algo falla, ══
    -- ══ ninguna escritura queda a medias.                       ══

    SELECT id_estado_solicitud INTO v_id_estado
    FROM estado_solicitud WHERE nombre = 'PENDIENTE';

    INSERT INTO solicitud_credito (
        id_cliente, id_estado_solicitud, monto_solicitado,
        plazo_meses, canal_solicitud, ip_solicitud
    ) VALUES (
        v_id_cliente, v_id_estado, p_monto, p_plazo, 'WEB', p_ip
    )
    RETURNING id_solicitud INTO v_id_solicitud;

    -- ── Respuestas ──
    INSERT INTO respuesta_cliente (id_solicitud, id_pregunta, id_opcion, respuesta_texto, respuesta_numerica)
    SELECT v_id_solicitud,
           (e->>'id_pregunta')::UUID,
           NULLIF(e->>'id_opcion', '')::UUID,
           NULLIF(e->>'respuesta_texto', ''),
           (e->>'respuesta_numerica')::NUMERIC
    FROM jsonb_array_elements(p_respuestas) e;

    v_hay_respuestas := jsonb_array_length(p_respuestas) > 0;

    -- ── Scoring ──
    SELECT id_modelo_score, puntaje_minimo, puntaje_maximo INTO v_modelo
    FROM modelo_score WHERE activo = true
    ORDER BY vigente_desde DESC LIMIT 1;

    IF v_hay_respuestas THEN
        -- a) puntos de opciones seleccionadas
        SELECT COALESCE(SUM(o.valor_puntos), 0) INTO v_puntaje
        FROM respuesta_cliente rc
        JOIN opcion_pregunta o ON o.id_opcion = rc.id_opcion
        WHERE rc.id_solicitud = v_id_solicitud;

        -- b) puntos por rango del valor numérico
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
        -- Sin cuestionario NUNCA se pre-aprueba automáticamente:
        -- siempre revisión manual (antes: fallback pseudo-aleatorio por DNI)
        v_puntaje  := 0;
        v_dictamen := 'REVISION_MANUAL';
    END IF;

    -- ── Estado final ──
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

    -- ── Documentos KYC + soportes ──
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
$$;

-- Solo usuarios autenticados pueden ejecutar las RPC
REVOKE EXECUTE ON FUNCTION fn_verificar_elegibilidad() FROM anon, public;
REVOKE EXECUTE ON FUNCTION fn_crear_solicitud_completa(NUMERIC, INT, JSONB, JSONB, TEXT) FROM anon, public;
GRANT  EXECUTE ON FUNCTION fn_verificar_elegibilidad() TO authenticated;
GRANT  EXECUTE ON FUNCTION fn_crear_solicitud_completa(NUMERIC, INT, JSONB, JSONB, TEXT) TO authenticated;
