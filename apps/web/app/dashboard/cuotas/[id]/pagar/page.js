'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/cuotas/[id]/pagar/page.js
 * DESCRIPCIÓN: Pantalla de pago de cuota(s) con el widget de Wompi.
 * FUNCIONALIDAD: Dos modos de pago:
 *                  - "Por cuotas": elegir cuántas cuotas pagar por adelantado.
 *                  - "Otro monto": escribir un valor libre; cubre las cuotas
 *                     completas que alcance y el sobrante queda como saldo a
 *                     favor. Muestra el desglose en vivo vía /api/pagos/cotizar
 *                     y, al confirmar, pide la firma a /api/pagos/iniciar y abre
 *                     el checkout de Wompi.
 * ========================================================================== */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/calculadora'
import {
  ArrowLeft, Shield, Loader2, AlertCircle, DollarSign, CalendarDays,
  TrendingDown, AlertTriangle, ExternalLink, Minus, Plus, CheckCircle2,
  Wallet, ListChecks, Coins,
} from 'lucide-react'
import Link from 'next/link'

const ERRORES_API = {
  401: 'Tu sesión expiró. Inicia sesión de nuevo e intenta pagar.',
  403: 'Esta cuota no te pertenece. Si crees que es un error, contacta soporte.',
  404: 'La cuota que intentas pagar ya no existe.',
  400: 'Esta cuota no está disponible para pago (puede estar pagada o cancelada).',
  429: 'Has hecho demasiados intentos de pago. Espera unos minutos y vuelve a intentar.',
}

