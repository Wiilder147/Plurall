/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/reportes/page.js
 * DESCRIPCIÓN: Vista del panel de administración.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Users, CheckCircle2, Download } from 'lucide-react'
import ExportarReporteBtn from '@/components/ExportarReporteBtn'

export const dynamic = 'force-dynamic'

export default async function AdminReportesPage() {
  const supabase = await createClient()

  // ── Métricas generales ───────────────────────────────────────
  const [
    { data: creditosActivos },
    { data: cuotasVencidas  },
    { data: pagosConfirmados },
    { count: totalClientes  },
    { count: totalSolicitudes },
  ] = await Promise.all([
    supabase.from('credito').select('monto_desembolsado, saldo_pendiente, estado_credito').in('estado_credito', ['ACTIVO','EN_MORA']),
    supabase.from('cuota').select('monto_total_cuota').eq('estado_cuota', 'VENCIDA'),
    supabase.from('pago').select('monto_pagado').eq('estado', 'CONFIRMADO'),
    supabase.from('cliente').select('*', { count: 'exact', head: true }),
    supabase.from('solicitud_credito').select('*', { count: 'exact', head: true }),
  ])

  const carteraTotal    = creditosActivos?.reduce((s, c) => s + (c.saldo_pendiente || 0), 0) || 0
  const desembolsadoTotal = creditosActivos?.reduce((s, c) => s + (c.monto_desembolsado || 0), 0) || 0
  const cuotasVencidasMonto = cuotasVencidas?.reduce((s, c) => s + (c.monto_total_cuota || 0), 0) || 0
  const recaudadoTotal  = pagosConfirmados?.reduce((s, p) => s + (p.monto_pagado || 0), 0) || 0
  const creditosEnMora  = creditosActivos?.filter((c) => c.estado_credito === 'EN_MORA').length || 0

  // Solicitudes por estado (para gráfica de barras)
  const { data: solicitudesPorEstado } = await supabase
    .from('solicitud_credito')
    .select('estado_solicitud ( nombre )')

  const conteoEstados = {}
  solicitudesPorEstado?.forEach((s) => {
    const nombre = s.estado_solicitud?.nombre || 'DESCONOCIDO'
    conteoEstados[nombre] = (conteoEstados[nombre] || 0) + 1
  })

  const maxEstado = Math.max(...Object.values(conteoEstados), 1)

  const kpis = [
    { label: 'Cartera activa',         value: formatCOP(carteraTotal),        icon: DollarSign, color: 'text-orange-400 bg-orange-500/10' },
    { label: 'Total desembolsado',      value: formatCOP(desembolsadoTotal),   icon: TrendingUp, color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Recaudado (pagos)',        value: formatCOP(recaudadoTotal),      icon: CheckCircle2, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'En mora (capital)',        value: formatCOP(cuotasVencidasMonto), icon: AlertTriangle, color: 'text-red-400 bg-red-500/10' },
    { label: 'Clientes totales',        value: totalClientes?.toLocaleString('es-CO') || '0', icon: Users, color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Créditos en mora',        value: creditosEnMora,                 icon: TrendingDown, color: 'text-yellow-400 bg-yellow-500/10' },
  ]

  const COLORES_ESTADO = {
    PENDIENTE:    'bg-yellow-500',
    EN_ESTUDIO:   'bg-blue-500',
    APROBADA:     'bg-emerald-500',
    DESEMBOLSADA: 'bg-green-600',
    RECHAZADA:    'bg-red-500',
    CANCELADA:    'bg-slate-500',
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reportes y Métricas</h1>
          <p className="text-slate-400 mt-1">Vista ejecutiva del portafolio de créditos PLURALL.</p>
        </div>
        {/* Botones de exportación CSV */}
        <div className="flex flex-wrap gap-2">
          <ExportarReporteBtn tipo="clientes"    label="Clientes" />
          <ExportarReporteBtn tipo="creditos"    label="Créditos" />
          <ExportarReporteBtn tipo="solicitudes" label="Solicitudes" />
          <ExportarReporteBtn tipo="pagos"       label="Pagos" />
          <ExportarReporteBtn tipo="mora"        label="Mora" acento />
        </div>
      </header>

      {/* KPIs grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xl font-extrabold text-white">{value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Distribución de solicitudes */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-300 mb-5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-orange-400" />
          Solicitudes por estado
          <span className="ml-auto text-slate-500 text-xs font-normal">Total: {totalSolicitudes?.toLocaleString('es-CO')}</span>
        </h2>
        <div className="flex flex-col gap-3">
          {Object.entries(conteoEstados)
            .sort((a, b) => b[1] - a[1])
            .map(([estado, count]) => {
              const pct   = Math.round((count / maxEstado) * 100)
              const color = COLORES_ESTADO[estado.toUpperCase()] || 'bg-slate-500'
              return (
                <div key={estado} className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs w-28 shrink-0 text-right">{estado}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-slate-300 text-xs font-bold w-8 text-right">{count}</span>
                </div>
              )
            })}
          {Object.keys(conteoEstados).length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Sin datos de solicitudes.</p>
          )}
        </div>
      </div>

      {/* Indicador de mora */}
      {desembolsadoTotal > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Indicador de mora
          </h2>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Cartera en mora / Total desembolsado</span>
              <span className="font-bold text-white">
                {((cuotasVencidasMonto / desembolsadoTotal) * 100).toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="bg-red-500 h-3 rounded-full"
                style={{ width: `${Math.min(100, (cuotasVencidasMonto / desembolsadoTotal) * 100)}%` }}
              />
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Referencia: indicador sano = por debajo del 5%.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
