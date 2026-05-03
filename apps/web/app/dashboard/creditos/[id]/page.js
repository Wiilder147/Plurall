import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, CreditCard } from 'lucide-react'
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

  // 1. Obtener cliente y crédito en paralelo
  const [{ data: credito, error: credError }, { data: cliente }] = await Promise.all([
    supabase
      .from('credito')
      .select(`
        id_credito,
        monto_desembolsado,
        numero_cuotas,
        cuota_fija,
        saldo_pendiente,
        estado_credito,
        tasa_interes_anual,
        fecha_desembolso,
        id_cliente
      `)
      .eq('id_credito', idCredito)
      .single(),
    supabase.from('cliente').select('id_cliente').eq('id_usuario_cuenta', user.id).single(),
  ])

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
  const totalPagado    = cuotas.reduce((acc, curr) => acc + (curr.monto_pagado_real || 0), 0)
  const cuotasPagadas  = cuotas.filter(c => ['PAGADA', 'PAGADA_MORA', 'CONDONADA'].includes(c.estado_cuota)).length
  const cuotasVencidas = cuotas.filter(c => c.estado_cuota === 'VENCIDA').length
  const enMora         = credito.estado_credito === 'EN_MORA'

  // Badge de estado del crédito
  const estadoBadge = {
    ACTIVO:    { label: 'ACTIVO',    cls: 'bg-emerald-100 text-emerald-700' },
    EN_MORA:   { label: 'EN MORA',   cls: 'bg-red-100 text-red-700' },
    CANCELADO: { label: 'CANCELADO', cls: 'bg-slate-100 text-slate-600' },
    CASTIGADO: { label: 'CASTIGADO', cls: 'bg-gray-100 text-gray-600' },
  }[credito.estado_credito] ?? { label: credito.estado_credito, cls: 'bg-slate-100 text-slate-600' }

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
          Préstamo Comercial {idCredito.substring(0, 8).toUpperCase()}
          <span className={`inline-flex items-center px-3 py-1 text-xs font-bold leading-none rounded-full w-fit ${estadoBadge.cls}`}>
            {estadoBadge.label}
          </span>
        </h1>
        <p className="text-slate-500 mt-2">
          Desembolsado el{' '}
          {credito.fecha_desembolso
            ? new Date(credito.fecha_desembolso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
            : '—'}
          {' · '}Tasa E.A. {Number(credito.tasa_interes_anual).toFixed(2)}%
        </p>
      </header>

      {/* Alerta de mora */}
      {enMora && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-700">Crédito en mora — {cuotasVencidas} cuota{cuotasVencidas > 1 ? 's' : ''} vencida{cuotasVencidas > 1 ? 's' : ''}</p>
            <p className="text-sm text-red-600 mt-0.5">
              Cada día de mora genera intereses adicionales. Realiza tu pago lo antes posible.
            </p>
          </div>
        </div>
      )}

      {/* Resumen Superior */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capital Original</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(credito.monto_desembolsado)}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Pendiente</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCOP(credito.saldo_pendiente)}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avance</span>
          <p className="text-xl font-bold text-slate-900 mt-1">{cuotasPagadas} / {credito.numero_cuotas}</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.round((cuotasPagadas / credito.numero_cuotas) * 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Cuota Mensual</span>
          <p className="text-2xl font-black text-orange-600 mt-1">{formatCOP(credito.cuota_fija)}</p>
        </div>
      </div>

      {/* Tabla de cuotas */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-500" />
            Plan de amortización
          </h2>
          <span className="text-xs text-slate-400">
            Intereses totales: {formatCOP(totalIntereses)}
          </span>
        </div>
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
              {cuotas.map((cuota) => {
                const esVencida  = cuota.estado_cuota === 'VENCIDA'
                const esPagable  = ['PENDIENTE', 'VENCIDA'].includes(cuota.estado_cuota)
                const esPagada   = ['PAGADA', 'PAGADA_MORA', 'CONDONADA'].includes(cuota.estado_cuota)
                return (
                  <tr
                    key={cuota.id_cuota}
                    className={`hover:bg-slate-50 transition-colors ${esVencida ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="p-4 pl-6 font-bold text-slate-400">{cuota.numero_cuota}</td>
                    <td className={`p-4 ${esVencida ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                      {new Date(cuota.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                      {esVencida && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">VENCIDA</span>}
                    </td>
                    <td className="p-4 text-slate-600">{formatCOP(cuota.monto_capital)}</td>
                    <td className="p-4 text-slate-600">{formatCOP(cuota.monto_interes)}</td>
                    <td className="p-4 font-bold text-slate-900">{formatCOP(cuota.monto_total_cuota)}</td>
                    <td className="p-4 pr-6 text-right">
                      {esPagada && (
                        <span className="inline-flex items-center justify-end gap-1.5 text-xs font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {cuota.estado_cuota === 'PAGADA_MORA' ? 'Pagada c/mora' : 'Pagada'}
                        </span>
                      )}
                      {esPagable && (
                        // ✅ FIX P1: apunta a la pantalla de pago real con Wompi
                        <Link
                          href={`/dashboard/cuotas/${cuota.id_cuota}/pagar`}
                          className={`inline-flex items-center justify-center gap-1.5 font-bold py-1.5 px-4 rounded-lg transition-colors text-xs w-full shadow-sm text-white ${
                            esVencida
                              ? 'bg-red-500 hover:bg-red-600'
                              : 'bg-orange-500 hover:bg-orange-600'
                          }`}
                        >
                          {esVencida ? <AlertTriangle className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          Pagar ahora
                        </Link>
                      )}
                      {cuota.estado_cuota === 'CONDONADA' && (
                        <span className="text-xs font-bold text-purple-600">Condonada</span>
                      )}
                    </td>
                  </tr>
                )
              })}
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
