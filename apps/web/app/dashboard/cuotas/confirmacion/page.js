'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/cuotas/confirmacion/page.js
 * DESCRIPCIÓN: Confirmación de pago tras redirección de Wompi.
 * FUNCIONALIDAD: Consulta el pago por referencia_externa. El webhook de Wompi
 *                puede tardar unos segundos, por eso hace polling automático
 *                cada 4s (hasta ~2 min) mientras el pago está PROCESANDO.
 * ========================================================================== */

import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  FileText,
  ReceiptText,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'
import { createClient } from '@/lib/supabase/client'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

// ─── Tipos de estado del pago ────────────────────────────────────────────────
const ESTADO_UI = {
  confirmado: {
    bg:    'bg-emerald-500',
    icon:  <CheckCircle2 className="w-12 h-12 text-white" />,
    titulo:'¡Pago Exitoso!',
    sub:   'Tu cuota ha sido procesada correctamente.',
  },
  procesando: {
    bg:    'bg-yellow-400',
    icon:  <Clock className="w-12 h-12 text-white" />,
    titulo:'Pago en proceso',
    sub:   'Estamos verificando tu transacción con Wompi.',
  },
  fallido: {
    bg:    'bg-red-500',
    icon:  <XCircle className="w-12 h-12 text-white" />,
    titulo:'Pago no completado',
    sub:   'La transacción no fue aprobada. Puedes intentarlo de nuevo.',
  },
}

const POLL_INTERVAL_MS = 4000 // cada 4 segundos
const POLL_MAX_ATTEMPTS = 30  // ~2 minutos máximo

