/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/page.js
 * DESCRIPCIÓN: Vista principal del panel del SUPERVISOR.
 * FUNCIONALIDAD: Muestra el header con botón de búsqueda y delega las
 *                gráficas al componente cliente SupervisorCharts.js
 *                (que carga los datos dinámicamente desde el browser).
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search } from 'lucide-react'
import SupervisorCharts from '@/components/SupervisorCharts'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'

export const dynamic = 'force-dynamic'

export default async function SupervisorDashboard() {
  const supabase = await createClient()
  await supabase.auth.getUser()

  return (
    // CONTENEDOR — fondo oscuro heredado del layout supervisor (indigo)
    // gap-6 (24px entre secciones), pb-10 (40px abajo)
    <div className="flex flex-col gap-6 pb-10">

      {/* ── ENCABEZADO CON BOTÓN DE BÚSQUEDA ──
          DISPOSICIÓN: columna en móvil, fila con alineación en sm+
          ESPACIO: gap-4 (16px) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {/* TÍTULO "Panel Supervisor"
              COLOR: text-white (blanco sobre fondo oscuro del layout)
              TAMAÑO: text-3xl (30px), font-bold (negrita), tracking-tight */}
          <h1 className="text-3xl font-bold text-white tracking-tight">Panel Supervisor</h1>
          {/* SUBTÍTULO — text-slate-400 (gris claro), mt-1 (4px arriba) */}
          <p className="text-slate-400 mt-1">Visión ejecutiva de cartera, mora y solicitudes.</p>
        </div>

        {/* BOTÓN "Buscar cliente…"
            COLOR FONDO: bg-slate-800 (gris oscuro)
            BORDE: border border-slate-700 (gris oscuro), hover:border-indigo-500/50 (indigo al hover)
            COLOR TEXTO: text-slate-400, hover:text-slate-200 (más claro al hover)
            PADDING: px-4 py-2.5 (16px horizontal, 10px vertical)
            BORDES: rounded-xl (12px)
            TAMAÑO: text-sm (14px)
            ÍCONO: w-4 h-4 (16x16px) */}
        <Link href="/supervisor/buscar"
          className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl text-sm transition-all">
          <Search className="w-4 h-4" /> Buscar cliente…
        </Link>
      </div>

      {/* ── PANEL DE GRÁFICAS (Componente Cliente) ──
          SupervisorCharts.js carga los datos desde el browser con fetch.
          Las gráficas, colores y tamaños se modifican en: components/SupervisorCharts.js */}
      <SupervisorCharts />

      {/* ── ANALÍTICA AMPLIADA (asesores, zonas, PQR, comparativas) ── */}
      <section>
        <h2 className="text-xl font-bold text-white tracking-tight mb-4 mt-2">Analítica detallada</h2>
        <AnalyticsDashboard accent="indigo" />
      </section>
    </div>
  )
}
