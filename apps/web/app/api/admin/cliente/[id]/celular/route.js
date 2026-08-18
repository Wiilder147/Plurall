/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/admin/cliente/[id]/celular/route.js
 * DESCRIPCIÓN: Cambio del celular de un cliente por parte del staff.
 * FUNCIONALIDAD: PATCH /api/admin/cliente/:idCliente/celular  { celular }
 *   El celular es la identidad de acceso (email virtual celular@plurall.app),
 *   así que se actualiza el email en Supabase Auth y el teléfono del cliente.
 *   Solo ADMIN y SUPERVISOR.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { aplicarCambioCelular } from '@/lib/celular'

const STAFF = ['ADMIN', 'SUPERVISOR']

export async function PATCH(request, { params }) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!STAFF.includes(rol)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const { id } = await params
  const { celular } = await request.json()
  const cel = String(celular || '').replace(/\D/g, '')
  if (cel.length !== 10) {
    return NextResponse.json({ error: 'El celular debe tener exactamente 10 dígitos' }, { status: 422 })
  }

  const service = createServiceClient()

  // Cliente + su cuenta de acceso
  const { data: cliente } = await service
    .from('cliente').select('id_cliente, id_usuario_cuenta, telefono').eq('id_cliente', id).single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // El helper registra el número anterior, cambia el acceso y detecta reúso.
  const res = await aplicarCambioCelular(service, {
    cliente,
    nuevoCelular: cel,
    liberadoPor:  user.id,
    motivo:       'Cambio por staff',
  })
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.status })

  // Se informa el reúso al frontend (además de la notificación al staff).
  return NextResponse.json({ ok: true, celular: res.celular, reuso: res.reuso ?? null })
}
