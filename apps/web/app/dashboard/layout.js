/* ==========================================================================
 * ARCHIVO: layout.js
 * RUTA: apps/web/app/dashboard/layout.js
 * DESCRIPCIÓN: Vista del panel de control del usuario.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import DashboardSidebar from '@/components/DashboardSidebar'
import ForceLightMode from '@/components/ForceLightMode'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <ForceLightMode />
      <DashboardSidebar />
      <main className="flex-1 h-screen overflow-y-auto w-full relative">
        {/* Decoración de fondo simple */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-400/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-3xl -z-10 translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="w-full p-4 md:p-8 lg:px-12 max-w-7xl mx-auto mt-12 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
