/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/motivos-rechazo/page.js
 * DESCRIPCIÓN: Módulo "Motivos de rechazo" (SUPERVISOR).
 * FUNCIONALIDAD: Administra el catálogo de motivos de rechazo: crear nuevos y
 *                activar/desactivar los existentes.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { XCircle } from 'lucide-react'
import GestionMotivos from './GestionMotivos'

export const dynamic = 'force-dynamic'

export default async function MotivosRechazoPage() {
  const supabase = await createClient()

  const { data: motivos } = await supabase
    .from('motivo_rechazo')
    .select('id_motivo, descripcion_motivo, visible_cliente, activo, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <XCircle className="w-7 h-7 text-indigo-400" /> Motivos de rechazo
        </h1>
        <p className="text-slate-400 mt-1">Catálogo de motivos usados al rechazar solicitudes de crédito.</p>
      </header>

      <GestionMotivos motivosIniciales={motivos ?? []} />
    </div>
  )
}
