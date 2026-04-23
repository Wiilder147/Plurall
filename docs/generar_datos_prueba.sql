/*
  SCRIPT GENERADOR DE DATOS DE PRUEBA: CRÉDITOS Y CUOTAS (PLURALL)
  ---------------------------------------------------------------------------------
  Este script te permite generar un crédito desembolsado y todo su plan de pagos 
  (con cuotas) de manera automática hacia un usuario específico de tu base de datos.
  
  USO:
  1. Córtalo y pégalo en el SQL Editor de tu proyecto en Supabase (o DBeaver).
  2. Modifica el campo `v_telefono_cliente` (Línea 15) por el teléfono con el 
     que te registraste en la aplicación.
  3. Dale Ejecutar (Run). ¡Y listo! Verás los datos aparecer al instante en tu Dashboard de Mis Créditos.
*/
DO $$ 
DECLARE
    -- 🚨 CAMBIA ESTO por el número de tu celular o correo con el que te creaste:
    v_telefono_cliente VARCHAR := '3132779933';
    
    v_id_auth UUID;
    v_id_cliente UUID;
    v_id_estado_solicitud UUID;
    v_id_solicitud UUID;
    v_id_credito UUID;
    v_id_plan_pago UUID;
    
    -- Variables de plan de amortización de prueba
    v_monto DECIMAL := 5000000;
    v_tasa_anual DECIMAL := 28;
    v_tasa_mensual DECIMAL := 0.020785; -- (1+0.28)^(1/12)-1 Aprox
    v_plazo INT := 6;
    v_cuota_fija DECIMAL := 885661; -- Cálculo aproximado $5M a 6 meses
    v_saldo_residual DECIMAL := v_monto;
    
    v_interes_mes DECIMAL;
    v_capital_mes DECIMAL;
BEGIN
    -- 1. Buscamos al usuario en la plataforma utilizando el teléfono (espejo del correo)
    SELECT id INTO v_id_auth 
    FROM auth.users 
    WHERE email = v_telefono_cliente || '@plurall.app' OR email = v_telefono_cliente;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario con teléfono % no encontrado. Por favor, asegúrate de haberte registrado primero.', v_telefono_cliente;
    END IF;
    
    -- Al ser UUID compartidos, id_auth es id_cliente
    v_id_cliente := v_id_auth;
    
    -- 2. Buscamos el estado 'DESEMBOLSADA' que ya deberías tener en base de datos
    SELECT id_estado_solicitud INTO v_id_estado_solicitud FROM public.estado_solicitud WHERE nombre = 'DESEMBOLSADA' LIMIT 1;
    
    IF v_id_estado_solicitud IS NULL THEN
        RAISE EXCEPTION 'No se encontró el estado DESEMBOLSADA. ¿Corriste el catálogo de estados?';
    END IF;

    -- 3. Creamos una Solicitud Ficticia Inicial
    INSERT INTO public.solicitud_credito (id_cliente, id_estado_solicitud, monto_solicitado, plazo_meses, proposito)
    VALUES (v_id_cliente, v_id_estado_solicitud, v_monto, v_plazo, 'Capital de trabajo demo visualizacion')
    RETURNING id_solicitud INTO v_id_solicitud;

    -- 4. Creamos el Crédito Desembolsado atado a la solicitud
    INSERT INTO public.credito (
        id_solicitud, id_cliente, monto_desembolsado, 
        tasa_interes_anual, tasa_interes_mensual, numero_cuotas, cuota_fija, 
        fecha_desembolso, fecha_primera_cuota, fecha_ultima_cuota, saldo_pendiente
    ) VALUES (
        v_id_solicitud, v_id_cliente, v_monto,
        v_tasa_anual, v_tasa_mensual, v_plazo, v_cuota_fija,
        NOW() - INTERVAL '1 month', (NOW() + INTERVAL '1 month')::DATE, (NOW() + INTERVAL '6 months')::DATE,
        v_monto
    ) RETURNING id_credito INTO v_id_credito;

    -- 5. Le atamos el plan de pagos centralizado
    INSERT INTO public.plan_pago (
        id_credito, num_cuotas_totales, fecha_inicio_cobro, fecha_fin_cobro
    ) VALUES (
        v_id_credito, v_plazo, NOW()::DATE, (NOW() + INTERVAL '6 months')::DATE
    ) RETURNING id_plan_pago INTO v_id_plan_pago;

    -- 6. Insertamos el despiece de cada iteración (Hacemos un FOR simple para 6 meses)
    FOR i IN 1..v_plazo LOOP
        -- Calculamos lo del mes particular
        v_interes_mes := v_saldo_residual * v_tasa_mensual;
        v_capital_mes := v_cuota_fija - v_interes_mes;
        v_saldo_residual := v_saldo_residual - v_capital_mes;
        
        -- Simulamos que las dos primeras están pagadas, la tercera atrasada o al día
        INSERT INTO public.cuota (
            id_plan_pago, numero_cuota, monto_capital, monto_interes, monto_total_cuota,
            saldo_despues_pago, fecha_vencimiento, estado_cuota
        ) VALUES (
            v_id_plan_pago, i, ROUND(v_capital_mes, 2), ROUND(v_interes_mes, 2), ROUND(v_cuota_fija, 2),
            GREATEST(ROUND(v_saldo_residual, 2), 0),
            (NOW() + (i * INTERVAL '1 month'))::DATE,
            CASE 
                WHEN i <= 2 THEN 'PAGADA'
                WHEN i = 3 THEN 'PENDIENTE'
                ELSE 'PENDIENTE'
            END
        );
    END LOOP;
    
    -- 7. Actualizamos el saldo pendiente del crédito general si es que hemos pagado dos
    UPDATE credito SET saldo_pendiente = (v_monto - (v_cuota_fija - v_interes_mes) * 2), cuotas_pagadas = 2 WHERE id_credito = v_id_credito;

END $$;
