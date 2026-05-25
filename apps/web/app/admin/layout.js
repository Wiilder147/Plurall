/* ==========================================================================
 * ARCHIVO: layout.js
 * RUTA: apps/web/app/admin/layout.js
 * DESCRIPCIÓN: Vista del panel de administración.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'

export default async function AdminLayout({ children }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // Verificar que el usuario tenga rol ADMIN o ANALISTA
  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('id_rol, rol ( nombre_rol )')
    .eq('id', user.id)
    .single()

  const nombreRol = perfil?.rol?.nombre_rol?.toUpperCase()

  if (!perfil || !['ADMIN', 'ANALISTA'].includes(nombreRol)) {
    redirect('/dashboard/inicio')
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 h-screen overflow-y-auto w-full">
        <div className="w-full p-4 md:p-8 max-w-7xl mx-auto mt-12 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
