/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/page.js
 * DESCRIPCIÓN: Vista principal del panel de ADMINISTRACIÓN.
 * FUNCIONALIDAD: Muestra KPIs (indicadores clave), cartera total activa
 *                y las últimas 5 solicitudes de crédito recibidas.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { ClipboardList, Users, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import AnalyticsSection from '@/components/AnalyticsSection'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Todas las consultas del panel en paralelo (un solo round-trip lógico)
  const [
    { count: totalSolicitudes },
    { count: pendientes },
    { count: totalClientes },
    { count: creditosActivos },
    { data: recientes },
    { data: cartera },
    { count: cuotasVencidas },
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
  ])

  const totalCartera = cartera?.reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0) || 0

  // CONFIGURACIÓN DE LAS TARJETAS KPI
  // Para agregar un KPI nuevo: agrega un objeto con { label, value, icon, color, href }
  // color: combina 'text-' + 'bg-' de Tailwind, ej: 'text-purple-500 bg-purple-500/10'
  const kpis = [
    { label: 'Solicitudes pendientes', value: pendientes || 0,      icon: Clock,          color: 'text-yellow-500 bg-yellow-500/10', href: '/admin/solicitudes' },
    { label: 'Clientes registrados',   value: totalClientes || 0,   icon: Users,          color: 'text-blue-500 bg-blue-500/10',     href: '/admin/clientes'    },
    { label: 'Créditos activos',       value: creditosActivos || 0, icon: TrendingUp,     color: 'text-emerald-500 bg-emerald-500/10',href: '/admin/solicitudes'},
    { label: 'Cuotas vencidas',        value: cuotasVencidas || 0,  icon: AlertTriangle,  color: 'text-red-500 bg-red-500/10',       href: '/admin/solicitudes' },
  ]

  return (
    // CONTENEDOR PRINCIPAL — fondo oscuro heredado del layout admin
    // gap-8 (32px entre secciones), pb-10 (40px abajo)
    <div className="flex flex-col gap-8 pb-10">

      {/* ── ENCABEZADO ──
          TÍTULO: text-3xl (30px), font-bold, text-white (blanco — sobre fondo oscuro del layout)
          SUBTÍTULO: text-slate-400 (gris claro), mt-1 (4px arriba) */}
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Panel de Administración</h1>
        <p className="text-slate-400 mt-1">Gestión de créditos y clientes PLURALL.</p>
      </header>

      {/* ── GRID DE KPIs ──
          COLUMNAS: 2 en móvil (grid-cols-2), 4 en desktop (lg:grid-cols-4)
          ESPACIO: gap-4 (16px) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, href }) => (
          // TARJETA KPI
          // COLOR DE FONDO: bg-slate-800 (gris oscuro — para cambiar: bg-slate-700, bg-zinc-800)
          // BORDE: border border-slate-700 (gris oscuro), hover:border-slate-600 (al hover más claro)
          // BORDES: rounded-2xl (16px), PADDING: p-5 (20px)
          <Link key={label} href={href} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-colors">
            {/* ÍCONO CONTENEDOR
                TAMAÑO: w-10 h-10 (40x40px), BORDES: rounded-xl (12px)
                MARGEN INFERIOR: mb-3 (12px)
                color viene del objeto kpis: ej 'text-yellow-500 bg-yellow-500/10' */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              {/* ÍCONO — w-5 h-5 (20x20px) */}
              <Icon className="w-5 h-5" />
            </div>
            {/* VALOR NUMÉRICO — text-2xl (24px), font-extrabold (extra negrita), text-white (blanco) */}
            <p className="text-2xl font-extrabold text-white">{value.toLocaleString('es-CO')}</p>
            {/* ETIQUETA — text-sm (14px), text-slate-400 (gris claro), mt-0.5 (2px arriba) */}
            <p className="text-slate-400 text-sm mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── TARJETA CARTERA TOTAL ──
          COLOR DE FONDO: bg-gradient-to-br from-orange-500 to-orange-600 (degradado naranja)
          Para cambiar: from-blue-500 to-blue-600, from-emerald-500 to-emerald-600
          BORDES: rounded-2xl (16px), PADDING: p-6 (24px)
          SOMBRA: shadow-xl shadow-orange-500/20 (sombra naranja suave) */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/20">
        {/* ETIQUETA "Cartera total activa"
            COLOR: text-orange-100 (naranja muy claro, semi-transparente)
            TAMAÑO: text-sm (14px), uppercase, tracking-wide */}
        <p className="text-orange-100 text-sm font-medium uppercase tracking-wide mb-1">Cartera total activa</p>
        {/* MONTO — text-4xl (36px), font-extrabold (extra negrita), text-white */}
        <p className="text-4xl font-extrabold">{formatCOP(totalCartera)}</p>
        {/* SUBTÍTULO — text-orange-200 (naranja claro), text-sm (14px) */}
        <p className="text-orange-200 text-sm mt-1">{(creditosActivos || 0).toLocaleString()} crédito{creditosActivos !== 1 ? 's' : ''} activo{creditosActivos !== 1 ? 's' : ''}</p>
      </div>

      {/* ── PANEL DE ANALÍTICA (gráficas con filtros configurables) ── */}
      <section>
        <h2 className="text-xl font-bold text-white tracking-tight mb-4">Analítica e indicadores</h2>
        <AnalyticsSection accent="orange" />
      </section>

      {/* ── TABLA SOLICITUDES RECIENTES ──
          COLOR DE FONDO: bg-slate-800 (gris oscuro)
          BORDE: border border-slate-700
          BORDES: rounded-2xl (16px), overflow-hidden (recorta esquinas) */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">

        {/* ENCABEZADO DE LA TABLA
            BORDE INFERIOR: border-b border-slate-700
            PADDING: px-6 py-4 (24px horizontal, 16px vertical) */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          {/* TÍTULO "Solicitudes recientes"
              COLOR: text-white (blanco), font-semibold (semi-negrita)
              ÍCONO: text-orange-400 (naranja claro), w-4 h-4 (16x16px) */}
          <h2 className="font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-orange-400" /> Solicitudes recientes
          </h2>
          {/* ENLACE "Ver todas"
              COLOR: text-orange-400 (naranja claro), hover:text-orange-300 (más claro al hover)
              TAMAÑO: text-sm (14px) */}
          <Link href="/admin/solicitudes" className="text-orange-400 text-sm font-medium flex items-center gap-1 hover:text-orange-300">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* FILAS DE SOLICITUDES — divide-y divide-slate-700/50 (líneas divisorias grises) */}
        <div className="divide-y divide-slate-700/50">
          {recientes?.map((sol) => {
            const estado = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
            const esPendiente = ['PENDIENTE', 'EN_ESTUDIO'].includes(estado)
            return (
              // FILA DE SOLICITUD
              // HOVER: hover:bg-slate-700/40 (fondo gris oscuro semi-transparente al hover)
              // PADDING: px-6 py-4 (24px horizontal, 16px vertical)
              <Link
                key={sol.id_solicitud}
                href={`/admin/solicitudes/${sol.id_solicitud}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-700/40 transition-colors"
              >
                <div>
                  {/* NOMBRE DEL CLIENTE — text-slate-200 (gris muy claro), font-semibold, text-sm */}
                  <p className="font-semibold text-slate-200 text-sm">{sol.cliente?.nombre_completo || 'Cliente'}</p>
                  {/* MONTO Y PLAZO — text-slate-500 (gris), text-xs (12px) */}
                  <p className="text-slate-500 text-xs">
                    {formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses
                  </p>
                </div>
                {/* BADGE DE ESTADO
                    PENDIENTE/EN_ESTUDIO: bg-yellow-500/10 text-yellow-400 (amarillo transparente)
                    APROBADA/DESEMBOLSADA: bg-emerald-500/10 text-emerald-400 (verde transparente)
                    RECHAZADA/CANCELADA: bg-red-500/10 text-red-400 (rojo transparente)
                    PADDING: px-2.5 py-1, BORDES: rounded-full
                    TAMAÑO FUENTE: text-xs (12px), font-semibold */}
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
          {/* MENSAJE VACÍO — text-slate-500 (gris), py-8 (32px vertical), text-sm */}
          {(!recientes || recientes.length === 0) && (
            <p className="text-center text-slate-500 py-8 text-sm">Sin solicitudes aún.</p>
          )}
        </div>
      </div>
    </div>
  )
}
