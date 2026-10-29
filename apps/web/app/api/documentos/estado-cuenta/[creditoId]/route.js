import { labelEstadoCredito } from '@/lib/estados'
import { resumenMora } from '@/lib/credito'
import { procesarDocumento, boxDeudor, boxAcreedor, fmtFechaDoc, formatCOP } from '@/lib/documentosHandler'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { creditoId } = await params
  return procesarDocumento(request, {
    creditoId,
    tipoSlug: 'estado-cuenta',
    titulo: 'Estado de Cuenta',
    buildCuerpo: async ({ credito, titular, supabase }) => {
      const { data: plan } = await supabase.from('plan_pago').select('id_plan_pago').eq('id_credito', credito.id_credito).single()
      let cuotas = []
      if (plan) {
        const { data } = await supabase.from('cuota').select('*').eq('id_plan_pago', plan.id_plan_pago).order('numero_cuota')
        cuotas = data || []
      }
      const pagadas = cuotas.filter(c => ['PAGADA', 'PAGADA_MORA', 'CONDONADA'].includes(c.estado_cuota))
      // M-04: atraso y días de mora calculados al generar (RN-08), no el valor
      // guardado que el cron deja de actualizar.
      const { enAtraso: vencidas, diasMoraMax } = resumenMora(cuotas, credito.dias_mora_maximo)
      const totalPagado = pagadas.reduce((s, c) => s + (c.monto_total_cuota || 0), 0)
      const totalVencido = vencidas.reduce((s, c) => s + (c.monto_total_cuota || 0), 0)

      return `
        <div class="grid2">${boxDeudor(titular)}${boxAcreedor()}</div>
        <div class="section">
          <div class="section-title">Situación actual — ${fmtFechaDoc(new Date().toISOString())}</div>
          <div class="box">
            <div class="row"><span class="lbl">Estado crédito</span><span class="val">${labelEstadoCredito(credito.estado_credito)}</span></div>
            <div class="row"><span class="lbl">Saldo pendiente</span><span class="val">${formatCOP(credito.saldo_pendiente)}</span></div>
            <div class="row"><span class="lbl">Total pagado</span><span class="val">${formatCOP(totalPagado)}</span></div>
            <div class="row"><span class="lbl">Cuotas vencidas</span><span class="val">${vencidas.length} (${formatCOP(totalVencido)})</span></div>
            <div class="row"><span class="lbl">Cuotas pagadas</span><span class="val">${pagadas.length} / ${cuotas.length}</span></div>
            <div class="row"><span class="lbl">Días mora máx.</span><span class="val">${diasMoraMax}</span></div>
          </div>
        </div>`
    },
  })
}
