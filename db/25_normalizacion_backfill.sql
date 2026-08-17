-- ============================================================
-- PLURALL — Migración 25: normalización BD — MIGRATE (backfill)
-- Ejecutar después de 24_normalizacion_tablas_nuevas.sql
-- ============================================================
-- FASE 3 del plan (docs/HANDOFF_normalizacion_bd.md).
--
-- Puebla las tablas nuevas (creadas vacías en la migración 24) desde las
-- columnas sobrecargadas de `cliente` y `detalle_cliente`, aplicando §4:
--   - direccion: filas CASA / NEGOCIO por cliente (solo si hay algún dato).
--   - negocio_cliente: 1 negocio por cliente que tenga nombre_negocio.
--   - perfil_financiero: finanzas 1:1, FUSIONANDO duplicados
--       personas_cargo   absorbe dependientes
--       patrimonio_estimado absorbe ahorros
--     arriendo_casa vive aquí y NO se re-suma a egresos_mensuales.
--   - cuenta_bancaria: banco_preferido(texto) -> FK banco (match por nombre).
--
-- NO borra ni modifica columnas origen (eso es el CONTRACT, migración 26).
-- Idempotente: re-ejecutable sin duplicar (ON CONFLICT / WHERE NOT EXISTS).
--
-- Estado de datos al escribir (dev/seed, 85 clientes):
--   - 0 clientes con dirección (casa/negocio/legacy) -> direccion backfill = 0.
--   - 69 clientes con nombre_negocio; tipo/antigüedad/empleados/arriendo vacíos.
--   - detalle_cliente: 3 filas; sin banco/número -> cuenta_bancaria = 0.
--   - dependientes/ahorros = 0 en todas -> la fusión no cambia valores hoy,
--     pero la regla queda escrita para datos futuros.
-- ============================================================


-- ============================================================
-- 1. DIRECCION — CASA y NEGOCIO (solo filas con algún dato)
-- ============================================================
-- CASA
INSERT INTO direccion (id_cliente, tipo, linea, lat, lon)
SELECT c.id_cliente, 'CASA',
       NULLIF(trim(concat_ws(', ',
           NULLIF(trim(c.direccion_casa), ''),
           NULLIF(trim(c.ciudad_casa), ''),
           NULLIF(trim(c.departamento_casa), '')
       )), ''),
       c.lat_casa, c.lon_casa
FROM cliente c
WHERE NULLIF(trim(c.direccion_casa), '') IS NOT NULL
   OR NULLIF(trim(c.ciudad_casa), '')    IS NOT NULL
   OR c.lat_casa IS NOT NULL
   OR c.lon_casa IS NOT NULL
ON CONFLICT (id_cliente, tipo) DO NOTHING;

-- NEGOCIO — preferir campos *_negocio; si vacíos, caer a los legacy (direccion/ciudad/departamento)
INSERT INTO direccion (id_cliente, tipo, linea, lat, lon)
SELECT c.id_cliente, 'NEGOCIO',
       NULLIF(trim(concat_ws(', ',
           COALESCE(NULLIF(trim(c.direccion_negocio), ''),   NULLIF(trim(c.direccion), '')),
           COALESCE(NULLIF(trim(c.ciudad_negocio), ''),      NULLIF(trim(c.ciudad), '')),
           COALESCE(NULLIF(trim(c.departamento_negocio), ''),NULLIF(trim(c.departamento), ''))
       )), ''),
       c.lat_negocio, c.lon_negocio
FROM cliente c
WHERE NULLIF(trim(c.direccion_negocio), '')    IS NOT NULL
   OR NULLIF(trim(c.ciudad_negocio), '')       IS NOT NULL
   OR c.lat_negocio IS NOT NULL
   OR c.lon_negocio IS NOT NULL
   OR NULLIF(trim(c.direccion), '')            IS NOT NULL
   OR NULLIF(trim(c.ciudad), '')               IS NOT NULL
ON CONFLICT (id_cliente, tipo) DO NOTHING;


-- ============================================================
-- 2. NEGOCIO_CLIENTE — un negocio por cliente con nombre_negocio
-- ============================================================
-- 1:N sin UNIQUE, así que idempotencia por WHERE NOT EXISTS (no re-inserta si
-- el cliente ya tiene algún negocio). empleados/arriendo desde detalle_cliente.
INSERT INTO negocio_cliente
    (id_cliente, nombre_negocio, id_tipo_negocio, descripcion, antiguedad_meses, empleados, arriendo_negocio)
SELECT c.id_cliente,
       c.nombre_negocio,
       c.id_tipo_negocio,
       NULLIF(trim(c.descripcion_negocio), ''),
       c.antiguedad_negocio_meses,
       COALESCE(d.empleados_negocio, 0),
       COALESCE(d.arriendo_negocio, 0)
FROM cliente c
LEFT JOIN LATERAL (
    SELECT dc.empleados_negocio, dc.arriendo_negocio
    FROM detalle_cliente dc
    WHERE dc.id_cliente = c.id_cliente
    ORDER BY dc.updated_at DESC NULLS LAST, dc.created_at DESC NULLS LAST
    LIMIT 1
) d ON true
WHERE NULLIF(trim(c.nombre_negocio), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM negocio_cliente n WHERE n.id_cliente = c.id_cliente);


