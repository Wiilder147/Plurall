/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/notificaciones/page.js
 * DESCRIPCIÓN: Módulo "Notificaciones" (ASESOR).
 * FUNCIONALIDAD: Historial de notificaciones enviadas a los clientes.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { Bell, Mail, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

const ESTADO = {
  ENVIADO:   { label: 'Enviado',   cls: 'bg-emerald-500/10 text-emerald-400', Icon: CheckCircle2 },
  PENDIENTE: { label: 'Pendiente', cls: 'bg-yellow-500/10 text-yellow-400',   Icon: Clock },
  FALLIDO:   { label: 'Fallido',   cls: 'bg-red-500/10 text-red-400',         Icon: XCircle },
  ERROR:     { label: 'Error',     cls: 'bg-red-500/10 text-red-400',         Icon: XCircle },
}

export default async function NotificacionesAsesorPage() {
  const supabase = await createClient()

  const { data: notifs } = await supabase
    .from('notificacion')
    .select(`
      id_notificacion, canal, destinatario, asunto, estado_envio, created_at,
      tipo_notificacion ( nombre ),
      cliente(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const lista = notifs ?? []

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Bell className="w-7 h-7 text-teal-400" /> Notificaciones
        </h1>
        <p className="text-slate-400 mt-1">Historial de notificaciones enviadas a los clientes.</p>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">No hay notificaciones registradas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((n) => {
            const est = ESTADO[n.estado_envio?.toUpperCase()] || ESTADO.PENDIENTE
            const fecha = new Date(n.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={n.id_notificacion} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 bg-teal-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-200 text-sm truncate">{n.asunto || n.tipo_notificacion?.nombre || 'Notificación'}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${est.cls}`}>
                      <est.Icon className="w-3 h-3" /> {est.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                    <span>{formatNombre(n.cliente) || (n.destinatario ?? '—')}</span>
                    <span className="uppercase">{n.canal ?? 'EMAIL'}</span>
                    <span>{fecha}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
