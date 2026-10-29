/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/pqr/page.js
 * DESCRIPCIÓN: Módulo "PQR" (USUARIO / cliente).
 * FUNCIONALIDAD: Permite al cliente crear PQR y consultar el estado y la
 *                respuesta de las que ha radicado.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import FormPqr from './FormPqr'

export const dynamic = 'force-dynamic'

const ESTADO = {
  ABIERTO:    'bg-yellow-100 text-yellow-700',
  EN_PROCESO: 'bg-blue-100 text-blue-700',
  RESUELTO:   'bg-emerald-100 text-emerald-700',
  CERRADO:    'bg-slate-100 text-slate-600',
}

export default async function PqrUsuarioPage({ searchParams }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: cliente } = await supabase
    .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

  let pqrs = []
  if (cliente?.id_cliente) {
    const { data } = await supabase
      .from('pqr')
      .select('id_pqr, numero_radicado, tipo, asunto, descripcion, estado, respuesta, fecha_respuesta, created_at')
      .eq('id_cliente', cliente.id_cliente)
      .order('created_at', { ascending: false })
    pqrs = data ?? []
  }

  // C-04: búsqueda por número de radicado (sobre las PQR propias ya cargadas)
  const buscar = String((await searchParams)?.radicado ?? '').trim().toUpperCase()
  if (buscar) {
    pqrs = pqrs.filter(p => String(p.numero_radicado ?? '').toUpperCase().includes(buscar))
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-orange-500" /> PQR
        </h1>
        <p className="text-slate-500 mt-1">Peticiones, quejas, reclamos y sugerencias.</p>
      </header>

      <FormPqr />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">Mis solicitudes</h2>
          <form method="GET" className="flex gap-2">
            <input
              name="radicado"
              defaultValue={buscar}
              placeholder="Buscar por radicado (PQR-2026-…)"
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-56"
            />
            <button type="submit" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white">Buscar</button>
          </form>
        </div>
        {pqrs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-slate-100">
            <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">{buscar ? `No hay PQR con el radicado ${buscar}.` : 'Aún no has creado ninguna PQR.'}</p>
          </div>
        ) : (
          pqrs.map((p) => {
            const fecha = new Date(p.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={p.id_pqr} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 capitalize">{p.tipo.toLowerCase()}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO[p.estado] || ESTADO.ABIERTO}`}>{p.estado.replace('_', ' ')}</span>
                  {p.numero_radicado && <span className="text-xs font-mono font-semibold text-slate-600">{p.numero_radicado}</span>}
                  <span className="text-xs text-slate-400 ml-auto">{fecha}</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm mt-2">{p.asunto}</p>
                <p className="text-slate-500 text-sm mt-1">{p.descripcion}</p>
                {p.respuesta && (
                  <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Respuesta de Plurall</p>
                    <p className="text-sm text-slate-700">{p.respuesta}</p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
