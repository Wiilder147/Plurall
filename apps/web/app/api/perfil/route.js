import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/perfil
 * Actualiza los datos editables del cliente autenticado.
 * Campos permitidos: telefono, direccion, ciudad, departamento,
 *                    nombre_negocio, descripcion_negocio, antiguedad_negocio_meses
 * Campos NO editables por el cliente: dni, email, score_credito, estado
 */
export async function PATCH(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()

  // ── Whitelist de campos editables ────────────────────────────
  const CAMPOS_PERMITIDOS = [
    'telefono',
    'direccion',
    'ciudad',
    'departamento',
    'nombre_negocio',
    'descripcion_negocio',
    'antiguedad_negocio_meses',
  ]

  const actualizacion = {}
  for (const campo of CAMPOS_PERMITIDOS) {
    if (body[campo] !== undefined) {
      actualizacion[campo] = body[campo] === '' ? null : body[campo]
    }
  }

  if (Object.keys(actualizacion).length === 0) {
    return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
  }

  // ── Validar teléfono si viene en el body ─────────────────────
  if (actualizacion.telefono) {
    const telLimpio = String(actualizacion.telefono).replace(/\D/g, '')
    if (telLimpio.length !== 10) {
      return NextResponse.json({ error: 'El teléfono debe tener exactamente 10 dígitos' }, { status: 422 })
    }
    actualizacion.telefono = telLimpio
  }

  // ── Obtener id_cliente del usuario ───────────────────────────
  const { data: clienteRow, error: cliErr } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (cliErr || !clienteRow) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // ── Actualizar ───────────────────────────────────────────────
  const { data: clienteActualizado, error: updateErr } = await supabase
    .from('cliente')
    .update({ ...actualizacion, updated_at: new Date().toISOString() })
    .eq('id_cliente', clienteRow.id_cliente)
    .select('telefono, direccion, ciudad, departamento, nombre_negocio, descripcion_negocio, antiguedad_negocio_meses')
    .single()

  if (updateErr) {
    console.error('[Perfil] Error al actualizar:', updateErr)
    return NextResponse.json({ error: 'Error al guardar los cambios' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data: clienteActualizado })
}