// ─── Componente principal ────────────────────────────────────────────────────
function ConfirmacionContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  // Wompi redirige con ?referencia=PLR-XXXX-timestamp
  const referencia = searchParams.get('referencia') || ''

  const [estado,    setEstado]    = useState('cargando') // cargando | confirmado | procesando | fallido
  const [pagoData,  setPagoData]  = useState(null)       // fila de la tabla pago
  const [cuotaData, setCuotaData] = useState(null)       // fila de la tabla cuota
  const [creditoId, setCreditoId] = useState(null)
  const [agotado,   setAgotado]   = useState(false)      // polling terminó sin confirmación
  const intentosRef = useRef(0)

  const verificar = useCallback(async () => {
    const supabase = createClient()

    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return false }

    // 2. Buscar el pago por referencia_externa en la BD
    //    El webhook de Wompi debería haberlo actualizado
    const { data: pago } = await supabase
      .from('pago')
      .select('id_recibo, monto_pagado, monto_capital, monto_interes, monto_mora, estado, metodo_pago, fecha_pago, id_cuota, id_credito, referencia_externa')
      .eq('referencia_externa', referencia)
      .maybeSingle()

    if (!pago) {
      // El webhook puede tardar unos segundos — seguir en "procesando"
      return false
    }

    setPagoData(pago)
    setCreditoId(pago.id_credito)

    // 3. Obtener datos de la cuota para mostrar el número
    if (pago.id_cuota) {
      const { data: cuota } = await supabase
        .from('cuota')
        .select('numero_cuota, fecha_vencimiento, estado_cuota')
        .eq('id_cuota', pago.id_cuota)
        .maybeSingle()
      if (cuota) setCuotaData(cuota)
    }

    // 4. Determinar estado visual
    if (pago.estado === 'CONFIRMADO') setEstado('confirmado')
    else if (pago.estado === 'FALLIDO') setEstado('fallido')
    else return false // PROCESANDO → seguir esperando

    return true // ya hay resultado definitivo
  }, [referencia, router])

  useEffect(() => {
    if (!referencia) {
      // Sin referencia → redirigir al dashboard
      router.replace('/dashboard/cuotas')
      return
    }

    intentosRef.current = 0
    let intervalo = null

    const ejecutar = async () => {
      const terminado = await verificar()
      if (terminado) {
        clearInterval(intervalo)
        return
      }
      intentosRef.current += 1
      if (intentosRef.current >= POLL_MAX_ATTEMPTS) {
        clearInterval(intervalo)
        setAgotado(true)
      }
    }

    // Verificar de inmediato y luego hacer polling
    ejecutar()
    intervalo = setInterval(ejecutar, POLL_INTERVAL_MS)

    return () => clearInterval(intervalo)
  }, [referencia, verificar, router])

  // ── Pantalla de carga ────────────────────────────────────────
  if (estado === 'cargando') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm">Verificando tu pago…</p>
      </div>
    )
  }

  const ui      = ESTADO_UI[estado] ?? ESTADO_UI.procesando
  const fechaPago = pagoData?.fecha_pago
    ? new Date(pagoData.fecha_pago).toLocaleString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : new Date().toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // Referencia corta para mostrar al usuario
  const refCorta = referencia ? referencia.split('-').slice(0, 2).join('-') : '—'

  return (
    <div className="w-full max-w-2xl mx-auto pb-12 mt-10">
      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">

        {/* ── Cabecera de estado ── */}
        <div className={`${ui.bg} p-8 flex flex-col items-center justify-center text-center text-white relative overflow-hidden`}>
          <div className="absolute w-64 h-64 bg-white/10 rounded-full blur-xl -top-1/2 -left-1/4" />
          <div className="absolute w-48 h-48 bg-white/10 rounded-full blur-xl -bottom-1/4 -right-1/4" />
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 relative z-10">
            {ui.icon}
          </div>
          <h2 className="text-3xl font-bold tracking-tight relative z-10">{ui.titulo}</h2>
          <p className="text-white/80 font-medium mt-1 relative z-10">{ui.sub}</p>
        </div>

        {/* ── Cuerpo del recibo ── */}
        <div className="p-8">

          {/* Monto pagado */}
          {pagoData && estado === 'confirmado' && (
            <div className="border-b border-slate-100 pb-6 mb-6 text-center">
              <p className="text-slate-500 text-sm font-medium mb-1">Total pagado</p>
              <p className="text-4xl font-extrabold text-slate-900">{formatCOP(pagoData.monto_pagado)}</p>
            </div>
          )}

          {/* Aviso procesando */}
          {estado === 'procesando' && (
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-6">
              <Loader2 className="w-5 h-5 text-yellow-500 animate-spin mt-0.5 shrink-0" />
              <div className="text-sm text-yellow-800">
                <p>
                  Tu pago está siendo procesado. Esto puede tardar hasta 2 minutos.
                  Estamos verificando automáticamente el estado…
                </p>
                {agotado && (
                  <p className="mt-2 flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    La verificación está tardando más de lo normal. Revisa <strong>Mis Cuotas</strong> en unos minutos.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Aviso fallido */}
          {estado === 'fallido' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-800">
                La transacción fue rechazada por la pasarela de pago. No se realizó ningún cobro.
                Puedes intentarlo de nuevo desde <strong>Mis Cuotas</strong>.
              </p>
            </div>
          )}

          {/* Detalle del recibo */}
          <ul className="space-y-3 text-sm mb-8">
            {cuotaData && (
              <li className="flex justify-between">
                <span className="text-slate-500 font-medium">Concepto</span>
                <span className="font-bold text-slate-900">
                  Cuota #{cuotaData.numero_cuota}
                  {cuotaData.fecha_vencimiento && (
                    <span className="text-slate-400 font-normal ml-1">
                      (venc. {new Date(cuotaData.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })})
                    </span>
                  )}
                </span>
              </li>
            )}
            <li className="flex justify-between">
              <span className="text-slate-500 font-medium">Referencia</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{referencia || '—'}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-slate-500 font-medium">Método de pago</span>
              <span className="font-bold text-slate-900">{pagoData?.metodo_pago ?? 'Wompi'}</span>
            </li>
            {pagoData && estado === 'confirmado' && (
              <>
                <li className="flex justify-between">
                  <span className="text-slate-500 font-medium">Capital abonado</span>
                  <span className="font-bold text-slate-900">{formatCOP(pagoData.monto_capital)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-500 font-medium">Intereses</span>
                  <span className="font-bold text-slate-900">{formatCOP(pagoData.monto_interes)}</span>
                </li>
                {pagoData.monto_mora > 0 && (
                  <li className="flex justify-between text-red-600">
                    <span className="font-medium">Mora cobrada</span>
                    <span className="font-bold">{formatCOP(pagoData.monto_mora)}</span>
                  </li>
                )}
              </>
            )}
            <li className="flex justify-between">
              <span className="text-slate-500 font-medium">Fecha y hora</span>
              <span className="font-bold text-slate-900">{fechaPago}</span>
            </li>
          </ul>

          {/* Acciones */}
          <div className="flex flex-col gap-3">
            {/* Estado de cuenta — solo si el pago fue confirmado y tenemos creditoId */}
            {estado === 'confirmado' && creditoId && (
              <a
                href={`/api/documentos/estado-cuenta/${creditoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl transition-all"
              >
                <ReceiptText className="w-5 h-5" /> Ver estado de cuenta
              </a>
            )}

            {/* Reintentar verificación (cuando el polling se agotó) */}
            {estado === 'procesando' && agotado && (
              <button
                onClick={async () => {
                  setAgotado(false)
                  intentosRef.current = 0
                  await verificar()
                }}
                className="flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3.5 rounded-xl transition-all"
              >
                <RefreshCw className="w-5 h-5" /> Consultar de nuevo
              </button>
            )}

            {/* Volver a cuotas */}
            <Link
              href="/dashboard/cuotas"
              className="flex items-center justify-center gap-2 w-full bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold py-3.5 rounded-xl transition-all"
            >
              <ArrowLeft className="w-5 h-5" /> Volver a mis cuotas
            </Link>
          </div>

          {/* Nota legal */}
          <p className="text-center text-xs text-slate-400 mt-5 flex items-center justify-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Este comprobante es válido como constancia de pago emitida por Plurall.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PagoConfirmacion() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <ConfirmacionContent />
    </Suspense>
  )
}