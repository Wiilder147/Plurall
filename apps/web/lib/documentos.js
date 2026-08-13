/* ==========================================================================
 * ARCHIVO: documentos.js
 * RUTA: apps/web/lib/documentos.js
 * DESCRIPCIÓN: Utilidades compartidas para documentos y archivos KYC.
 * FUNCIONALIDAD:
 *   - urlPublicaDocumento(path): convierte la ruta guardada en documento_cliente
 *     (bucket público 'documentos_kyc') en una URL completa abrible.
 *   - resolverAccesoCredito(supabase, creditoId): autoriza la generación de un
 *     documento de un crédito. El CLIENTE solo puede el suyo; ADMIN/SUPERVISOR/
 *     ASESOR pueden el de cualquier cliente. Devuelve los datos del titular para
 *     que el PDF muestre el nombre/cédula correctos del cliente (no del staff).
 * ========================================================================== */

const STAFF = ['ADMIN', 'SUPERVISOR', 'ASESOR']

export function urlPublicaDocumento(pathOrUrl) {
  if (!pathOrUrl) return null
  // Si ya es una URL completa, devolverla tal cual.
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  const path = pathOrUrl.replace(/^\/+/, '')
  return `${base}/storage/v1/object/public/documentos_kyc/${path}`
}

/**
 * Autoriza el acceso a los documentos de un crédito y devuelve el titular.
 * @returns { error?, status?, idCliente?, titular? }
 *   titular: { id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, email }
 */
export async function resolverAccesoCredito(supabase, creditoId) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'No autorizado', status: 401 }

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  const esStaff = STAFF.includes(rol)

  const { data: credito } = await supabase
    .from('credito').select('id_credito, id_cliente').eq('id_credito', creditoId).single()
  if (!credito) return { error: 'Crédito no encontrado', status: 404 }

  // Si NO es staff, debe ser el cliente dueño del crédito.
  if (!esStaff) {
    const { data: cli } = await supabase
      .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()
    if (!cli || cli.id_cliente !== credito.id_cliente) {
      return { error: 'No autorizado', status: 403 }
    }
  }

  const { data: titular } = await supabase
    .from('cliente')
    .select('id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, email')
    .eq('id_cliente', credito.id_cliente)
    .single()

  return { idCliente: credito.id_cliente, titular: titular || {} }
}
