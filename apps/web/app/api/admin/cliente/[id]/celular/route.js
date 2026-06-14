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

  const nuevoEmail = `${cel}@plurall.app`

  // Actualizar identidad de acceso en Auth (si tiene cuenta vinculada)
  if (cliente.id_usuario_cuenta) {
    const { error: authUpdErr } = await service.auth.admin.updateUserById(cliente.id_usuario_cuenta, {
      email: nuevoEmail,
      email_confirm: true,
    })
    if (authUpdErr) {
      const msg = authUpdErr.message?.toLowerCase() || ''
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return NextResponse.json({ error: 'Ese celular ya está registrado en otra cuenta' }, { status: 409 })
      }
      console.error('[Cambiar celular auth]', authUpdErr)
      return NextResponse.json({ error: 'No se pudo actualizar el acceso del cliente' }, { status: 500 })
    }
  }

  // Actualizar teléfono y email de contacto del cliente
  const { error: updErr } = await service
    .from('cliente')
    .update({ telefono: cel, email: nuevoEmail, updated_at: new Date().toISOString() })
    .eq('id_cliente', id)
  if (updErr) {
    console.error('[Cambiar celular cliente]', updErr)
    return NextResponse.json({ error: 'No se pudo actualizar el teléfono' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, celular: cel })
}
