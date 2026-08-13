/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/admin/solicitudes/page.js
 * DESCRIPCIÓN: Vista de listado de solicitudes de crédito para el ADMIN.
 * FUNCIONALIDAD: Muestra todas las solicitudes con filtros por estado (tabs).
 *                Cada fila es un enlace al detalle de la solicitud.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { ArrowRight, Clock, CheckCircle2, XCircle, Hourglass, TrendingUp, Search } from 'lucide-react'
import { formatNombre } from '@/lib/nombre'

export const dynamic = 'force-dynamic'

// MAPA DE ESTILOS PARA CADA ESTADO DE SOLICITUD
// Para cambiar el color de un estado: modifica la propiedad 'color'
// Formato: 'bg-[color]-500/10 text-[color]-400' (fondo transparente + texto)
const ESTADO_UI = {
  PENDIENTE:    { label: 'Pendiente',   color: 'bg-yellow-500/10 text-yellow-400',   icon: Clock       },
  EN_ESTUDIO:   { label: 'En estudio',  color: 'bg-blue-500/10 text-blue-400',       icon: Hourglass   },
  APROBADA:     { label: 'Aprobada',    color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2},
  DESEMBOLSADA: { label: 'Activa',      color: 'bg-green-500/10 text-green-400',     icon: TrendingUp  },
  RECHAZADA:    { label: 'Rechazada',   color: 'bg-red-500/10 text-red-400',         icon: XCircle     },
  CANCELADA:    { label: 'Cancelada',   color: 'bg-slate-500/10 text-slate-400',     icon: XCircle     },
}

