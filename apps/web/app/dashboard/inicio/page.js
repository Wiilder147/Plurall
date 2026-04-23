import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import {
  CreditCard,
  ArrowRight,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  TrendingUp,
  Wallet,
  BarChart3,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardInicio() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { nombre_completo } = user.user_metadata || {}
  const primerNombre = nombre_completo ? nombre_completo.split(' ')[0] : 'Emprendedor'

  // ── Buscar cliente y crédito activo ──
  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  let credito = null
  let cuotasPagadas = 0
  let cuotasVencidas = 0
  let proximaCuota = null

  if (clienteRow) {
    const { data: cred } = await supabase
      .from('credito')
      .select('*')
      .eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['ACTIVO', 'EN_MORA'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    credito = cred

    if (credito) {
      // Traer cuotas para métricas
      const { data: plan } = await supabase
        .from('plan_pago')
        .select('id_plan_pago')
        .eq('id_credito', credito.id_credito)
        .single()

      if (plan) {
        const { data: cuotas } = await supabase
          .from('cuota')
          .select('numero_cuota, estado_cuota, monto_total_cuota, fecha_vencimiento')
          .eq('id_plan_pago', plan.id_plan_pago)
          .order('numero_cuota', { ascending: true })

        if (cuotas) {
          cuotasPagadas = cuotas.filter(c => ['PAGADA', 'PAGADA_MORA', 'CONDONADA'].includes(c.estado_cuota)).length
          cuotasVencidas = cuotas.filter(c => c.estado_cuota === 'VENCIDA').length
          proximaCuota = cuotas.find(c => c.estado_cuota === 'VENCIDA' || c.estado_cuota === 'PENDIENTE') || null
        }
      }
    }
  }

  const tieneCredito = !!credito
  const enMora = credito?.estado_credito === 'EN_MORA'
  const progreso = tieneCredito ? Math.round((cuotasPagadas / credito.numero_cuotas) * 100) : 0

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Saludo */}
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Hola, {primerNombre} 👋
        </h1>
        <p className="text-slate-500 mt-2">
          Bienvenido a tu panel de control financiero Plurall.
        </p>
      </header>

      {tieneCredito ? (
        <>
          {/* ── TARJETA PRINCIPAL DEL CRÉDITO ── */}
          <section className={`rounded-3xl p-8 text-white shadow-xl relative overflow-hidden ${enMora ? 'bg-gradient-to-br from-red-600 to-red-900' : 'bg-gradient-to-br from-slate-900 to-slate-800'}`}>
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute left-0 bottom-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-white/70 font-medium tracking-wide text-xs uppercase">Estado de cuenta</span>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                  {enMora ? 'En mora' : 'Al día'}
                </h2>
                <p className="text-white/70 mt-2 max-w-md text-sm">
                  Préstamo Comercial Plurall · Saldo pendiente: {formatCOP(credito.saldo_pendiente)}
                </p>
              </div>
              
              <Link
                href="/dashboard/cuotas"
                className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 w-full md:w-auto shrink-0"
              >
                Ver mis cuotas
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>

          {/* ── ALERTA DE MORA ── */}
          {cuotasVencidas > 0 && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-700">Tienes {cuotasVencidas} cuota{cuotasVencidas > 1 ? 's' : ''} vencida{cuotasVencidas > 1 ? 's' : ''}</p>
                <p className="text-sm text-red-600 mt-0.5">
                  Cada día de mora genera intereses adicionales. Realiza tu pago lo antes posible para evitar recargos.
                </p>
              </div>
            </div>
          )}

          {/* ── MÉTRICAS RÁPIDAS ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-orange-500" />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Desembolsado</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(credito.monto_desembolsado)}</p>
            </div>
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuota mensual</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(credito.cuota_fija)}</p>
            </div>
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avance</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{cuotasPagadas} / {credito.numero_cuotas}</p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }}></div>
              </div>
            </div>
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enMora ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  {enMora ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</span>
              <p className={`text-sm font-bold mt-1 px-3 py-1 rounded-full w-fit ${enMora ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {enMora ? 'En mora' : 'Al día'}
              </p>
            </div>
          </div>

          {/* ── PRÓXIMA CUOTA ── */}
          {proximaCuota && (
            <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${proximaCuota.estado_cuota === 'VENCIDA' ? 'bg-red-100' : 'bg-orange-50'}`}>
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
                <span className="text-2xl font-extrabold text-slate-900">{formatCOP(proximaCuota.monto_total_cuota)}</span>
                <Link
                  href="/dashboard/cuotas"
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-5 py-3 rounded-xl transition-all shadow-md shadow-orange-500/20 text-sm shrink-0"
                >
                  Pagar
                </Link>
              </div>
            </div>
          )}

          {/* ── ACCIONES RÁPIDAS ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <Link href="/dashboard/cuotas" className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Plan de Pagos</h3>
              <p className="text-slate-500 text-sm">Consulta tu tabla de amortización y el detalle de cada cuota.</p>
            </Link>

            <Link href="/dashboard/documentos" className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Documentos</h3>
              <p className="text-slate-500 text-sm">Descarga tu contrato, estado de cuenta y paz y salvo.</p>
            </Link>

            <Link href="/dashboard/perfil" className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Mi Perfil</h3>
              <p className="text-slate-500 text-sm">Revisa tus datos personales y actualiza tu información.</p>
            </Link>
          </section>
        </>
      ) : (
        <>
          {/* ── SIN CRÉDITO ACTIVO ── */}
          <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute left-0 bottom-0 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-slate-300 font-medium tracking-wide text-sm uppercase">Estado de cuenta</span>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Sin créditos activos</h2>
                <p className="text-slate-300 mt-2 max-w-md">
                  Aún no tienes un crédito desembolsado con nosotros. Puedes explorar tus opciones o solicitar uno nuevo.
                </p>
              </div>
              <Link
                href="/dashboard/creditos/solicitar"
                className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 w-full md:w-auto shrink-0"
              >
                Solicitar Crédito
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Simular Crédito</h3>
              <p className="text-slate-500 text-sm">Calcula tus cuotas antes de pedir un préstamo real.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Historial</h3>
              <p className="text-slate-500 text-sm">Descarga tus extractos y revisa tus pagos anteriores.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Pagos Múltiples</h3>
              <p className="text-slate-500 text-sm">Paga todas tus cuotas activas en una sola transacción rápida.</p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
