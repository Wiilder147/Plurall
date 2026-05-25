/* ==========================================================================
 * ARCHIVO: layout.js
 * RUTA: apps/web/app/supervisor/layout.js
 * DESCRIPCIÓN: Vista del panel para el rol de supervisor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SupervisorSidebar from '@/components/SupervisorSidebar'

export default async function SupervisorLayout({ children }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('id_rol, rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()

  // SUPERVISOR y ADMIN pueden acceder
  if (!['SUPERVISOR', 'ADMIN'].includes(rol)) {
    redirect('/dashboard/inicio')
  }

  return (
    <div className="flex h-screen bg-indigo-950 overflow-hidden">
      <SupervisorSidebar />
      <main className="flex-1 h-screen overflow-y-auto bg-slate-950 w-full">
        <div className="w-full p-4 md:p-8 max-w-7xl mx-auto mt-12 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
