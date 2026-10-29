/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/creditos/page.js
 * DESCRIPCIÓN: Módulo "Gestión de créditos" (ASESOR).
 * FUNCIONALIDAD: Lista los créditos de los clientes con su estado, saldo y
 *                avance de cuotas para el seguimiento del asesor.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import { CreditCard, User, AlertTriangle, Download } from 'lucide-react'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

const ESTADO = {
  VIGENTE:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  AL_DIA:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  EN_MORA:   'bg-red-500/10 text-red-400 border-red-500/20',
  PAGADO:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PAGADO:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  CANCELADO: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export default async function CreditosAsesorPage() {
  const supabase = await createClient()

  const { data: creditos } = await supabase
    .from('credito')
    .select(`
      id_credito, monto_desembolsado, estado_credito, saldo_pendiente,
      numero_cuotas, cuotas_pagadas, cuotas_en_mora, fecha_desembolso,
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni )
    `)
    .order('fecha_desembolso', { ascending: false })

  const lista = creditos ?? []

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-teal-400" /> Gestión de créditos
        </h1>
        <p className="text-slate-400 mt-1">Créditos activos de tus clientes y su estado.</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CreditCard className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Aún no hay créditos desembolsados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((c) => {
            const estado = (c.estado_credito || 'VIGENTE').toUpperCase()
            const cls = ESTADO[estado] || ESTADO.VIGENTE
            const avance = c.numero_cuotas ? Math.round((c.cuotas_pagadas / c.numero_cuotas) * 100) : 0
            return (
              <div key={c.id_credito} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-200 text-sm">{formatNombre(c.cliente) || '—'}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{estado.replace('_', ' ')}</span>
                        {c.cuotas_en_mora > 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {c.cuotas_en_mora} en mora
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span>CC {c.cliente?.dni ?? '—'}</span>
                        <span>Desembolsado: {formatCOP(c.monto_desembolsado ?? 0)}</span>
                        <span>Saldo: {formatCOP(c.saldo_pendiente ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-14 sm:pl-0 w-40">
                    <p className="text-xs text-slate-500 mb-1">{c.cuotas_pagadas}/{c.numero_cuotas} cuotas</p>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${avance}%` }} />
                    </div>
                  </div>
                </div>
                {/* Descarga de documentos PDF del crédito */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-700/60">
                  {[
                    { label: 'Plan de pagos', key: 'plan-pagos' },
                    { label: 'Estado de cuenta', key: 'estado-cuenta' },
                    { label: 'Contrato', key: 'contrato' },
                  ].map((d) => (
                    <a key={d.key} href={`/api/documentos/${d.key}/${c.id_credito}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg transition-colors">
                      <Download className="w-3.5 h-3.5" /> {d.label}
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
