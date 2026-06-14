/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/documentos/ver/[id]/route.js
 * DESCRIPCIÓN: Acceso seguro a un documento/imagen KYC del bucket privado.
 * FUNCIONALIDAD: GET /api/documentos/ver/:idDocumento
 *   Autoriza al staff (ADMIN/SUPERVISOR/ASESOR) o al cliente dueño, genera una
 *   URL firmada temporal (60s) del bucket privado 'documentos_kyc' y redirige.
 *   Así las cédulas no son accesibles públicamente.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const STAFF = ['ADMIN', 'SUPERVISOR', 'ASESOR']

export async function GET(request, { params }) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return new Response('No autorizado', { status: 401 })

  const { id } = await params
  const service = createServiceClient()

  // Documento + dueño
  const { data: doc } = await service
    .from('documento_cliente')
    .select('id_documento, url_archivo, id_cliente')
    .eq('id_documento', id)
    .single()
  if (!doc || !doc.url_archivo) return new Response('Documento no encontrado', { status: 404 })

  // Rol del solicitante
  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()

  // Autorización: staff o cliente dueño del documento
  if (!STAFF.includes(rol)) {
    const { data: cli } = await supabase
      .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()
    if (!cli || cli.id_cliente !== doc.id_cliente) {
      return new Response('Acceso denegado', { status: 403 })
    }
  }

  // La ruta puede venir como path puro o como URL pública antigua; normalizar a path.
  let path = doc.url_archivo
  const marca = '/documentos_kyc/'
  if (path.includes(marca)) path = path.split(marca)[1]
  path = path.replace(/^\/+/, '')

  const { data: firma, error: firmaErr } = await service
    .storage.from('documentos_kyc')
    .createSignedUrl(path, 60)

  if (firmaErr || !firma?.signedUrl) {
    return new Response('No se pudo generar el acceso al documento', { status: 500 })
  }

  return NextResponse.redirect(firma.signedUrl)
}
