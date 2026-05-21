import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * GET /api/supervisor/dashboard-data
 * Parámetros:
 *   ?meses=12          → últimos N meses (default)
 *   ?desde=2024-01-01  → fecha inicio (rango personalizado)
 *   ?hasta=2024-03-31  → fecha fin    (rango personalizado)
 *   ?agrupacion=dia|semana|mes  → granularidad (default: mes)
 */
export async function GET(request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const meses      = parseInt(searchParams.get('meses') ?? '12')
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')
  const agrupacion = searchParams.get('agrupacion') ?? 'mes' // dia | semana | mes

  // ── Calcular rango de fechas ──────────────────────────────────────────────
  let fechaInicio, fechaFin

  if (desdeParam && hastaParam) {
    // Rango personalizado
    fechaInicio = new Date(desdeParam + 'T00:00:00')
    fechaFin    = new Date(hastaParam + 'T23:59:59')
  } else {
    // Últimos N meses
    fechaFin    = new Date()
    fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - meses)
    fechaInicio.setDate(1)
    fechaInicio.setHours(0, 0, 0, 0)
  }

  const db = createServiceClient()

  // ── Consultas en paralelo ─────────────────────────────────────────────────
  const [
    { data: creditos    },
    { data: pagos       },
    { data: solicitudes },
  ] = await Promise.all([
    db.from('credito')
      .select('id_credito, monto_desembolsado, saldo_pendiente, estado_credito, fecha_desembolso, cuotas_en_mora, dias_mora_maximo')
      .gte('fecha_desembolso', fechaInicio.toISOString())
      .lte('fecha_desembolso', fechaFin.toISOString()),
    db.from('pago')
      .select('monto_pagado, monto_capital, fecha_pago, estado')
      .eq('estado', 'CONFIRMADO')
      .gte('fecha_pago', fechaInicio.toISOString())
      .lte('fecha_pago', fechaFin.toISOString()),
    db.from('solicitud_credito')
      .select('id_solicitud, monto_solicitado, fecha_solicitud, id_estado_solicitud, estado_solicitud(nombre)')
      .gte('fecha_solicitud', fechaInicio.toISOString())
      .lte('fecha_solicitud', fechaFin.toISOString()),
  ])

  // ── Función para obtener la clave de agrupación ───────────────────────────
  function getKey(isoString) {
    if (!isoString) return null
    const d = new Date(isoString)
    if (agrupacion === 'dia') {
      return isoString.slice(0, 10) // YYYY-MM-DD
    } else if (agrupacion === 'semana') {
      // Semana ISO: año-W##
      const startOfYear = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      return `${d.getFullYear()}-S${String(week).padStart(2, '0')}`
    } else {
      return isoString.slice(0, 7) // YYYY-MM
    }
  }

  function getLabel(key) {
    if (agrupacion === 'dia') {
      const d = new Date(key + 'T00:00:00')
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    } else if (agrupacion === 'semana') {
      return key.replace('-S', ' S')
    } else {
      const [y, m] = key.split('-')
      const d = new Date(parseInt(y), parseInt(m) - 1, 1)
      return d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    }
  }

  // ── Generar todas las claves del período ──────────────────────────────────
  const mesesMap = {}
  const cursor = new Date(fechaInicio)

  while (cursor <= fechaFin) {
    const key = getKey(cursor.toISOString())
    if (key && !mesesMap[key]) {
      mesesMap[key] = {
        mes: key, label: getLabel(key),
        desembolsado: 0, recaudado: 0,
        solicitudes: 0, aprobadas: 0, rechazadas: 0,
        creditosNuevos: 0, enMora: 0, carteraAcumulada: 0,
      }
    }
    // Avanzar según agrupación
    if (agrupacion === 'dia') {
      cursor.setDate(cursor.getDate() + 1)
    } else if (agrupacion === 'semana') {
      cursor.setDate(cursor.getDate() + 7)
    } else {
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  // ── Agregar datos ─────────────────────────────────────────────────────────
  creditos?.forEach(c => {
    const key = getKey(c.fecha_desembolso)
    if (mesesMap[key]) {
      mesesMap[key].desembolsado   += c.monto_desembolsado || 0
      mesesMap[key].creditosNuevos += 1
      if (c.estado_credito === 'EN_MORA') mesesMap[key].enMora += 1
    }
  })

  pagos?.forEach(p => {
    const key = getKey(p.fecha_pago)
    if (mesesMap[key]) mesesMap[key].recaudado += p.monto_pagado || 0
  })

  solicitudes?.forEach(s => {
    const key = getKey(s.fecha_solicitud)
    if (mesesMap[key]) {
      mesesMap[key].solicitudes += 1
      const estado = s.estado_solicitud?.nombre?.toUpperCase()
      if (['APROBADA','DESEMBOLSADA'].includes(estado)) mesesMap[key].aprobadas++
      if (estado === 'RECHAZADA') mesesMap[key].rechazadas++
    }
  })

  // ── Cartera acumulada (running total) ─────────────────────────────────────
  const { data: carteraTotal } = await db
    .from('credito').select('saldo_pendiente').in('estado_credito', ['ACTIVO','EN_MORA'])
  const totalCarteraActual = carteraTotal?.reduce((s, c) => s + (c.saldo_pendiente || 0), 0) ?? 0

  const serie = Object.values(mesesMap)
  let carteraAcum = Math.max(0, totalCarteraActual - serie.reduce((s, m) => s + m.desembolsado, 0) * 0.7)
  serie.forEach((m, idx) => {
    carteraAcum = Math.max(0, carteraAcum + m.desembolsado - m.recaudado * 0.8)
    serie[idx].carteraAcumulada = Math.round(carteraAcum)
  })

  // ── KPIs del período seleccionado ─────────────────────────────────────────
  const totalDesembolsadoPeriodo = serie.reduce((s, m) => s + m.desembolsado, 0)
  const totalRecaudadoPeriodo    = serie.reduce((s, m) => s + m.recaudado, 0)
  const totalSolicitudesPeriodo  = serie.reduce((s, m) => s + m.solicitudes, 0)
  const totalCreditosPeriodo     = serie.reduce((s, m) => s + m.creditosNuevos, 0)

  // ── KPIs globales (siempre actuales) ─────────────────────────────────────
  const [
    { count: totalClientes  },
    { count: creditosActivos},
    { count: creditosMora   },
    { count: cuotasVencidas },
    { data: carteraData     },
  ] = await Promise.all([
    db.from('cliente').select('*', { count: 'exact', head: true }),
    db.from('credito').select('*', { count: 'exact', head: true }).eq('estado_credito', 'ACTIVO'),
    db.from('credito').select('*', { count: 'exact', head: true }).eq('estado_credito', 'EN_MORA'),
    db.from('cuota').select('*', { count: 'exact', head: true }).eq('estado_cuota', 'VENCIDA'),
    db.from('credito').select('saldo_pendiente, monto_desembolsado').in('estado_credito', ['ACTIVO','EN_MORA']),
  ])

  const carteraSaldo      = carteraData?.reduce((s, c) => s + (c.saldo_pendiente || 0), 0) ?? 0
  const totalDesembolsado = carteraData?.reduce((s, c) => s + (c.monto_desembolsado || 0), 0) ?? 0
  const indicadorMora     = (creditosActivos ?? 0) + (creditosMora ?? 0) > 0
    ? ((creditosMora ?? 0) / ((creditosActivos ?? 0) + (creditosMora ?? 0)) * 100).toFixed(1)
    : '0.0'

  // ── Tramos de mora ────────────────────────────────────────────────────────
  const { data: tramosData } = await db.from('credito')
    .select('dias_mora_maximo, saldo_pendiente').eq('estado_credito', 'EN_MORA')

  const tramos = [
    { label: '1-30d',  min: 1,  max: 30   },
    { label: '31-60d', min: 31, max: 60   },
    { label: '61-90d', min: 61, max: 90   },
    { label: '+90d',   min: 91, max: 9999 },
  ].map(t => {
    const items = tramosData?.filter(c => c.dias_mora_maximo >= t.min && c.dias_mora_maximo <= t.max) ?? []
    return { ...t, count: items.length, monto: items.reduce((s, c) => s + (c.saldo_pendiente || 0), 0) }
  })

  return NextResponse.json({
    serie,
    kpis: {
      totalClientes: totalClientes ?? 0,
      creditosActivos: creditosActivos ?? 0,
      creditosMora: creditosMora ?? 0,
      cuotasVencidas: cuotasVencidas ?? 0,
      carteraSaldo, totalDesembolsado, indicadorMora,
      // KPIs del período
      periodo: {
        desembolsado: totalDesembolsadoPeriodo,
        recaudado:    totalRecaudadoPeriodo,
        solicitudes:  totalSolicitudesPeriodo,
        creditos:     totalCreditosPeriodo,
        desde: fechaInicio.toISOString().slice(0, 10),
        hasta: fechaFin.toISOString().slice(0, 10),
      },
    },
    tramos,
    agrupacion,
  })
}
