-- ============================================================
-- MEJORAS DE INTEGRIDAD Y ROBUSTEZ - PLURALL V1.1
-- ============================================================

-- 1. Añadir restricciones (Check Constraints) para evitar datos inválidos

-- En solicitud_credito
ALTER TABLE solicitud_credito
  ADD CONSTRAINT chk_monto_solicitado CHECK (monto_solicitado > 0),
  ADD CONSTRAINT chk_plazo_meses CHECK (plazo_meses > 0);

-- En credito
ALTER TABLE credito
  ADD CONSTRAINT chk_monto_desembolsado CHECK (monto_desembolsado > 0),
  ADD CONSTRAINT chk_tasa_interes_anual CHECK (tasa_interes_anual >= 0),
  ADD CONSTRAINT chk_numero_cuotas CHECK (numero_cuotas > 0),
  ADD CONSTRAINT chk_fechas_credito CHECK (fecha_ultima_cuota >= fecha_primera_cuota),
  ADD CONSTRAINT chk_saldo_positivo CHECK (saldo_pendiente >= 0);

-- En cuota
ALTER TABLE cuota
  ADD CONSTRAINT chk_monto_total_cuota CHECK (monto_total_cuota >= 0),
  ADD CONSTRAINT chk_saldo_despues CHECK (saldo_despues_pago >= 0);

-- En pago
ALTER TABLE pago
  ADD CONSTRAINT chk_monto_pagado CHECK (monto_pagado > 0);


-- 2. Trigger para automatizar la actualización de saldos al confirmar un pago

CREATE OR REPLACE FUNCTION fn_actualizar_saldos_credito()
RETURNS TRIGGER AS $$
DECLARE
    v_id_credito UUID;
    v_saldo_actual DECIMAL(15,2);
    v_estado_credito VARCHAR(20);
BEGIN
    -- Solo actuar si el pago se confirma (o se inserta ya confirmado)
    IF (TG_OP = 'INSERT' AND NEW.estado = 'CONFIRMADO') OR 
       (TG_OP = 'UPDATE' AND OLD.estado != 'CONFIRMADO' AND NEW.estado = 'CONFIRMADO') THEN
        
        -- Obtener id_credito de la cuota pagada
        SELECT id_credito INTO v_id_credito FROM cuota JOIN plan_pago ON cuota.id_plan_pago = plan_pago.id_plan_pago WHERE cuota.id_cuota = NEW.id_cuota;

        -- Descontar del saldo pendiente en el crédito
        UPDATE credito 
        SET saldo_pendiente = GREATEST(0, saldo_pendiente - NEW.monto_capital),
            cuotas_pagadas = cuotas_pagadas + 1,
            updated_at = NOW()
        WHERE id_credito = v_id_credito
        RETURNING saldo_pendiente, estado_credito INTO v_saldo_actual, v_estado_credito;

        -- Si el saldo llega a 0, cambiar estado a CANCELADO
        IF v_saldo_actual = 0 AND v_estado_credito != 'CANCELADO' THEN
            UPDATE credito SET estado_credito = 'CANCELADO', updated_at = NOW() WHERE id_credito = v_id_credito;
        END IF;

        -- Actualizar el estado de la cuota
        UPDATE cuota 
        SET estado_cuota = 'PAGADA',
            monto_pagado_real = COALESCE(monto_pagado_real, 0) + NEW.monto_pagado,
            fecha_pago_real = CURRENT_DATE,
            updated_at = NOW()
        WHERE id_cuota = NEW.id_cuota;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar el trigger si existe para recrearlo
DROP TRIGGER IF EXISTS trg_pago_confirmado ON pago;

-- Crear el trigger
CREATE TRIGGER trg_pago_confirmado
AFTER INSERT OR UPDATE ON pago
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_saldos_credito();
