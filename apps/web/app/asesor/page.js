import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import {
  Users, AlertTriangle, CheckCircle2, PhoneCall,
  ArrowRight, Clock, DollarSign,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AsesorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Consultas en paralelo sin subconsultas anidadas ───────────────────────────
  const hoy = new Date().toISOString().split('T')[0]

  const [
    { data: perfil },
    { data: asignaciones },
    { count: gestionesHoy },
    { data: promesas },
  ] = await Promise.all([
    supabase.from('perfil_usuario').select('nombre_completo').eq('id', user.id).single(),
    supabase.from('asignacion_asesor')
      .select(`
        id_asignacion,
        cliente (
          id_cliente, nombre_completo, dni, telefono,
          credito ( id_credito, estado_credito, saldo_pendiente, cuotas_en_mora, dias_mora_maximo )
        )
      `)
      .eq('id_asesor', user.id)
      .eq('activa', true),
    supabase.from('gestion_cobranza')
      .select('*', { count: 'exact', head: true })
      .eq('id_asesor', user.id)
      .gte('fecha_gestion', `${hoy}T00:00:00`),
    supabase.from('gestion_cobranza')
      .select('id_gestion, monto_prometido, fecha_promesa, cliente(nombre_completo, telefono)')
      .eq('id_asesor', user.id)
      .eq('resultado', 'PROMESA')
      .gte('fecha_promesa', hoy)
      .order('fecha_promesa', { ascending: true })
      .limit(5),
  ])

  const primerNombre = perfil?.nombre_completo?.split(' ')[0] ?? 'Asesor'
  const clientes     = asignaciones?.map(a => a.cliente).filter(Boolean) ?? []

  const enMora = clientes.filter(c =>
    c.credito?.some(cr => cr.estado_credito === 'EN_MORA')
  )
  const alDia = clientes.filter(c =>
    c.credito?.some(cr => cr.estado_credito === 'ACTIVO') &&
    !c.credito?.some(cr => cr.estado_credito === 'EN_MORA')
  )
  const saldoTotal = clientes.reduce((s, c) => {
    const cr = c.credito?.find(cr => ['ACTIVO','EN_MORA'].includes(cr.estado_credito))
    return s + (cr?.saldo_pendiente ?? 0)
  }, 0)

  // Top 5 mora crítica de la cartera del asesor
  const moraCritica = enMora
    .map(c => ({ ...c, creditoMora: c.credito?.find(cr => cr.estado_credito === 'EN_MORA') }))
    .sort((a, b) => (b.creditoMora?.dias_mora_maximo ?? 0) - (a.creditoMora?.dias_mora_maximo ?? 0))
    .slice(0, 5)

  const kpis = [
    { label: 'Clientes asignados',  value: clientes.length,       icon: Users,         color: 'text-teal-400 bg-teal-500/10',      href: '/asesor/clientes'  },
    { label: 'En mora',             value: enMora.length,         icon: AlertTriangle, color: 'text-red-400 bg-red-500/10',        href: '/asesor/cobranza'  },
    { label: 'Al día',              value: alDia.length,          icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/10',href: '/asesor/clientes'  },
    { label: 'Gestiones hoy',       value: gestionesHoy ?? 0,     icon: PhoneCall,     color: 'text-blue-400 bg-blue-500/10',      href: '/asesor/gestiones' },
    { label: 'Saldo en cartera',    value: formatCOP(saldoTotal),  icon: DollarSign,    color: 'text-orange-400 bg-orange-500/10',  href: '/asesor/clientes'  },
    { label: 'Promesas pendientes', value: promesas?.length ?? 0,  icon: Clock,         color: 'text-yellow-400 bg-yellow-500/10',  href: '/asesor/gestiones' },
  ]

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Hola, {primerNombre} 👋</h1>
        <p className="text-slate-400 mt-1">Tu panel de gestión de cobranza y seguimiento de clientes.</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-teal-600/40 transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-extrabold text-white">
              {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mora crítica */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Mora crítica
            </h2>
            <Link href="/asesor/cobranza" className="text-teal-400 text-xs font-medium flex items-center gap-1 hover:text-teal-300">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {moraCritica.length === 0 ? (
            <p className="text-center text-slate-500 py-8 text-sm">Sin clientes en mora. ✓</p>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {moraCritica.map((c) => (
                <Link key={c.id_cliente} href={`/asesor/cobranza/${c.id_cliente}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-700/40 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-200 text-sm">{c.nombre_completo}</p>
                    <p className="text-slate-500 text-xs">{c.telefono}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-bold text-sm">{c.creditoMora?.dias_mora_maximo}d mora</p>
                    <p className="text-slate-500 text-xs">{formatCOP(c.creditoMora?.saldo_pendiente)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Promesas de pago */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" /> Promesas de pago pendientes
            </h2>
            <Link href="/asesor/gestiones" className="text-teal-400 text-xs font-medium flex items-center gap-1 hover:text-teal-300">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!promesas?.length ? (
            <p className="text-center text-slate-500 py-8 text-sm">Sin promesas pendientes.</p>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {promesas.map((p) => (
                <div key={p.id_gestion} className="flex items-center justify-between px-5 py-3.5">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
