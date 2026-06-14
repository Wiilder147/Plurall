-- ============================================================
-- CONSOLIDACIÓN A 4 ROLES — PLURALL v1.3
-- Ejecutar en: Supabase → SQL Editor
--
-- OBJETIVO: Dejar el sistema con EXACTAMENTE 4 roles bien definidos:
--   1. ADMIN      → Acceso total (gerente del proyecto / base de datos)
--   2. SUPERVISOR → Analista de crédito: aprobación, desembolso y gestión
--   3. ASESOR     → Gestión comercial y preaprobación de créditos
--   4. CLIENTE    → Vista del usuario final (se muestra como "Usuario" en la UI)
--
-- El rol ANALISTA se FUSIONA en SUPERVISOR (eran el mismo concepto).
-- NOTA: El rol CLIENTE conserva su nombre interno porque la tabla
--       'cliente' y múltiples relaciones dependen de él; en la interfaz
--       se etiqueta como "Usuario".
-- ============================================================

BEGIN;

-- ── 1. Migrar usuarios ANALISTA → SUPERVISOR ─────────────────
-- Asegurar primero que SUPERVISOR exista en el catálogo.
INSERT INTO rol (nombre_rol, descripcion) VALUES
  ('SUPERVISOR', 'Supervisor / analista de crédito: aprueba solicitudes, gestiona desembolsos, mora y asesores')
ON CONFLICT (nombre_rol) DO NOTHING;

-- Reasignar cualquier perfil que tenga ANALISTA al rol SUPERVISOR.
UPDATE perfil_usuario pu
SET id_rol = (SELECT id_rol FROM rol WHERE nombre_rol = 'SUPERVISOR')
WHERE pu.id_rol = (SELECT id_rol FROM rol WHERE nombre_rol = 'ANALISTA');


-- ── 2. Actualizar funciones RLS que referencian ANALISTA ─────
-- es_analista_o_admin() ahora considera SUPERVISOR (antes ANALISTA).
-- Se conserva el nombre de la función para no romper las políticas
-- existentes que la invocan.
CREATE OR REPLACE FUNCTION es_analista_o_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM perfil_usuario pu
        JOIN rol r ON r.id_rol = pu.id_rol
        WHERE pu.id = auth.uid()
          AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR')
          AND pu.activo = true
    );
$$;


-- ── 3. Recrear políticas que listaban ANALISTA explícitamente ─
-- gestion_cobranza: "supervisor_admin_ver_cobros" listaba ANALISTA.
DROP POLICY IF EXISTS "supervisor_admin_ver_cobros" ON gestion_cobranza;
CREATE POLICY "supervisor_admin_ver_cobros" ON gestion_cobranza
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM perfil_usuario pu
            JOIN rol r ON r.id_rol = pu.id_rol
            WHERE pu.id = auth.uid()
              AND r.nombre_rol IN ('ADMIN', 'SUPERVISOR')
        )
    );


-- ── 4. Eliminar el rol ANALISTA del catálogo ─────────────────
-- A este punto ningún perfil debería seguir apuntando a ANALISTA.
DELETE FROM rol WHERE nombre_rol = 'ANALISTA';


-- ── 5. Garantizar los 4 roles canónicos con descripción final ─
INSERT INTO rol (nombre_rol, descripcion) VALUES
  ('ADMIN',      'Administrador / gerente del proyecto: acceso total al sistema y a la base de datos'),
  ('SUPERVISOR', 'Supervisor / analista de crédito: aprueba solicitudes, gestiona desembolsos, mora y asesores'),
  ('ASESOR',     'Asesor comercial: gestiona usuarios, créditos y realiza la preaprobación de solicitudes'),
  ('CLIENTE',    'Usuario final: gestiona su crédito, documentos, pagos y solicitudes de PQR')
ON CONFLICT (nombre_rol) DO UPDATE
  SET descripcion = EXCLUDED.descripcion,
      activo = true;

COMMENT ON TABLE rol IS 'Roles del sistema (4): ADMIN, SUPERVISOR, ASESOR, CLIENTE';


-- ── 6. Verificación ──────────────────────────────────────────
-- Debe devolver EXACTAMENTE 4 filas.
SELECT nombre_rol, descripcion, activo FROM rol ORDER BY nombre_rol;

-- No debe quedar ningún perfil sin rol válido.
SELECT COUNT(*) AS perfiles_sin_rol_valido
FROM perfil_usuario pu
LEFT JOIN rol r ON r.id_rol = pu.id_rol
WHERE r.id_rol IS NULL;

COMMIT;
