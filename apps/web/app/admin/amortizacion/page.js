/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/amortizacion/page.js
 * DESCRIPCIÓN: Módulo "Amortización" (ADMIN).
 * FUNCIONALIDAD: Lista los planes de pago de cada crédito con su resumen y el
 *                cronograma de cuotas expandible (capital, interés, saldo, estado).
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { CalendarClock } from 'lucide-react'
import AmortizacionExpandible from '@/components/AmortizacionExpandible'

export const dynamic = 'force-dynamic'

export default async function AmortizacionAdminPage() {
  const supabase = await createClient()

  const { data: planes } = await supabase
    .from('plan_pago')
    .select(`
      id_plan_pago, num_cuotas_totales, frecuencia_pago, fecha_inicio_cobro, fecha_fin_cobro, tasa_mora_diaria,
      credito ( monto_desembolsado, estado_credito, cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni ) ),
      cuota ( numero_cuota, fecha_vencimiento, monto_capital, monto_interes, monto_total_cuota, saldo_despues_pago, estado_cuota )
    `)
    .order('created_at', { ascending: false })

  const lista = planes ?? []

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <CalendarClock className="w-7 h-7 text-amber-400" /> Amortización
        </h1>
        <p className="text-slate-400 mt-1">Planes de pago y cronograma de amortización de todos los créditos.</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarClock className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay planes de pago registrados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((p) => (
            <AmortizacionExpandible key={p.id_plan_pago} plan={p} accent="amber" />
          ))}
        </div>
      )}
    </div>
  )
}
