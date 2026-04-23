import Link from 'next/link'
import { ArrowRight, CheckCircle2, AlertCircle, Clock, CreditCard, Lock, History, Award } from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MisCreditos() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/login')

  // ── Buscar cliente ──
  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  let creditoActivo = null
  let creditosHistoricos = []

  if (clienteRow) {
    // Crédito activo (ACTIVO o EN_MORA)
    const { data: activo } = await supabase
      .from('credito')
      .select('*')
      .eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['ACTIVO', 'EN_MORA'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    creditoActivo = activo

    // Créditos ya finalizados (PAGADO, CANCELADO, CASTIGADO)
    const { data: historicos } = await supabase
      .from('credito')
      .select('*')
      .eq('id_cliente', clienteRow.id_cliente)
      .in('estado_credito', ['PAGADO', 'CANCELADO', 'CASTIGADO'])
      .order('created_at', { ascending: false })

    creditosHistoricos = historicos || []
  }

  const tieneActivo = !!creditoActivo
  const enMora = creditoActivo?.estado_credito === 'EN_MORA'
  const progreso = tieneActivo ? Math.round((creditoActivo.cuotas_pagadas / creditoActivo.numero_cuotas) * 100) : 0
  const totalDesembolsadoHistorico = creditosHistoricos.reduce((acc, c) => acc + c.monto_desembolsado, 0)

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Créditos</h1>
          <p className="text-slate-500 mt-2">
            {tieneActivo 
              ? 'Regla de negocio: solo puedes mantener 1 crédito activo a la vez.'
              : 'Consulta el estado de tus préstamos y paga a tiempo.'}
          </p>
        </div>
        {tieneActivo ? (
          <div className="inline-flex items-center gap-2 bg-slate-200 text-slate-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed select-none">
            <Lock className="w-4 h-4" />
            Crédito activo vigente
          </div>
        ) : (
          <Link 
            href="/dashboard/creditos/solicitar"
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Solicitar Crédito
          </Link>
        )}
      </header>

      {/* ── CRÉDITO ACTIVO ── */}
      {tieneActivo ? (
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
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                enMora ? 'bg-red-100' : 'bg-emerald-100'
              }`}>
                <CreditCard className={`w-5 h-5 ${enMora ? 'text-red-500' : 'text-emerald-600'}`} />
              </div>
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Préstamo Comercial #{creditoActivo.id_credito.substring(0,8).toUpperCase()}
              </span>
            </div>

            <h3 className="text-3xl font-black text-slate-900">{formatCOP(creditoActivo.monto_desembolsado)}</h3>
            
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {enMora ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" /> En mora — {creditoActivo.cuotas_en_mora} cuota{creditoActivo.cuotas_en_mora > 1 ? 's' : ''} vencida{creditoActivo.cuotas_en_mora > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Al día
                </span>
              )}
              <span className="text-sm font-medium text-slate-500">
                Avance: {creditoActivo.cuotas_pagadas} de {creditoActivo.numero_cuotas} cuotas
              </span>
            </div>

            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-1">
              <div 
                className={`h-2 rounded-full transition-all ${enMora ? 'bg-red-500' : 'bg-emerald-500'}`} 
                style={{ width: `${progreso}%` }}
              ></div>
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-2 bg-slate-50/80 md:bg-transparent p-4 md:p-0 rounded-xl">
            <span className="text-sm text-slate-500 font-medium">Cuota mensual</span>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-orange-500">{formatCOP(creditoActivo.cuota_fija)}</span>
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
            <span className="text-xs text-slate-400">Toca para ver plan de pagos →</span>
          </div>
        </Link>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No tienes un crédito activo</h3>
          <p className="text-slate-500 max-w-sm mb-6">Solicita un nuevo desembolso o espera a que tu solicitud sea aprobada por el analista.</p>
          <Link 
            href="/dashboard/creditos/solicitar"
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md"
          >
            Solicitar Crédito
          </Link>
        </div>
      )}

      {/* ── HISTORIAL DE CRÉDITOS PAGADOS ── */}
      {creditosHistoricos.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <History className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Historial de Créditos</h2>
                <p className="text-xs text-slate-400">{creditosHistoricos.length} crédito{creditosHistoricos.length > 1 ? 's' : ''} finalizado{creditosHistoricos.length > 1 ? 's' : ''} · Total desembolsado: {formatCOP(totalDesembolsadoHistorico)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {creditosHistoricos.map((cred) => {
              const fechaDesembolso = new Date(cred.fecha_desembolso).toLocaleDateString('es-CO', { 
                month: 'short', year: 'numeric' 
              })
              const fechaFin = new Date(cred.updated_at).toLocaleDateString('es-CO', { 
                month: 'short', year: 'numeric' 
              })

              return (
                <div 
                  key={cred.id_credito}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{formatCOP(cred.monto_desembolsado)}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Pagado
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cred.numero_cuotas} cuotas · {fechaDesembolso} → {fechaFin}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">{formatCOP(cred.cuota_fija)}<span className="text-slate-400 font-normal">/mes</span></p>
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
