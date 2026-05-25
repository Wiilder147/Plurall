/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/pagos/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de asesor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import { DollarSign, CheckCircle2, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AsesorPagosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Pagos en efectivo registrados por este asesor
  const { data: pagos } = await supabase
    .from('pago')
    .select(`
      id_recibo, monto_pagado, monto_capital, monto_interes, monto_mora,
      metodo_pago, referencia_externa, estado, fecha_pago,
      credito ( id_credito, cliente ( nombre_completo, dni, telefono ) )
    `)
    .eq('id_usuario_receptor', user.id)
    .eq('metodo_pago', 'EFECTIVO')
    .order('fecha_pago', { ascending: false })

  // Totales
  const totalRecaudado = pagos?.reduce((s, p) => s + (p.monto_pagado || 0), 0) ?? 0
  const totalCapital   = pagos?.reduce((s, p) => s + (p.monto_capital || 0), 0) ?? 0

  // Agrupado por día
  const porDia = {}
  pagos?.forEach(p => {
    const dia = p.fecha_pago?.split('T')[0] ?? 'Sin fecha'
    if (!porDia[dia]) porDia[dia] = { count: 0, monto: 0 }
    porDia[dia].count++
    porDia[dia].monto += p.monto_pagado || 0
  })
  const diasArr = Object.entries(porDia).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Pagos en Efectivo</h1>
        <p className="text-slate-400 mt-1">Registro de pagos recibidos en efectivo por tu gestión.</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total recaudado',  value: formatCOP(totalRecaudado), icon: DollarSign,   color: 'text-teal-400 bg-teal-500/10' },
          { label: 'Capital abonado',  value: formatCOP(totalCapital),   icon: TrendingUp,   color: 'text-emerald-400 bg-emerald-500/10' },
          { label: 'Pagos registrados',value: pagos?.length ?? 0,        icon: CheckCircle2, color: 'text-blue-400 bg-blue-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
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

      {/* Resumen por día */}
      {diasArr.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-300 mb-4 text-sm">Recaudo por día (últimos 7 días)</h2>
          <div className="flex flex-col gap-2">
            {diasArr.map(([dia, d]) => (
              <div key={dia} className="flex items-center gap-3">
                <span className="text-slate-400 text-xs w-24 shrink-0">
                  {new Date(dia + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                </span>
                <div className="flex-1 bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-teal-500 h-2.5 rounded-full"
                    style={{ width: `${Math.min(100, (d.monto / (totalRecaudado || 1)) * 100)}%` }} />
                </div>
                <span className="text-slate-300 text-xs font-semibold w-28 text-right">{formatCOP(d.monto)}</span>
                <span className="text-slate-500 text-xs w-12 text-right">{d.count} pago{d.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de pagos */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-teal-400" /> Detalle de pagos ({pagos?.length ?? 0})
          </h2>
        </div>
        {!pagos?.length ? (
          <p className="text-center text-slate-500 py-12 text-sm">Sin pagos en efectivo registrados aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                  <th className="px-5 py-3 text-right">Capital</th>
                  <th className="px-5 py-3 text-right">Interés</th>
                  <th className="px-5 py-3 text-left">Referencia</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {pagos.map((p) => (
                  <tr key={p.id_recibo} className="hover:bg-slate-700/20">
                    <td className="px-5 py-3">
                      <p className="text-slate-200 font-medium">{p.credito?.cliente?.nombre_completo}</p>
                      <p className="text-slate-500 text-xs">{p.credito?.cliente?.telefono}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-400">{formatCOP(p.monto_pagado)}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{formatCOP(p.monto_capital)}</td>
                    <td className="px-5 py-3 text-right text-slate-400">{formatCOP(p.monto_interes)}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{p.referencia_externa}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(p.fecha_pago).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
