-- ============================================================
-- PLURALL — Migración 21: El ASESOR puede leer los clientes que tiene asignados
-- Ejecutar después de 20_disponibilidad_registro_y_trigger.sql
-- ============================================================
-- Problema: las páginas del asesor (/asesor/clientes, /asesor/cobranza/[id], ...)
-- consultan con el cliente RLS del propio asesor. El asesor SÍ puede leer sus
-- filas en `asignacion_asesor` (política asesor_ver_sus_asignaciones), pero el
-- join embebido a `cliente(...)` lo filtra RLS y devuelve NULL, porque NINGUNA
-- política le da acceso de lectura a las filas de `cliente` que tiene asignadas.
-- Todas las políticas usan "id_cliente = mi_id_cliente() OR es_analista_o_admin()",
-- y es_analista_o_admin() solo cubre ADMIN y SUPERVISOR (no ASESOR).
-- Resultado: "No tienes clientes asignados aún." aunque las asignaciones existan.
--
-- Solución: helper es_asesor_de_cliente() + políticas SELECT ADITIVAS (permisivas,
-- se combinan con OR con las existentes; no se elimina ni modifica nada previo)
-- para las tablas que leen las vistas del asesor.
-- ============================================================


-- ============================================================
-- 1. HELPER: ¿el asesor autenticado tiene asignado (activo) este cliente?
-- ============================================================
-- SECURITY DEFINER para poder consultar asignacion_asesor sin depender de su RLS.
CREATE OR REPLACE FUNCTION public.es_asesor_de_cliente(p_id_cliente UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM asignacion_asesor aa
        WHERE aa.id_cliente = p_id_cliente
          AND aa.id_asesor  = auth.uid()
          AND aa.activa      = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.es_asesor_de_cliente(UUID) TO authenticated;


-- ============================================================
-- 2. POLÍTICAS SELECT PARA EL ASESOR (aditivas)
-- ============================================================

-- ── cliente ──
DROP POLICY IF EXISTS "asesor_ver_clientes_asignados" ON cliente;
CREATE POLICY "asesor_ver_clientes_asignados" ON cliente
    FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- ── credito ──
DROP POLICY IF EXISTS "asesor_ver_creditos_asignados" ON credito;
CREATE POLICY "asesor_ver_creditos_asignados" ON credito
    FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- ── solicitud_credito ──
DROP POLICY IF EXISTS "asesor_ver_solicitudes_asignadas" ON solicitud_credito;
CREATE POLICY "asesor_ver_solicitudes_asignadas" ON solicitud_credito
    FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- ── detalle_cliente ──
DROP POLICY IF EXISTS "asesor_ver_detalle_asignado" ON detalle_cliente;
CREATE POLICY "asesor_ver_detalle_asignado" ON detalle_cliente
    FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- ── documento_cliente ──
DROP POLICY IF EXISTS "asesor_ver_documentos_asignados" ON documento_cliente;
CREATE POLICY "asesor_ver_documentos_asignados" ON documento_cliente
    FOR SELECT USING (es_asesor_de_cliente(id_cliente));

-- ── plan_pago (vía crédito) ──
DROP POLICY IF EXISTS "asesor_ver_planes_asignados" ON plan_pago;
CREATE POLICY "asesor_ver_planes_asignados" ON plan_pago
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM credito c
            WHERE c.id_credito = plan_pago.id_credito
              AND es_asesor_de_cliente(c.id_cliente)
        )
    );

-- ── cuota (vía plan_pago → crédito) ──
DROP POLICY IF EXISTS "asesor_ver_cuotas_asignadas" ON cuota;
CREATE POLICY "asesor_ver_cuotas_asignadas" ON cuota
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM plan_pago pp
            JOIN credito c ON c.id_credito = pp.id_credito
            WHERE pp.id_plan_pago = cuota.id_plan_pago
              AND es_asesor_de_cliente(c.id_cliente)
        )
    );

-- ── pago (vía crédito) ──
DROP POLICY IF EXISTS "asesor_ver_pagos_asignados" ON pago;
CREATE POLICY "asesor_ver_pagos_asignados" ON pago
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM credito c
            WHERE c.id_credito = pago.id_credito
              AND es_asesor_de_cliente(c.id_cliente)
        )
    );


-- ============================================================
-- 3. Verificación
-- ============================================================
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'asesor_ver_%asignad%'
ORDER BY tablename;
