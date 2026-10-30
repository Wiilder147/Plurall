/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/clientes/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de supervisor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { colorScore } from '@/lib/scoring'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { Users, Search, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react'
import { orBusquedaNombre, formatNombre } from '@/lib/nombre'
import { emailVisible } from '@/lib/email'

export const dynamic = 'force-dynamic'

export default async function SupervisorClientesPage({ searchParams }) {
  const supabase = await createClient()
  await supabase.auth.getUser()
  const db     = createServiceClient()
  const params = await searchParams
  const buscar = params?.q || ''
  const filtro = params?.estado?.toUpperCase() || 'TODOS'

  const SELECT_CLIENTE = `
    id_cliente, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono, email,
    created_at,
    estado_cliente ( nombre ),
    credito ( id_credito, estado_credito, saldo_pendiente, dias_mora_maximo )
  `

  let todos = []

  if (buscar && buscar.length >= 2) {
    // Search by name, DNI, phone or email
    const { data: byDatos } = await db
      .from('cliente')
      .select(SELECT_CLIENTE)
      .or(orBusquedaNombre(buscar))
      .order('created_at', { ascending: false })

    // Also search by credit UUID prefix
    let byCredito = []
    if (buscar.length >= 8) {
      const { data: creditos } = await db
        .from('credito')
        .select(`id_credito, cliente ( ${SELECT_CLIENTE} )`)
        .ilike('id_credito', `${buscar}%`)
        .limit(5)
      byCredito = (creditos ?? []).filter(c => c.cliente).map(c => c.cliente)
    }

    // Deduplicate by id_cliente
    const mapa = new Map()
    ;[...(byDatos ?? []), ...byCredito].forEach(c => {
      if (!mapa.has(c.id_cliente)) mapa.set(c.id_cliente, c)
    })
    todos = Array.from(mapa.values())
  } else {
    const { data } = await db
      .from('cliente')
      .select(SELECT_CLIENTE)
      .order('created_at', { ascending: false })
    todos = data ?? []
  }

  // Score real desde `vw_cliente_score` (opción A). Se conserva el campo
  // `score_credito` en cada fila por compatibilidad con el render.
  if (todos.length) {
    const { data: scores } = await db
      .from('vw_cliente_score')
      .select('id_cliente, puntaje_total')
      .in('id_cliente', todos.map(c => c.id_cliente))
    const scoreDe = Object.fromEntries((scores ?? []).map(s => [s.id_cliente, s.puntaje_total]))
    todos.forEach(c => { c.score_credito = scoreDe[c.id_cliente] ?? null })
  }

  const clientes = filtro === 'TODOS' ? todos ?? []
    : filtro === 'MORA' ? (todos ?? []).filter(c => c.credito?.some(cr => cr.estado_credito === 'EN_MORA'))
    : filtro === 'ACTIVO' ? (todos ?? []).filter(c => c.credito?.some(cr => cr.estado_credito === 'ACTIVO'))
    : todos ?? []

  const tabs = [
    { key: 'TODOS',  label: 'Todos',       count: todos?.length ?? 0 },
    { key: 'ACTIVO', label: 'Con crédito', count: (todos ?? []).filter(c => c.credito?.some(cr => ['ACTIVO','EN_MORA'].includes(cr.estado_credito))).length },
    { key: 'MORA',   label: 'En mora',     count: (todos ?? []).filter(c => c.credito?.some(cr => cr.estado_credito === 'EN_MORA')).length },
  ]

  // W-05: colores según el mínimo del modelo activo (escala 0–1000)
  const { data: modeloScore } = await supabase
    .from('modelo_score').select('puntaje_minimo').eq('activo', true).limit(1).maybeSingle()

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Clientes</h1>
        <p className="text-slate-400 mt-1">Directorio completo de comerciantes registrados.</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <form method="GET" className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input name="q" type="text" defaultValue={buscar}
            placeholder="Buscar por nombre, cédula, celular, email o ID de crédito…"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </form>
        <div className="flex gap-2">
          {tabs.map(({ key, label, count }) => (
            <Link key={key}
              href={`/supervisor/clientes?estado=${key.toLowerCase()}${buscar ? `&q=${buscar}` : ''}`}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filtro === key
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}>
              {label} <span className="ml-1 text-xs opacity-70">{count}</span>
            </Link>
          ))}
        </div>
      </div>

      {!clientes.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400">{buscar ? 'Sin resultados.' : 'No hay clientes registrados.'}</p>
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
                  <th className="px-5 py-3 text-right">Saldo activo</th>
                  <th className="px-5 py-3 text-center">Estado crédito</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {clientes.map((cli) => {
                  const creditoActivo = cli.credito?.find(c => ['ACTIVO','EN_MORA'].includes(c.estado_credito))
                  const enMora        = creditoActivo?.estado_credito === 'EN_MORA'
                  return (
                    <tr key={cli.id_cliente} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-200">{formatNombre(cli)}</p>
                        {emailVisible(cli.email) && (
                          <p className="text-slate-500 text-xs">{emailVisible(cli.email)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-400 font-mono text-xs">{cli.dni}</td>
                      <td className="px-5 py-4 text-slate-400">{cli.telefono}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`font-bold text-sm ${
                          colorScore(cli.score_credito, modeloScore)
                        }`}>{cli.score_credito || 0}</span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-300">
                        {creditoActivo ? formatCOP(creditoActivo.saldo_pendiente) : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {creditoActivo ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                            enMora ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {enMora ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                            {creditoActivo.estado_credito}
                            {enMora && creditoActivo.dias_mora_maximo > 0 && ` · ${creditoActivo.dias_mora_maximo}d`}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">Sin crédito</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/supervisor/clientes/${cli.id_cliente}`}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors">
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
