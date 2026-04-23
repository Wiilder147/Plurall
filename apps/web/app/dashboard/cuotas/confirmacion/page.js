'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, FileText, Download, ArrowLeft } from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'
import { Suspense } from 'react'

function ConfirmacionContent() {
  const searchParams = useSearchParams()
  const amount = searchParams.get('amount') || 0
  const idCuota = searchParams.get('id') || 1

  return (
    <div className="max-w-2xl mx-auto pb-12 mt-10">
      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
        
        {/* Cabecera Verde de Éxito */}
        <div className="bg-emerald-500 p-8 flex flex-col items-center justify-center text-center text-white relative overflow-hidden">
          {/* Círculos decorativos de fondo */}
          <div className="absolute w-64 h-64 bg-white/10 rounded-full blur-xl -top-1/2 -left-1/4"></div>
          <div className="absolute w-48 h-48 bg-white/10 rounded-full blur-xl -bottom-1/4 -right-1/4"></div>
          
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 relative z-10">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight relative z-10">¡Pago Exitoso!</h2>
          <p className="text-emerald-50 font-medium mt-1 relative z-10">Tu cuota ha sido procesada con éxito.</p>
        </div>

        {/* Detalles del Recibo */}
        <div className="p-8">
          <div className="border-b border-slate-100 pb-6 mb-6">
            <p className="text-slate-500 text-sm text-center font-medium mb-1">Total Pagado</p>
            <p className="text-4xl font-extrabold text-slate-900 text-center">{formatCOP(Number(amount))}</p>
          </div>

          <ul className="space-y-4 text-sm mb-8">
            <li className="flex justify-between">
              <span className="text-slate-500 font-medium">Concepto</span>
              <span className="font-bold text-slate-900">Pago de Cuota #{idCuota}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-slate-500 font-medium">Método de Pago</span>
              <span className="font-bold text-slate-900">Pasarela Wompi</span>
            </li>
            <li className="flex justify-between">
              <span className="text-slate-500 font-medium">Número de Aprobación</span>
              <span className="font-bold text-slate-900">WP-{Math.floor(Math.random() * 1000000)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-slate-500 font-medium">Fecha y Hora</span>
              <span className="font-bold text-slate-900">{new Date().toLocaleString('es-CO')}</span>
            </li>
          </ul>

          <div className="flex flex-col gap-3">
            <button className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl transition-all">
              <Download className="w-5 h-5" /> Descargar Paz y Salvo PDF
            </button>
            <Link 
              href="/dashboard/creditos"
              className="flex items-center justify-center gap-2 w-full bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold py-3.5 rounded-xl transition-all"
            >
              <ArrowLeft className="w-5 h-5" /> Volver a mis créditos
            </Link>
          </div>
        </div>
      </div>
{/* 
      <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1">
        <FileText className="w-3.5 h-3.5" /> Este documento es un comprobante válido emitido por Plurall.
      </p> */}
    </div>
  )
}

export default function PagoConfirmacion() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ConfirmacionContent />
    </Suspense>
  )
}
