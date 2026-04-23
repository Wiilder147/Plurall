-- ==============================================================================
-- PROTECCIÓN ANTIFRAUDE: REGLA DE 1 CRÉDITO CADA 3 MESES
-- ==============================================================================
-- Este trigger evita transaccionalmente que un usuario inyecte una solicitud 
-- si ya tiene otra creada (independientemente si fue aprobada o rechazada)
-- en los últimos 90 días.
-- ==============================================================================

-- 1. Función Validadora
CREATE OR REPLACE FUNCTION proteger_solicitud_trimestral()
RETURNS TRIGGER AS $$
DECLARE
    v_fecha_ultima_solicitud TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Obtenemos la última solicitud del cliente
    SELECT fecha_solicitud INTO v_fecha_ultima_solicitud
    FROM public.solicitud_credito
    WHERE id_cliente = NEW.id_cliente
    ORDER BY fecha_solicitud DESC
    LIMIT 1;
    
    -- Validamos
    IF v_fecha_ultima_solicitud IS NOT NULL THEN
        -- Si la diferencia es menor a 90 días (o 3 meses)
        IF v_fecha_ultima_solicitud > (NOW() - INTERVAL '3 months') THEN
            RAISE EXCEPTION 'BLOQUEO_TRIMESTRAL: El usuario ya posee una solicitud registrada en los ultimos 3 meses. Fecha ultima: %', v_fecha_ultima_solicitud
            USING ERRCODE = 'P0001'; -- Código estándar para excepciones PL/pgSQL
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Atar la función a la tabla
DROP TRIGGER IF EXISTS trigger_evitar_solicitudes_frecuentes ON public.solicitud_credito;
CREATE TRIGGER trigger_evitar_solicitudes_frecuentes
    BEFORE INSERT ON public.solicitud_credito
    FOR EACH ROW
    EXECUTE FUNCTION proteger_solicitud_trimestral();

COMMENT ON FUNCTION proteger_solicitud_trimestral() IS 'Evita que el mismo id_cliente radique solicitudes con una ventana menor a 3 meses.';
