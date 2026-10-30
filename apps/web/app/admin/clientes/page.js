/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/clientes/page.js
 * DESCRIPCIÓN: Vista del panel de administración.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { colorScore } from '@/lib/scoring'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { Users, Search, ArrowRight, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { orBusquedaNombre, formatNombre } from '@/lib/nombre'
import { emailVisible } from '@/lib/email'

export const dynamic = 'force-dynamic'

export default async function AdminClientesPage({ searchParams }) {
  const supabase = await createClient()
  const params   = await searchParams
  const buscar   = params?.q || ''

  let query = supabase
    .from('cliente')
    .select(`
      id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      dni,
      telefono,
      email,
      created_at,
      estado_cliente ( nombre ),
      solicitud_credito ( count ),
      credito (
        id_credito,
        estado_credito,
        saldo_pendiente,
        cuota_fija
      )
    `)
    .order('created_at', { ascending: false })

  if (buscar) {
    query = query.or(orBusquedaNombre(buscar, ['dni', 'telefono']))
  }

  const { data: clientes } = await query

  // Score real desde la vista `vw_cliente_score` (fuente única; opción A de la
  // normalización). Se conserva el campo `score_credito` en cada fila por
  // compatibilidad con el render, pero su origen ya no es la columna legacy.
  if (clientes?.length) {
    const { data: scores } = await supabase
      .from('vw_cliente_score')
      .select('id_cliente, puntaje_total')
      .in('id_cliente', clientes.map(c => c.id_cliente))
    const scoreDe = Object.fromEntries((scores ?? []).map(s => [s.id_cliente, s.puntaje_total]))
    clientes.forEach(c => { c.score_credito = scoreDe[c.id_cliente] ?? null })
  }

  // W-05: colores según el mínimo del modelo activo (escala 0–1000)
  const { data: modeloScore } = await supabase
    .from('modelo_score').select('puntaje_minimo').eq('activo', true).limit(1).maybeSingle()

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Clientes</h1>
        <p className="text-slate-400 mt-1">Directorio de comerciantes registrados en PLURALL.</p>
      </header>

      {/* Buscador */}
      {/* W-07: botón visible; antes solo filtraba con Enter, sin indicación */}
      <form method="GET" className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            name="q"
            type="text"
            defaultValue={buscar}
            placeholder="Buscar por nombre, cédula o celular…"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
        >
          Buscar
        </button>
      </form>

      {/* Tabla / lista */}
      {(!clientes || clientes.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400">{buscar ? 'Sin resultados para tu búsqueda.' : 'No hay clientes registrados aún.'}</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase tracking-wide border-b border-slate-700">
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-left">Documento</th>
                  <th className="px-5 py-3 text-left">Celular</th>
                  <th className="px-5 py-3 text-center">Score</th>
                  <th className="px-5 py-3 text-center">Solicitudes</th>
                  <th className="px-5 py-3 text-right">Saldo activo</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {clientes.map((cli) => {
                  const creditoActivo = cli.credito?.find((c) => ['ACTIVO','EN_MORA'].includes(c.estado_credito))
                  const estadoNombre  = cli.estado_cliente?.nombre?.toUpperCase()
                  return (
                    <tr key={cli.id_cliente} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-200">{formatNombre(cli)}</p>
                        {emailVisible(cli.email) && <p className="text-slate-500 text-xs">{emailVisible(cli.email)}</p>}
                      </td>
                      <td className="px-5 py-4 text-slate-400 font-mono text-xs">{cli.dni}</td>
                      <td className="px-5 py-4 text-slate-400">{cli.telefono}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`font-bold text-sm ${
                          colorScore(cli.score_credito, modeloScore)
                        }`}>
                          {cli.score_credito || 0}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-slate-400">
                        {/* Supabase devuelve [{ count: N }] para columnas de count */}
                        {cli.solicitud_credito?.[0]?.count ?? 0}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-300">
                        {creditoActivo ? formatCOP(creditoActivo.saldo_pendiente) : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          estadoNombre === 'ACTIVO'   ? 'bg-emerald-500/10 text-emerald-400' :
                          estadoNombre === 'BLOQUEADO'? 'bg-red-500/10 text-red-400'         :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {estadoNombre === 'ACTIVO' ? <CheckCircle2 className="w-3 h-3" /> :
                           estadoNombre === 'BLOQUEADO' ? <XCircle className="w-3 h-3" /> :
                           <Clock className="w-3 h-3" />}
                          {estadoNombre || 'ACTIVO'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/clientes/${cli.id_cliente}`}
                          className="text-orange-400 hover:text-orange-300 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
