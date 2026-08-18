/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/asignar-asesor/route.js
 * DESCRIPCIÓN: Asignación de clientes a asesores (ADMIN / SUPERVISOR).
 * FUNCIONALIDAD:
 *   POST   → asigna o reasigna (cambia) el asesor de un cliente.
 *   DELETE → quita el asesor asignado a un cliente.
 *   En ambos casos se notifica al asesor afectado (notificacion_staff).
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { crearNotificacionStaff } from '@/lib/notificacionesInApp'
import { formatNombre } from '@/lib/nombre'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireStaff(supabase) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'No autorizado', status: 401 }
  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR'].includes(rol)) return { error: 'Acceso denegado', status: 403 }
  return { user }
}

async function nombreCliente(service, clienteId) {
  const { data } = await service
    .from('cliente')
    .select('primer_nombre, segundo_nombre, primer_apellido, segundo_apellido')
    .eq('id_cliente', clienteId).single()
  return formatNombre(data) || 'un cliente'
}

// POST — asignar / reasignar. Body: { clienteId, asesorId }
export async function POST(request) {
  const supabase = await createClient()
  const guard = await requireStaff(supabase)
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { clienteId, asesorId } = await request.json()
  if (!clienteId || !asesorId) {
    return NextResponse.json({ error: 'clienteId y asesorId son requeridos' }, { status: 400 })
  }

  const service = getServiceClient()

  const { data: asesorPerfil } = await service
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', asesorId).single()
  if (asesorPerfil?.rol?.nombre_rol?.toUpperCase() !== 'ASESOR') {
    return NextResponse.json({ error: 'El usuario no tiene rol de ASESOR' }, { status: 400 })
  }

  // Quién tenía el cliente antes (para avisar si cambia de asesor).
  const { data: previa } = await service
    .from('asignacion_asesor').select('id_asesor').eq('id_cliente', clienteId).eq('activa', true).maybeSingle()

  // Asignación atómica (migración 22): cierra la activa previa y crea la nueva.
  const { error: rpcErr } = await service.rpc('asignar_asesor_a_cliente', {
    p_id_cliente: clienteId,
    p_id_asesor:  asesorId,
  })
  if (rpcErr) {
    console.error('[Asignar asesor]', rpcErr)
    return NextResponse.json({ error: 'Error al asignar asesor' }, { status: 500 })
  }

  // Notificar al nuevo asesor (y al anterior si cambió).
  const nombre = await nombreCliente(service, clienteId)
  if (previa?.id_asesor && previa.id_asesor !== asesorId) {
    await crearNotificacionStaff({
      idUsuario: previa.id_asesor,
      codigoTipo: 'ASIGNACION_CLIENTE',
      titulo: 'Cliente reasignado',
      mensaje: `El cliente ${nombre} fue reasignado a otro asesor.`,
      metadata: { clienteId },
    }).catch(() => null)
  }
  if (previa?.id_asesor !== asesorId) {
    await crearNotificacionStaff({
      idUsuario: asesorId,
      codigoTipo: 'ASIGNACION_CLIENTE',
      titulo: 'Nuevo cliente asignado',
      mensaje: `Se te asignó el cliente ${nombre}.`,
      metadata: { clienteId },
    }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}

// DELETE — quitar el asesor. Body: { clienteId }
export async function DELETE(request) {
  const supabase = await createClient()
  const guard = await requireStaff(supabase)
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { clienteId } = await request.json()
  if (!clienteId) return NextResponse.json({ error: 'clienteId es requerido' }, { status: 400 })

  const service = getServiceClient()

  const { data: activa } = await service
    .from('asignacion_asesor').select('id_asignacion, id_asesor').eq('id_cliente', clienteId).eq('activa', true).maybeSingle()
  if (!activa) return NextResponse.json({ ok: true, msg: 'El cliente no tenía asesor asignado' })

  const { error: updErr } = await service
    .from('asignacion_asesor')
    .update({ activa: false, fecha_fin: new Date().toISOString() })
    .eq('id_asignacion', activa.id_asignacion)
  if (updErr) {
    console.error('[Quitar asesor]', updErr)
    return NextResponse.json({ error: 'No se pudo quitar el asesor' }, { status: 500 })
  }

  const nombre = await nombreCliente(service, clienteId)
  await crearNotificacionStaff({
    idUsuario: activa.id_asesor,
    codigoTipo: 'ASIGNACION_CLIENTE',
    titulo: 'Cliente retirado',
    mensaje: `Ya no tienes asignado al cliente ${nombre}.`,
    metadata: { clienteId },
  }).catch(() => null)

  return NextResponse.json({ ok: true })
}
