import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatCOP } from '@/lib/calculadora'
import { BarChart3, TrendingUp, DollarSign, CheckCircle2, AlertTriangle, CreditCard } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SupervisorCarteraPage() {
  const supabase = await createClient()
  await supabase.auth.getUser()
  const db = createServiceClient()

  const [
    { data: creditos },
    { data: pagosConfirmados },
    { data: cohortes },
  ] = await Promise.all([
    db.from('credito')
      .select(`
        id_credito, estado_credito, monto_desembolsado, saldo_pendiente,
        cuota_fija, cuotas_pagadas, numero_cuotas, dias_mora_maximo,
        fecha_desembolso,
        cliente ( nombre_completo, dni, telefono )
      `)
      .in('estado_credito', ['ACTIVO', 'EN_MORA', 'CANCELADO'])
      .order('fecha_desembolso', { ascending: false }),
    db.from('pago').select('monto_pagado, fecha_pago').eq('estado', 'CONFIRMADO'),
    db.from('credito').select('fecha_desembolso, monto_desembolsado, estado_credito'),
  ])

  const activos    = creditos?.filter(c => c.estado_credito === 'ACTIVO')    ?? []
  const enMora     = creditos?.filter(c => c.estado_credito === 'EN_MORA')   ?? []
  const cancelados = creditos?.filter(c => c.estado_credito === 'CANCELADO') ?? []

  const carteraTotal   = [...activos, ...enMora].reduce((s, c) => s + (c.saldo_pendiente || 0), 0)
  const desembolsado   = [...activos, ...enMora].reduce((s, c) => s + (c.monto_desembolsado || 0), 0)
  const recaudadoTotal = pagosConfirmados?.reduce((s, p) => s + (p.monto_pagado || 0), 0) ?? 0

  // Cohortes por mes
  const cohortesMap = {}
  cohortes?.forEach(c => {
    const mes = c.fecha_desembolso?.slice(0, 7) ?? 'Sin fecha'
    if (!cohortesMap[mes]) cohortesMap[mes] = { otorgados: 0, monto: 0, cancelados: 0, mora: 0 }
    cohortesMap[mes].otorgados++
    cohortesMap[mes].monto += c.monto_desembolsado || 0
    if (c.estado_credito === 'CANCELADO') cohortesMap[mes].cancelados++
    if (c.estado_credito === 'EN_MORA')   cohortesMap[mes].mora++
  })
  const cohortesArr = Object.entries(cohortesMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8)

  const kpis = [
    { label: 'Cartera activa',    value: formatCOP(carteraTotal),  icon: DollarSign,   color: 'text-indigo-400 bg-indigo-500/10'   },
    { label: 'Total desembolsado',value: formatCOP(desembolsado),  icon: TrendingUp,   color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Total recaudado',   value: formatCOP(recaudadoTotal),icon: CheckCircle2, color: 'text-blue-400 bg-blue-500/10'       },
    { label: 'Créditos activos',  value: activos.length,           icon: CreditCard,   color: 'text-orange-400 bg-orange-500/10'   },
    { label: 'En mora',           value: enMora.length,            icon: AlertTriangle,color: 'text-red-400 bg-red-500/10'         },
    { label: 'Cancelados',        value: cancelados.length,        icon: CheckCircle2, color: 'text-teal-400 bg-teal-500/10'       },
  ]

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Cartera de Créditos</h1>
        <p className="text-slate-400 mt-1">Estado completo del portafolio de créditos PLURALL.</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xl font-extrabold text-white">
              {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Cohortes por mes */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-300 mb-5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" /> Cohortes de desembolso (últimos 8 meses)
        </h2>
        {cohortesArr.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Sin datos de cohortes aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-wide border-b border-slate-700">
                  <th className="pb-3 text-left">Mes</th>
                  <th className="pb-3 text-right">Créditos</th>
                  <th className="pb-3 text-right">Monto</th>
                  <th className="pb-3 text-right">Cancelados</th>
                  <th className="pb-3 text-right">En mora</th>
                  <th className="pb-3 text-right">% Mora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {cohortesArr.map(([mes, d]) => (
                  <tr key={mes} className="hover:bg-slate-700/20">
                    <td className="py-3 text-slate-300 font-medium">{mes}</td>
                    <td className="py-3 text-right text-slate-400">{d.otorgados}</td>
                    <td className="py-3 text-right text-slate-300">{formatCOP(d.monto)}</td>
                    <td className="py-3 text-right text-emerald-400">{d.cancelados}</td>
                    <td className="py-3 text-right text-red-400">{d.mora}</td>
                    <td className="py-3 text-right">
                      <span className={`font-bold ${d.mora / d.otorgados > 0.05 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {d.otorgados > 0 ? ((d.mora / d.otorgados) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabla de créditos activos + en mora */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            Créditos vigentes ({activos.length + enMora.length})
          </h2>
        </div>
        {activos.length + enMora.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">Sin créditos vigentes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-right">Desembolsado</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                  <th className="px-5 py-3 text-right">Avance</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                  <th className="px-5 py-3 text-right">Días mora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {[...enMora, ...activos].map((c) => {
                  const progreso = c.numero_cuotas > 0
                    ? Math.round((c.cuotas_pagadas / c.numero_cuotas) * 100)
                    : 0
                  return (
                    <tr key={c.id_credito} className="hover:bg-slate-700/20">
                      <td className="px-5 py-3">
                        <p className="text-slate-200 font-medium">{c.cliente?.nombre_completo}</p>
                        <p className="text-slate-500 text-xs">{c.cliente?.dni} · {c.cliente?.telefono}</p>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-300">{formatCOP(c.monto_desembolsado)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-200">{formatCOP(c.saldo_pendiente)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${c.estado_credito === 'EN_MORA' ? 'bg-red-500' : 'bg-indigo-500'}`}
                              style={{ width: `${progreso}%` }}
                            />
                          </div>
                          <span className="text-slate-400 text-xs">{progreso}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          c.estado_credito === 'EN_MORA'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {c.estado_credito}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold text-sm ${c.dias_mora_maximo > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {c.dias_mora_maximo > 0 ? `${c.dias_mora_maximo}d` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