export default function PagarCuotaPage({ params }) {
  const router = useRouter()

  const [cuotaId,    setCuotaId]    = useState(null)
  const [cuota,      setCuota]      = useState(null)
  const [credito,    setCredito]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const [modo,       setModo]       = useState('cuotas') // 'cuotas' | 'libre'
  const [numCuotas,  setNumCuotas]  = useState(1)
  const [maxCuotas,  setMaxCuotas]  = useState(1)
  const [montoLibre, setMontoLibre] = useState('')       // string del input

  const [cotizacion, setCotizacion] = useState(null)     // respuesta de /cotizar
  const [cotizando,  setCotizando]  = useState(false)
  const [cotizaError,setCotizaError]= useState(null)     // error suave (inline)

  const [pagando,    setPagando]    = useState(false)
  const [wompiListo, setWompiListo] = useState(false)
  const [wompiError, setWompiError] = useState(null)     // error duro (bloquea pago)

  const debounceRef = useRef(null)

  // ── Cargar el script del widget de Wompi una sola vez ─────────
  useEffect(() => {
    if (typeof window !== 'undefined' && window.WidgetCheckout) { setWompiListo(true); return }
    const script = document.createElement('script')
    script.src   = 'https://checkout.wompi.co/widget.js'
    script.async = true
    script.onload  = () => setWompiListo(true)
    script.onerror = () => setWompiError('No se pudo cargar la pasarela de pago. Revisa tu conexión e intenta de nuevo.')
    document.body.appendChild(script)
  }, [])

  // ── Cotizar (preview, sin escribir en BD) ─────────────────────
  const cotizar = useCallback(async (payload) => {
    setCotizando(true)
    setCotizaError(null)
    try {
      const res = await fetch('/api/pagos/cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCotizacion(data)
        if (typeof data.maxCuotas === 'number') setMaxCuotas(data.maxCuotas)
      } else {
        setCotizacion(null)
        setCotizaError(data?.error || ERRORES_API[res.status] || 'No se pudo calcular el pago.')
      }
    } catch {
      setCotizacion(null)
      setCotizaError('No se pudo calcular el pago. Revisa tu conexión.')
    } finally {
      setCotizando(false)
    }
  }, [])

  // ── Carga inicial ─────────────────────────────────────────────
  useEffect(() => {
    async function cargar() {
      const resolved = await params
      const id = resolved.id
      setCuotaId(id)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: cuotaData, error: cuotaErr } = await supabase
        .from('cuota')
        .select('*, plan_pago ( id_credito )')
        .eq('id_cuota', id)
        .single()

      if (cuotaErr || !cuotaData) { setError('Cuota no encontrada.'); setLoading(false); return }

      const { data: creditoData } = await supabase
        .from('credito')
        .select('*')
        .eq('id_credito', cuotaData.plan_pago.id_credito)
        .single()

      setCuota(cuotaData)
      setCredito(creditoData)
      await cotizar({ cuotaId: id, modo: 'cuotas', numCuotas: 1 })
      setLoading(false)
    }
    cargar()
  }, [params, router, cotizar])

  // ── Modo "por cuotas": cambiar cantidad ───────────────────────
  const cambiarNum = (n) => {
    const nuevo = Math.min(Math.max(1, n), maxCuotas)
    setNumCuotas(nuevo)
    cotizar({ cuotaId, modo: 'cuotas', numCuotas: nuevo })
  }

  // ── Cambiar de pestaña de modo ────────────────────────────────
  const cambiarModo = (nuevoModo) => {
    if (nuevoModo === modo) return
    setModo(nuevoModo)
    setCotizaError(null)
    if (nuevoModo === 'cuotas') {
      cotizar({ cuotaId, modo: 'cuotas', numCuotas })
    } else {
      // Prefill con el valor de la cuota de partida
      const inicial = String(Math.round(Number(cuota?.monto_total_cuota) || 0))
      setMontoLibre(inicial)
      cotizar({ cuotaId, modo: 'libre', montoLibre: Number(inicial) })
    }
  }

  // ── Modo "otro monto": input con debounce ─────────────────────
  const cambiarMonto = (valor) => {
    const limpio = valor.replace(/[^\d]/g, '')
    setMontoLibre(limpio)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (limpio && Number(limpio) > 0) {
        cotizar({ cuotaId, modo: 'libre', montoLibre: Number(limpio) })
      } else {
        setCotizacion(null)
        setCotizaError('Escribe un monto a pagar.')
      }
    }, 500)
  }

  // ── Confirmar y abrir el checkout de Wompi ────────────────────
  const handlePagar = async () => {
    setWompiError(null)
    setPagando(true)
    try {
      const body = modo === 'libre'
        ? { cuotaId, modo: 'libre', montoLibre: Number(montoLibre) }
        : { cuotaId, modo: 'cuotas', numCuotas }

      const res = await fetch('/api/pagos/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let mensaje = ERRORES_API[res.status] || 'No se pudo iniciar el pago. Intenta más tarde.'
        try { const b = await res.json(); if (b?.error) mensaje = b.error } catch { /* sin cuerpo */ }
        setWompiError(mensaje)
        setPagando(false)
        return
      }

      const data = await res.json()

      if (!data.publicKey || !data.hash) {
        setWompiError('La pasarela de pago no está configurada todavía. Intenta más tarde o contacta soporte.')
        setPagando(false)
        return
      }
      if (!window.WidgetCheckout) {
        setWompiError('La pasarela de pago aún se está cargando. Espera un momento e intenta de nuevo.')
        setPagando(false)
        return
      }

      const checkout = new window.WidgetCheckout({
        currency:      'COP',
        amountInCents: data.montoEnCentavos,
        reference:     data.referencia,
        publicKey:     data.publicKey,
        signature:     { integrity: data.hash },
        redirectUrl:   data.redirectUrl,
        customerData: {
          email:       data.email || '',
          fullName:    data.nombre || '',
          phoneNumber: data.telefono || '',
          legalId:     data.dni || '',
          legalIdType: 'CC',
        },
      })

      checkout.open(() => {
        router.push(`/dashboard/cuotas/confirmacion?referencia=${data.referencia}`)
      })
      setPagando(false)
    } catch (e) {
      console.error('[Pago] Error abriendo el checkout:', e)
      setWompiError('Ocurrió un error al abrir la pasarela de pago. Intenta de nuevo.')
      setPagando(false)
    }
  }

  // ── Estados de carga / error ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        Preparando el pago…
      </div>
    )
  }

  if (error || !cuota) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-slate-600">{error || 'No se encontró la cuota.'}</p>
        <Link href="/dashboard/cuotas" className="text-orange-500 font-semibold hover:underline">
          ← Volver a mis cuotas
        </Link>
      </div>
    )
  }

  const cubiertas    = cotizacion?.cuotasCubiertas ?? []
  const montoMora    = cotizacion?.montoMora ?? 0
  const montoBase    = cotizacion?.montoBase ?? 0
  const montoACobrar = cotizacion?.montoACobrar ?? 0
  const saldoPrevio  = cotizacion?.saldoPrevio ?? 0
  const saldoNuevo   = cotizacion?.saldoNuevo ?? 0
  const primera      = cubiertas[0]
  const ultima       = cubiertas[cubiertas.length - 1]
  const vencimiento  = new Date(cuota.fecha_vencimiento).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const puedePagar = !!cotizacion && montoACobrar > 0 && !cotizaError

  return (
    <div className="w-full flex flex-col gap-8 pb-10 max-w-3xl mx-auto">

      <header>
        <Link href="/dashboard/cuotas" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-500 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver al plan de pagos
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pagar</h1>
        <p className="text-slate-500 mt-1">Elige cómo quieres pagar. Serás redirigido al portal seguro de Wompi.</p>
      </header>

      {/* Saldo a favor disponible */}
      {saldoPrevio > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
          <Wallet className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-emerald-800">
            Tienes <strong>{formatCOP(saldoPrevio)}</strong> de saldo a favor. Se aplicará automáticamente a este pago.
          </p>
        </div>
      )}

      {/* Selector de modo + entrada */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => cambiarModo('cuotas')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              modo === 'cuotas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ListChecks className="w-4 h-4" /> Por cuotas
          </button>
          <button
            onClick={() => cambiarModo('libre')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              modo === 'libre' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Coins className="w-4 h-4" /> Otro monto
          </button>
        </div>

        {/* Modo POR CUOTAS */}
        {modo === 'cuotas' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-700">¿Cuántas cuotas quieres pagar?</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Puedes adelantar hasta {maxCuotas} cuota{maxCuotas > 1 ? 's' : ''} pendiente{maxCuotas > 1 ? 's' : ''}.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                onClick={() => cambiarNum(numCuotas - 1)}
                disabled={numCuotas <= 1 || cotizando}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Menos cuotas"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center text-2xl font-extrabold text-slate-900 tabular-nums">{numCuotas}</span>
              <button
                onClick={() => cambiarNum(numCuotas + 1)}
                disabled={numCuotas >= maxCuotas || cotizando}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Más cuotas"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modo OTRO MONTO */}
        {modo === 'libre' && (
          <div>
            <h2 className="font-semibold text-slate-700">¿Cuánto quieres pagar?</h2>
            <p className="text-sm text-slate-400 mt-0.5 mb-3">
              Pagaremos las cuotas completas que alcance el monto; el sobrante queda como saldo a favor.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
              <input
                inputMode="numeric"
                value={montoLibre ? Number(montoLibre).toLocaleString('es-CO') : ''}
                onChange={(e) => cambiarMonto(e.target.value)}
                placeholder="Escribe el valor a pagar"
                className="w-full pl-9 pr-4 py-3 text-lg font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400"
              />
            </div>
          </div>
        )}

        {/* Listado de cuotas cubiertas */}
        {cubiertas.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2">
            {cubiertas.map((c) => (
              <li key={c.id_cuota} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                <span className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Cuota #{c.numero_cuota}
                  {c.monto_mora > 0 && (
                    <span className="text-red-500 text-xs font-medium">+ mora {formatCOP(c.monto_mora)}</span>
                  )}
                </span>
                <span className="font-semibold text-slate-800">{formatCOP(c.monto_total_cuota + c.monto_mora)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Sin cuotas completas (solo abono a saldo) */}
        {modo === 'libre' && cotizacion && cubiertas.length === 0 && !cotizaError && (
          <div className="mt-5 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800">
            <Wallet className="w-4 h-4 mt-0.5 shrink-0" />
            Este monto no completa una cuota; se abonará por completo a tu saldo a favor.
          </div>
        )}

        {/* Error de cotización (inline, suave) */}
        {cotizaError && (
          <p className="mt-4 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" /> {cotizaError}
          </p>
        )}
      </div>

      {/* Resumen del pago */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-700 mb-5">Resumen del pago</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 flex items-center gap-1"><DollarSign className="w-3 h-3" />Total a cobrar</span>
            <span className="text-2xl font-extrabold text-slate-900">{formatCOP(montoACobrar)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays className="w-3 h-3" />Próximo vencimiento</span>
            <span className="font-semibold text-slate-700">{vencimiento}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Cuotas cubiertas</span>
            <span className="font-semibold text-slate-700">
              {primera && ultima
                ? (cubiertas.length > 1 ? `#${primera.numero_cuota} a #${ultima.numero_cuota}` : `#${primera.numero_cuota}`)
                : '—'} {credito?.numero_cuotas ? `de ${credito.numero_cuotas}` : ''}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal cuotas</span>
            <span className="font-semibold">{formatCOP(montoBase)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500"># de cuotas</span>
            <span className="font-semibold">{cubiertas.length}</span>
          </div>
          {montoMora > 0 && (
            <div className="flex justify-between text-red-600 font-semibold col-span-2 border-t border-red-100 pt-2 mt-1">
              <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Intereses de mora</span>
              <span>{formatCOP(montoMora)}</span>
            </div>
          )}
          {saldoPrevio > 0 && (
            <div className="flex justify-between text-emerald-700 col-span-2">
              <span>Saldo a favor aplicado</span>
              <span className="font-semibold">− {formatCOP(saldoPrevio - saldoNuevo)}</span>
            </div>
          )}
          {saldoNuevo > 0 && (
            <div className="flex justify-between text-emerald-700 col-span-2">
              <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Quedará como saldo a favor</span>
              <span className="font-semibold">{formatCOP(saldoNuevo)}</span>
            </div>
          )}
          <div className="flex justify-between col-span-2 border-t border-slate-200 pt-2 font-semibold">
            <span className="text-slate-500">Total a cobrar</span>
            <span className="text-slate-900">{formatCOP(montoACobrar)}</span>
          </div>
        </div>

        {/* Botón de pago / errores */}
        <div className="flex flex-col items-center gap-4">
          {wompiError ? (
            <div className="w-full flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-700 font-medium">{wompiError}</p>
                <Link href="/dashboard/cuotas" className="text-sm text-red-600 underline mt-1 inline-block">
                  ← Volver a mis cuotas
                </Link>
              </div>
            </div>
          ) : (
            <button
              onClick={handlePagar}
              disabled={pagando || cotizando || !wompiListo || !puedePagar}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold py-4 rounded-xl transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pagando || cotizando ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Preparando…</>
              ) : !wompiListo ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Cargando pasarela…</>
              ) : (
                <><DollarSign className="w-5 h-5" /> Pagar {formatCOP(montoACobrar)}</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Seguridad */}
      <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
        <Shield className="w-5 h-5 text-slate-300 shrink-0" />
        <p>
          Pago procesado por <strong className="text-slate-600">Wompi — Bancolombia</strong>.
          Plurall no almacena tus datos de tarjeta. Conexión cifrada con TLS 1.3.
        </p>
      </div>

      {/* Soporte */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <ExternalLink className="w-3 h-3" />
        ¿Problemas con tu pago? Contacta a soporte en <span className="text-slate-500 font-medium">soporte@plurall.app</span>
      </div>
    </div>
  )
}
