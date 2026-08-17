-- ============================================================
-- PLURALL — Migración 24: normalización BD — EXPAND (crear tablas nuevas)
-- Ejecutar después de 23_eliminar_nombre_completo.sql
-- ============================================================
-- FASE 2 del plan de normalización (docs/HANDOFF_normalizacion_bd.md).
--
-- Estrategia expand → migrate → contract SIN downtime:
--   - Migración 24 (esta): SOLO crea estructuras nuevas. NO toca ni borra datos
--     ni columnas existentes. La app vieja sigue funcionando intacta.
--   - Migración 25: backfill desde cliente/detalle_cliente + verificación.
--   - Migración 26: DROP de columnas/tablas sobrecargadas (contract), ya con
--     backend/frontend recableados y pruebas verdes.
--
-- Modelo objetivo (§4 del handoff):
--   direccion         → ubicación CASA/NEGOCIO por cliente (1:N)
--   negocio_cliente   → negocios del cliente (1:N)
--   perfil_financiero → finanzas del cliente (1:1), duplicados fusionados
--   cuenta_bancaria   → cuentas bancarias del cliente (1:N), banco por FK
--   vw_cliente_score  → último score por cliente (reemplaza cliente.score_credito)
--
-- Idempotente: IF NOT EXISTS / CREATE OR REPLACE. Re-ejecutable sin efectos.
-- ============================================================


