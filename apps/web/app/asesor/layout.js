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

  // Solo ASESOR y ADMIN pueden acceder
  if (!['ASESOR', 'ADMIN', 'SUPERVISOR'].includes(rol)) {
    redirect('/dashboard/inicio')
  }

  return (
    <div className="flex h-screen bg-teal-950 overflow-hidden">
      <AsesorSidebar />
      <main className="flex-1 h-screen overflow-y-auto bg-slate-950">
        <div className="p-4 md:p-8 max-w-5xl mx-auto mt-12 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
