/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/supervisor/page.js
 * DESCRIPCIÓN: Vista principal del panel del SUPERVISOR.
 * ========================================================================== */
import Link from 'next/link'
import { Search, ShieldCheck, Users, BarChart3, AlertTriangle } from 'lucide-react'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import QuickActions from '@/components/dashboard/QuickActions'
import SupervisorCharts from '@/components/SupervisorCharts'
import AnalyticsSection from '@/components/AnalyticsSection'

export const dynamic = 'force-dynamic'

export default async function SupervisorDashboard() {
  const quickActions = [
    { label: 'Aprobar créditos', href: '/supervisor/solicitudes', icon: ShieldCheck },
    { label: 'Desembolsos', href: '/supervisor/desembolsos', icon: BarChart3 },
    { label: 'Gestión mora', href: '/supervisor/mora', icon: AlertTriangle },
    { label: 'Asesores', href: '/supervisor/asesores', icon: Users },
  ]

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-10">
      <DashboardHeader
        accent="indigo"
        badge="Portal Supervisor"
        title="Panel Supervisor"
        subtitle="Visión ejecutiva de cartera, mora, originación y desembolsos."
        actions={
          <>
            <QuickActions accent="indigo" actions={quickActions.slice(0, 2)} />
            <Link
              href="/supervisor/buscar"
              className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 hover:border-indigo-500/50 text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl text-sm transition-all"
            >
              <Search className="w-4 h-4" /> Buscar cliente
            </Link>
          </>
        }
      />

      <QuickActions accent="indigo" actions={quickActions.slice(2)} />

      <SupervisorCharts />

      <section>
        <h2 className="text-lg font-bold text-white tracking-tight mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          Analítica detallada
        </h2>
        <AnalyticsSection accent="indigo" />
      </section>
    </div>
  )
}
