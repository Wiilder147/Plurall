-- ============================================================
-- MÓDULO PQR — PLURALL v1.4
-- Peticiones, Quejas, Reclamos y Sugerencias
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS pqr (
    id_pqr            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cliente        UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    tipo              VARCHAR(20) NOT NULL DEFAULT 'PETICION',
    -- 'PETICION' | 'QUEJA' | 'RECLAMO' | 'SUGERENCIA'
    asunto            VARCHAR(160) NOT NULL,
    descripcion       TEXT NOT NULL,
    estado            VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
    -- 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO' | 'CERRADO'
    respuesta         TEXT,
    id_respondido_por UUID REFERENCES perfil_usuario(id),
    fecha_respuesta   TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pqr IS 'Peticiones, Quejas, Reclamos y Sugerencias de los clientes';

CREATE INDEX IF NOT EXISTS idx_pqr_cliente ON pqr(id_cliente);
CREATE INDEX IF NOT EXISTS idx_pqr_estado  ON pqr(estado);
CREATE INDEX IF NOT EXISTS idx_pqr_fecha   ON pqr(created_at DESC);

-- ── RLS ──
ALTER TABLE pqr ENABLE ROW LEVEL SECURITY;

-- El cliente ve y crea sus propias PQR
DROP POLICY IF EXISTS "cliente_ve_sus_pqr" ON pqr;
CREATE POLICY "cliente_ve_sus_pqr" ON pqr
    FOR SELECT USING (id_cliente = mi_id_cliente());

DROP POLICY IF EXISTS "cliente_crea_sus_pqr" ON pqr;
CREATE POLICY "cliente_crea_sus_pqr" ON pqr
    FOR INSERT WITH CHECK (id_cliente = mi_id_cliente());

-- El staff (ADMIN, SUPERVISOR, ASESOR) ve y gestiona todas las PQR
DROP POLICY IF EXISTS "staff_gestiona_pqr" ON pqr;
CREATE POLICY "staff_gestiona_pqr" ON pqr
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM perfil_usuario pu
            JOIN rol r ON r.id_rol = pu.id_rol
            WHERE pu.id = auth.uid()
              AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR', 'ASESOR')
              AND pu.activo = true
        )
    );
