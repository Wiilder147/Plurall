/* ==========================================================================
 * ARCHIVO: layout.js
 * RUTA: apps/web/app/asesor/layout.js
 * DESCRIPCIÓN: Vista del panel para el rol de asesor.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AsesorSidebar from '@/components/AsesorSidebar'

export default async function AsesorLayout({ children }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('id_rol, rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol?.nombre_rol?.toUpperCase()

  // Solo ASESOR y ADMIN pueden acceder (el SUPERVISOR usa su propio panel)
  if (!['ASESOR', 'ADMIN'].includes(rol)) {
    redirect('/dashboard/inicio')
  }

  return (
    <div className="flex h-screen bg-teal-950 overflow-hidden">
      <AsesorSidebar esAdmin={rol === 'ADMIN'} />
      <main className="flex-1 h-screen overflow-y-auto bg-slate-950 w-full">
        <div className="w-full p-4 md:p-8 max-w-5xl mx-auto mt-12 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
