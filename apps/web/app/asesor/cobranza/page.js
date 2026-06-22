import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculadora'
import { calcularScoreRiesgo, prioridadLabel } from '@/lib/cobranza'
import StaffPageShell from '@/components/dashboard/StaffPageShell'
import KpiCard, { KpiGrid } from '@/components/dashboard/KpiCard'
import { AlertTriangle, Phone, ArrowRight, DollarSign, Target } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TRAMO = (dias) => {
  if (dias <= 30) return { label: '1-30 días', cls: 'bg-yellow-500/10 text-yellow-400' }
  if (dias <= 60) return { label: '31-60 días', cls: 'bg-orange-500/10 text-orange-400' }
  if (dias <= 90) return { label: '61-90 días', cls: 'bg-red-500/10 text-red-400' }
  return { label: '+90 días', cls: 'bg-red-900/30 text-red-300' }
}

export default async function AsesorCobranzaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: asignaciones } = await supabase
    .from('asignacion_asesor')
    .select(`
      cliente (
        id_cliente, nombre_completo, dni, telefono, email,
        credito (
          id_credito, saldo_pendiente, cuotas_en_mora, dias_mora_maximo,
          cuota_fija, estado_credito, plan_pago ( id_plan_pago )
        )
      )
    `)
    .eq('id_asesor', user.id)
    .eq('activa', true)

  const clientesMora = (asignaciones ?? [])
    .map(a => a.cliente)
    .filter(c => c?.credito?.some(cr => cr.estado_credito === 'EN_MORA'))
    .map(c => ({
      ...c,
      creditoMora: c.credito?.find(cr => cr.estado_credito === 'EN_MORA'),
    }))

  const planIds = clientesMora.map(c => c.creditoMora?.plan_pago?.id_plan_pago).filter(Boolean)
  const cuotasMap = {}
  if (planIds.length > 0) {
    const { data: cuotasV } = await supabase
      .from('cuota')
      .select('id_plan_pago, monto_total_cuota')
      .in('id_plan_pago', planIds)
      .eq('estado_cuota', 'VENCIDA')
    cuotasV?.forEach(c => {
      if (!cuotasMap[c.id_plan_pago]) cuotasMap[c.id_plan_pago] = { count: 0, monto: 0 }
      cuotasMap[c.id_plan_pago].count++
      cuotasMap[c.id_plan_pago].monto += c.monto_total_cuota || 0
    })
  }

  const enriquecidos = clientesMora.map(c => {
    const planId = c.creditoMora?.plan_pago?.id_plan_pago
    const vencidas = planId ? cuotasMap[planId] : { count: 0, monto: 0 }
    const score = calcularScoreRiesgo({
      diasMora: c.creditoMora?.dias_mora_maximo ?? 0,
      saldoPendiente: c.creditoMora?.saldo_pendiente ?? 0,
      cuotasVencidas: vencidas.count,
      montoVencido: vencidas.monto,
    })
    return { ...c, vencidas, score, prioridad: prioridadLabel(score) }
  }).sort((a, b) => b.score - a.score)

  const totalEnRiesgo = enriquecidos.reduce((s, c) => s + (c.creditoMora?.saldo_pendiente ?? 0), 0)

  // Efectividad cobranza del mes
  const inicioMes = new Date()
  inicioMes.setDate(1)
  const { data: gestiones } = await supabase
    .from('gestion_cobranza')
    .select('resultado')
    .eq('id_asesor', user.id)
    .gte('fecha_gestion', inicioMes.toISOString())

  const promesas = gestiones?.filter(g => g.resultado === 'PROMESA').length ?? 0
  const pagos = gestiones?.filter(g => g.resultado === 'PAGO_RECIBIDO').length ?? 0
  const totalG = gestiones?.length ?? 0
  const efectividad = totalG > 0 ? Math.round(((pagos + promesas) / totalG) * 100) : 0

  return (
    <StaffPageShell
      accent="teal"
      badge="Cobranza inteligente"
      title="Cola de cobranza"
      subtitle="Clientes priorizados por score de riesgo (días mora × monto × cuotas vencidas)."
      quickActions={[
        { label: 'Registrar gestión', href: '/asesor/gestiones', icon: Phone },
        { label: 'Pagos efectivo', href: '/asesor/pagos', icon: DollarSign },
      ]}
    >
      <KpiGrid cols={3}>
        <KpiCard accent="teal" label="Clientes en mora" value={enriquecidos.length} icon={AlertTriangle} color="text-red-400 bg-red-500/10" index={0} />
        <KpiCard accent="teal" label="Capital en riesgo" value={formatCOP(totalEnRiesgo)} icon={DollarSign} color="text-orange-400 bg-orange-500/10" index={1} />
        <KpiCard accent="teal" label="Efectividad mes" value={`${efectividad}%`} icon={Target} color="text-emerald-400 bg-emerald-500/10" sublabel={`${pagos} pagos · ${promesas} promesas`} index={2} />
      </KpiGrid>

      {enriquecidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium">Sin clientes en mora. ✓</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {enriquecidos.map((c, i) => {
            const tramo = TRAMO(c.creditoMora?.dias_mora_maximo ?? 0)
            return (
              <Link key={c.id_cliente} href={`/asesor/cobranza/${c.id_cliente}`}
                className="dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-teal-500/30 transition-all animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 font-bold shrink-0">
                    #{i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-200">{c.nombre_completo}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${c.prioridad.cls}`}>{c.prioridad.label}</span>
                      <span className="text-xs text-slate-500">Score {c.score}</span>
                    </div>
                    <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {c.telefono} · CC {c.dni}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tramo.cls}`}>{tramo.label}</span>
                      {c.vencidas?.count > 0 && (
                        <span className="text-xs text-slate-500">{c.vencidas.count} cuota(s) · {formatCOP(c.vencidas.monto)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-red-400 font-extrabold text-xl">{c.creditoMora?.dias_mora_maximo}d</p>
                    <p className="text-slate-400 text-xs">{formatCOP(c.creditoMora?.saldo_pendiente)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </StaffPageShell>
  )
}
