-- ============================================================
-- PLURALL — Migración 26: enriquecer direccion.id_municipio (FK municipio)
-- Ejecutar después de 25_normalizacion_backfill.sql
-- ============================================================
-- FASE 4 (soporte de reads). El backfill de la migración 25 dejó
-- `direccion.id_municipio` en NULL porque el origen (`cliente.ciudad`/
-- `departamento`) es texto libre. Sin esta FK, `direccion` queda medio
-- desconectada del catálogo `municipio` y las analíticas geográficas no
-- podrían dejar de leer `cliente.ciudad`/`departamento` antes del DROP (FASE 7).
--
-- Mapea cada dirección a un `municipio` por (ciudad, departamento) del cliente,
-- con dos alias explícitos para los nombres que no calzan 1:1 con el catálogo:
--   'Bogotá'    -> 'Bogotá D.C.'        (evita colisión con el municipio
--                                        homónimo de Cundinamarca)
--   'Cartagena' -> 'Cartagena de Indias'
-- Verificado sobre los datos actuales: mapea 69/69 direcciones (0 sin match).
--
-- Idempotente: solo toca filas con id_municipio NULL; re-ejecutable.
-- ============================================================

WITH norm AS (
    SELECT d.id_direccion,
           CASE lower(trim(c.ciudad))
               WHEN 'bogotá'    THEN 'bogotá d.c.'
               WHEN 'cartagena' THEN 'cartagena de indias'
               ELSE lower(trim(c.ciudad))
           END               AS ciudad_n,
           lower(trim(c.departamento)) AS depto_n
    FROM direccion d
    JOIN cliente   c ON c.id_cliente = d.id_cliente
    WHERE d.id_municipio IS NULL
      AND nullif(trim(c.ciudad), '') IS NOT NULL
),
mapa AS (
    SELECT n.id_direccion,
           (SELECT m.id_municipio
              FROM municipio m
              JOIN departamento dp ON dp.id_departamento = m.id_departamento
             WHERE lower(trim(m.nombre))  = n.ciudad_n
               AND lower(trim(dp.nombre)) = n.depto_n
             LIMIT 1) AS id_muni
    FROM norm n
)
UPDATE direccion d
SET id_municipio = mapa.id_muni,
    updated_at   = now()
FROM mapa
WHERE d.id_direccion = mapa.id_direccion
  AND mapa.id_muni IS NOT NULL;

-- ============================================================
-- VERIFICACIÓN (correr a mano)
-- ============================================================
-- Deben quedar 0 direcciones con ciudad de origen pero sin municipio:
--   SELECT count(*) FROM direccion d JOIN cliente c ON c.id_cliente=d.id_cliente
--   WHERE d.id_municipio IS NULL AND nullif(trim(c.ciudad),'') IS NOT NULL;
-- Distribución por departamento vía el modelo normalizado:
--   SELECT dp.nombre, count(*) FROM direccion d
--   JOIN municipio m  ON m.id_municipio=d.id_municipio
--   JOIN departamento dp ON dp.id_departamento=m.id_departamento
--   GROUP BY dp.nombre ORDER BY count(*) DESC;
