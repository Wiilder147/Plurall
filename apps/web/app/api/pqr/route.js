/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/pqr/route.js
 * DESCRIPCIÓN: API de PQR — creación por parte del cliente.
 * FUNCIONALIDAD: POST crea una PQR asociada al cliente autenticado. El RLS
 *                garantiza que solo pueda crear PQR a su propio nombre.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TIPOS = ['PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA']

export async function POST(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipo = 'PETICION', asunto, descripcion } = await request.json()
  if (!asunto?.trim() || !descripcion?.trim()) {
    return NextResponse.json({ error: 'Asunto y descripción son obligatorios' }, { status: 400 })
  }
  const tipoFinal = TIPOS.includes(String(tipo).toUpperCase()) ? String(tipo).toUpperCase() : 'PETICION'

  // Obtener el cliente del usuario autenticado
  const { data: cliente } = await supabase
    .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()
  if (!cliente?.id_cliente) {
    return NextResponse.json({ error: 'Solo los clientes pueden crear PQR' }, { status: 403 })
  }

  const { data: creada, error } = await supabase.from('pqr').insert({
    id_cliente: cliente.id_cliente,
    tipo: tipoFinal,
    asunto: asunto.trim(),
    descripcion: descripcion.trim(),
    estado: 'ABIERTO',
  }).select('numero_radicado').single()
  if (error) {
    console.error('[PQR POST]', error)
    return NextResponse.json({ error: 'No se pudo crear la PQR' }, { status: 500 })
  }
  // C-04: número de radicado asignado por la BD (trigger trg_pqr_radicado)
  return NextResponse.json({ ok: true, numero_radicado: creada?.numero_radicado ?? null })
}
