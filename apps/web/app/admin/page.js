import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { ClipboardList, Users, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // ── KPIs ─────────────────────────────────────────────────────
  const [
    { count: totalSolicitudes },
    { count: pendientes },
    { count: totalClientes },
    { count: creditosActivos },
  ] = await Promise.all([
    supabase.from('solicitud_credito').select('*', { count: 'exact', head: true }),
    supabase.from('solicitud_credito')
      .select('*', { count: 'exact', head: true })
      .in('estado_solicitud.nombre', ['PENDIENTE', 'EN_ESTUDIO'])
      .not('id_estado_solicitud', 'is', null),
    supabase.from('cliente').select('*', { count: 'exact', head: true }),
    supabase.from('credito')
      .select('*', { count: 'exact', head: true })
      .in('estado_credito', ['ACTIVO', 'EN_MORA']),
  ])

  // Solicitudes recientes (últimas 5)
  const { data: recientes } = await supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud,
      monto_solicitado,
      plazo_meses,
      fecha_solicitud,
      estado_solicitud ( nombre ),
      cliente ( nombre_completo )
    `)
    .order('fecha_solicitud', { ascending: false })
    .limit(5)

  // Cartera total
  const { data: cartera } = await supabase
    .from('credito')
    .select('saldo_pendiente')
    .in('estado_credito', ['ACTIVO', 'EN_MORA'])

  const totalCartera = cartera?.reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0) || 0

  // Cuotas vencidas
  const { count: cuotasVencidas } = await supabase
    .from('cuota')
    .select('*', { count: 'exact', head: true })
    .eq('estado_cuota', 'VENCIDA')

  const kpis = [
    { label: 'Solicitudes pendientes', value: pendientes || 0,      icon: Clock,          color: 'text-yellow-500 bg-yellow-500/10', href: '/admin/solicitudes' },
    { label: 'Clientes registrados',   value: totalClientes || 0,   icon: Users,          color: 'text-blue-500 bg-blue-500/10',     href: '/admin/clientes'    },
    { label: 'Créditos activos',       value: creditosActivos || 0, icon: TrendingUp,     color: 'text-emerald-500 bg-emerald-500/10',href: '/admin/solicitudes'},
    { label: 'Cuotas vencidas',        value: cuotasVencidas || 0,  icon: AlertTriangle,  color: 'text-red-500 bg-red-500/10',       href: '/admin/solicitudes' },
  ]

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Panel de Administración</h1>
        <p className="text-slate-400 mt-1">Gestión de créditos y clientes PLURALL.</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-extrabold text-white">{value.toLocaleString('es-CO')}</p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Cartera */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/20">
        <p className="text-orange-100 text-sm font-medium uppercase tracking-wide mb-1">Cartera total activa</p>
        <p className="text-4xl font-extrabold">{formatCOP(totalCartera)}</p>
        <p className="text-orange-200 text-sm mt-1">{(creditosActivos || 0).toLocaleString()} crédito{creditosActivos !== 1 ? 's' : ''} activo{creditosActivos !== 1 ? 's' : ''}</p>
      </div>

      {/* Solicitudes recientes */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-orange-400" /> Solicitudes recientes
          </h2>
          <Link href="/admin/solicitudes" className="text-orange-400 text-sm font-medium flex items-center gap-1 hover:text-orange-300">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-700/50">
          {recientes?.map((sol) => {
            const estado = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
            const esPendiente = ['PENDIENTE', 'EN_ESTUDIO'].includes(estado)
            return (
              <Link
                key={sol.id_solicitud}
                href={`/admin/solicitudes/${sol.id_solicitud}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-700/40 transition-colors"
              >
                <div>
                  <p className="font-semibold text-slate-200 text-sm">{sol.cliente?.nombre_completo || 'Cliente'}</p>
                  <p className="text-slate-500 text-xs">
                    {formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  esPendiente ? 'bg-yellow-500/10 text-yellow-400' :
                  estado === 'APROBADA' || estado === 'DESEMBOLSADA' ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {estado}
                </span>
              </Link>
            )
          })}
          {(!recientes || recientes.length === 0) && (
            <p className="text-center text-slate-500 py-8 text-sm">Sin solicitudes aún.</p>
          )}
        </div>
      </div>
    </div>
  )
}