-- ============================================================
-- 1. DIRECCION — ubicación normalizada (CASA / NEGOCIO), 1:N por cliente
-- ============================================================
-- Reemplaza cliente.direccion/ciudad/departamento + *_casa/*_negocio.
-- id_municipio es opcional: los datos reales casi no tienen municipio poblado,
-- así que se conserva `linea` de texto libre hasta poder mapear a municipio.
CREATE TABLE IF NOT EXISTS direccion (
    id_direccion  uuid NOT NULL DEFAULT gen_random_uuid(),
    id_cliente    uuid NOT NULL,
    tipo          character varying(10) NOT NULL,
    linea         text,
    id_municipio  uuid,
    lat           numeric(10,7),
    lon           numeric(10,7),
    created_at    timestamp with time zone DEFAULT now(),
    updated_at    timestamp with time zone DEFAULT now(),
    CONSTRAINT pk_direccion PRIMARY KEY (id_direccion),
    CONSTRAINT fk_direccion_cliente   FOREIGN KEY (id_cliente)   REFERENCES cliente (id_cliente)   ON DELETE CASCADE,
    CONSTRAINT fk_direccion_municipio FOREIGN KEY (id_municipio) REFERENCES municipio (id_municipio),
    CONSTRAINT ck_direccion_tipo CHECK (tipo IN ('CASA', 'NEGOCIO'))
);
CREATE INDEX IF NOT EXISTS ix_direccion_cliente ON direccion (id_cliente);
-- Una dirección de cada tipo por cliente (evita duplicar CASA/NEGOCIO).
CREATE UNIQUE INDEX IF NOT EXISTS ux_direccion_cliente_tipo ON direccion (id_cliente, tipo);


-- ============================================================
-- 2. NEGOCIO_CLIENTE — negocios del cliente, 1:N (FK sin UNIQUE)
-- ============================================================
-- Reemplaza cliente.nombre_negocio/id_tipo_negocio/descripcion_negocio/
-- antiguedad_negocio_meses + detalle_cliente.empleados_negocio/arriendo_negocio.
-- Decisión confirmada #3: 1:N (un cliente puede tener varios negocios).
CREATE TABLE IF NOT EXISTS negocio_cliente (
    id_negocio        uuid NOT NULL DEFAULT gen_random_uuid(),
    id_cliente        uuid NOT NULL,
    nombre_negocio    character varying(150),
    id_tipo_negocio   uuid,
    descripcion       text,
    antiguedad_meses  integer,
    empleados         integer DEFAULT 0,
    arriendo_negocio  numeric(14,2) DEFAULT 0,
    created_at        timestamp with time zone DEFAULT now(),
    updated_at        timestamp with time zone DEFAULT now(),
    CONSTRAINT pk_negocio_cliente PRIMARY KEY (id_negocio),
    CONSTRAINT fk_negocio_cliente        FOREIGN KEY (id_cliente)      REFERENCES cliente (id_cliente)          ON DELETE CASCADE,
    CONSTRAINT fk_negocio_tipo_negocio   FOREIGN KEY (id_tipo_negocio) REFERENCES tipo_negocio (id_tipo_negocio)
);
CREATE INDEX IF NOT EXISTS ix_negocio_cliente_cliente ON negocio_cliente (id_cliente);


-- ============================================================
-- 3. PERFIL_FINANCIERO — finanzas del cliente, 1:1 (FK UNIQUE)
-- ============================================================
-- Reemplaza los campos financieros de detalle_cliente, fusionando duplicados
-- (decisión #2): personas_cargo absorbe dependientes; patrimonio_estimado
-- absorbe ahorros. arriendo_casa vive aquí y NO se re-suma a egresos_mensuales.
CREATE TABLE IF NOT EXISTS perfil_financiero (
    id_perfil            uuid NOT NULL DEFAULT gen_random_uuid(),
    id_cliente           uuid NOT NULL,
    tipo_vivienda        character varying(50),
    estrato              integer,
    nivel_educativo      character varying(50),
    estado_civil         character varying(30),
    personas_cargo       integer DEFAULT 0,
    ingresos_mensuales   numeric(14,2),
    egresos_mensuales    numeric(14,2),
    patrimonio_estimado  numeric(14,2),
    otras_obligaciones   numeric(14,2) DEFAULT 0,
    arriendo_casa        numeric(14,2) DEFAULT 0,
    colaboracion_gastos  boolean DEFAULT false,
    tiene_vehiculo       boolean DEFAULT false,
    created_at           timestamp with time zone DEFAULT now(),
    updated_at           timestamp with time zone DEFAULT now(),
    CONSTRAINT pk_perfil_financiero PRIMARY KEY (id_perfil),
    CONSTRAINT fk_perfil_financiero_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente) ON DELETE CASCADE,
    CONSTRAINT ux_perfil_financiero_cliente UNIQUE (id_cliente)
);


-- ============================================================
-- 4. CUENTA_BANCARIA — cuentas del cliente, 1:N, banco por FK
-- ============================================================
-- Reemplaza detalle_cliente.banco_preferido(texto)/tipo_cuenta_bancaria/
-- numero_cuenta. banco_preferido(texto) se mapeará a FK banco en el backfill (25).
CREATE TABLE IF NOT EXISTS cuenta_bancaria (
    id_cuenta     uuid NOT NULL DEFAULT gen_random_uuid(),
    id_cliente    uuid NOT NULL,
    id_banco      uuid,
    tipo_cuenta   character varying(30),
    numero        character varying(30),
    created_at    timestamp with time zone DEFAULT now(),
    updated_at    timestamp with time zone DEFAULT now(),
    CONSTRAINT pk_cuenta_bancaria PRIMARY KEY (id_cuenta),
    CONSTRAINT fk_cuenta_bancaria_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente) ON DELETE CASCADE,
    CONSTRAINT fk_cuenta_bancaria_banco   FOREIGN KEY (id_banco)   REFERENCES banco (id_banco)
);
CREATE INDEX IF NOT EXISTS ix_cuenta_bancaria_cliente ON cuenta_bancaria (id_cliente);


-- ============================================================
-- 5. VW_CLIENTE_SCORE — último score por cliente
-- ============================================================
-- Reemplaza la columna denormalizada cliente.score_credito. Toma el score más
-- reciente vía solicitud_credito (score → solicitud → cliente).
CREATE OR REPLACE VIEW vw_cliente_score AS
SELECT DISTINCT ON (sc.id_cliente)
       sc.id_cliente,
       s.id_score,
       s.id_solicitud,
       s.puntaje_total,
       s.puntaje_maximo_posible,
       s.porcentaje,
       s.recomendacion,
       s.fecha_evaluacion
FROM score s
JOIN solicitud_credito sc ON sc.id_solicitud = s.id_solicitud
ORDER BY sc.id_cliente, s.fecha_evaluacion DESC, s.created_at DESC;


-- ============================================================
-- 6. TRIGGERS updated_at (reusa fn_set_updated_at existente)
-- ============================================================
DROP TRIGGER IF EXISTS trg_direccion_updated_at         ON direccion;
CREATE TRIGGER trg_direccion_updated_at         BEFORE UPDATE ON direccion         FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_negocio_cliente_updated_at   ON negocio_cliente;
CREATE TRIGGER trg_negocio_cliente_updated_at   BEFORE UPDATE ON negocio_cliente   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_perfil_financiero_updated_at ON perfil_financiero;
CREATE TRIGGER trg_perfil_financiero_updated_at BEFORE UPDATE ON perfil_financiero FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_cuenta_bancaria_updated_at   ON cuenta_bancaria;
CREATE TRIGGER trg_cuenta_bancaria_updated_at   BEFORE UPDATE ON cuenta_bancaria   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- 7. RLS — mismo patrón que detalle_cliente
-- ============================================================
-- Cliente ve/gestiona lo suyo (mi_id_cliente()); analista/admin todo;
-- asesor ve lo de sus clientes asignados (es_asesor_de_cliente()).
ALTER TABLE direccion         ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocio_cliente   ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfil_financiero ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuenta_bancaria   ENABLE ROW LEVEL SECURITY;

-- --- direccion ---
DROP POLICY IF EXISTS "ver_direccion_propia"        ON direccion;
CREATE POLICY "ver_direccion_propia"        ON direccion         AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
DROP POLICY IF EXISTS "cliente_gestiona_direccion"  ON direccion;
CREATE POLICY "cliente_gestiona_direccion"  ON direccion         AS PERMISSIVE FOR ALL    USING ((id_cliente = mi_id_cliente())) WITH CHECK ((id_cliente = mi_id_cliente()));
DROP POLICY IF EXISTS "admin_gestiona_direccion"    ON direccion;
CREATE POLICY "admin_gestiona_direccion"    ON direccion         AS PERMISSIVE FOR ALL    USING (es_analista_o_admin());
DROP POLICY IF EXISTS "asesor_ve_direccion"         ON direccion;
CREATE POLICY "asesor_ve_direccion"         ON direccion         AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- --- negocio_cliente ---
DROP POLICY IF EXISTS "ver_negocio_propio"          ON negocio_cliente;
CREATE POLICY "ver_negocio_propio"          ON negocio_cliente   AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
DROP POLICY IF EXISTS "cliente_gestiona_negocio"    ON negocio_cliente;
CREATE POLICY "cliente_gestiona_negocio"    ON negocio_cliente   AS PERMISSIVE FOR ALL    USING ((id_cliente = mi_id_cliente())) WITH CHECK ((id_cliente = mi_id_cliente()));
DROP POLICY IF EXISTS "admin_gestiona_negocio"      ON negocio_cliente;
CREATE POLICY "admin_gestiona_negocio"      ON negocio_cliente   AS PERMISSIVE FOR ALL    USING (es_analista_o_admin());
DROP POLICY IF EXISTS "asesor_ve_negocio"           ON negocio_cliente;
CREATE POLICY "asesor_ve_negocio"           ON negocio_cliente   AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- --- perfil_financiero ---
DROP POLICY IF EXISTS "ver_finanzas_propias"        ON perfil_financiero;
CREATE POLICY "ver_finanzas_propias"        ON perfil_financiero AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
DROP POLICY IF EXISTS "cliente_gestiona_finanzas"   ON perfil_financiero;
CREATE POLICY "cliente_gestiona_finanzas"   ON perfil_financiero AS PERMISSIVE FOR ALL    USING ((id_cliente = mi_id_cliente())) WITH CHECK ((id_cliente = mi_id_cliente()));
DROP POLICY IF EXISTS "admin_gestiona_finanzas"     ON perfil_financiero;
CREATE POLICY "admin_gestiona_finanzas"     ON perfil_financiero AS PERMISSIVE FOR ALL    USING (es_analista_o_admin());
DROP POLICY IF EXISTS "asesor_ve_finanzas"          ON perfil_financiero;
CREATE POLICY "asesor_ve_finanzas"          ON perfil_financiero AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- --- cuenta_bancaria ---
DROP POLICY IF EXISTS "ver_cuenta_propia"           ON cuenta_bancaria;
CREATE POLICY "ver_cuenta_propia"           ON cuenta_bancaria   AS PERMISSIVE FOR SELECT USING (((id_cliente = mi_id_cliente()) OR es_analista_o_admin()));
DROP POLICY IF EXISTS "cliente_gestiona_cuenta"     ON cuenta_bancaria;
CREATE POLICY "cliente_gestiona_cuenta"     ON cuenta_bancaria   AS PERMISSIVE FOR ALL    USING ((id_cliente = mi_id_cliente())) WITH CHECK ((id_cliente = mi_id_cliente()));
DROP POLICY IF EXISTS "admin_gestiona_cuenta"       ON cuenta_bancaria;
CREATE POLICY "admin_gestiona_cuenta"       ON cuenta_bancaria   AS PERMISSIVE FOR ALL    USING (es_analista_o_admin());
DROP POLICY IF EXISTS "asesor_ve_cuenta"            ON cuenta_bancaria;
CREATE POLICY "asesor_ve_cuenta"            ON cuenta_bancaria   AS PERMISSIVE FOR SELECT USING (es_asesor_de_cliente(id_cliente));


-- ============================================================
-- 8. VERIFICACIÓN (correr a mano tras aplicar)
-- ============================================================
-- Estructuras creadas (deben existir las 4 tablas + la vista):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public'
--     AND table_name IN ('direccion','negocio_cliente','perfil_financiero','cuenta_bancaria');
--   SELECT table_name FROM information_schema.views
--   WHERE table_schema='public' AND table_name='vw_cliente_score';
-- RLS activo en las 4 tablas:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('direccion','negocio_cliente','perfil_financiero','cuenta_bancaria');
-- Aún vacías (el backfill llega en la migración 25):
--   SELECT
--     (SELECT count(*) FROM direccion)         AS direcciones,
--     (SELECT count(*) FROM negocio_cliente)   AS negocios,
--     (SELECT count(*) FROM perfil_financiero) AS perfiles,
--     (SELECT count(*) FROM cuenta_bancaria)   AS cuentas;
