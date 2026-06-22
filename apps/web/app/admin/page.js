/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/page.js
 * DESCRIPCIÓN: Vista principal del panel de ADMINISTRACIÓN.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import KpiCard, { KpiGrid } from '@/components/dashboard/KpiCard'
import DashboardPanel, { PanelList, PanelRow } from '@/components/dashboard/DashboardPanel'
import QuickActions from '@/components/dashboard/QuickActions'
import HeroMetric from '@/components/dashboard/HeroMetric'
import StatusBadge from '@/components/dashboard/StatusBadge'
import AnalyticsSection from '@/components/AnalyticsSection'
import {
  ClipboardList, Users, TrendingUp, AlertTriangle,
  Clock, BarChart3, ShieldCheck, Headset,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: perfil },
    { count: pendientes },
    { count: totalClientes },
    { count: creditosActivos },
    { data: recientes },
    { data: cartera },
    { count: cuotasVencidas },
    { count: totalSolicitudes },
  ] = await Promise.all([
    supabase.from('perfil_usuario').select('nombre_completo').eq('id', user.id).single(),
    supabase.from('solicitud_credito')
      .select('*', { count: 'exact', head: true })
      .in('estado_solicitud.nombre', ['PENDIENTE', 'EN_ESTUDIO'])
      .not('id_estado_solicitud', 'is', null),
    supabase.from('cliente').select('*', { count: 'exact', head: true }),
    supabase.from('credito')
      .select('*', { count: 'exact', head: true })
      .in('estado_credito', ['ACTIVO', 'EN_MORA']),
    supabase.from('solicitud_credito')
      .select(`
        id_solicitud, monto_solicitado, plazo_meses, fecha_solicitud,
        estado_solicitud ( nombre ),
        cliente ( nombre_completo )
      `)
      .order('fecha_solicitud', { ascending: false })
      .limit(5),
    supabase.from('credito').select('saldo_pendiente').in('estado_credito', ['ACTIVO', 'EN_MORA']),
    supabase.from('cuota').select('*', { count: 'exact', head: true }).eq('estado_cuota', 'VENCIDA'),
    supabase.from('solicitud_credito').select('*', { count: 'exact', head: true }),
  ])

  const totalCartera = cartera?.reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0) || 0
  const primerNombre = perfil?.nombre_completo?.split(' ')[0] ?? 'Admin'

  const kpis = [
    { label: 'Solicitudes pendientes', value: pendientes || 0, icon: Clock, color: 'text-yellow-500 bg-yellow-500/10', href: '/admin/solicitudes' },
    { label: 'Clientes registrados', value: totalClientes || 0, icon: Users, color: 'text-blue-500 bg-blue-500/10', href: '/admin/clientes' },
    { label: 'Créditos activos', value: creditosActivos || 0, icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10', href: '/admin/solicitudes' },
    { label: 'Cuotas vencidas', value: cuotasVencidas || 0, icon: AlertTriangle, color: 'text-red-500 bg-red-500/10', href: '/admin/reportes' },
  ]

  const quickActions = [
    { label: 'Solicitudes', href: '/admin/solicitudes', icon: ClipboardList },
    { label: 'Clientes', href: '/admin/clientes', icon: Users },
    { label: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
    { label: 'Supervisor', href: '/supervisor', icon: ShieldCheck },
    { label: 'Asesor', href: '/asesor', icon: Headset },
  ]

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-10">
      <DashboardHeader
        accent="orange"
        badge="Panel Administrativo"
        title={`Bienvenido, ${primerNombre}`}
        subtitle="Visión ejecutiva de la operación crediticia PLURALL."
        actions={
          <Link
            href="/admin/reportes"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border bg-orange-500/15 text-orange-300 border-orange-500/25 hover:bg-orange-500/25 transition-all"
          >
            <BarChart3 className="w-4 h-4" /> Exportar reportes
          </Link>
        }
      />

      <KpiGrid cols={4}>
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} {...kpi} accent="orange" index={i} />
        ))}
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HeroMetric
            accent="orange"
            label="Cartera total activa"
            value={formatCOP(totalCartera)}
            sublabel={`${(creditosActivos || 0).toLocaleString()} crédito${creditosActivos !== 1 ? 's' : ''} en curso`}
            stats={[
              { label: 'solicitudes totales', value: (totalSolicitudes || 0).toLocaleString(), highlight: false },
              { label: '·', value: '', highlight: false },
              { label: 'pendientes', value: (pendientes || 0).toLocaleString(), highlight: true },
            ]}
          />
        </div>
        <div className="dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 flex flex-col justify-center gap-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Accesos rápidos</p>
          <QuickActions accent="orange" actions={quickActions.slice(0, 3)} />
          <div className="pt-2 border-t border-slate-700/50">
            <QuickActions accent="orange" actions={quickActions.slice(3)} />
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-white tracking-tight mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-400" />
          Analítica e indicadores
        </h2>
        <AnalyticsSection accent="orange" />
      </section>

      <DashboardPanel
        accent="orange"
        title="Solicitudes recientes"
        icon={ClipboardList}
        iconColor="text-orange-400"
        href="/admin/solicitudes"
        linkLabel="Ver todas"
        isEmpty={!recientes?.length}
        empty="Sin solicitudes registradas aún."
      >
        <PanelList>
          {recientes?.map((sol) => {
            const estado = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
            return (
              <PanelRow key={sol.id_solicitud} href={`/admin/solicitudes/${sol.id_solicitud}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 text-sm truncate">
                    {sol.cliente?.nombre_completo || 'Cliente'}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {formatCOP(sol.monto_solicitado)} · {sol.plazo_meses} meses
                    {sol.fecha_solicitud && (
                      <> · {new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</>
                    )}
                  </p>
                </div>
                <StatusBadge estado={estado} />
              </PanelRow>
            )
          })}
        </PanelList>
      </DashboardPanel>
    </div>
  )
}
