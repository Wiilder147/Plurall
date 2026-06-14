/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/analitica/route.js
 * DESCRIPCIÓN: API de analítica para los paneles de ADMIN y SUPERVISOR.
 * FUNCIONALIDAD: Devuelve indicadores agregados (solicitudes por estado,
 *                aprobadas vs rechazadas, créditos por asesor, mora por tramos,
 *                créditos por ciudad/departamento, PQR por estado/tipo).
 *                Acepta filtros ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const inRange = (fecha, desde, hasta) => {
  if (!fecha) return false
  const f = new Date(fecha)
  if (desde && f < new Date(desde)) return false
  if (hasta && f > new Date(`${hasta}T23:59:59`)) return false
  return true
}

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
  const desde = searchParams.get('desde') || null
  const hasta = searchParams.get('hasta') || null

  const db = getServiceClient()

  const [
    { data: creditos },
    { data: solicitudes },
    { data: clientes },
    { data: asignaciones },
    { data: asesores },
    { data: pqrs },
  ] = await Promise.all([
    db.from('credito').select('id_cliente, estado_credito, saldo_pendiente, monto_desembolsado, dias_mora_maximo, fecha_desembolso'),
    db.from('solicitud_credito').select('id_solicitud, fecha_solicitud, monto_solicitado, estado_solicitud ( nombre )'),
    db.from('cliente').select('id_cliente, ciudad, departamento'),
    db.from('asignacion_asesor').select('id_asesor, id_cliente, activa').eq('activa', true),
    db.from('perfil_usuario').select('id, nombre_completo, rol ( nombre_rol )'),
    db.from('pqr').select('estado, tipo, created_at'),
  ])

  // Filtrado por fecha
  const solsF = (solicitudes ?? []).filter(s => (!desde && !hasta) || inRange(s.fecha_solicitud, desde, hasta))
  const credsF = (creditos ?? []).filter(c => (!desde && !hasta) || inRange(c.fecha_desembolso, desde, hasta))
  const pqrsF = (pqrs ?? []).filter(p => (!desde && !hasta) || inRange(p.created_at, desde, hasta))

  // ── Solicitudes por estado ──
  const estados = ['PENDIENTE', 'EN_ESTUDIO', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'DESEMBOLSADA']
  const solicitudesPorEstado = estados.map(e => ({
    estado: e,
    count: solsF.filter(s => s.estado_solicitud?.nombre?.toUpperCase() === e).length,
  }))

  const aprobadas = solsF.filter(s => ['APROBADA', 'DESEMBOLSADA'].includes(s.estado_solicitud?.nombre?.toUpperCase())).length
  const rechazadas = solsF.filter(s => s.estado_solicitud?.nombre?.toUpperCase() === 'RECHAZADA').length

  // ── Créditos por asesor ──
  const asesorPorCliente = {}
  ;(asignaciones ?? []).forEach(a => { asesorPorCliente[a.id_cliente] = a.id_asesor })
  const nombreAsesor = {}
  ;(asesores ?? []).forEach(a => { nombreAsesor[a.id] = a.nombre_completo })
  const asesorMap = {}
  credsF.forEach(c => {
    const idA = asesorPorCliente[c.id_cliente]
    const nombre = idA ? (nombreAsesor[idA] || 'Asesor') : 'Sin asignar'
    if (!asesorMap[nombre]) asesorMap[nombre] = { asesor: nombre, creditos: 0, monto: 0 }
    asesorMap[nombre].creditos += 1
    asesorMap[nombre].monto += Number(c.monto_desembolsado || 0)
  })
  const creditosPorAsesor = Object.values(asesorMap).sort((a, b) => b.creditos - a.creditos)

  // ── Mora por tramos ──
  const enMora = credsF.filter(c => c.estado_credito === 'EN_MORA')
  const tramo = (d) => d <= 30 ? 'Temprana (1-30)' : d <= 60 ? 'Media (31-60)' : d <= 90 ? 'Tardía (61-90)' : 'Crítica (90+)'
  const tramosOrden = ['Temprana (1-30)', 'Media (31-60)', 'Tardía (61-90)', 'Crítica (90+)']
  const moraMap = Object.fromEntries(tramosOrden.map(t => [t, { tramo: t, count: 0, monto: 0 }]))
  enMora.forEach(c => {
    const t = tramo(c.dias_mora_maximo || 0)
    moraMap[t].count += 1
    moraMap[t].monto += Number(c.saldo_pendiente || 0)
  })
  const moraPorTramos = tramosOrden.map(t => moraMap[t])

  // ── Créditos por ciudad / departamento ──
  const ciudadDe = {}, deptoDe = {}
  ;(clientes ?? []).forEach(c => { ciudadDe[c.id_cliente] = c.ciudad || 'Sin ciudad'; deptoDe[c.id_cliente] = c.departamento || 'Sin departamento' })
  const acumular = (map, key) => { map[key] = (map[key] || 0) + 1 }
  const ciudadMap = {}, deptoMap = {}
  credsF.forEach(c => { acumular(ciudadMap, ciudadDe[c.id_cliente] || 'Sin ciudad'); acumular(deptoMap, deptoDe[c.id_cliente] || 'Sin departamento') })
  const creditosPorCiudad = Object.entries(ciudadMap).map(([ciudad, count]) => ({ ciudad, count })).sort((a, b) => b.count - a.count).slice(0, 10)
  const creditosPorDepartamento = Object.entries(deptoMap).map(([departamento, count]) => ({ departamento, count })).sort((a, b) => b.count - a.count).slice(0, 10)

  // ── PQR por estado / tipo ──
  const pqrEstados = ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO']
  const pqrTipos = ['PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA']
  const pqrPorEstado = pqrEstados.map(e => ({ estado: e, count: pqrsF.filter(p => p.estado?.toUpperCase() === e).length }))
  const pqrPorTipo = pqrTipos.map(t => ({ tipo: t, count: pqrsF.filter(p => p.tipo?.toUpperCase() === t).length }))

  // ── Serie mensual aprobadas vs rechazadas ──
  const meses = {}
  solsF.forEach(s => {
    if (!s.fecha_solicitud) return
    const d = new Date(s.fecha_solicitud)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!meses[key]) meses[key] = { mes: key, aprobadas: 0, rechazadas: 0 }
    const est = s.estado_solicitud?.nombre?.toUpperCase()
    if (['APROBADA', 'DESEMBOLSADA'].includes(est)) meses[key].aprobadas++
    if (est === 'RECHAZADA') meses[key].rechazadas++
  })
  const serieMensual = Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes))

  // ── KPIs resumen ──
  const carteraActiva = credsF.filter(c => ['ACTIVO', 'EN_MORA'].includes(c.estado_credito)).reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0)
  const resumen = {
    totalSolicitudes: solsF.length,
    aprobadas,
    rechazadas,
    tasaAprobacion: solsF.length ? Math.round((aprobadas / solsF.length) * 100) : 0,
    creditosActivos: credsF.filter(c => c.estado_credito === 'ACTIVO').length,
    creditosEnMora: enMora.length,
    carteraActiva,
    pqrAbiertas: pqrsF.filter(p => ['ABIERTO', 'EN_PROCESO'].includes(p.estado?.toUpperCase())).length,
  }

  return NextResponse.json({
    filtros: { desde, hasta },
    resumen,
    solicitudesPorEstado,
    comparativa: { aprobadas, rechazadas },
    creditosPorAsesor,
    moraPorTramos,
    creditosPorCiudad,
    creditosPorDepartamento,
    pqrPorEstado,
    pqrPorTipo,
    serieMensual,
  })
}
