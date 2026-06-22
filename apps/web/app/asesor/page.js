/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/asesor/page.js
 * DESCRIPCIÓN: Vista principal del panel del ASESOR de cobranza.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import KpiCard, { KpiGrid } from '@/components/dashboard/KpiCard'
import DashboardPanel, { PanelList, PanelRow } from '@/components/dashboard/DashboardPanel'
import QuickActions from '@/components/dashboard/QuickActions'
import HeroMetric from '@/components/dashboard/HeroMetric'
import ProgressRing from '@/components/dashboard/ProgressRing'
import {
  Users, AlertTriangle, CheckCircle2, PhoneCall,
  Clock, DollarSign, FileCheck, Wallet, UserPlus,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AsesorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const hoy = new Date().toISOString().split('T')[0]

  const [
    { data: perfil },
    { data: asignaciones },
    { count: gestionesHoy },
    { data: promesas },
    { data: solsPendientes },
  ] = await Promise.all([
    supabase.from('perfil_usuario').select('nombre_completo').eq('id', user.id).single(),
    supabase.from('asignacion_asesor')
      .select(`id_asignacion, cliente ( id_cliente, nombre_completo, dni, telefono,
        credito ( id_credito, estado_credito, saldo_pendiente, cuotas_en_mora, dias_mora_maximo ) )`)
      .eq('id_asesor', user.id).eq('activa', true),
    supabase.from('gestion_cobranza').select('*', { count: 'exact', head: true })
      .eq('id_asesor', user.id).gte('fecha_gestion', `${hoy}T00:00:00`),
    supabase.from('gestion_cobranza')
      .select('id_gestion, monto_prometido, fecha_promesa, cliente(nombre_completo, telefono)')
      .eq('id_asesor', user.id).eq('resultado', 'PROMESA')
      .gte('fecha_promesa', hoy).order('fecha_promesa', { ascending: true }).limit(5),
    supabase.from('solicitud_credito')
      .select('id_solicitud, estado_solicitud!inner ( nombre )').eq('estado_solicitud.nombre', 'PENDIENTE'),
  ])

  const primerNombre = perfil?.nombre_completo?.split(' ')[0] ?? 'Asesor'
  const clientes = asignaciones?.map(a => a.cliente).filter(Boolean) ?? []
  const enMora = clientes.filter(c => c.credito?.some(cr => cr.estado_credito === 'EN_MORA'))
  const alDia = clientes.filter(c =>
    c.credito?.some(cr => cr.estado_credito === 'ACTIVO') &&
    !c.credito?.some(cr => cr.estado_credito === 'EN_MORA')
  )
  const saldoTotal = clientes.reduce((s, c) => {
    const cr = c.credito?.find(cr => ['ACTIVO', 'EN_MORA'].includes(cr.estado_credito))
    return s + (cr?.saldo_pendiente ?? 0)
  }, 0)

  const moraCritica = enMora
    .map(c => ({ ...c, creditoMora: c.credito?.find(cr => cr.estado_credito === 'EN_MORA') }))
    .sort((a, b) => (b.creditoMora?.dias_mora_maximo ?? 0) - (a.creditoMora?.dias_mora_maximo ?? 0))
    .slice(0, 5)

  const kpis = [
    { label: 'Sol. por revisar', value: solsPendientes?.length ?? 0, icon: FileCheck, color: 'text-violet-400 bg-violet-500/10', href: '/asesor/solicitudes' },
    { label: 'Clientes asignados', value: clientes.length, icon: Users, color: 'text-teal-400 bg-teal-500/10', href: '/asesor/clientes' },
    { label: 'En mora', value: enMora.length, icon: AlertTriangle, color: 'text-red-400 bg-red-500/10', href: '/asesor/cobranza' },
    { label: 'Al día', value: alDia.length, icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10', href: '/asesor/clientes' },
    { label: 'Gestiones hoy', value: gestionesHoy ?? 0, icon: PhoneCall, color: 'text-blue-400 bg-blue-500/10', href: '/asesor/gestiones' },
    { label: 'Promesas pendientes', value: promesas?.length ?? 0, icon: Clock, color: 'text-yellow-400 bg-yellow-500/10', href: '/asesor/gestiones' },
  ]

  const quickActions = [
    { label: 'Cola de cobranza', href: '/asesor/cobranza', icon: AlertTriangle },
    { label: 'Registrar gestión', href: '/asesor/gestiones', icon: PhoneCall },
    { label: 'Preaprobación', href: '/asesor/preaprobacion', icon: CheckCircle2 },
    { label: 'Registrar pago', href: '/asesor/pagos', icon: Wallet },
  ]

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-10">
      <DashboardHeader
        accent="teal"
        badge="Portal Asesor"
        title={`Hola, ${primerNombre}`}
        subtitle="Gestión de cobranza, seguimiento de clientes y promesas de pago."
        actions={
          <QuickActions accent="teal" actions={[
            { label: 'Mis clientes', href: '/asesor/clientes', icon: Users },
            { label: 'Cobranza', href: '/asesor/cobranza', icon: AlertTriangle },
          ]} />
        }
      />

      <KpiGrid cols={3}>
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.label} {...kpi} accent="teal" index={i} />
        ))}
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HeroMetric
            accent="teal"
            label="Saldo en cartera asignada"
            value={formatCOP(saldoTotal)}
            sublabel={`${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} bajo tu gestión`}
            stats={[
              { label: 'al día', value: alDia.length, highlight: false },
              { label: '·', value: '', highlight: false },
              { label: 'en mora', value: enMora.length, highlight: true },
            ]}
          />
        </div>
        <div className="dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 flex flex-col items-center justify-center">
          <ProgressRing
            value={alDia.length}
            max={clientes.length || 1}
            label="Cartera al día"
            sublabel={`${alDia.length} de ${clientes.length} clientes`}
            color="#14b8a6"
          />
        </div>
      </div>

      <QuickActions accent="teal" actions={quickActions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardPanel
          accent="teal"
          title="Mora crítica"
          icon={AlertTriangle}
          iconColor="text-red-400"
          href="/asesor/cobranza"
          isEmpty={moraCritica.length === 0}
          empty="Sin clientes en mora. Excelente trabajo."
        >
          <PanelList>
            {moraCritica.map((c) => (
              <PanelRow key={c.id_cliente} href={`/asesor/cobranza/${c.id_cliente}`}>
                <div>
                  <p className="font-semibold text-slate-200 text-sm">{c.nombre_completo}</p>
                  <p className="text-slate-500 text-xs">{c.telefono}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-bold text-sm">{c.creditoMora?.dias_mora_maximo}d mora</p>
                  <p className="text-slate-500 text-xs">{formatCOP(c.creditoMora?.saldo_pendiente)}</p>
                </div>
              </PanelRow>
            ))}
          </PanelList>
        </DashboardPanel>

        <DashboardPanel
          accent="teal"
          title="Promesas de pago pendientes"
          icon={Clock}
          iconColor="text-yellow-400"
          href="/asesor/gestiones"
          linkLabel="Ver todas"
          isEmpty={!promesas?.length}
          empty="Sin promesas pendientes para hoy."
        >
          <PanelList>
            {promesas?.map((p) => (
              <PanelRow key={p.id_gestion}>
                <div>
                  <p className="font-semibold text-slate-200 text-sm">{p.cliente?.nombre_completo}</p>
                  <p className="text-slate-500 text-xs">{p.cliente?.telefono}</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400 font-bold text-sm">{formatCOP(p.monto_prometido)}</p>
                  <p className="text-slate-500 text-xs">
                    {p.fecha_promesa
                      ? new Date(p.fecha_promesa + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                      : '—'}
                  </p>
                </div>
              </PanelRow>
            ))}
          </PanelList>
        </DashboardPanel>
      </div>

      {(solsPendientes?.length ?? 0) > 0 && (
        <DashboardPanel
          accent="teal"
          title="Solicitudes pendientes de revisión"
          icon={UserPlus}
          iconColor="text-violet-400"
          href="/asesor/solicitudes"
        >
          <PanelList>
            <PanelRow href="/asesor/solicitudes">
              <p className="text-slate-300 text-sm">
                Tienes <span className="font-bold text-violet-400">{solsPendientes.length}</span> solicitud{solsPendientes.length !== 1 ? 'es' : ''} esperando tu revisión.
              </p>
              <span className="text-teal-400 text-xs font-medium">Revisar →</span>
            </PanelRow>
          </PanelList>
        </DashboardPanel>
      )}
    </div>
  )
}
