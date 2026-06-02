/* ==========================================================================
 * ARCHIVO: layout.js
 * RUTA: apps/web/app/dashboard/layout.js
 * DESCRIPCIÓN: Layout envolvente de todas las páginas del dashboard del CLIENTE.
 * FUNCIONALIDAD: Arma la estructura fija de dos columnas: sidebar izquierdo + contenido derecho.
 *                ForceLightMode fuerza el modo claro (sin importar el tema del sistema).
 * ========================================================================== */
import DashboardSidebar from '@/components/DashboardSidebar'
import ForceLightMode from '@/components/ForceLightMode'

export default function DashboardLayout({ children }) {
  return (
    // CONTENEDOR PRINCIPAL — flex horizontal (sidebar + contenido)
    // COLOR DE FONDO DE LA PÁGINA: bg-slate-50 (gris muy claro casi blanco)
    // Para cambiar el fondo general: bg-white, bg-gray-100, bg-slate-100
    // ALTURA: h-screen (100% de la pantalla)
    // overflow-hidden — evita scroll doble (el scroll va en el main)
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* COMPONENTE QUE FUERZA MODO CLARO — no tiene UI visible */}
      <ForceLightMode />

      {/* SIDEBAR IZQUIERDO — ocupa su ancho fijo (w-64 = 256px definido en DashboardSidebar.js) */}
      <DashboardSidebar />

      {/* ÁREA DE CONTENIDO PRINCIPAL (columna derecha)
          flex-1 — ocupa todo el espacio restante después del sidebar
          h-screen overflow-y-auto — scroll vertical en esta columna
          w-full — ancho completo en móvil (cuando el sidebar está oculto) */}
      <main className="flex-1 h-screen overflow-y-auto w-full relative">

        {/* DECORACIÓN DE FONDO — círculos borrosos decorativos
            CÍRCULO SUPERIOR DERECHO: naranja muy suave (bg-orange-400/5 = naranja 5% opacidad)
            TAMAÑO: w-[500px] h-[500px] (500x500px)
            DESENFOQUE: blur-3xl (desenfoque máximo)
            Para quitar la decoración: elimina estos dos divs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-400/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/3"></div>

        {/* CÍRCULO INFERIOR IZQUIERDO: azul muy suave (bg-blue-900/5 = azul 5% opacidad) */}
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-3xl -z-10 translate-y-1/3 -translate-x-1/4"></div>

        {/* CONTENEDOR DEL CONTENIDO DE LA PÁGINA
            PADDING: p-4 (16px) en móvil, md:p-8 (32px) en tablet, lg:px-12 (48px horizontal) en desktop
            ANCHO MÁXIMO: max-w-7xl (1280px), centrado con mx-auto
            MARGEN SUPERIOR: mt-12 en móvil (espacio para el hamburguesa), md:mt-0 en desktop */}
        <div className="w-full p-4 md:p-8 lg:px-12 max-w-7xl mx-auto mt-12 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
