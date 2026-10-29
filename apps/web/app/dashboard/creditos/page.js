/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/creditos/page.js
 * DESCRIPCIÓN: Vista "Mis Créditos" del dashboard del CLIENTE.
 * FUNCIONALIDAD: Muestra el crédito activo (si existe) o invitación a solicitar.
 *                También muestra el historial de créditos pagados/finalizados.
 * ========================================================================== */
import Link from 'next/link'
import { ArrowRight, CheckCircle2, AlertCircle, Clock, CreditCard, Lock, History, Award, Search, XCircle, CalendarClock } from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'
import { fechaCierrePorCredito } from '@/lib/credito'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSolicitudAprobadaPendiente, getUltimaSolicitudCliente } from '@/lib/solicitudCliente'
import SolicitudDesembolsoPendiente from '@/components/cliente/SolicitudDesembolsoPendiente'

export const dynamic = 'force-dynamic'

export default async function MisCreditos() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  const { data: clienteRow } = await supabase
    .from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

  let creditoActivo = null
  let creditosHistoricos = []
  let solicitudAprobada = null
  let ultimaSolicitud = null
  let fechasCierre = {}

  if (clienteRow) {
    const { data: activo } = await supabase
      .from('credito').select('*').eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['ACTIVO', 'EN_MORA']).order('created_at', { ascending: false }).limit(1).single()
    creditoActivo = activo

    const { data: historicos } = await supabase
      .from('credito').select('*').eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['PAGADO', 'CANCELADO', 'CASTIGADO']).order('created_at', { ascending: false })
    creditosHistoricos = historicos || []

    // J-10: fecha de cierre real = último pago de las cuotas (no updated_at)
    if (creditosHistoricos.length) {
      const { data: cuotasPagadas } = await supabase
        .from('cuota')
        .select('fecha_pago_real, plan_pago!inner ( id_credito )')
        .in('plan_pago.id_credito', creditosHistoricos.map(c => c.id_credito))
        .not('fecha_pago_real', 'is', null)
      fechasCierre = fechaCierrePorCredito(cuotasPagadas)
    }

    if (!creditoActivo) {
      solicitudAprobada = await getSolicitudAprobadaPendiente(supabase, clienteRow.id_cliente)
      if (!solicitudAprobada) {
        ultimaSolicitud = await getUltimaSolicitudCliente(supabase, clienteRow.id_cliente)
      }
    }
  }

  const tieneActivo = !!creditoActivo
  const enMora = creditoActivo?.estado_credito === 'EN_MORA'
  const progreso = tieneActivo ? Math.round((creditoActivo.cuotas_pagadas / creditoActivo.numero_cuotas) * 100) : 0
  const totalDesembolsadoHistorico = creditosHistoricos.reduce((acc, c) => acc + c.monto_desembolsado, 0)

  // Estado de la última solicitud (para mostrar la solicitud y su estado aquí)
  const fmtFecha = (f) => f
    ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  const solicitudEnCurso = ['PENDIENTE', 'EN_ESTUDIO'].includes(ultimaSolicitud?.estado)
  const solicitudRechazada = ultimaSolicitud?.estado === 'RECHAZADA'

  return (
    // CONTENEDOR — gap-8 (32px entre secciones), pb-10 (40px abajo)
    <div className="flex flex-col gap-8 pb-10">

      {/* ── ENCABEZADO ──
          DISTRIBUCIÓN: columna en móvil, fila con alineación al fondo en md+ */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          {/* TÍTULO "Mis Créditos"
              COLOR: text-slate-900 (casi negro), TAMAÑO: text-3xl (30px), font-bold */}
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Créditos</h1>
          {/* SUBTÍTULO — text-slate-500 (gris), mt-2 (8px arriba), texto por defecto (16px) */}
          <p className="text-slate-500 mt-2">
            {tieneActivo
              ? 'Regla de negocio: solo puedes mantener 1 crédito activo a la vez.'
              : solicitudAprobada
                ? 'Tu crédito fue aprobado. Estamos preparando el desembolso.'
                : solicitudEnCurso
                  ? 'Tu solicitud está en evaluación. Aquí puedes ver su estado.'
                  : solicitudRechazada
                    ? 'Aquí puedes ver el estado de tu última solicitud.'
                    : 'Consulta el estado de tus préstamos y paga a tiempo.'}
          </p>
        </div>

        {tieneActivo ? (
          // BADGE "Crédito activo vigente" (cuando ya tiene crédito — bloquea nueva solicitud)
          // COLOR FONDO: bg-slate-200 (gris claro), COLOR TEXTO: text-slate-500 (gris)
          // PADDING: px-4 py-2 (16px horizontal, 8px vertical), BORDES: rounded-lg (8px)
          // cursor-not-allowed — indica que no se puede hacer clic
          <div className="inline-flex items-center gap-2 bg-slate-200 text-slate-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed select-none">
            <Lock className="w-4 h-4" />
            Crédito activo vigente
          </div>
        ) : solicitudAprobada ? (
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-medium border border-emerald-200 select-none">
            <Clock className="w-4 h-4" />
            Desembolso en proceso
          </div>
        ) : solicitudEnCurso ? (
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium border border-blue-200 select-none">
            <Search className="w-4 h-4" />
            En evaluación
          </div>
        ) : solicitudRechazada && !ultimaSolicitud.puedeReintentar ? (
          // M-07: durante el bloqueo de 90 días (RN-03) no se ofrece solicitar
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-lg font-medium border border-orange-200 select-none">
            <CalendarClock className="w-4 h-4" />
            Nueva solicitud desde el {fmtFecha(ultimaSolicitud.fechaReintento)}
          </div>
        ) : (
          // BOTÓN "+ Solicitar Crédito" (cuando NO tiene crédito activo)
          // COLOR FONDO: bg-slate-900 (casi negro), hover:bg-slate-800 (un poco más claro)
          // COLOR TEXTO: text-white (blanco)
          // PADDING: px-4 py-2, BORDES: rounded-lg (8px)
          <Link
            href="/dashboard/creditos/solicitar"
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Solicitar Crédito
          </Link>
        )}
      </header>

      {/* ── TARJETA DEL CRÉDITO ACTIVO ── */}
      {tieneActivo ? (
        // TARJETA CLICKEABLE (navega a /dashboard/cuotas)
        // EN MORA: fondo bg-gradient-to-br from-red-50 to-white, borde rojo
        // AL DÍA: fondo bg-gradient-to-br from-emerald-50 to-white, borde verde
        // BORDES: rounded-3xl (24px), PADDING: p-6 (24px) móvil, p-8 (32px) desktop
        // hover:shadow-lg + hover:border-X-400 — efecto al pasar cursor
        <Link
          href="/dashboard/cuotas"
          className={`rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-lg group border-2 ${
            enMora
              ? 'bg-gradient-to-br from-red-50 to-white border-red-200 hover:border-red-400 hover:shadow-red-500/10'
              : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-500/10'
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* ÍCONO CONTENEDOR
                  EN MORA: bg-red-100 (rojo claro), ícono text-red-500 (rojo)
                  AL DÍA: bg-emerald-100 (verde claro), ícono text-emerald-600 (verde)
                  TAMAÑO: w-10 h-10 (40x40px), BORDES: rounded-xl (12px) */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enMora ? 'bg-red-100' : 'bg-emerald-100'}`}>
                <CreditCard className={`w-5 h-5 ${enMora ? 'text-red-500' : 'text-emerald-600'}`} />
              </div>
              {/* ID DEL CRÉDITO — text-slate-400, text-sm (14px), uppercase */}
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Préstamo Comercial #{creditoActivo.id_credito.substring(0,8).toUpperCase()}
              </span>
            </div>

            {/* MONTO PRINCIPAL — text-3xl (30px), font-black (máxima negrita), text-slate-900 */}
            <h3 className="text-3xl font-black text-slate-900">{formatCOP(creditoActivo.monto_desembolsado)}</h3>

            <div className="flex flex-wrap items-center gap-3 mt-1">
              {enMora ? (
                // BADGE EN MORA
                // COLOR FONDO: bg-red-100 (rojo claro), COLOR TEXTO: text-red-600 (rojo)
                // BORDE: border border-red-200, PADDING: px-3 py-1.5
                // BORDES: rounded-lg (8px), TAMAÑO: text-xs (12px), font-bold
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" /> En mora — {creditoActivo.cuotas_en_mora} cuota{creditoActivo.cuotas_en_mora > 1 ? 's' : ''} vencida{creditoActivo.cuotas_en_mora > 1 ? 's' : ''}
                </span>
              ) : (
                // BADGE AL DÍA
                // COLOR FONDO: bg-emerald-100, COLOR TEXTO: text-emerald-600
                // BORDE: border border-emerald-200
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Al día
                </span>
              )}
              {/* TEXTO AVANCE — text-sm (14px), text-slate-500 */}
              <span className="text-sm font-medium text-slate-500">
                Avance: {creditoActivo.cuotas_pagadas} de {creditoActivo.numero_cuotas} cuotas
              </span>
            </div>

            {/* BARRA DE PROGRESO
                FONDO: bg-slate-100 (gris muy claro), ANCHO MÁXIMO: max-w-xs (320px)
                ALTURA: h-2 (8px), BORDES: rounded-full
                RELLENO: en mora → bg-red-500, al día → bg-emerald-500
                ANCHO DEL RELLENO: calculado dinámicamente (progreso %) */}
            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all ${enMora ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${progreso}%` }}
              ></div>
            </div>
          </div>

          {/* COLUMNA DERECHA DE LA TARJETA */}
          <div className="flex flex-col md:items-end gap-2 bg-slate-50/80 md:bg-transparent p-4 md:p-0 rounded-xl">
            {/* ETIQUETA "Cuota mensual" — text-slate-500, text-sm */}
            <span className="text-sm text-slate-500 font-medium">Cuota mensual</span>
            <div className="flex items-center gap-4">
              {/* MONTO DE CUOTA — text-2xl (24px), font-bold, text-orange-500 (naranja) */}
              <span className="text-2xl font-bold text-orange-500">{formatCOP(creditoActivo.cuota_fija)}</span>
              {/* BOTÓN CÍRCULO CON FLECHA
                  COLOR NORMAL: bg-orange-100 text-orange-600
                  COLOR HOVER: group-hover:bg-orange-500 group-hover:text-white
                  TAMAÑO: w-10 h-10 (40x40px), BORDES: rounded-full */}
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
            {/* TEXTO HINT — text-xs (12px), text-slate-400 (gris claro) */}
            <span className="text-xs text-slate-400">Toca para ver plan de pagos →</span>
          </div>
        </Link>
      ) : solicitudAprobada ? (
        <SolicitudDesembolsoPendiente solicitud={solicitudAprobada} variant="card" />
      ) : solicitudEnCurso ? (
        // ── SOLICITUD EN EVALUACIÓN ──
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Solicitud en evaluación</h3>
              <p className="text-sm text-slate-500">Enviada el {fmtFecha(ultimaSolicitud.fechaSolicitud)}</p>
            </div>
            {/* BADGE DE ESTADO */}
            <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 self-start">
              <Clock className="w-3.5 h-3.5" /> En evaluación
            </span>
          </div>

          {/* DATOS DE LA SOLICITUD */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-6">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monto solicitado</span>
              <p className="text-lg font-bold text-slate-900 mt-1">{formatCOP(ultimaSolicitud.monto)}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plazo</span>
              <p className="text-lg font-bold text-slate-900 mt-1">{ultimaSolicitud.plazo} meses</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</span>
              <p className="text-lg font-bold text-blue-600 mt-1">En evaluación</p>
            </div>
          </div>

          <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
            Nuestro equipo está revisando tu información. Un asesor te contactará muy pronto para confirmar tus datos.
            No necesitas hacer nada más por ahora.
          </p>
        </div>
      ) : solicitudRechazada ? (
        // ── SOLICITUD RECHAZADA ──
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Solicitud no aprobada</h3>
              <p className="text-sm text-slate-500">Enviada el {fmtFecha(ultimaSolicitud.fechaSolicitud)}</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 self-start">
              No aprobada
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-6">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monto solicitado</span>
              <p className="text-lg font-bold text-slate-900 mt-1">{formatCOP(ultimaSolicitud.monto)}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plazo</span>
              <p className="text-lg font-bold text-slate-900 mt-1">{ultimaSolicitud.plazo} meses</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</span>
              <p className="text-lg font-bold text-slate-600 mt-1">No aprobada</p>
            </div>
          </div>

          {/* REINTENTO */}
          {!ultimaSolicitud.puedeReintentar ? (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
              <CalendarClock className="w-5 h-5 text-orange-500 shrink-0" />
              <p className="text-sm text-slate-600">
                Por política de crédito, entre una solicitud y la siguiente deben pasar
                90 días. Podrás volver a solicitar tu crédito a partir del{' '}
                <strong className="text-slate-800">{fmtFecha(ultimaSolicitud.fechaReintento)}</strong>.
              </p>
            </div>
          ) : (
            <Link
              href="/dashboard/creditos/solicitar"
              className="self-start bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md"
            >
              Solicitar de nuevo
            </Link>
          )}
        </div>
      ) : (
        // ESTADO VACÍO (sin crédito activo)
        // COLOR FONDO: bg-white, BORDE: border border-slate-200
        // BORDES: rounded-3xl (24px), PADDING: p-12 (48px), centrado
        <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          {/* ÍCONO RELOJ
              COLOR FONDO: bg-slate-100 (gris claro), BORDES: rounded-full
              TAMAÑO: w-16 h-16 (64x64px), ÍCONO: w-8 h-8 (32x32px), text-slate-400 */}
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          {/* TÍTULO — text-xl (20px), font-bold, text-slate-800 */}
          <h3 className="text-xl font-bold text-slate-800 mb-2">No tienes un crédito activo</h3>
          <p className="text-slate-500 max-w-sm mb-6">Solicita un nuevo desembolso o espera a que tu solicitud sea aprobada por el analista.</p>
          {/* BOTÓN "Solicitar Crédito"
              COLOR: bg-orange-500 hover:bg-orange-400 (naranja)
              PADDING: px-6 py-3 (24px horizontal, 12px vertical)
              BORDES: rounded-xl (12px)
              SOMBRA: shadow-md */}
          <Link
            href="/dashboard/creditos/solicitar"
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md"
          >
            Solicitar Crédito
          </Link>
        </div>
      )}

      {/* ── HISTORIAL DE CRÉDITOS FINALIZADOS (solo visible si hay créditos históricos) ── */}
      {creditosHistoricos.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* ÍCONO HISTORIAL
                  COLOR FONDO: bg-slate-100, TAMAÑO: w-8 h-8 (32x32px)
                  ÍCONO: w-4 h-4 (16x16px), text-slate-500 */}
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <History className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                {/* TÍTULO — text-lg (18px), font-bold, text-slate-800 */}
                <h2 className="text-lg font-bold text-slate-800">Historial de Créditos</h2>
                {/* SUBTÍTULO — text-xs (12px), text-slate-400 */}
                <p className="text-xs text-slate-400">{creditosHistoricos.length} crédito{creditosHistoricos.length > 1 ? 's' : ''} finalizado{creditosHistoricos.length > 1 ? 's' : ''} · Total desembolsado: {formatCOP(totalDesembolsadoHistorico)}</p>
              </div>
            </div>
          </div>

          {/* LISTA DE CRÉDITOS HISTÓRICOS — gap-3 (12px entre tarjetas) */}
          <div className="grid gap-3">
            {creditosHistoricos.map((cred) => {
              const fechaDesembolso = new Date(cred.fecha_desembolso).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
              const cierre   = fechasCierre[cred.id_credito]
              const fechaFin = cierre
                ? new Date(`${cierre}T00:00:00`).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
                : '—'

              return (
                // TARJETA DE CRÉDITO HISTÓRICO
                // COLOR FONDO: bg-white, BORDE: border border-slate-200/80
                // BORDES: rounded-2xl (16px), PADDING: p-5 (20px)
                // hover:bg-slate-50/50 (levemente gris al hover)
                <div
                  key={cred.id_credito}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* ÍCONO AWARD (premio — indica crédito pagado exitosamente)
                        COLOR FONDO: bg-emerald-50 (verde muy claro)
                        TAMAÑO: w-10 h-10 (40x40px), BORDES: rounded-xl (12px)
                        ÍCONO: w-5 h-5 (20x20px), text-emerald-500 (verde) */}
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {/* MONTO — font-semibold, text-slate-800 */}
                        <span className="font-semibold text-slate-800">{formatCOP(cred.monto_desembolsado)}</span>
                        {/* BADGE "Pagado"
                            COLOR FONDO: bg-emerald-50, COLOR TEXTO: text-emerald-600
                            BORDE: border border-emerald-200
                            PADDING: px-2 py-0.5, BORDES: rounded-md (6px)
                            TAMAÑO: text-[10px] (10px — muy pequeño), font-bold, uppercase */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Pagado
                        </span>
                      </div>
                      {/* DETALLES — text-xs (12px), text-slate-400, mt-0.5 */}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cred.numero_cuotas} cuotas · {fechaDesembolso} → {fechaFin}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      {/* CUOTA MENSUAL — text-sm (14px), font-semibold, text-slate-600 */}
                      <p className="text-sm font-semibold text-slate-600">{formatCOP(cred.cuota_fija)}<span className="text-slate-400 font-normal">/mes</span></p>
                      {/* ID DEL CRÉDITO — text-[10px] (10px), text-slate-400, uppercase */}
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">#{cred.id_credito.substring(0,8).toUpperCase()}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