export default async function AdminSolicitudesPage({ searchParams }) {
  const supabase = await createClient()
  const params   = await searchParams
  const filtro   = params?.estado?.toUpperCase() || 'TODOS'

  let query = supabase
    .from('solicitud_credito')
    .select(`
      id_solicitud, monto_solicitado, plazo_meses, proposito, fecha_solicitud,
      estado_solicitud ( nombre ),
      cliente ( primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dni, telefono )
    `)
    .order('fecha_solicitud', { ascending: false })

  const { data: todas } = await query

  const solicitudes = filtro === 'TODOS'
    ? todas || []
    : (todas || []).filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === filtro)

  const tabs = [
    { key: 'TODOS',      label: 'Todas',       count: todas?.length || 0 },
    { key: 'PENDIENTE',  label: 'Pendientes',  count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'PENDIENTE').length || 0 },
    { key: 'EN_ESTUDIO', label: 'En estudio',  count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'EN_ESTUDIO').length || 0 },
    { key: 'APROBADA',   label: 'Aprobadas',   count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'APROBADA').length || 0 },
    { key: 'RECHAZADA',  label: 'Rechazadas',  count: todas?.filter((s) => s.estado_solicitud?.nombre?.toUpperCase() === 'RECHAZADA').length || 0 },
  ]

  return (
    // CONTENEDOR — fondo oscuro heredado del layout admin
    <div className="flex flex-col gap-6 pb-10">

      {/* ── ENCABEZADO ──
          TÍTULO: text-3xl (30px), text-white (blanco sobre fondo oscuro)
          SUBTÍTULO: text-slate-400 (gris claro) */}
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Solicitudes de Crédito</h1>
        <p className="text-slate-400 mt-1">Revisa, aprueba o rechaza las solicitudes de los clientes.</p>
      </header>

      {/* ── TABS DE FILTRO ──
          DISPOSICIÓN: flex gap-2 flex-wrap (fila con salto de línea en móvil) */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, count }) => (
          // TAB INDIVIDUAL
          // ESTADO ACTIVO: bg-orange-500 text-white shadow-md shadow-orange-500/20 (naranja sólido)
          // ESTADO INACTIVO: bg-slate-800 text-slate-400 hover:bg-slate-700 (gris oscuro)
          // Para cambiar el COLOR ACTIVO: reemplaza 'bg-orange-500' por otro color
          // PADDING: px-4 py-2 (16px horizontal, 8px vertical)
          // BORDES: rounded-xl (12px), TAMAÑO FUENTE: text-sm (14px)
          <Link
            key={key}
            href={`/admin/solicitudes${key === 'TODOS' ? '' : `?estado=${key.toLowerCase()}`}`}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtro === key
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {label}
            {/* CONTADOR DEL TAB (visible si count > 0)
                COLOR FONDO: bg-slate-900/40 (casi negro semi-transparente)
                PADDING: px-1.5 py-0.5, BORDES: rounded-full
                TAMAÑO: text-xs (12px) */}
            {count > 0 && (
              <span className="ml-2 bg-slate-900/40 text-xs px-1.5 py-0.5 rounded-full">{count}</span>
            )}
          </Link>
        ))}
      </div>

      {/* ── LISTA DE SOLICITUDES ── */}
      {solicitudes.length === 0 ? (
        // ESTADO VACÍO
        // PADDING: py-20 (80px vertical), centrado
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {/* ÍCONO BÚSQUEDA — w-12 h-12 (48x48px), text-slate-600 (gris) */}
          <Search className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400">No hay solicitudes en esta categoría.</p>
        </div>
      ) : (
        // CONTENEDOR DE TARJETAS — gap-3 (12px entre tarjetas)
        <div className="flex flex-col gap-3">
          {solicitudes.map((sol) => {
            const estadoNombre = sol.estado_solicitud?.nombre?.toUpperCase() || 'PENDIENTE'
            const ui = ESTADO_UI[estadoNombre] || ESTADO_UI.PENDIENTE
            const IconEstado = ui.icon
            const fecha = new Date(sol.fecha_solicitud).toLocaleDateString('es-CO', {
              day: '2-digit', month: 'short', year: 'numeric',
            })

            return (
              // TARJETA DE SOLICITUD
              // COLOR FONDO: bg-slate-800 (gris oscuro)
              // BORDE: border border-slate-700, hover:border-slate-600 (más claro al hover)
              // BORDES: rounded-2xl (16px), PADDING: p-5 (20px)
              // DISTRIBUCIÓN: columna en móvil, fila en sm+
              <Link
                key={sol.id_solicitud}
                href={`/admin/solicitudes/${sol.id_solicitud}`}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* AVATAR DE INICIAL
                      COLOR FONDO: bg-slate-700 (gris oscuro)
                      COLOR TEXTO: text-slate-400 (gris claro)
                      TAMAÑO: w-10 h-10 (40x40px), BORDES: rounded-xl (12px)
                      FUENTE: font-bold, text-sm (14px) */}
                  <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm shrink-0">
                    {formatNombre(sol.cliente)?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    {/* NOMBRE DEL CLIENTE — text-slate-200 (gris muy claro), font-semibold */}
                    <p className="font-semibold text-slate-200">{formatNombre(sol.cliente) || 'Cliente'}</p>
                    {/* CC Y TELÉFONO — text-slate-500 (gris), text-xs (12px) */}
                    <p className="text-slate-500 text-xs">CC {sol.cliente?.dni} — {sol.cliente?.telefono}</p>
                    {/* MONTO Y PLAZO — text-slate-400, text-sm (14px) */}
                    <p className="text-slate-400 text-sm mt-1">{formatCOP(sol.monto_solicitado)} — {sol.plazo_meses} meses</p>
                    {/* PROPÓSITO (si existe) — text-xs (12px), line-clamp-1 (máximo 1 línea) */}
                    {sol.proposito && (
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{sol.proposito}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    {/* BADGE ESTADO
                        ESTILOS: definidos en ESTADO_UI arriba
                        PADDING: px-2.5 py-1, BORDES: rounded-full
                        TAMAÑO FUENTE: text-xs (12px), font-semibold */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ui.color}`}>
                      <IconEstado className="w-3 h-3" />{ui.label}
                    </span>
                    {/* FECHA — text-slate-500, text-xs (12px), mt-1 (4px arriba) */}
                    <p className="text-slate-500 text-xs mt-1">{fecha}</p>
                  </div>
                  {/* ÍCONO FLECHA — w-4 h-4 (16x16px), text-slate-600 (gris oscuro) */}
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
