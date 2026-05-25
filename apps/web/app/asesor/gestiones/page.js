/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/gestiones/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de asesor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { ClipboardList, CheckCircle2, Clock, XCircle, PhoneCall } from 'lucide-react'

export const dynamic = 'force-dynamic'

const RESULTADO_UI = {
  EXITOSO:       { cls: 'bg-emerald-500/10 text-emerald-400' },
  PAGO_RECIBIDO: { cls: 'bg-emerald-500/10 text-emerald-400' },
  PROMESA:       { cls: 'bg-yellow-500/10 text-yellow-400'   },
  SIN_RESPUESTA: { cls: 'bg-slate-700 text-slate-400'        },
  RECHAZO:       { cls: 'bg-red-500/10 text-red-400'         },
}

export default async function AsesorGestionesPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params  = await searchParams
  const filtro  = params?.resultado?.toUpperCase() || 'TODOS'
  const pagina  = parseInt(params?.pagina || '1')
  const POR_PAG = 20

  let query = supabase
    .from('gestion_cobranza')
    .select(`
      id_gestion, tipo_gestion, resultado, observaciones,
      monto_prometido, fecha_promesa, monto_recibido, fecha_gestion,
      cliente ( nombre_completo, telefono )
    `, { count: 'exact' })
    .eq('id_asesor', user.id)
    .order('fecha_gestion', { ascending: false })
    .range((pagina - 1) * POR_PAG, pagina * POR_PAG - 1)

  if (filtro !== 'TODOS') query = query.eq('resultado', filtro)

  const { data: gestiones, count: total } = await query
  const totalPaginas = Math.ceil((total ?? 0) / POR_PAG)

  // Conteos para tabs
  const { data: conteos } = await supabase
    .from('gestion_cobranza')
    .select('resultado')
    .eq('id_asesor', user.id)

  const conteoPorResultado = {}
  conteos?.forEach(g => {
    conteoPorResultado[g.resultado] = (conteoPorResultado[g.resultado] || 0) + 1
  })

  const tabs = [
    { key: 'TODOS',        label: 'Todas',          count: total ?? 0 },
    { key: 'PROMESA',      label: 'Promesas',        count: conteoPorResultado['PROMESA'] ?? 0 },
    { key: 'PAGO_RECIBIDO',label: 'Pagos recibidos', count: conteoPorResultado['PAGO_RECIBIDO'] ?? 0 },
    { key: 'SIN_RESPUESTA',label: 'Sin respuesta',   count: conteoPorResultado['SIN_RESPUESTA'] ?? 0 },
  ]

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Mis Gestiones</h1>
        <p className="text-slate-400 mt-1">Historial completo de gestiones de cobranza.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, count }) => (
          <Link key={key}
            href={`/asesor/gestiones?resultado=${key.toLowerCase()}`}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtro === key
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}>
            {label}
            {count > 0 && <span className="ml-2 text-xs opacity-70">{count}</span>}
          </Link>
        ))}
      </div>

      {/* Lista */}
      {!gestiones?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400">Sin gestiones en esta categoría.</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="divide-y divide-slate-700/50">
            {gestiones.map((g) => {
              const ui = RESULTADO_UI[g.resultado] ?? RESULTADO_UI.SIN_RESPUESTA
              return (
                <div key={g.id_gestion} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <PhoneCall className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200 text-sm">{g.cliente?.nombre_completo}</p>
                      <p className="text-slate-500 text-xs">{g.cliente?.telefono}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">
                          {g.tipo_gestion.replace('_', ' ')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ui.cls}`}>
                          {g.resultado.replace('_', ' ')}
                        </span>
                      </div>
                      {g.observaciones && (
                        <p className="text-slate-400 text-xs mt-1">{g.observaciones}</p>
                      )}
                      {g.monto_prometido && (
                        <p className="text-yellow-400 text-xs mt-0.5">
                          Promesa: {formatCOP(g.monto_prometido)} para el{' '}
                          {g.fecha_promesa ? new Date(g.fecha_promesa + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                        </p>
                      )}
                      {g.monto_recibido > 0 && (
                        <p className="text-emerald-400 text-xs mt-0.5">
                          Pago recibido: {formatCOP(g.monto_recibido)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs shrink-0">
                    {new Date(g.fecha_gestion).toLocaleDateString('es-CO', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
              <Link href={`/asesor/gestiones?resultado=${filtro.toLowerCase()}&pagina=${Math.max(1, pagina - 1)}`}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  pagina <= 1 ? 'text-slate-600 pointer-events-none' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>← Anterior</Link>
              <span className="text-slate-500 text-sm">{pagina} / {totalPaginas}</span>
              <Link href={`/asesor/gestiones?resultado=${filtro.toLowerCase()}&pagina=${Math.min(totalPaginas, pagina + 1)}`}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  pagina >= totalPaginas ? 'text-slate-600 pointer-events-none' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>Siguiente →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
