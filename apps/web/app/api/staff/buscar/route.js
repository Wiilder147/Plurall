/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/staff/buscar/route.js
 * DESCRIPCIÓN: Búsqueda de clientes para el staff (asesor/supervisor/admin).
 * FUNCIONALIDAD: Busca por nombre, cédula, celular, email o ID de crédito.
 *   - ADMIN / SUPERVISOR: buscan en todos los clientes.
 *   - ASESOR: solo entre sus clientes asignados (asignacion_asesor activa).
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { orBusquedaNombre } from '@/lib/nombre'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR', 'ASESOR'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ resultados: [] })

  const service = createServiceClient()

  // El asesor solo puede ver sus clientes asignados.
  let idsPermitidos = null
  if (rol === 'ASESOR') {
    const { data: asigns } = await service
      .from('asignacion_asesor').select('id_cliente').eq('id_asesor', user.id).eq('activa', true)
    idsPermitidos = new Set((asigns ?? []).map(a => a.id_cliente))
    if (idsPermitidos.size === 0) return NextResponse.json({ resultados: [] })
  }

  // Búsqueda por datos del cliente
  let query = service
    .from('cliente')
    .select(`
      id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono, email,
      credito ( id_credito, estado_credito, saldo_pendiente, dias_mora_maximo )
    `)
    .or(orBusquedaNombre(q))
    .limit(15)
  if (idsPermitidos) query = query.in('id_cliente', Array.from(idsPermitidos))
  const { data: porDatos } = await query

  // Búsqueda por ID de crédito (query largo)
  let porCredito = []
  if (q.length >= 8) {
    const { data: creditos } = await service
      .from('credito')
      .select(`
        id_credito, estado_credito, saldo_pendiente, dias_mora_maximo,
        cliente ( id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono, email )
      `)
      .ilike('id_credito', `${q}%`)
      .limit(5)
    porCredito = (creditos ?? [])
      .filter(c => c.cliente && (!idsPermitidos || idsPermitidos.has(c.cliente.id_cliente)))
      .map(c => ({ ...c.cliente, creditos: [{ id_credito: c.id_credito, estado_credito: c.estado_credito, saldo_pendiente: c.saldo_pendiente, dias_mora_maximo: c.dias_mora_maximo }] }))
  }

  const mapa = new Map()
  ;[...(porDatos ?? []), ...porCredito].forEach(c => {
    if (!mapa.has(c.id_cliente)) mapa.set(c.id_cliente, { ...c, creditos: c.credito ?? c.creditos ?? [] })
  })
  const resultados = Array.from(mapa.values()).slice(0, 15)

  return NextResponse.json({ resultados })
}
