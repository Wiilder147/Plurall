/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/auditoria/page.js
 * DESCRIPCIÓN: Vista del panel para el rol de supervisor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ShieldCheck, Filter } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const ACCION_UI = {
  INSERT: { label: 'Creación',     cls: 'bg-emerald-500/10 text-emerald-400' },
  UPDATE: { label: 'Modificación', cls: 'bg-blue-500/10 text-blue-400'       },
  DELETE: { label: 'Eliminación',  cls: 'bg-red-500/10 text-red-400'         },
}

export default async function SupervisorAuditoriaPage({ searchParams }) {
  const supabase = await createClient()
  const service  = getServiceClient()
  const params   = await searchParams
  const tabla    = params?.tabla || 'TODOS'
  const pagina   = parseInt(params?.pagina || '1')
  const POR_PAG  = 30

  let query = service
    .from('auditoria')
    .select(`
      id_auditoria, tabla_afectada, accion_realizada, id_registro_afectado,
      fecha_evento, ip_origen,
      perfil_usuario:id_usuario_responsable ( nombre_completo )
    `, { count: 'exact' })
    .order('fecha_evento', { ascending: false })
    .range((pagina - 1) * POR_PAG, pagina * POR_PAG - 1)

  if (tabla !== 'TODOS') {
    query = query.eq('tabla_afectada', tabla.toLowerCase())
  }

  const { data: registros, count: total } = await query

  const totalPaginas = Math.ceil((total ?? 0) / POR_PAG)

  const tablas = ['TODOS', 'credito', 'pago', 'solicitud_credito', 'decision_solicitud', 'cliente']

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Auditoría del Sistema</h1>
        <p className="text-slate-400 mt-1">Registro completo de cambios en tablas críticas.</p>
      </header>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        {tablas.map((t) => (
          <a key={t}
            href={`/supervisor/auditoria?tabla=${t}`}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tabla === t
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}>
            {t === 'TODOS' ? 'Todas' : t}
          </a>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            {total?.toLocaleString('es-CO') ?? 0} registros
          </h2>
          <span className="text-slate-500 text-xs">Página {pagina} de {totalPaginas}</span>
        </div>

        {!registros?.length ? (
          <p className="text-center text-slate-500 py-12 text-sm">Sin registros de auditoría.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-700/50 text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Tabla</th>
                  <th className="px-5 py-3 text-center">Acción</th>
                  <th className="px-5 py-3 text-left">ID Registro</th>
                  <th className="px-5 py-3 text-left">Usuario</th>
                  <th className="px-5 py-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {registros.map((r) => {
                  const ui = ACCION_UI[r.accion_realizada] ?? { label: r.accion_realizada, cls: 'bg-slate-700 text-slate-400' }
                  return (
                    <tr key={r.id_auditoria} className="hover:bg-slate-700/20">
                      <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(r.fecha_evento).toLocaleString('es-CO', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 text-slate-300 font-mono">{r.tabla_afectada}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${ui.cls}`}>{ui.label}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 font-mono">
                        {r.id_registro_afectado?.slice(0, 8).toUpperCase()}…
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {r.perfil_usuario?.nombre_completo ?? 'Sistema'}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{r.ip_origen ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
            <a href={`/supervisor/auditoria?tabla=${tabla}&pagina=${Math.max(1, pagina - 1)}`}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                pagina <= 1 ? 'text-slate-600 pointer-events-none' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}>← Anterior</a>
            <span className="text-slate-500 text-sm">{pagina} / {totalPaginas}</span>
            <a href={`/supervisor/auditoria?tabla=${tabla}&pagina=${Math.min(totalPaginas, pagina + 1)}`}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                pagina >= totalPaginas ? 'text-slate-600 pointer-events-none' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}>Siguiente →</a>
          </div>
        )}
      </div>
    </div>
  )
}
