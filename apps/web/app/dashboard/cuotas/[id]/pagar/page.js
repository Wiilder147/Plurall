'use client'

/* ==========================================================================
 * ARCHIVO: page.js
 * RUTA: apps/web/app/dashboard/cuotas/[id]/pagar/page.js
 * DESCRIPCIÓN: Vista del panel de control del usuario.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/calculadora'
import {
  ArrowLeft,
  Shield,
  Loader2,
  AlertCircle,
  DollarSign,
  CalendarDays,
  TrendingDown,
} from 'lucide-react'
import Link from 'next/link'

export default function PagarCuotaPage({ params }) {
  const router   = useRouter()
  const formRef  = useRef(null)

  const [cuota,    setCuota]    = useState(null)
  const [credito,  setCredito]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [wompiData,setWompiData]= useState(null)
  const [error,    setError]    = useState(null)

  // ── Carga datos de la cuota ──────────────────────────────────
  useEffect(() => {
    async function cargar() {
      const resolvedParams = await params
      const cuotaId = resolvedParams.id

      const supabase = createClient()

      // Verificar sesión
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Obtener cuota
      const { data: cuotaData, error: cuotaErr } = await supabase
        .from('cuota')
        .select(`*, plan_pago ( id_credito )`)
        .eq('id_cuota', cuotaId)
        .single()

      if (cuotaErr || !cuotaData) { setError('Cuota no encontrada.'); setLoading(false); return }

      // Obtener crédito
      const { data: creditoData } = await supabase
        .from('credito')
        .select('*')
        .eq('id_credito', cuotaData.plan_pago.id_credito)
        .single()

      setCuota(cuotaData)
      setCredito(creditoData)

      // Solicitar datos de Wompi al servidor (firma de integridad)
      const res = await fetch('/api/pagos/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuotaId }),
      })

      if (res.ok) {
        const data = await res.json()
        setWompiData(data)
      } else {
        setError('No se pudo inicializar el sistema de pago. Intenta más tarde.')
      }

      setLoading(false)
    }
    cargar()
  }, [params, router])

  // ── Inyectar widget Wompi cuando los datos están listos ───────
  useEffect(() => {
    if (!wompiData || !formRef.current) return

    // Limpiar script anterior si existe
    const existente = formRef.current.querySelector('script')
    if (existente) existente.remove()

    const script = document.createElement('script')
    script.src = 'https://checkout.wompi.co/widget.js'
    script.setAttribute('data-render',           'button')
    script.setAttribute('data-public-key',       wompiData.publicKey)
    script.setAttribute('data-currency',         'COP')
    script.setAttribute('data-amount-in-cents',  String(wompiData.montoEnCentavos))
    script.setAttribute('data-reference',        wompiData.referencia)
    script.setAttribute('data-signature:integrity', wompiData.hash)
    script.setAttribute('data-redirect-url',     wompiData.redirectUrl)
    script.setAttribute('data-customer-data:email',        wompiData.email || '')
    script.setAttribute('data-customer-data:full-name',    wompiData.nombre || '')
    script.setAttribute('data-customer-data:phone-number', wompiData.telefono || '')
    script.setAttribute('data-customer-data:legal-id',     wompiData.dni || '')
    script.setAttribute('data-customer-data:legal-id-type','CC')

    formRef.current.appendChild(script)
  }, [wompiData])

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

  const vencimiento = new Date(cuota.fecha_vencimiento).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="w-full flex flex-col gap-8 pb-10 max-w-2xl">

      <header>
        <Link href="/dashboard/cuotas" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-500 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver al plan de pagos
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pagar Cuota</h1>
        <p className="text-slate-500 mt-1">Serás redirigido al portal seguro de Wompi.</p>
      </header>

      {/* Resumen de la cuota */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-slate-700 mb-5">Resumen del pago</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 flex items-center gap-1"><DollarSign className="w-3 h-3" />Total a pagar</span>
            <span className="text-2xl font-extrabold text-slate-900">{formatCOP(cuota.monto_total_cuota)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays className="w-3 h-3" />Vencimiento</span>
            <span className="font-semibold text-slate-700">{vencimiento}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Cuota #</span>
            <span className="font-semibold text-slate-700">{cuota.numero_cuota} de {credito?.numero_cuotas}</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-slate-500">Capital</span>
            <span className="font-semibold">{formatCOP(cuota.monto_capital)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Interés</span>
            <span className="font-semibold">{formatCOP(cuota.monto_interes)}</span>
          </div>
          {cuota.estado_cuota === 'VENCIDA' && (
            <div className="flex justify-between col-span-2 text-red-600 font-semibold">
              <span>⚠️ Mora acumulada</span>
              <span>Se calculará al pagar</span>
            </div>
          )}
        </div>

        {/* Botón Wompi */}
        <div className="flex flex-col items-center gap-4">
          {wompiData ? (
            <form ref={formRef} className="w-full flex justify-center" />
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando pasarela de pago…
            </div>
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
    </div>
  )
}
