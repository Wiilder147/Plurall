-- ============================================================
-- PLURALL — Migración 17: Precisión numérica (dinero y tasas)
-- Ejecutar después de 16_integridad_dominios_y_registro.sql
-- ============================================================
-- Estandariza los tipos numeric sin precisión declarada (riesgo en
-- fintech) a dominios explícitos. Escalas verificadas contra los datos
-- existentes antes de aplicar (dinero=2, tasas<=6), por lo que el
-- casteo no trunca ni redondea ningún valor real.
--   · Dinero -> numeric(14,2)   (hasta ~999.999 millones)
--   · Tasas  -> numeric(9,6)
-- No hay vistas ni columnas generadas que dependan de estas columnas
-- (verificado en information_schema.view_column_usage / pg_matviews).
-- ============================================================

ALTER TABLE credito
  ALTER COLUMN monto_desembolsado TYPE numeric(14,2),
  ALTER COLUMN cuota_fija         TYPE numeric(14,2),
  ALTER COLUMN saldo_pendiente    TYPE numeric(14,2),
  ALTER COLUMN tasa_interes_anual   TYPE numeric(9,6),
  ALTER COLUMN tasa_interes_mensual TYPE numeric(9,6);

ALTER TABLE cuota
  ALTER COLUMN monto_capital      TYPE numeric(14,2),
  ALTER COLUMN monto_interes      TYPE numeric(14,2),
  ALTER COLUMN monto_total_cuota  TYPE numeric(14,2),
  ALTER COLUMN saldo_despues_pago TYPE numeric(14,2),
  ALTER COLUMN monto_pagado_real  TYPE numeric(14,2),
  ALTER COLUMN monto_mora_cobrada TYPE numeric(14,2);

ALTER TABLE pago
  ALTER COLUMN monto_pagado  TYPE numeric(14,2),
  ALTER COLUMN monto_capital TYPE numeric(14,2),
  ALTER COLUMN monto_interes TYPE numeric(14,2),
  ALTER COLUMN monto_mora    TYPE numeric(14,2);

ALTER TABLE solicitud_credito
  ALTER COLUMN monto_solicitado       TYPE numeric(14,2),
  ALTER COLUMN tasa_interes_propuesta TYPE numeric(9,6);

ALTER TABLE decision_solicitud
  ALTER COLUMN monto_aprobado        TYPE numeric(14,2),
  ALTER COLUMN tasa_interes_aprobada TYPE numeric(9,6);

ALTER TABLE detalle_cliente
  ALTER COLUMN ingresos_mensuales  TYPE numeric(14,2),
  ALTER COLUMN egresos_mensuales   TYPE numeric(14,2),
  ALTER COLUMN patrimonio_estimado TYPE numeric(14,2),
  ALTER COLUMN otras_obligaciones  TYPE numeric(14,2),
  ALTER COLUMN arriendo_negocio    TYPE numeric(14,2),
  ALTER COLUMN arriendo_casa       TYPE numeric(14,2),
  ALTER COLUMN ahorros             TYPE numeric(14,2);

ALTER TABLE gestion_cobranza
  ALTER COLUMN monto_prometido TYPE numeric(14,2),
  ALTER COLUMN monto_recibido  TYPE numeric(14,2);

ALTER TABLE plan_pago
  ALTER COLUMN tasa_mora_diaria TYPE numeric(9,6);
