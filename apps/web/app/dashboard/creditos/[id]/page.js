import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, Calendar } from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DetalleCredito({ params }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const resolvedParams = await params
  const idCredito = resolvedParams.id

  // 1. Obtener la información general del Crédito
  const { data: credito, error: credError } = await supabase
    .from('credito')
    .select(`
      monto_desembolsado, 
      numero_cuotas, 
      cuota_fija, 
      saldo_pendiente,
      id_cliente
    `)
    .eq('id_credito', idCredito)
    .single()

  const { data: cliente } = await supabase.from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single()

  if (credError || !credito || credito.id_cliente !== cliente?.id_cliente) {
    return (
      <div className="max-w-4xl mx-auto pb-12 pt-10 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Crédito no encontrado o sin acceso</h2>
        <Link href="/dashboard/creditos" className="text-orange-500 mt-4 inline-block hover:underline">
          Volver a mis créditos
        </Link>
      </div>
    )
  }

  // 2. Obtener el Plan de Pagos asociado
  const { data: plan } = await supabase
    .from('plan_pago')
    .select('id_plan_pago')
    .eq('id_credito', idCredito)
    .single()

  let cuotas = []
  if (plan) {
    // 3. Obtener el desglose de cuotas
    const { data: q } = await supabase
      .from('cuota')
      .select('*')
      .eq('id_plan_pago', plan.id_plan_pago)
      .order('numero_cuota', { ascending: true })
    
    if (q) cuotas = q
  }

  const totalIntereses = cuotas.reduce((acc, curr) => acc + Number(curr.monto_interes), 0)

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <Link 
        href="/dashboard/creditos"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" /> Volver a mis créditos
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl flex-col md:flex-row font-bold text-slate-900 tracking-tight flex md:items-center gap-3">
          Préstamo Comercial {idCredito.substring(0,8).toUpperCase()}
          <span className="inline-flex items-center px-3 py-1 text-xs font-bold leading-none bg-emerald-100 text-emerald-700 rounded-full w-fit">
            ACTIVO
          </span>
        </h1>
        <p className="text-slate-500 mt-2">Detalle cronológico de tu plan de pagos y saldos extraído de base de datos.</p>
      </header>

      {/* Resumen Superior */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capital Original</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(credito.monto_desembolsado)}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Intereses Totales</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(totalIntereses)}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plazo</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{credito.numero_cuotas} meses</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Cuota Mensual</span>
          <p className="text-2xl font-black text-orange-600 mt-1">{formatCOP(credito.cuota_fija)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-500">
                <th className="p-4 pl-6 w-16">#</th>
                <th className="p-4">Vencimiento</th>
                <th className="p-4">Capital</th>
                <th className="p-4">Interés</th>
                <th className="p-4">Total Cuota</th>
                <th className="p-4 pr-6 text-right w-48">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {cuotas.map((cuota) => (
                <tr 
                  key={cuota.id_cuota} 
                  className={`hover:bg-slate-50 transition-colors ${cuota.estado_cuota === 'PENDIENTE' ? 'bg-orange-50/10' : ''}`}
                >
                  <td className="p-4 pl-6 font-bold text-slate-400">{cuota.numero_cuota}</td>
                  <td className="p-4 text-slate-600">{cuota.fecha_vencimiento}</td>
                  <td className="p-4 text-slate-600">{formatCOP(cuota.monto_capital)}</td>
                  <td className="p-4 text-slate-600">{formatCOP(cuota.monto_interes)}</td>
                  <td className="p-4 font-bold text-slate-900">{formatCOP(cuota.monto_total_cuota)}</td>
                  <td className="p-4 pr-6 text-right">
                    {cuota.estado_cuota === 'PAGADA' && (
                      <span className="inline-flex items-center justify-end gap-1.5 px-2.5 py-1 rounded w-full bg-transparent text-xs font-bold text-slate-500">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Pagada
                      </span>
                    )}
                    {cuota.estado_cuota === 'PENDIENTE' && (
                      <Link 
                        href={`/dashboard/cuotas/confirmacion?amount=${cuota.monto_total_cuota}&id=${cuota.numero_cuota}`}
                        className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 px-4 rounded-lg transition-colors text-xs w-full shadow-sm"
                      >
                        Pagar ahora
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {cuotas.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Aún no se ha generado un plan de pagos para este crédito.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
