-- ============================================================
-- PLURALL — Tabla evento_funnel (Arquitectura Basada en Eventos)
-- Sprint 6: Funnel Analytics
-- Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS evento_funnel (
  id_evento       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  id_solicitud    UUID REFERENCES solicitud_credito(id_solicitud) ON DELETE SET NULL,

  -- Paso del embudo que se completó
  evento          VARCHAR(60) NOT NULL,
  -- Valores posibles (en orden de conversión):
  -- 'INICIO_CALCULADORA'     → Entró al Step 1 (calculadora)
  -- 'AJUSTO_MONTO'           → Interactuó con el slider de monto
  -- 'INICIO_CUESTIONARIO'    → Avanzó al Step 2
  -- 'COMPLETO_CUESTIONARIO'  → Respondió todas las preguntas obligatorias
  -- 'INICIO_DOCUMENTOS'      → Avanzó al Step 3
  -- 'SUBIO_CEDULA_FRONTAL'   → Subió foto frontal de cédula
  -- 'SUBIO_CEDULA_TRASERA'   → Subió foto trasera de cédula
  -- 'INICIO_RESUMEN'         → Avanzó al Step 4 (confirmación)
  -- 'ENVIO_SOLICITUD'        → Presionó "Confirmar y Enviar"
  -- 'SOLICITUD_APROBADA'     → Motor devolvió PRE_APROBADO
  -- 'SOLICITUD_REVISION'     → Motor devolvió REVISION_MANUAL
  -- 'SOLICITUD_RECHAZADA'    → Motor devolvió RECHAZAR
  -- 'BLOQUEADO_CREDITO_ACTIVO'   → Bloqueado por RN-07
  -- 'BLOQUEADO_COOLDOWN_90'      → Bloqueado por regla trimestral

  -- Contexto del evento (datos adicionales)
  metadata        JSONB DEFAULT '{}',
  -- Ejemplo: { "monto": 2000000, "plazo": 6, "score": 750, "step_desde": 1 }

  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas del funnel
CREATE INDEX IF NOT EXISTS idx_evento_funnel_usuario  ON evento_funnel(id_usuario);
CREATE INDEX IF NOT EXISTS idx_evento_funnel_evento   ON evento_funnel(evento);
CREATE INDEX IF NOT EXISTS idx_evento_funnel_fecha    ON evento_funnel(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evento_funnel_sol      ON evento_funnel(id_solicitud) WHERE id_solicitud IS NOT NULL;

-- Comentario explicativo
COMMENT ON TABLE evento_funnel IS
  'Registro de eventos del embudo de conversión de solicitudes. '
  'Permite al supervisor ver en qué paso se abandonan las solicitudes.';

-- ============================================================
-- RLS: El cliente solo puede insertar sus propios eventos.
-- El supervisor puede leer todos.
-- ============================================================
ALTER TABLE evento_funnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente_insertar_evento" ON evento_funnel
  FOR INSERT WITH CHECK (id_usuario = auth.uid());

CREATE POLICY "supervisor_leer_eventos" ON evento_funnel
  FOR SELECT USING (es_analista_o_admin());