-- ============================================================
-- 3. PERFIL_FINANCIERO — 1:1, fusionando duplicados
-- ============================================================
-- DISTINCT ON por si detalle_cliente tuviera >1 fila por cliente (gana la más
-- reciente). Fusión: personas_cargo<-dependientes, patrimonio_estimado<-ahorros.
INSERT INTO perfil_financiero
    (id_cliente, tipo_vivienda, estrato, nivel_educativo, estado_civil,
     personas_cargo, ingresos_mensuales, egresos_mensuales, patrimonio_estimado,
     otras_obligaciones, arriendo_casa, colaboracion_gastos, tiene_vehiculo)
SELECT DISTINCT ON (d.id_cliente)
       d.id_cliente,
       d.tipo_vivienda,
       d.estrato,
       d.nivel_educativo,
       d.estado_civil,
       COALESCE(NULLIF(d.personas_cargo, 0),      NULLIF(d.dependientes, 0), 0),
       d.ingresos_mensuales,
       d.egresos_mensuales,
       COALESCE(NULLIF(d.patrimonio_estimado, 0), NULLIF(d.ahorros, 0), 0),
       COALESCE(d.otras_obligaciones, 0),
       COALESCE(d.arriendo_casa, 0),
       COALESCE(d.colaboracion_gastos, false),
       COALESCE(d.tiene_vehiculo, false)
FROM detalle_cliente d
ORDER BY d.id_cliente, d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST
ON CONFLICT (id_cliente) DO NOTHING;


-- ============================================================
-- 4. CUENTA_BANCARIA — banco_preferido(texto) -> FK banco
-- ============================================================
-- Solo filas con algún dato bancario. Match de banco por nombre normalizado
-- (lower+trim); si no matchea, id_banco queda NULL (se corrige a mano después).
INSERT INTO cuenta_bancaria (id_cliente, id_banco, tipo_cuenta, numero)
SELECT DISTINCT ON (d.id_cliente)
       d.id_cliente,
       b.id_banco,
       NULLIF(trim(d.tipo_cuenta_bancaria), ''),
       NULLIF(trim(d.numero_cuenta), '')
FROM detalle_cliente d
LEFT JOIN banco b
       ON lower(trim(b.nombre)) = lower(trim(d.banco_preferido))
WHERE NULLIF(trim(d.banco_preferido), '')      IS NOT NULL
   OR NULLIF(trim(d.numero_cuenta), '')        IS NOT NULL
   OR NULLIF(trim(d.tipo_cuenta_bancaria), '') IS NOT NULL
ORDER BY d.id_cliente, d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST
ON CONFLICT DO NOTHING;
-- Nota: cuenta_bancaria no tiene UNIQUE por cliente; el ON CONFLICT DO NOTHING
-- solo cubre PK. Como el backfill es one-shot y hoy no hay datos, no se duplica.
-- Si se re-corriera con datos, filtrar con WHERE NOT EXISTS por (id_cliente,numero).


-- ============================================================
-- 5. VERIFICACIÓN (correr a mano tras aplicar)
-- ============================================================
-- Conteos destino esperados hoy: direccion 0 | negocio_cliente 69 | perfil_financiero 3 | cuenta_bancaria 0
--   SELECT
--     (SELECT count(*) FROM direccion)         AS direcciones,
--     (SELECT count(*) FROM negocio_cliente)   AS negocios,
--     (SELECT count(*) FROM perfil_financiero) AS perfiles,
--     (SELECT count(*) FROM cuenta_bancaria)   AS cuentas;
--
-- Origen == destino (negocios): debe coincidir con clientes que tienen nombre_negocio
--   SELECT
--     (SELECT count(*) FROM cliente WHERE nullif(trim(nombre_negocio),'') IS NOT NULL) AS origen,
--     (SELECT count(*) FROM negocio_cliente) AS destino;
--
-- perfil_financiero == filas de detalle_cliente (1:1)
--   SELECT (SELECT count(*) FROM detalle_cliente) AS origen,
--          (SELECT count(*) FROM perfil_financiero) AS destino;
--
-- 0 huérfanos (todo id_cliente existe en cliente)
--   SELECT 'direccion' t, count(*) FROM direccion d WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id_cliente=d.id_cliente)
--   UNION ALL SELECT 'negocio', count(*) FROM negocio_cliente n WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id_cliente=n.id_cliente)
--   UNION ALL SELECT 'perfil', count(*) FROM perfil_financiero p WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id_cliente=p.id_cliente)
--   UNION ALL SELECT 'cuenta', count(*) FROM cuenta_bancaria cb WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id_cliente=cb.id_cliente);
--
-- Spot-check fusión (los 3 de detalle): personas_cargo y patrimonio conservados
--   SELECT id_cliente, personas_cargo, patrimonio_estimado FROM perfil_financiero ORDER BY id_cliente;
