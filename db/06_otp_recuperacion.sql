-- ============================================================
-- PLURALL — Tabla otp_recuperacion (OTP para Contraseñas)
-- Sprint: Recuperación Gratuita
-- Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS otp_recuperacion (
  id_otp          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  celular         VARCHAR(20) NOT NULL,
  otp_code        VARCHAR(10) NOT NULL,
  expiracion      TIMESTAMP WITH TIME ZONE NOT NULL,
  usado           BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_recuperacion_celular ON otp_recuperacion(celular);

-- Política de limpieza automática o acceso
-- No requiere RLS restrictiva si solo se accede vía API backend (Service Role)
-- pero por seguridad la bloqueamos para accesos directos desde cliente:
ALTER TABLE otp_recuperacion ENABLE ROW LEVEL SECURITY;

-- Solo admins o service_role pueden interactuar con esta tabla
-- El cliente frontend se comunicará a través del API en Next.js
CREATE POLICY "solo_service_role" ON otp_recuperacion
  USING (false); -- Nadie puede leer/escribir desde el frontend cliente
