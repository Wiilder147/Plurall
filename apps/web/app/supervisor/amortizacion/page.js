/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/amortizacion/page.js
 * DESCRIPCIÓN: Módulo "Amortización" (SUPERVISOR).
 * FUNCIONALIDAD: Lista los planes de pago de cada crédito con su frecuencia,
 *                número de cuotas, fechas de cobro y tasa de mora.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { CalendarClock, User } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AmortizacionSupervisorPage() {
  const supabase = await createClient()

  const { data: planes } = await supabase
    .from('plan_pago')
    .select(`
      id_plan_pago, num_cuotas_totales, frecuencia_pago, fecha_inicio_cobro, fecha_fin_cobro, tasa_mora_diaria,
      credito ( monto_desembolsado, estado_credito, cliente ( nombre_completo, dni ) )
    `)
    .order('created_at', { ascending: false })

  const lista = planes ?? []
  const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <CalendarClock className="w-7 h-7 text-indigo-400" /> Amortización
        </h1>
        <p className="text-slate-400 mt-1">Planes de pago y condiciones de amortización por crédito.</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarClock className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay planes de pago registrados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((p) => {
            const cliente = p.credito?.cliente
            return (
              <div key={p.id_plan_pago} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 text-sm">{cliente?.nombre_completo ?? '—'} <span className="text-slate-500 font-normal">· CC {cliente?.dni ?? '—'}</span></p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div><p className="text-xs text-slate-500">Cuotas</p><p className="text-sm font-semibold text-slate-200">{p.num_cuotas_totales}</p></div>
                      <div><p className="text-xs text-slate-500">Frecuencia</p><p className="text-sm font-semibold text-slate-200 capitalize">{(p.frecuencia_pago || 'mensual').toLowerCase()}</p></div>
                      <div><p className="text-xs text-slate-500">Inicio cobro</p><p className="text-sm font-semibold text-slate-200">{fmtFecha(p.fecha_inicio_cobro)}</p></div>
                      <div><p className="text-xs text-slate-500">Fin cobro</p><p className="text-sm font-semibold text-slate-200">{fmtFecha(p.fecha_fin_cobro)}</p></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Tasa de mora diaria: <span className="text-slate-300 font-medium">{Number(p.tasa_mora_diaria ?? 0)}%</span></p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
