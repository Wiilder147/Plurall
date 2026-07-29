-- ============================================================
-- PLURALL — Migración 14: Catálogos maestros
-- Ejecutar después de 13_rpc_solicitud_atomica.sql
-- ============================================================
-- Contenido:
--   1. Tabla banco: reemplaza la lista hardcodeada del frontend.
--   2. Tabla departamento: los 33 departamentos de Colombia para
--      reportería consistente (antes texto libre).
--   3. CHECK constraints en detalle_cliente para campos enumerados
--      (los datos actuales son NULL, no rompe nada).
-- ============================================================

-- ── 1. BANCO ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banco (
    id_banco   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     VARCHAR(100) NOT NULL UNIQUE,
    tipo       VARCHAR(20)  NOT NULL CHECK (tipo IN ('BANCO', 'BILLETERA')),
    orden      INT,
    activo     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE banco IS 'Bancos y billeteras digitales para el cuestionario. Reemplaza la constante BANCOS del frontend';

ALTER TABLE banco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leer_bancos" ON banco;
CREATE POLICY "leer_bancos" ON banco
    FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS "admin_gestionar_bancos" ON banco;
CREATE POLICY "admin_gestionar_bancos" ON banco
    FOR ALL USING (es_admin());

INSERT INTO banco (nombre, tipo, orden) VALUES
  ('Bancolombia', 'BANCO', 1), ('Banco de Bogotá', 'BANCO', 2),
  ('Davivienda', 'BANCO', 3), ('BBVA Colombia', 'BANCO', 4),
  ('Banco Popular', 'BANCO', 5), ('Banco Caja Social', 'BANCO', 6),
  ('Banco de Occidente', 'BANCO', 7), ('Banco AV Villas', 'BANCO', 8),
  ('Banco Agrario de Colombia', 'BANCO', 9), ('Scotiabank Colpatria', 'BANCO', 10),
  ('Itaú Colombia', 'BANCO', 11), ('Banco GNB Sudameris', 'BANCO', 12),
  ('Banco Falabella', 'BANCO', 13), ('Banco Finandina', 'BANCO', 14),
  ('Banco Mundo Mujer', 'BANCO', 15), ('Banco W', 'BANCO', 16),
  ('Bancamía', 'BANCO', 17), ('Mibanco Colombia', 'BANCO', 18),
  ('Banco Cooperativo Coopcentral', 'BANCO', 19), ('Bancóldex', 'BANCO', 20),
  ('Nequi', 'BILLETERA', 21), ('Daviplata', 'BILLETERA', 22),
  ('Movii', 'BILLETERA', 23), ('Tpaga', 'BILLETERA', 24),
  ('RappiPay', 'BILLETERA', 25), ('Lulo Bank', 'BILLETERA', 26),
  ('Nubank Colombia', 'BILLETERA', 27), ('Ualá Colombia', 'BILLETERA', 28)
ON CONFLICT (nombre) DO NOTHING;

-- ── 2. DEPARTAMENTO ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departamento (
    id_departamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_dane     VARCHAR(2)  NOT NULL UNIQUE,
    nombre          VARCHAR(60) NOT NULL UNIQUE,
    activo          BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE departamento IS 'Departamentos de Colombia (código DANE) para normalizar ubicaciones';

ALTER TABLE departamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leer_departamentos" ON departamento;
CREATE POLICY "leer_departamentos" ON departamento
    FOR SELECT TO authenticated USING (true);

INSERT INTO departamento (codigo_dane, nombre) VALUES
  ('05','Antioquia'), ('08','Atlántico'), ('11','Bogotá D.C.'), ('13','Bolívar'),
  ('15','Boyacá'), ('17','Caldas'), ('18','Caquetá'), ('19','Cauca'),
  ('20','Cesar'), ('23','Córdoba'), ('25','Cundinamarca'), ('27','Chocó'),
  ('41','Huila'), ('44','La Guajira'), ('47','Magdalena'), ('50','Meta'),
  ('52','Nariño'), ('54','Norte de Santander'), ('63','Quindío'), ('66','Risaralda'),
  ('68','Santander'), ('70','Sucre'), ('73','Tolima'), ('76','Valle del Cauca'),
  ('81','Arauca'), ('85','Casanare'), ('86','Putumayo'), ('88','San Andrés y Providencia'),
  ('91','Amazonas'), ('94','Guainía'), ('95','Guaviare'), ('97','Vaupés'), ('99','Vichada')
ON CONFLICT (codigo_dane) DO NOTHING;

-- ── 3. CHECKs EN detalle_cliente ──────────────────────────────
ALTER TABLE detalle_cliente DROP CONSTRAINT IF EXISTS ck_tipo_vivienda;
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_tipo_vivienda
  CHECK (tipo_vivienda IS NULL OR tipo_vivienda IN ('PROPIA', 'ARRENDADA', 'FAMILIAR'));

ALTER TABLE detalle_cliente DROP CONSTRAINT IF EXISTS ck_estado_civil;
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_estado_civil
  CHECK (estado_civil IS NULL OR estado_civil IN ('SOLTERO', 'CASADO', 'UNION_LIBRE', 'SEPARADO', 'VIUDO'));

ALTER TABLE detalle_cliente DROP CONSTRAINT IF EXISTS ck_nivel_educativo;
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_nivel_educativo
  CHECK (nivel_educativo IS NULL OR nivel_educativo IN
         ('PRIMARIA', 'BACHILLERATO', 'TECNICO', 'TECNOLOGO', 'PROFESIONAL', 'POSGRADO', 'NINGUNO'));

ALTER TABLE detalle_cliente DROP CONSTRAINT IF EXISTS ck_tipo_cuenta;
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_tipo_cuenta
  CHECK (tipo_cuenta_bancaria IS NULL OR tipo_cuenta_bancaria IN ('AHORROS', 'CORRIENTE', 'BILLETERA'));

-- Estratos válidos en Colombia: 1 a 6
ALTER TABLE detalle_cliente DROP CONSTRAINT IF EXISTS ck_estrato;
ALTER TABLE detalle_cliente ADD CONSTRAINT ck_estrato
  CHECK (estrato IS NULL OR estrato BETWEEN 1 AND 6);
