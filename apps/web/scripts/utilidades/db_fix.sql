-- ============================================================
-- FIX: TRIGGER DE AUDITORÍA Y RLS
-- ============================================================

-- 1. Corregir función de auditoría (to_jsonb en lugar de row_to_json)
CREATE OR REPLACE FUNCTION fn_auditar_registros()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    v_record_id TEXT;
BEGIN
    current_user_id := auth.uid();
    
    -- Detectar ID del registro afectado de forma dinámica según la tabla
    IF TG_TABLE_NAME = 'cliente' THEN v_record_id := COALESCE(NEW.id_cliente, OLD.id_cliente)::TEXT;
    ELSIF TG_TABLE_NAME = 'credito' THEN v_record_id := COALESCE(NEW.id_credito, OLD.id_credito)::TEXT;
    ELSIF TG_TABLE_NAME = 'solicitud_credito' THEN v_record_id := COALESCE(NEW.id_solicitud, OLD.id_solicitud)::TEXT;
    ELSIF TG_TABLE_NAME = 'pago' THEN v_record_id := COALESCE(NEW.id_recibo, OLD.id_recibo)::TEXT;
    ELSE v_record_id := 'S/N';
    END IF;

    INSERT INTO auditoria (
        id_usuario_responsable,
        tabla_afectada,
        id_registro_afectado,
        accion_realizada,
        valor_anterior,
        valor_nuevo,
        ip_origen,
        user_agent
    ) VALUES (
        current_user_id,
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        current_setting('request.headers', true)::json->>'x-forwarded-for',
        current_setting('request.headers', true)::json->>'user-agent'
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Agregar política de lectura para plan_pago
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'plan_pago' AND policyname = 'cliente_ver_sus_planes'
    ) THEN
        CREATE POLICY "cliente_ver_sus_planes" ON plan_pago
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM credito c 
                WHERE c.id_credito = plan_pago.id_credito 
                  AND (c.id_cliente = mi_id_cliente() OR es_analista_o_admin())
            )
        );
    END IF;
END $$;

-- 3. Asegurar que las cuotas tengan acceso (ya existe pero por si acaso)
-- Ya revisamos que depende de plan_pago, al arreglar plan_pago se arregla cuota.
