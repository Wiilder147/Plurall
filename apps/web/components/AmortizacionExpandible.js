'use client'

/* ==========================================================================
 * ARCHIVO: AmortizacionExpandible.js
 * RUTA: apps/web/components/AmortizacionExpandible.js
 * DESCRIPCIÓN: Tarjeta de plan de pago con cronograma de amortización expandible.
 * FUNCIONALIDAD: Muestra el resumen del plan y, al expandir, la tabla de cuotas
 *                (capital, interés, cuota, saldo, estado). La usan las vistas de
 *                amortización de asesor, supervisor y admin. Tema oscuro.
 * ========================================================================== */
import { useState } from 'react'
import { User, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'
import { formatNombre } from '@/lib/nombre'

const ESTADO_CUOTA = {
  PENDIENTE:   'bg-slate-500/15 text-slate-300',
  PAGADA:      'bg-emerald-500/15 text-emerald-300',
  PAGADA_MORA: 'bg-yellow-500/15 text-yellow-300',
  VENCIDA:     'bg-red-500/15 text-red-300',
  CONDONADA:   'bg-purple-500/15 text-purple-300',
}

const ACCENTS = {
  teal:   'bg-teal-500/20 text-teal-400',
  indigo: 'bg-indigo-500/20 text-indigo-400',
  amber:  'bg-amber-500/20 text-amber-400',
}

const fmtFecha = (f) => f
  ? new Date(f.length <= 10 ? f + 'T00:00:00' : f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

export default function AmortizacionExpandible({ plan, accent = 'indigo' }) {
  const [abierto, setAbierto] = useState(false)
  const cliente = plan.credito?.cliente
  const cuotas = [...(plan.cuota ?? [])].sort((a, b) => a.numero_cuota - b.numero_cuota)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ACCENTS[accent] || ACCENTS.indigo}`}>
          <User className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-200 text-sm">
            {formatNombre(cliente) || '—'} <span className="text-slate-500 font-normal">· CC {cliente?.dni ?? '—'}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div><p className="text-xs text-slate-500">Cuotas</p><p className="text-sm font-semibold text-slate-200">{plan.num_cuotas_totales}</p></div>
            <div><p className="text-xs text-slate-500">Frecuencia</p><p className="text-sm font-semibold text-slate-200 capitalize">{(plan.frecuencia_pago || 'mensual').toLowerCase()}</p></div>
            <div><p className="text-xs text-slate-500">Inicio cobro</p><p className="text-sm font-semibold text-slate-200">{fmtFecha(plan.fecha_inicio_cobro)}</p></div>
            <div><p className="text-xs text-slate-500">Fin cobro</p><p className="text-sm font-semibold text-slate-200">{fmtFecha(plan.fecha_fin_cobro)}</p></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Tasa de mora diaria: <span className="text-slate-300 font-medium">{Number(plan.tasa_mora_diaria ?? 0)}%</span></p>

          {cuotas.length > 0 && (
            <button
              onClick={() => setAbierto(v => !v)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {abierto ? 'Ocultar cronograma' : `Ver cronograma (${cuotas.length} cuotas)`}
            </button>
          )}
        </div>
      </div>

      {abierto && cuotas.length > 0 && (
        <div className="mt-4 overflow-x-auto border-t border-slate-700 pt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 uppercase tracking-wide">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Vencimiento</th>
                <th className="px-3 py-2 text-right">Capital</th>
                <th className="px-3 py-2 text-right">Interés</th>
                <th className="px-3 py-2 text-right">Cuota</th>
                <th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {cuotas.map((c) => (
                <tr key={c.numero_cuota} className="hover:bg-slate-700/20">
                  <td className="px-3 py-2 font-semibold text-slate-300">{c.numero_cuota}</td>
                  <td className="px-3 py-2 text-slate-400">{fmtFecha(c.fecha_vencimiento)}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{formatCOP(c.monto_capital)}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{formatCOP(c.monto_interes)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-200">{formatCOP(c.monto_total_cuota)}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{formatCOP(c.saldo_despues_pago)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${ESTADO_CUOTA[c.estado_cuota] || ESTADO_CUOTA.PENDIENTE}`}>
                      {(c.estado_cuota || 'PENDIENTE').replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
