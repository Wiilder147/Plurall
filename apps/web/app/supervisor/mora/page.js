import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatCOP } from '@/lib/calculadora'
import { AlertTriangle, Phone, DollarSign, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TRAMO = (dias) => {
  if (dias === 0)  return { label: 'Al día',           cls: 'bg-emerald-500/10 text-emerald-400' }
  if (dias <= 30)  return { label: 'Mora 1-30 días',   cls: 'bg-yellow-500/10 text-yellow-400'  }
  if (dias <= 60)  return { label: 'Mora 31-60 días',  cls: 'bg-orange-500/10 text-orange-400'  }
  if (dias <= 90)  return { label: 'Mora 61-90 días',  cls: 'bg-red-500/10 text-red-400'        }
  return                  { label: 'Castigada +90d',   cls: 'bg-red-900/30 text-red-300'        }
}

export default async function SupervisorMoraPage() {
  const supabase = await createClient()
  await supabase.auth.getUser()
  const db = createServiceClient()

  const { data: creditosMora } = await db
    .from('credito')
    .select(`
      id_credito, saldo_pendiente, cuotas_en_mora, dias_mora_maximo,
      cuota_fija, fecha_desembolso,
      cliente ( id_cliente, nombre_completo, dni, telefono, email ),
      plan_pago ( id_plan_pago )
    `)
    .eq('estado_credito', 'EN_MORA')
    .order('dias_mora_maximo', { ascending: false })

  // Cuotas vencidas por crédito
  const cuotasVencidasMap = {}
  if (creditosMora && creditosMora.length > 0) {
    const planIds = creditosMora.map(c => c.plan_pago?.id_plan_pago).filter(Boolean)
    if (planIds.length > 0) {
      const { data: cuotasV } = await db
        .from('cuota')
        .select('id_plan_pago, monto_total_cuota, fecha_vencimiento')
        .in('id_plan_pago', planIds)
        .eq('estado_cuota', 'VENCIDA')
      cuotasV?.forEach(c => {
        if (!cuotasVencidasMap[c.id_plan_pago]) cuotasVencidasMap[c.id_plan_pago] = { count: 0, monto: 0 }
        cuotasVencidasMap[c.id_plan_pago].count++
        cuotasVencidasMap[c.id_plan_pago].monto += c.monto_total_cuota || 0
      })
    }
  }

  // Gestiones recientes
  const { data: gestiones } = await db
    .from('gestion_cobranza')
    .select(`
      id_gestion, tipo_gestion, resultado, fecha_gestion, observaciones,
      credito ( id_credito, cliente ( nombre_completo ) )
    `)
    .order('fecha_gestion', { ascending: false })
    .limit(10)

  const totalMora = creditosMora?.reduce((s, c) => s + (c.saldo_pendiente || 0), 0) ?? 0
  const tramosCount = { '1-30': 0, '31-60': 0, '61-90': 0, '+90': 0 }
  creditosMora?.forEach(c => {
    const d = c.dias_mora_maximo
    if (d <= 30)       tramosCount['1-30']++
    else if (d <= 60)  tramosCount['31-60']++
    else if (d <= 90)  tramosCount['61-90']++
    else               tramosCount['+90']++
  })

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Mora</h1>
        <p className="text-slate-400 mt-1">Créditos en mora y seguimiento de cobranza.</p>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-2xl font-extrabold text-white">{creditosMora?.length ?? 0}</p>
          <p className="text-slate-400 text-sm">Créditos en mora</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <DollarSign className="w-8 h-8 text-orange-400 mb-2" />
          <p className="text-xl font-extrabold text-white">{formatCOP(totalMora)}</p>
          <p className="text-slate-400 text-sm">Capital en riesgo</p>
        </div>
        {[
          { label: 'Mora 1-30d',  count: tramosCount['1-30'],  cls: 'text-yellow-400' },
          { label: 'Mora +30d',   count: tramosCount['31-60'] + tramosCount['61-90'] + tramosCount['+90'], cls: 'text-red-400' },
        ].map(({ label, count, cls }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <p className={`text-2xl font-extrabold ${cls}`}>{count}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabla de mora */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Créditos en mora ({creditosMora?.length ?? 0})
          </h2>
        </div>
        {!creditosMora?.length ? (
          <p className="text-center text-slate-500 py-12 text-sm">Sin créditos en mora. ✓</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-left">Contacto</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                  <th className="px-5 py-3 text-right">Cuotas vencidas</th>
                  <th className="px-5 py-3 text-right">Monto vencido</th>
                  <th className="px-5 py-3 text-center">Tramo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {creditosMora.map((c) => {
                  const tramo    = TRAMO(c.dias_mora_maximo)
                  const planId   = c.plan_pago?.id_plan_pago
                  const vencidas = planId ? cuotasVencidasMap[planId] : null
                  return (
                    <tr key={c.id_credito} className="hover:bg-slate-700/20">
                      <td className="px-5 py-3">
                        <p className="text-slate-200 font-medium">{c.cliente?.nombre_completo}</p>
                        <p className="text-slate-500 text-xs">CC {c.cliente?.dni}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-slate-400 text-xs flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {c.cliente?.telefono}
                        </p>
                        <p className="text-slate-500 text-xs">{c.cliente?.email}</p>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-200">{formatCOP(c.saldo_pendiente)}</td>
                      <td className="px-5 py-3 text-right text-red-400 font-bold">{vencidas?.count ?? c.cuotas_en_mora}</td>
                      <td className="px-5 py-3 text-right text-red-400">{formatCOP(vencidas?.monto ?? 0)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tramo.cls}`}>
                          {c.dias_mora_maximo}d · {tramo.label}
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

      {/* Gestiones recientes */}
      {gestiones && gestiones.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" /> Gestiones de cobranza recientes
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50">
            {gestiones.map((g) => (
              <div key={g.id_gestion} className="px-5 py-3.5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-slate-300 text-sm font-medium">{g.credito?.cliente?.nombre_completo}</p>
                  <p className="text-slate-500 text-xs">{g.tipo_gestion} · {g.observaciones}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    g.resultado === 'EXITOSO' || g.resultado === 'PAGO_RECIBIDO' ? 'bg-emerald-500/10 text-emerald-400' :
                    g.resultado === 'PROMESA' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>{g.resultado}</span>
                  <p className="text-slate-500 text-xs mt-1">
                    {new Date(g.fecha_gestion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
