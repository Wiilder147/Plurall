/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/cuotas/page.js
 * DESCRIPCIÓN: Vista del panel de control del usuario.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarDays,
  TrendingDown,
  ArrowRight,
  DollarSign,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const ESTADO_CUOTA = {
  PENDIENTE:   { label: 'Pendiente',   color: 'bg-slate-100 text-slate-600 border-slate-200',       icon: Clock         },
  PAGADA:      { label: 'Pagada',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2  },
  VENCIDA:     { label: 'Vencida',     color: 'bg-red-100 text-red-700 border-red-200',             icon: AlertTriangle },
  PAGADA_MORA: { label: 'Pagada c/mora',color: 'bg-yellow-100 text-yellow-700 border-yellow-200',   icon: CheckCircle2  },
  CONDONADA:   { label: 'Condonada',   color: 'bg-purple-100 text-purple-700 border-purple-200',    icon: CheckCircle2  },
}

export default async function MisCuotasPage() {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) redirect('/login')

  // Buscamos el id_cliente
  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  let credito     = null
  let planPago    = null
  let cuotas      = []

  if (clienteRow) {
    // Buscamos crédito activo
    const { data: creditoData } = await supabase
      .from('credito')
      .select('*')
      .eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['ACTIVO', 'EN_MORA'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    credito = creditoData

    if (credito) {
      // Plan de pago
      const { data: planData } = await supabase
        .from('plan_pago')
        .select('*')
        .eq('id_credito', credito.id_credito)
        .single()

      planPago = planData

      if (planPago) {
        // Cuotas ordenadas por número
        const { data: cuotasData } = await supabase
          .from('cuota')
          .select('*')
          .eq('id_plan_pago', planPago.id_plan_pago)
          .order('numero_cuota', { ascending: true })

        cuotas = cuotasData || []
      }
    }
  }

  // ── Sin crédito activo ────────────────────────────────────────
  if (!credito) {
    return (
      <div className="flex flex-col gap-8 pb-10">
        <header>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Cuotas</h1>
          <p className="text-slate-500 mt-1">Plan de pagos de tu crédito activo.</p>
        </header>
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
            <CreditCard className="w-9 h-9 text-slate-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-700">No tienes un crédito activo</h2>
            <p className="text-slate-500 mt-1 max-w-xs">
              Solicita tu primer crédito y este panel mostrará tu calendario de pagos.
            </p>
          </div>
          <Link
            href="/dashboard/creditos/solicitar"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-3 rounded-xl transition-all"
          >
            Solicitar Crédito <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  // ── Métricas del crédito ──────────────────────────────────────
  const cuotasPendientes = cuotas.filter((c) => c.estado_cuota === 'PENDIENTE').length
  const cuotasVencidas   = cuotas.filter((c) => c.estado_cuota === 'VENCIDA').length
  const cuotasPagadas    = cuotas.filter((c) => ['PAGADA','PAGADA_MORA','CONDONADA'].includes(c.estado_cuota)).length

  const proximaCuota = cuotas.find((c) => c.estado_cuota === 'PENDIENTE' || c.estado_cuota === 'VENCIDA')

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Cuotas</h1>
        <p className="text-slate-500 mt-1">
          Crédito activo — {credito.numero_cuotas} cuotas de {formatCOP(credito.cuota_fija)}
        </p>
      </header>

      {/* Tarjeta resumen del crédito */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Saldo pendiente</p>
            <p className="text-2xl font-extrabold">{formatCOP(credito.saldo_pendiente)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Cuota mensual</p>
            <p className="text-2xl font-extrabold">{formatCOP(credito.cuota_fija)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Cuotas pagadas</p>
            <p className="text-2xl font-extrabold">{cuotasPagadas}/{credito.numero_cuotas}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Estado</p>
            <p className={`text-sm font-bold px-3 py-1 rounded-full w-fit ${
              credito.estado_credito === 'EN_MORA'
                ? 'bg-red-500/20 text-red-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {credito.estado_credito === 'EN_MORA' ? 'En mora' : 'Al día'}
            </p>
          </div>
        </div>
      </div>

      {/* Alerta si hay cuotas vencidas */}
      {cuotasVencidas > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-700">Tienes {cuotasVencidas} cuota{cuotasVencidas > 1 ? 's' : ''} vencida{cuotasVencidas > 1 ? 's' : ''}</p>
            <p className="text-sm text-red-600 mt-0.5">
              Cada día de mora genera intereses adicionales. Realiza tu pago lo antes posible.
            </p>
          </div>
        </div>
      )}

      {/* Próxima cuota a pagar */}
      {proximaCuota && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              proximaCuota.estado_cuota === 'VENCIDA' ? 'bg-red-100' : 'bg-orange-50'
            }`}>
              {proximaCuota.estado_cuota === 'VENCIDA'
                ? <AlertTriangle className="w-6 h-6 text-red-500" />
                : <CalendarDays className="w-6 h-6 text-orange-500" />
              }
            </div>
            <div>
              <p className="font-bold text-slate-800">
                {proximaCuota.estado_cuota === 'VENCIDA' ? '⚠️ Cuota vencida' : 'Próximo pago'}
                {' '}<span className="text-orange-500">#{proximaCuota.numero_cuota}</span>
              </p>
              <p className="text-sm text-slate-500">
                Vence: {new Date(proximaCuota.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-extrabold text-slate-900">{formatCOP(proximaCuota.monto_total_cuota)}</p>
              <p className="text-xs text-slate-400">Capital: {formatCOP(proximaCuota.monto_capital)} + Interés: {formatCOP(proximaCuota.monto_interes)}</p>
            </div>
            <Link
              href={`/dashboard/cuotas/${proximaCuota.id_cuota}/pagar`}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-5 py-3 rounded-xl transition-all shadow-md shadow-orange-500/20 text-sm shrink-0"
            >
              <DollarSign className="w-4 h-4" /> Pagar
            </Link>
          </div>
        </div>
      )}

      {/* Tabla de cuotas */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-orange-500" />
            Plan de Amortización Completo
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">#</th>
                <th className="px-6 py-3 text-left">Vencimiento</th>
                <th className="px-6 py-3 text-right">Capital</th>
                <th className="px-6 py-3 text-right">Interés</th>
                <th className="px-6 py-3 text-right">Cuota</th>
                <th className="px-6 py-3 text-right">Saldo</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cuotas.map((c) => {
                const estadoUI = ESTADO_CUOTA[c.estado_cuota] || ESTADO_CUOTA.PENDIENTE
                const IconCuota = estadoUI.icon
                const esPagable = c.estado_cuota === 'PENDIENTE' || c.estado_cuota === 'VENCIDA'

                return (
                  <tr key={c.id_cuota} className={`hover:bg-slate-50/50 transition-colors ${c.estado_cuota === 'VENCIDA' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4 font-semibold text-slate-700">{c.numero_cuota}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(c.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-700">{formatCOP(c.monto_capital)}</td>
                    <td className="px-6 py-4 text-right text-slate-500">{formatCOP(c.monto_interes)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800">{formatCOP(c.monto_total_cuota)}</td>
                    <td className="px-6 py-4 text-right text-slate-500">{formatCOP(c.saldo_despues_pago)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${estadoUI.color}`}>
                        <IconCuota className="w-3 h-3" />
                        {estadoUI.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {esPagable && (
                        <Link
                          href={`/dashboard/cuotas/${c.id_cuota}/pagar`}
                          className="text-orange-500 hover:text-orange-600 font-semibold text-xs"
                        >
                          Pagar
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {cuotas.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">No hay cuotas registradas aún.</p>
          )}
        </div>
      </div>
    </div>
  )
}
