/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/analitica/detalle/route.js
 * DESCRIPCIÓN: Drill-down de la analítica. Devuelve los registros que componen
 *              un segmento de una gráfica (al hacer clic en una barra/sector).
 * FUNCIONALIDAD: GET ?dim=&valor=&desde=&hasta=
 *   dim: 'estado' | 'asesor' | 'mora' | 'ciudad' | 'departamento'
 *        | 'pqr_estado' | 'pqr_tipo'
 *   Devuelve { entidad, total, items[], asesores[] } para mostrar en el panel
 *   flotante con navegación y reasignación de asesor.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { formatNombre } from '@/lib/nombre'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const COP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v ?? 0)
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const inRange = (fecha, desde, hasta) => {
  if (!fecha) return false
  const f = new Date(fecha)
  if (desde && f < new Date(desde)) return false
  if (hasta && f > new Date(`${hasta}T23:59:59`)) return false
  return true
}
const tramo = (d) => d <= 30 ? 'Temprana (1-30)' : d <= 60 ? 'Media (31-60)' : d <= 90 ? 'Tardía (61-90)' : 'Crítica (90+)'

export async function GET(request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  const rol = perfil?.rol?.nombre_rol?.toUpperCase()
  if (!['ADMIN', 'SUPERVISOR'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dim = searchParams.get('dim')
  const valor = searchParams.get('valor')
  const desde = searchParams.get('desde') || null
  const hasta = searchParams.get('hasta') || null
  const conFecha = desde || hasta

  const db = getServiceClient()

  // Lista de asesores (para reasignación desde el panel)
  const { data: asesoresRaw } = await db
    .from('perfil_usuario').select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, rol ( nombre_rol )')
  const asesores = (asesoresRaw ?? [])
    .filter(a => a.rol?.nombre_rol?.toUpperCase() === 'ASESOR')
    .map(a => ({ id: a.id, nombre: formatNombre(a) }))

  let entidad = 'solicitud'
  let items = []

  if (dim === 'estado') {
    const { data } = await db
      .from('solicitud_credito')
      .select('id_solicitud, monto_solicitado, fecha_solicitud, id_cliente, estado_solicitud ( nombre ), cliente(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)')
      .order('fecha_solicitud', { ascending: false })
    items = (data ?? [])
      .filter(s => s.estado_solicitud?.nombre?.toUpperCase() === valor?.toUpperCase())
      .filter(s => !conFecha || inRange(s.fecha_solicitud, desde, hasta))
      .map(s => ({
        id: s.id_solicitud, id_cliente: s.id_cliente, entidad: 'solicitud',
        titulo: formatNombre(s.cliente) || 'Cliente',
        subtitulo: `${COP(s.monto_solicitado)} · ${fmtFecha(s.fecha_solicitud)}`,
        badge: valor,
      }))
  } else if (dim === 'asesor' || dim === 'mora' || dim === 'ciudad' || dim === 'departamento') {
    entidad = 'credito'
    const [{ data: creditos }, { data: clientes }, { data: direcciones }, { data: asignaciones }] = await Promise.all([
      db.from('credito').select('id_credito, id_cliente, estado_credito, saldo_pendiente, monto_desembolsado, dias_mora_maximo, fecha_desembolso'),
      db.from('cliente').select('id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido'),
      db.from('direccion').select('id_cliente, tipo, municipio ( nombre, departamento ( nombre ) )'),
      db.from('asignacion_asesor').select('id_asesor, id_cliente, activa').eq('activa', true),
    ])
    const cli = {}; (clientes ?? []).forEach(c => { cli[c.id_cliente] = c })
    // Ubicación desde el modelo normalizado (direccion→municipio→departamento).
    const ubic = {}
    ;(direcciones ?? []).forEach(d => {
      if (ubic[d.id_cliente] && d.tipo !== 'NEGOCIO') return
      ubic[d.id_cliente] = { ciudad: d.municipio?.nombre, departamento: d.municipio?.departamento?.nombre }
    })
    const asesorDe = {}; (asignaciones ?? []).forEach(a => { asesorDe[a.id_cliente] = a.id_asesor })
    const nombreAsesor = {}; asesores.forEach(a => { nombreAsesor[a.id] = a.nombre })

    items = (creditos ?? [])
      .filter(c => !conFecha || inRange(c.fecha_desembolso, desde, hasta))
      .filter(c => {
        const cl = cli[c.id_cliente] || {}
        if (dim === 'asesor') {
          const idA = asesorDe[c.id_cliente]
          const nombre = idA ? (nombreAsesor[idA] || 'Asesor') : 'Sin asignar'
          return nombre === valor
        }
        if (dim === 'mora') return c.estado_credito === 'EN_MORA' && tramo(c.dias_mora_maximo || 0) === valor
        if (dim === 'ciudad') return (ubic[c.id_cliente]?.ciudad || 'Sin ciudad') === valor
        if (dim === 'departamento') return (ubic[c.id_cliente]?.departamento || 'Sin departamento') === valor
        return false
      })
      .map(c => {
        const cl = cli[c.id_cliente] || {}
        return {
          id: c.id_credito, id_cliente: c.id_cliente, entidad: 'credito',
          titulo: formatNombre(cl) || 'Cliente',
          subtitulo: `${COP(c.monto_desembolsado)} · ${c.estado_credito}${c.estado_credito === 'EN_MORA' ? ` · ${c.dias_mora_maximo}d mora` : ''}`,
          badge: ubic[c.id_cliente]?.ciudad || c.estado_credito,
        }
      })
  } else if (dim === 'pqr_estado' || dim === 'pqr_tipo') {
    entidad = 'pqr'
    const campo = dim === 'pqr_estado' ? 'estado' : 'tipo'
    const { data } = await db
      .from('pqr')
      .select('id_pqr, tipo, asunto, estado, created_at, id_cliente, cliente(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)')
      .order('created_at', { ascending: false })
    items = (data ?? [])
      .filter(p => (p[campo] || '').toUpperCase() === valor?.toUpperCase())
      .filter(p => !conFecha || inRange(p.created_at, desde, hasta))
      .map(p => ({
        id: p.id_pqr, id_cliente: p.id_cliente, entidad: 'pqr',
        titulo: p.asunto || 'PQR',
        subtitulo: `${formatNombre(p.cliente) || '—'} · ${fmtFecha(p.created_at)}`,
        badge: p.estado,
      }))
  } else {
    return NextResponse.json({ error: 'Dimensión no soportada' }, { status: 400 })
  }

  return NextResponse.json({
    dim, valor, entidad,
    total: items.length,
    items: items.slice(0, 60),
    asesores,
  })
}
