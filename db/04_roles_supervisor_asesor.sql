-- ============================================================
-- ROLES SUPERVISOR Y ASESOR — PLURALL v1.2
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ── 1. Agregar roles al catálogo ─────────────────────────────
INSERT INTO rol (nombre_rol, descripcion) VALUES
  ('SUPERVISOR', 'Supervisor de cartera: aprueba solicitudes, monitorea mora y gestiona asesores'),
  ('ASESOR',     'Asesor comercial: gestiona cobros, registra pagos en efectivo y hace seguimiento')
ON CONFLICT (nombre_rol) DO NOTHING;


-- ── 2. Tabla de asignación asesor ↔ cliente ──────────────────
CREATE TABLE IF NOT EXISTS asignacion_asesor (
    id_asignacion  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_asesor      UUID NOT NULL REFERENCES perfil_usuario(id) ON DELETE CASCADE,
    id_cliente     UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    activa         BOOLEAN NOT NULL DEFAULT true,
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_fin        TIMESTAMP WITH TIME ZONE,
    notas            TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_asesor_cliente UNIQUE (id_asesor, id_cliente)
);

COMMENT ON TABLE asignacion_asesor IS
  'Asignación de clientes a asesores para gestión de cobro y seguimiento';

CREATE INDEX IF NOT EXISTS idx_asignacion_asesor   ON asignacion_asesor(id_asesor);
CREATE INDEX IF NOT EXISTS idx_asignacion_cliente  ON asignacion_asesor(id_cliente);
CREATE INDEX IF NOT EXISTS idx_asignacion_activa   ON asignacion_asesor(activa);


-- ── 3. Tabla de gestión de cobranza ──────────────────────────
CREATE TABLE IF NOT EXISTS gestion_cobranza (
    id_gestion     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_credito     UUID NOT NULL REFERENCES credito(id_credito) ON DELETE RESTRICT,
    id_cliente     UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
    id_asesor      UUID NOT NULL REFERENCES perfil_usuario(id),
    tipo_gestion   VARCHAR(30) NOT NULL,
    -- 'LLAMADA', 'VISITA', 'EMAIL', 'WHATSAPP', 'PAGO_EFECTIVO', 'PROMESA_PAGO', 'NO_CONTESTA'
    resultado      VARCHAR(30) NOT NULL,
    -- 'EXITOSO', 'SIN_RESPUESTA', 'PROMESA', 'RECHAZO', 'PAGO_RECIBIDO'
    monto_prometido  DECIMAL(15,2),   -- Si hizo promesa de pago
    fecha_promesa    DATE,            -- Fecha comprometida para pagar
    monto_recibido   DECIMAL(15,2),   -- Si recibió pago en efectivo
    observaciones    TEXT,
    fecha_gestion  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE gestion_cobranza IS
  'Registro de gestiones de cobro realizadas por asesores';

CREATE INDEX IF NOT EXISTS idx_gestion_credito ON gestion_cobranza(id_credito);
CREATE INDEX IF NOT EXISTS idx_gestion_cliente ON gestion_cobranza(id_cliente);
CREATE INDEX IF NOT EXISTS idx_gestion_asesor  ON gestion_cobranza(id_asesor);
CREATE INDEX IF NOT EXISTS idx_gestion_fecha   ON gestion_cobranza(fecha_gestion DESC);


-- ── 4. RLS para las nuevas tablas ────────────────────────────

-- asignacion_asesor
ALTER TABLE asignacion_asesor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supervisor_admin_gestionar_asignaciones" ON asignacion_asesor
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM perfil_usuario pu
            JOIN rol r ON r.id_rol = pu.id_rol
            WHERE pu.id = auth.uid()
              AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR')
        )
    );

CREATE POLICY "asesor_ver_sus_asignaciones" ON asignacion_asesor
    FOR SELECT USING (id_asesor = auth.uid());


-- gestion_cobranza
ALTER TABLE gestion_cobranza ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asesor_gestionar_sus_cobros" ON gestion_cobranza
    FOR ALL USING (id_asesor = auth.uid());

CREATE POLICY "supervisor_admin_ver_cobros" ON gestion_cobranza
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM perfil_usuario pu
            JOIN rol r ON r.id_rol = pu.id_rol
            WHERE pu.id = auth.uid()
              AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR', 'ANALISTA')
        )
    );


-- ── 5. Función helper para RLS ────────────────────────────────
CREATE OR REPLACE FUNCTION es_supervisor_o_admin()
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
          AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR')
          AND pu.activo = true
    );
$$;


-- ── 6. Verificación ──────────────────────────────────────────
SELECT nombre_rol, descripcion FROM rol ORDER BY nombre_rol;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('asignacion_asesor', 'gestion_cobranza')
ORDER BY table_name;
