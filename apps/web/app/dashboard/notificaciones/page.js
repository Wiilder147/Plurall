/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/notificaciones/page.js
 * DESCRIPCIÓN: Módulo "Notificaciones" (USUARIO / cliente).
 * FUNCIONALIDAD: Muestra las notificaciones del cliente autenticado sobre su
 *                crédito, pagos y solicitudes.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Bell, Mail } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NotificacionesUsuarioPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: cliente } = await supabase
    .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

  let notifs = []
  if (cliente?.id_cliente) {
    const { data } = await supabase
      .from('notificacion')
      .select('id_notificacion, canal, asunto, cuerpo, estado_envio, created_at, tipo_notificacion ( nombre )')
      .eq('id_cliente', cliente.id_cliente)
      .order('created_at', { ascending: false })
      .limit(50)
    notifs = data ?? []
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Bell className="w-7 h-7 text-orange-500" /> Notificaciones
        </h1>
        <p className="text-slate-500 mt-1">Avisos sobre tu crédito, pagos y solicitudes.</p>
      </header>

      {notifs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-100">
          <Bell className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No tienes notificaciones por ahora.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifs.map((n) => {
            const fecha = new Date(n.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={n.id_notificacion} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{n.asunto || n.tipo_notificacion?.nombre || 'Notificación'}</p>
                  {n.cuerpo && <p className="text-slate-500 text-sm mt-1 line-clamp-2">{n.cuerpo}</p>}
                  <p className="text-xs text-slate-400 mt-2">{fecha}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
