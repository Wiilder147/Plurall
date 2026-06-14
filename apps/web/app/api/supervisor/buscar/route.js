/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/supervisor/buscar/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de buscar
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * GET /api/supervisor/buscar?q=texto
 * Busca clientes por nombre, cédula, celular, email o ID de crédito.
 * Solo accesible para SUPERVISOR y ADMIN.
 */
export async function GET(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ resultados: [] })
  }

  const service = getServiceClient()

  // Buscar por nombre, cédula, teléfono o email
  const { data: porDatos } = await service
    .from('cliente')
    .select(`
      id_cliente, nombre_completo, dni, telefono, email, score_credito,
      credito ( id_credito, estado_credito, saldo_pendiente, dias_mora_maximo )
    `)
    .or(`nombre_completo.ilike.%${q}%,dni.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10)

  // Buscar también por ID de crédito (si el query parece un UUID)
  let porCredito = []
  if (q.length >= 8) {
    const { data: creditos } = await service
      .from('credito')
      .select(`
        id_credito, estado_credito, saldo_pendiente, dias_mora_maximo,
        cliente ( id_cliente, nombre_completo, dni, telefono, email, score_credito )
      `)
      .ilike('id_credito', `${q}%`)
      .limit(5)

    porCredito = (creditos ?? [])
      .filter(c => c.cliente)
      .map(c => ({
        ...c.cliente,
        creditos: [{ id_credito: c.id_credito, estado_credito: c.estado_credito, saldo_pendiente: c.saldo_pendiente, dias_mora_maximo: c.dias_mora_maximo }],
      }))
  }

  // Combinar y deduplicar por id_cliente
  const mapa = new Map()
  ;[...(porDatos ?? []), ...porCredito].forEach(c => {
    if (!mapa.has(c.id_cliente)) {
      mapa.set(c.id_cliente, { ...c, creditos: c.credito ?? c.creditos ?? [] })
    }
  })

  const resultados = Array.from(mapa.values()).slice(0, 15)

  return NextResponse.json({ resultados })
}
