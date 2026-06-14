/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/motivos-rechazo/page.js
 * DESCRIPCIÓN: Módulo "Motivos de rechazo" (ASESOR) — solo consulta.
 * FUNCIONALIDAD: Lista los motivos de rechazo activos para apoyar la decisión
 *                del asesor al gestionar solicitudes. La gestión la hace el supervisor.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { XCircle, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MotivosRechazoAsesorPage() {
  const supabase = await createClient()

  const { data: motivos } = await supabase
    .from('motivo_rechazo')
    .select('id_motivo, descripcion_motivo, visible_cliente, activo')
    .eq('activo', true)
    .order('descripcion_motivo')

  const lista = motivos ?? []

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <XCircle className="w-7 h-7 text-teal-400" /> Motivos de rechazo
        </h1>
        <p className="text-slate-400 mt-1">Motivos disponibles al rechazar una solicitud (gestionados por el supervisor).</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <XCircle className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay motivos activos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((m) => (
            <div key={m.id_motivo} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-200">{m.descripcion_motivo}</p>
              {m.visible_cliente && (
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 inline-flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Visible al cliente
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
