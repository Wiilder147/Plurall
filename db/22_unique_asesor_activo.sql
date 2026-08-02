-- ============================================================
-- PLURALL — Migración 22: un cliente tiene UN solo asesor activo
-- Ejecutar después de 21_rls_asesor_ve_clientes_asignados.sql
-- ============================================================
-- Problema: `asignacion_asesor` solo tiene UNIQUE (id_asesor, id_cliente), lo que
-- impide duplicar la MISMA pareja pero NO impide que un cliente quede con varias
-- asignaciones activas de asesores distintos. El endpoint
-- /api/supervisor/asignar-asesor hace upsert con onConflict 'id_asesor,id_cliente'
-- y nunca cierra la asignación previa, así que cada reasignación acumulaba una
-- fila activa más.
--
-- Estado encontrado en dev (2026-08-01): 3 clientes con 2 asesores activos
--   - Sofía Al Día    → Carlos Asesor (03-may) + Andrés Vargas  (21-may)
--   - Miguel Puntual  → Carlos Asesor (03-may) + Luisa Martínez (06-may)
--   - Rosa Mora Alta  → Carlos Asesor (03-may) + María López    (12-may)
--
-- Solución: cerrar las asignaciones antiguas (gana la más reciente, que es la
-- reasignación real), índice único parcial, y un RPC atómico para reasignar.
-- ============================================================


-- ============================================================
-- 1. LIMPIEZA: dejar activa solo la asignación más reciente por cliente
-- ============================================================
-- La asignación antigua se cierra (activa=false + fecha_fin) en lugar de
-- borrarse, para conservar el histórico de qué asesor tuvo al cliente.
WITH ranked AS (
    SELECT id_asignacion,
           id_cliente,
           fecha_asignacion,
           ROW_NUMBER() OVER (
               PARTITION BY id_cliente
               ORDER BY fecha_asignacion DESC, created_at DESC
           ) AS rn,
           MAX(fecha_asignacion) OVER (PARTITION BY id_cliente) AS fecha_vigente
    FROM asignacion_asesor
    WHERE activa
)
UPDATE asignacion_asesor a
SET activa    = false,
    fecha_fin = COALESCE(a.fecha_fin, r.fecha_vigente),
    notas     = COALESCE(a.notas || ' | ', '') ||
                'Cerrada por migración 22 (reasignada a otro asesor)'
FROM ranked r
WHERE a.id_asignacion = r.id_asignacion
  AND r.rn > 1;


-- ============================================================
-- 2. ÍNDICE ÚNICO PARCIAL: un solo asesor activo por cliente
-- ============================================================
-- Parcial (WHERE activa) para no bloquear el histórico de asignaciones cerradas.
DROP INDEX IF EXISTS ux_asignacion_asesor_cliente_activo;
CREATE UNIQUE INDEX ux_asignacion_asesor_cliente_activo
    ON asignacion_asesor (id_cliente)
    WHERE activa;


-- ============================================================
-- 3. RPC ATÓMICO: reasignar un cliente a un asesor
-- ============================================================
-- Cierra la asignación activa previa y crea/reactiva la nueva en una sola
-- transacción, de modo que el cliente nunca queda sin asesor ni con dos.
-- Reemplaza el upsert directo de /api/supervisor/asignar-asesor.
CREATE OR REPLACE FUNCTION public.asignar_asesor_a_cliente(
    p_id_cliente UUID,
    p_id_asesor  UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id_asignacion UUID;
BEGIN
    -- Cerrar cualquier asignación activa de OTRO asesor para este cliente.
    UPDATE asignacion_asesor
    SET activa    = false,
        fecha_fin = now()
    WHERE id_cliente = p_id_cliente
      AND activa
      AND id_asesor <> p_id_asesor;

    -- Crear o reactivar la asignación del asesor destino.
    INSERT INTO asignacion_asesor (id_asesor, id_cliente, activa, fecha_asignacion)
    VALUES (p_id_asesor, p_id_cliente, true, now())
    ON CONFLICT (id_asesor, id_cliente) DO UPDATE
        SET activa           = true,
            fecha_fin        = NULL,
            fecha_asignacion = now()
    RETURNING id_asignacion INTO v_id_asignacion;

    RETURN v_id_asignacion;
END;
$$;

-- Solo el backend (service_role) la invoca, tras validar el rol del llamante.
REVOKE ALL ON FUNCTION public.asignar_asesor_a_cliente(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.asignar_asesor_a_cliente(UUID, UUID) TO service_role;


-- ============================================================
-- 4. VERIFICACIÓN
-- ============================================================
-- Debe devolver 0 filas:
--   SELECT id_cliente, count(*) FROM asignacion_asesor
--   WHERE activa GROUP BY id_cliente HAVING count(*) > 1;
