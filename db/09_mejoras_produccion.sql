-- PLURALL — Mejoras fase producción (puntos 1-10)
-- Ejecutar después de 08_modulo_pqr.sql

-- tipo_input para preguntas del cuestionario (alineado con frontend)
ALTER TABLE pregunta ADD COLUMN IF NOT EXISTS tipo_input VARCHAR(30) DEFAULT 'SELECT';
COMMENT ON COLUMN pregunta.tipo_input IS 'SELECT | TEXTO | UBICACION | BANCO';

-- historial de cambios de estado (observabilidad)
CREATE TABLE IF NOT EXISTS historial_estado (
    id_historial     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad          VARCHAR(50) NOT NULL,
    id_registro      UUID NOT NULL,
    estado_anterior  VARCHAR(50),
    estado_nuevo     VARCHAR(50) NOT NULL,
    id_usuario       UUID REFERENCES auth.users(id),
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historial_entidad ON historial_estado(entidad, id_registro, created_at DESC);

-- Función genérica para registrar historial de estado
CREATE OR REPLACE FUNCTION fn_registrar_historial_estado()
RETURNS TRIGGER AS $$
DECLARE
    v_entidad TEXT := TG_TABLE_NAME;
    v_anterior TEXT;
    v_nuevo TEXT;
    v_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'solicitud_credito' THEN
        v_id := COALESCE(NEW.id_solicitud, OLD.id_solicitud);
        IF TG_OP = 'UPDATE' AND OLD.id_estado_solicitud IS DISTINCT FROM NEW.id_estado_solicitud THEN
            SELECT es.nombre INTO v_anterior FROM estado_solicitud es WHERE es.id_estado_solicitud = OLD.id_estado_solicitud;
            SELECT es.nombre INTO v_nuevo FROM estado_solicitud es WHERE es.id_estado_solicitud = NEW.id_estado_solicitud;
            INSERT INTO historial_estado (entidad, id_registro, estado_anterior, estado_nuevo, id_usuario)
            VALUES ('solicitud_credito', v_id, v_anterior, v_nuevo, auth.uid());
        END IF;
    ELSIF TG_TABLE_NAME = 'credito' THEN
        v_id := COALESCE(NEW.id_credito, OLD.id_credito);
        IF TG_OP = 'UPDATE' AND OLD.estado_credito IS DISTINCT FROM NEW.estado_credito THEN
            INSERT INTO historial_estado (entidad, id_registro, estado_anterior, estado_nuevo, id_usuario)
            VALUES ('credito', v_id, OLD.estado_credito, NEW.estado_credito, auth.uid());
        END IF;
    ELSIF TG_TABLE_NAME = 'cuota' THEN
        v_id := COALESCE(NEW.id_cuota, OLD.id_cuota);
        IF TG_OP = 'UPDATE' AND OLD.estado_cuota IS DISTINCT FROM NEW.estado_cuota THEN
            INSERT INTO historial_estado (entidad, id_registro, estado_anterior, estado_nuevo, id_usuario)
            VALUES ('cuota', v_id, OLD.estado_cuota, NEW.estado_cuota, auth.uid());
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_historial_solicitud ON solicitud_credito;
CREATE TRIGGER trg_historial_solicitud
    AFTER UPDATE ON solicitud_credito
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_historial_estado();

DROP TRIGGER IF EXISTS trg_historial_credito ON credito;
CREATE TRIGGER trg_historial_credito
    AFTER UPDATE ON credito
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_historial_estado();

DROP TRIGGER IF EXISTS trg_historial_cuota ON cuota;
CREATE TRIGGER trg_historial_cuota
    AFTER UPDATE ON cuota
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_historial_estado();

-- Notificaciones in-app para staff (asesor, supervisor, admin)
CREATE TABLE IF NOT EXISTS notificacion_staff (
    id_notif     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    codigo_tipo  VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    titulo       VARCHAR(200) NOT NULL,
    mensaje      TEXT,
    metadata     JSONB DEFAULT '{}',
    leida        BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_staff_usuario ON notificacion_staff(id_usuario, leida, created_at DESC);

ALTER TABLE notificacion_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_ver_sus_notifs" ON notificacion_staff
    FOR SELECT USING (id_usuario = auth.uid());
CREATE POLICY "staff_marcar_leidas" ON notificacion_staff
    FOR UPDATE USING (id_usuario = auth.uid());

-- Tipos de notificación adicionales
INSERT INTO tipo_notificacion (codigo, nombre, canal, plantilla_asunto, plantilla_cuerpo)
VALUES
    ('MORA_ASESOR', 'Alerta mora asesor', 'IN_APP', 'Cliente en mora', 'Un cliente de tu cartera entró en mora.'),
    ('RECORDATORIO_CUOTA', 'Recordatorio cuota', 'IN_APP', 'Cuota próxima a vencer', 'Tu cuota vence en 3 días.')
ON CONFLICT (codigo) DO NOTHING;
