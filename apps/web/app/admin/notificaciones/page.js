import { createClient } from '@/lib/supabase/server'
import StaffPageShell from '@/components/dashboard/StaffPageShell'
import { Bell } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminNotificacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: notifs } = await supabase
    .from('notificacion_staff')
    .select('*')
    .eq('id_usuario', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  await supabase.from('notificacion_staff').update({ leida: true }).eq('id_usuario', user.id).eq('leida', false)

  return (
    <StaffPageShell accent="orange" badge="Alertas" title="Notificaciones" subtitle="Alertas operativas del sistema.">
      {!notifs?.length ? (
        <p className="text-slate-500 text-center py-16">Sin notificaciones.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notifs.map(n => (
            <div key={n.id_notif} className={`dash-panel rounded-xl p-4 border ${n.leida ? 'border-slate-700/50 opacity-70' : 'border-orange-500/30'}`}>
              <p className="font-semibold text-slate-200 text-sm">{n.titulo}</p>
              {n.mensaje && <p className="text-slate-400 text-xs mt-1">{n.mensaje}</p>}
              <p className="text-slate-600 text-xs mt-2">{new Date(n.created_at).toLocaleString('es-CO')}</p>
            </div>
          ))}
        </div>
      )}
    </StaffPageShell>
  )
}
