/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/inicio/page.js
 * DESCRIPCIÓN: Vista principal del panel del CLIENTE (Home del dashboard).
 * FUNCIONALIDAD: Muestra saludo, tarjeta del crédito activo, alertas de mora,
 *                métricas rápidas, próxima cuota y acciones rápidas.
 *                Si no hay crédito activo, muestra pantalla de invitación.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { getSolicitudAprobadaPendiente, getUltimaSolicitudCliente } from '@/lib/solicitudCliente'
import SolicitudDesembolsoPendiente from '@/components/cliente/SolicitudDesembolsoPendiente'
import {
  CreditCard, ArrowRight, Activity, Zap,
  AlertTriangle, CheckCircle2, CalendarDays,
  TrendingUp, Wallet, BarChart3,
  PartyPopper, Phone, HeartHandshake, CalendarClock, Sparkles,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardInicio() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const { nombre_completo } = user.user_metadata || {}
  const primerNombre = nombre_completo ? nombre_completo.split(' ')[0] : 'Emprendedor'

  const { data: clienteRow } = await supabase
    .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

  let credito = null
  let cuotasPagadas = 0
  let cuotasVencidas = 0
  let proximaCuota = null
  let solicitudAprobada = null
  let ultimaSolicitud = null

  if (clienteRow) {
    const { data: cred } = await supabase
      .from('credito').select('*')
      .eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['ACTIVO', 'EN_MORA'])
      .order('created_at', { ascending: false }).limit(1).single()

    credito = cred

    if (credito) {
      const { data: plan } = await supabase
        .from('plan_pago').select('id_plan_pago').eq('id_credito', credito.id_credito).single()

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

    if (!credito) {
      solicitudAprobada = await getSolicitudAprobadaPendiente(supabase, clienteRow.id_cliente)
      // Última solicitud (para pantallas de rechazo o pre-aprobado en el Home)
      if (!solicitudAprobada) {
        ultimaSolicitud = await getUltimaSolicitudCliente(supabase, clienteRow.id_cliente)
      }
    }
  }

  // Clasificación de la última solicitud para decidir la pantalla del Home
  const fmtFecha = (f) => f
    ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  const rechazadaBloqueada = ultimaSolicitud?.estado === 'RECHAZADA' && !ultimaSolicitud.puedeReintentar
  const solicitudEnCurso   = ['PENDIENTE', 'EN_ESTUDIO'].includes(ultimaSolicitud?.estado)

  const tieneCredito = !!credito
  const enMora = credito?.estado_credito === 'EN_MORA'
  const progreso = tieneCredito ? Math.round((cuotasPagadas / credito.numero_cuotas) * 100) : 0

  return (
    // CONTENEDOR PRINCIPAL — flex vertical con espacio de 32px entre secciones
    // pb-10 — padding inferior de 40px para que no quede pegado al borde
    <div className="flex flex-col gap-8 pb-10">

      {/* ── ENCABEZADO CON SALUDO ──
          COLOR TÍTULO: text-slate-900 (negro suave)
          TAMAÑO: text-3xl (30px), font-bold (negrita), tracking-tight (letras más juntas)
          COLOR SUBTÍTULO: text-slate-500 (gris medio)
          MARGEN SUPERIOR DEL SUBTÍTULO: mt-2 (8px) */}
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
          {/* ────────────────────────────────────────────────────────────────────
              TARJETA PRINCIPAL DEL CRÉDITO
              EN MORA: bg-gradient-to-br from-red-600 to-red-900 (degradado rojo)
              AL DÍA: bg-gradient-to-br from-slate-900 to-slate-800 (degradado oscuro)
              Para cambiar el color: cambia 'from-slate-900 to-slate-800' o 'from-red-600 to-red-900'
              BORDES: rounded-3xl (24px muy redondeados)
              PADDING: p-8 (32px)
              SOMBRA: shadow-xl (sombra grande)
              ──────────────────────────────────────────────────────────────────── */}
          <section className={`hero-dark rounded-3xl p-8 text-white shadow-xl relative overflow-hidden ${enMora ? 'bg-gradient-to-br from-red-600 to-red-900' : 'bg-gradient-to-br from-slate-900 to-slate-800'}`}>
            {/* BOLA DECORATIVA SUPERIOR DERECHA — blanco 10% opacidad, desenfocada */}
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            {/* BOLA DECORATIVA INFERIOR IZQUIERDA */}
            <div className="absolute left-0 bottom-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex flex-col gap-2">
                {/* ETIQUETA "Estado de cuenta"
                    COLOR: text-white/70 (blanco 70% transparente)
                    TAMAÑO: text-xs (12px), uppercase, tracking-wide */}
                <span className="text-white/70 font-medium tracking-wide text-xs uppercase">Estado de cuenta</span>
                {/* ESTADO GRANDE: "En mora" o "Al día"
                    TAMAÑO: text-4xl (36px) en móvil, md:text-5xl (48px) en tablet
                    FUENTE: font-extrabold (extra negrita) */}
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                  {enMora ? 'En mora' : 'Al día'}
                </h2>
                {/* SUBTÍTULO con saldo pendiente
                    COLOR: text-white/70 (blanco semi-transparente)
                    TAMAÑO: text-sm (14px) */}
                <p className="text-white/70 mt-2 max-w-md text-sm">
                  Préstamo Comercial Plurall · Saldo pendiente: {formatCOP(credito.saldo_pendiente)}
                </p>
              </div>

              {/* BOTÓN "Ver mis cuotas"
                  COLOR DE FONDO: bg-orange-500 (naranja), hover:bg-orange-400 (más claro)
                  Para cambiar: bg-blue-500, bg-emerald-500
                  COLOR TEXTO: text-white (blanco)
                  PADDING: px-6 py-4 (24px horizontal, 16px vertical)
                  BORDES: rounded-xl (12px)
                  SOMBRA: shadow-lg shadow-orange-500/20 (sombra naranja suave)
                  ANCHO: w-full en móvil, md:w-auto en desktop */}
              <Link
                href="/dashboard/cuotas"
                className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 w-full md:w-auto shrink-0"
              >
                Ver mis cuotas
                {/* ÍCONO FLECHA — w-5 h-5 (20x20px) */}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>

          {/* ── ALERTA DE CUOTAS VENCIDAS (solo visible si cuotasVencidas > 0) ──
              COLOR DE FONDO: bg-red-50 (rojo muy claro)
              BORDE: border border-red-200 (rojo claro, 1px)
              BORDES: rounded-xl (12px)
              PADDING: px-5 py-4 (20px horizontal, 16px vertical)
              ÍCONO: text-red-500 (rojo), w-5 h-5 (20x20px)
              TÍTULO: text-red-700 (rojo oscuro), font-semibold
              MENSAJE: text-red-600 (rojo medio), text-sm (14px) */}
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

          {/* ── GRID DE MÉTRICAS RÁPIDAS ──
              COLUMNAS: 2 en móvil, 4 en desktop (md:grid-cols-4)
              ESPACIO: gap-4 (16px entre tarjetas) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* TARJETA: DESEMBOLSADO
                COLOR DE FONDO: bg-white (blanco)
                BORDE: border border-slate-200/60 (gris muy claro, semi-transparente)
                PADDING: p-5 (20px), BORDES: rounded-2xl (16px)
                SOMBRA: shadow-sm (sombra pequeña) */}
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              {/* ÍCONO CONTENEDOR
                  TAMAÑO: w-8 h-8 (32x32px), COLOR FONDO: bg-orange-50 (naranja muy claro)
                  BORDES: rounded-lg (8px)
                  ÍCONO WALLET: w-4 h-4 (16x16px), color text-orange-500 (naranja) */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-orange-500" />
                </div>
              </div>
              {/* ETIQUETA — text-xs (12px), text-slate-400, uppercase */}
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Desembolsado</span>
              {/* VALOR — text-xl (20px), font-bold, text-slate-900 */}
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(credito.monto_desembolsado)}</p>
            </div>

            {/* TARJETA: CUOTA MENSUAL
                Igual a la anterior pero con ícono azul */}
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                {/* ÍCONO — bg-blue-50 (azul muy claro), ícono text-blue-600 (azul medio) */}
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuota mensual</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(credito.cuota_fija)}</p>
            </div>

            {/* TARJETA: AVANCE DEL CRÉDITO (con barra de progreso) */}
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                {/* ÍCONO — bg-emerald-50 (verde muy claro), ícono text-emerald-600 (verde medio) */}
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avance</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{cuotasPagadas} / {credito.numero_cuotas}</p>
              {/* BARRA DE PROGRESO
                  FONDO: bg-slate-100 (gris muy claro)
                  RELLENO: bg-emerald-500 (verde — para cambiar: bg-orange-500, bg-blue-500)
                  ALTURA: h-1.5 (6px — para más gruesa: h-2=8px, h-3=12px)
                  BORDES: rounded-full (completamente oval)
                  ANCHO: width calculado dinámicamente según % de progreso */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }}></div>
              </div>
            </div>

            {/* TARJETA: ESTADO (En mora / Al día) */}
            <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                {/* ÍCONO condicional: rojo si mora, verde si al día */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enMora ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  {enMora ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</span>
              {/* BADGE DE ESTADO
                  EN MORA: bg-red-50 text-red-600 (rojo claro)
                  AL DÍA: bg-emerald-50 text-emerald-600 (verde claro)
                  PADDING: px-3 py-1 (12px horizontal, 4px vertical)
                  BORDES: rounded-full (completamente ovalado) */}
              <p className={`text-sm font-bold mt-1 px-3 py-1 rounded-full w-fit ${enMora ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {enMora ? 'En mora' : 'Al día'}
              </p>
            </div>
          </div>

          {/* ── TARJETA PRÓXIMA CUOTA (visible si hay cuota pendiente o vencida) ──
              COLOR DE FONDO: bg-white
              BORDE: border border-slate-200/60
              BORDES: rounded-2xl (16px), PADDING: p-6 (24px)
              Distribución: columna en móvil, fila en sm+ */}
          {proximaCuota && (
            <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* ÍCONO CONTENEDOR — rojo si vencida, naranja claro si pendiente
                    TAMAÑO: w-12 h-12 (48x48px), BORDES: rounded-xl (12px) */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${proximaCuota.estado_cuota === 'VENCIDA' ? 'bg-red-100' : 'bg-orange-50'}`}>
                  {proximaCuota.estado_cuota === 'VENCIDA'
                    ? <AlertTriangle className="w-6 h-6 text-red-500" />
                    : <CalendarDays className="w-6 h-6 text-orange-500" />
                  }
                </div>
                <div>
                  {/* NÚMERO DE CUOTA — color text-orange-500 (naranja) */}
                  <p className="font-bold text-slate-800">
                    {proximaCuota.estado_cuota === 'VENCIDA' ? '⚠️ Cuota vencida' : 'Próximo pago'}
                    {' '}<span className="text-orange-500">#{proximaCuota.numero_cuota}</span>
                  </p>
                  {/* FECHA DE VENCIMIENTO — text-sm (14px), text-slate-500 (gris) */}
                  <p className="text-sm text-slate-500">
                    Vence: {new Date(proximaCuota.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* MONTO — text-2xl (24px), font-extrabold, text-slate-900 */}
                <span className="text-2xl font-extrabold text-slate-900">{formatCOP(proximaCuota.monto_total_cuota)}</span>
                {/* BOTÓN "Pagar"
                    COLOR: bg-orange-500 hover:bg-orange-400 (naranja)
                    PADDING: px-5 py-3 (20px horizontal, 12px vertical)
                    BORDES: rounded-xl (12px)
                    SOMBRA: shadow-md shadow-orange-500/20
                    TAMAÑO FUENTE: text-sm (14px) */}
                <Link
                  href="/dashboard/cuotas"
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-5 py-3 rounded-xl transition-all shadow-md shadow-orange-500/20 text-sm shrink-0"
                >
                  Pagar
                </Link>
              </div>
            </div>
          )}

          {/* ── ACCIONES RÁPIDAS (3 tarjetas navegables) ──
              COLUMNAS: 1 en móvil, 3 en desktop (md:grid-cols-3)
              ESPACIO: gap-4 (16px) en móvil, gap-6 (24px) en desktop */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

            {/* TARJETA: PLAN DE PAGOS
                COLOR FONDO: bg-white (blanco)
                BORDE: border border-slate-200/60
                PADDING: p-6 (24px), BORDES: rounded-2xl (16px)
                ÍCONO CONTENEDOR: bg-orange-50 (naranja claro), hover:bg-orange-500 (naranja sólido)
                ÍCONO COLOR: text-orange-500, hover:text-white
                TAMAÑO ÍCONO CONTENEDOR: w-12 h-12 (48x48px) */}
            <Link href="/dashboard/cuotas" className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <BarChart3 className="w-6 h-6" />
              </div>
              {/* TÍTULO TARJETA — text-lg (18px), font-bold, text-slate-800 */}
              <h3 className="text-lg font-bold text-slate-800 mb-1">Plan de Pagos</h3>
              {/* DESCRIPCIÓN — text-sm (14px), text-slate-500 (gris) */}
              <p className="text-slate-500 text-sm">Consulta tu tabla de amortización y el detalle de cada cuota.</p>
            </Link>

            {/* TARJETA: DOCUMENTOS — ícono azul */}
            <Link href="/dashboard/documentos" className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              {/* ÍCONO: bg-blue-50 (azul muy claro), hover:bg-blue-600 (azul sólido)
                  COLOR ÍCONO: text-blue-600, hover:text-white */}
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Documentos</h3>
              <p className="text-slate-500 text-sm">Descarga tu contrato, estado de cuenta y paz y salvo.</p>
            </Link>

            {/* TARJETA: MI PERFIL — ícono verde */}
            <Link href="/dashboard/perfil" className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              {/* ÍCONO: bg-emerald-50 (verde muy claro), hover:bg-emerald-600 (verde sólido)
                  COLOR ÍCONO: text-emerald-600, hover:text-white */}
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Mi Perfil</h3>
              <p className="text-slate-500 text-sm">Revisa tus datos personales y actualiza tu información.</p>
            </Link>
          </section>
        </>
      ) : solicitudAprobada ? (
        <SolicitudDesembolsoPendiente solicitud={solicitudAprobada} variant="hero" />
      ) : solicitudEnCurso ? (
        /* ════════════ SOLICITUD EN CURSO (pre-aprobado / en evaluación) ════════════ */
        <>
          <section className="hero-dark bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-8 text-white shadow-xl shadow-emerald-900/10 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute left-0 bottom-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>
            <div className="relative z-10 flex flex-col gap-4">
              {/* ÍCONO CELEBRACIÓN */}
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
                <PartyPopper className="w-7 h-7 text-white" />
              </div>
              <span className="text-white/70 font-medium tracking-wide text-xs uppercase">Solicitud recibida</span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                ¡Felicitaciones, {primerNombre}! Tu solicitud avanza
              </h2>
              <p className="text-white/80 max-w-xl">
                Tu solicitud por <strong className="text-white">{formatCOP(ultimaSolicitud.monto)}</strong> a {ultimaSolicitud.plazo} meses
                fue evaluada positivamente y está en la etapa final de verificación. Un asesor de Plurall te contactará
                muy pronto para confirmar tus datos y coordinar el desembolso. ¡Mantén tu celular disponible!
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                {/* BOTÓN "Hablar con un asesor" */}
                <Link href="/dashboard/ayuda"
                  className="inline-flex items-center justify-center gap-2 bg-white text-emerald-800 hover:bg-emerald-50 font-semibold px-6 py-3.5 rounded-xl transition-all shadow-lg w-full sm:w-auto">
                  <Phone className="w-5 h-5" /> Hablar con un asesor
                </Link>
                {/* BOTÓN "Ver mi solicitud" (contorno) */}
                <Link href="/dashboard/creditos"
                  className="inline-flex items-center justify-center gap-2 border border-white/40 text-white hover:bg-white/10 font-semibold px-6 py-3.5 rounded-xl transition-all w-full sm:w-auto">
                  Ver mi solicitud <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </section>

          {/* ¿QUÉ SIGUE? — pasos informativos */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { icon: CheckCircle2, wrap: 'bg-emerald-50 text-emerald-600', title: 'Solicitud enviada', desc: 'Recibimos tu información y documentos correctamente.' },
              { icon: Sparkles,     wrap: 'bg-blue-50 text-blue-600',       title: 'Verificación final', desc: 'Nuestro equipo valida tus datos. Puede tomar unas horas hábiles.' },
              { icon: Phone,        wrap: 'bg-orange-50 text-orange-600',   title: 'Te contactamos', desc: 'Un asesor te llamará para confirmar y coordinar el desembolso.' },
            ].map(({ icon: Icon, wrap, title, desc }) => (
              <div key={title} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${wrap}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
                <p className="text-slate-500 text-sm">{desc}</p>
              </div>
            ))}
          </section>
        </>
      ) : rechazadaBloqueada ? (
        /* ════════════ SOLICITUD RECHAZADA (agradecimiento + reintento a 90 días) ════════════ */
        <>
          <section className="hero-dark bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute left-0 bottom-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
                <HeartHandshake className="w-7 h-7 text-white" />
              </div>
              <span className="text-white/70 font-medium tracking-wide text-xs uppercase">Gracias por confiar en Plurall</span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Gracias por tu solicitud, {primerNombre}
              </h2>
              <p className="text-white/80 max-w-xl">
                Revisamos tu solicitud con mucho cuidado. Por ahora no pudimos aprobarla
                {ultimaSolicitud.motivoVisible
                  ? <>, principalmente por aspectos relacionados con <strong className="text-white">{ultimaSolicitud.motivoVisible.toLowerCase()}</strong>.</>
                  : <> debido a nuestros criterios de evaluación vigentes.</>}
                {' '}Esto no es definitivo y valoramos mucho tu interés.
              </p>
              {/* RECUADRO DE REINTENTO */}
              <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-2xl px-5 py-4 max-w-xl">
                <CalendarClock className="w-6 h-6 text-white shrink-0" />
                <p className="text-white/90 text-sm">
                  Podrás volver a solicitar tu crédito a partir del{' '}
                  <strong className="text-white">{fmtFecha(ultimaSolicitud.fechaReintento)}</strong>.
                  Mientras tanto, mantener tu negocio activo y tus finanzas al día mejora tus posibilidades.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <Link href="/dashboard/ayuda"
                  className="inline-flex items-center justify-center gap-2 bg-white text-slate-800 hover:bg-slate-100 font-semibold px-6 py-3.5 rounded-xl transition-all shadow-lg w-full sm:w-auto">
                  <Phone className="w-5 h-5" /> Hablar con un asesor
                </Link>
                <Link href="/dashboard/documentacion"
                  className="inline-flex items-center justify-center gap-2 border border-white/40 text-white hover:bg-white/10 font-semibold px-6 py-3.5 rounded-xl transition-all w-full sm:w-auto">
                  Conocer más sobre Plurall <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </section>

          {/* CONSEJOS PARA MEJORAR EL PERFIL */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { icon: TrendingUp,    wrap: 'bg-emerald-50 text-emerald-600', title: 'Fortalece tu negocio', desc: 'Un negocio con más tiempo de operación e ingresos estables suma puntos.' },
              { icon: Wallet,        wrap: 'bg-blue-50 text-blue-600',       title: 'Cuida tus finanzas', desc: 'Mantén tus deudas al día; un buen historial mejora tu evaluación.' },
              { icon: CalendarClock, wrap: 'bg-orange-50 text-orange-600',   title: 'Vuelve a intentarlo', desc: `Podrás enviar una nueva solicitud desde el ${fmtFecha(ultimaSolicitud.fechaReintento)}.` },
            ].map(({ icon: Icon, wrap, title, desc }) => (
              <div key={title} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${wrap}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
                <p className="text-slate-500 text-sm">{desc}</p>
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          {/* ── SIN CRÉDITO ACTIVO: TARJETA DE INVITACIÓN ──
              COLOR DE FONDO: bg-gradient-to-br from-slate-900 to-slate-800 (degradado oscuro)
              BORDE: rounded-3xl (24px), PADDING: p-8 (32px)
              SOMBRA: shadow-xl shadow-slate-900/10
              hero-dark: mantiene el texto claro en tema claro (fix de contraste) */}
          <section className="hero-dark bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
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
              {/* BOTÓN "Solicitar Crédito"
                  COLOR: bg-orange-500 hover:bg-orange-400 (naranja)
                  PADDING: px-6 py-4 (24px horizontal, 16px vertical)
                  BORDES: rounded-xl (12px) */}
              <Link
                href="/dashboard/creditos/solicitar"
                className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 w-full md:w-auto shrink-0"
              >
                Solicitar Crédito
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>

          {/* TARJETAS INFORMATIVAS (sin crédito activo) */}
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
