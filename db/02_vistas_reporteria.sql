-- ============================================================
-- VISTAS MATERIALIZADAS PARA REPORTERÍA Y DASHBOARDS
-- ============================================================

-- 1. KPI General de la Cartera
-- Consolidado de monto desembolsado, saldo en riesgo y salud de cartera
CREATE MATERIALIZED VIEW vw_kpi_cartera AS
SELECT 
    COUNT(id_credito) AS total_creditos_activos,
    SUM(monto_desembolsado) AS total_desembolsado,
    SUM(saldo_pendiente) AS total_saldo_pendiente,
    SUM(CASE WHEN estado_credito = 'EN_MORA' THEN saldo_pendiente ELSE 0 END) AS total_cartera_vencida,
    CASE 
        WHEN SUM(saldo_pendiente) > 0 THEN 
            ROUND((SUM(CASE WHEN estado_credito = 'EN_MORA' THEN saldo_pendiente ELSE 0 END) / SUM(saldo_pendiente)) * 100, 2)
        ELSE 0 
    END AS indice_mora_porcentaje,
    NOW() AS ultima_actualizacion
FROM credito
WHERE estado_credito IN ('ACTIVO', 'EN_MORA');

-- 2. Rendimiento por Cohortes de Desembolso
-- Agrupa los créditos por el mes en que fueron desembolsados para ver su rendimiento
CREATE MATERIALIZED VIEW vw_cohortes_desembolso AS
SELECT 
    DATE_TRUNC('month', fecha_desembolso)::DATE AS mes_cohorte,
    COUNT(id_credito) AS creditos_otorgados,
    SUM(monto_desembolsado) AS monto_total_cohorte,
    SUM(CASE WHEN estado_credito = 'CANCELADO' THEN 1 ELSE 0 END) AS creditos_pagados,
    SUM(CASE WHEN estado_credito = 'EN_MORA' THEN 1 ELSE 0 END) AS creditos_en_mora,
    ROUND(AVG(dias_mora_maximo), 2) AS promedio_dias_mora_maximo
FROM credito
GROUP BY DATE_TRUNC('month', fecha_desembolso)
ORDER BY mes_cohorte DESC;

-- 3. Análisis de Mora Histórica y Tramos
-- Segmenta la cartera actual en diferentes buckets de riesgo
CREATE MATERIALIZED VIEW vw_mora_historica AS
SELECT 
    CASE 
        WHEN dias_mora_maximo = 0 THEN '0_Al_dia'
        WHEN dias_mora_maximo BETWEEN 1 AND 30 THEN '1_Mora_temprana_1_30'
        WHEN dias_mora_maximo BETWEEN 31 AND 60 THEN '2_Mora_media_31_60'
        WHEN dias_mora_maximo BETWEEN 61 AND 90 THEN '3_Mora_alta_61_90'
        ELSE '4_Cartera_castigada_mas_90'
    END AS tramo_riesgo,
    COUNT(id_credito) AS cantidad_creditos,
    SUM(saldo_pendiente) AS saldo_comprometido
FROM credito
WHERE estado_credito IN ('ACTIVO', 'EN_MORA')
GROUP BY tramo_riesgo
ORDER BY tramo_riesgo;

-- Nota: Para actualizar estas vistas materializadas, se debe ejecutar periódicamente (ej. vía pg_cron):
-- REFRESH MATERIALIZED VIEW vw_kpi_cartera;
-- REFRESH MATERIALIZED VIEW vw_cohortes_desembolso;
-- REFRESH MATERIALIZED VIEW vw_mora_historica;
