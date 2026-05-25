/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/cobranza/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de asesor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { AlertTriangle, Phone, ArrowRight, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TRAMO = (dias) => {
  if (dias <= 30) return { label: '1-30 días',  cls: 'bg-yellow-500/10 text-yellow-400' }
  if (dias <= 60) return { label: '31-60 días', cls: 'bg-orange-500/10 text-orange-400' }
  if (dias <= 90) return { label: '61-90 días', cls: 'bg-red-500/10 text-red-400'       }
  return                 { label: '+90 días',   cls: 'bg-red-900/30 text-red-300'        }
}

export default async function AsesorCobranzaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Solo clientes asignados a este asesor que estén en mora
  const { data: asignaciones } = await supabase
    .from('asignacion_asesor')
    .select(`
      cliente (
        id_cliente, nombre_completo, dni, telefono, email,
        credito (
          id_credito, saldo_pendiente, cuotas_en_mora, dias_mora_maximo,
          cuota_fija, plan_pago ( id_plan_pago )
        )
      )
    `)
    .eq('id_asesor', user.id)
    .eq('activa', true)

  const clientesMora = (asignaciones ?? [])
    .map(a => a.cliente)
    .filter(c => c?.credito?.some(cr => cr.estado_credito === 'EN_MORA'))
    .map(c => ({
      ...c,
      creditoMora: c.credito?.find(cr => cr.estado_credito === 'EN_MORA'),
    }))
    .sort((a, b) => (b.creditoMora?.dias_mora_maximo ?? 0) - (a.creditoMora?.dias_mora_maximo ?? 0))

  // Cuotas vencidas por plan
  const planIds = clientesMora.map(c => c.creditoMora?.plan_pago?.id_plan_pago).filter(Boolean)
  const cuotasMap = {}
  if (planIds.length > 0) {
    const { data: cuotasV } = await supabase
      .from('cuota')
      .select('id_plan_pago, monto_total_cuota')
      .in('id_plan_pago', planIds)
      .eq('estado_cuota', 'VENCIDA')
    cuotasV?.forEach(c => {
      if (!cuotasMap[c.id_plan_pago]) cuotasMap[c.id_plan_pago] = { count: 0, monto: 0 }
      cuotasMap[c.id_plan_pago].count++
      cuotasMap[c.id_plan_pago].monto += c.monto_total_cuota || 0
    })
  }

  const totalEnRiesgo = clientesMora.reduce((s, c) => s + (c.creditoMora?.saldo_pendiente ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Cobranza</h1>
        <p className="text-slate-400 mt-1">Clientes en mora asignados a tu cartera.</p>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-2xl font-extrabold text-white">{clientesMora.length}</p>
          <p className="text-slate-400 text-sm">Clientes en mora</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <DollarSign className="w-8 h-8 text-orange-400 mb-2" />
          <p className="text-xl font-extrabold text-white">{formatCOP(totalEnRiesgo)}</p>
          <p className="text-slate-400 text-sm">Capital en riesgo</p>
        </div>
      </div>

      {clientesMora.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Sin clientes en mora. ✓</p>
          <p className="text-slate-500 text-sm mt-1">Todos tus clientes están al día.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clientesMora.map((c) => {
            const planId   = c.creditoMora?.plan_pago?.id_plan_pago
            const vencidas = planId ? cuotasMap[planId] : null
            const tramo    = TRAMO(c.creditoMora?.dias_mora_maximo ?? 0)

            return (
              <Link key={c.id_cliente} href={`/asesor/cobranza/${c.id_cliente}`}
                className="bg-slate-800 border border-red-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-red-500/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 font-bold text-base shrink-0">
                    {c.nombre_completo?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{c.nombre_completo}</p>
                    <p className="text-slate-500 text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {c.telefono} · CC {c.dni}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tramo.cls}`}>
                        {tramo.label}
                      </span>
                      {vencidas && (
                        <span className="text-xs text-slate-500">
                          {vencidas.count} cuota{vencidas.count !== 1 ? 's' : ''} · {formatCOP(vencidas.monto)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-red-400 font-extrabold text-xl">{c.creditoMora?.dias_mora_maximo}d</p>
                    <p className="text-slate-400 text-xs">{formatCOP(c.creditoMora?.saldo_pendiente)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
