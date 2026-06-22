import { procesarDocumento, boxDeudor, boxAcreedor, fmtFechaDoc, formatCOP } from '@/lib/documentosHandler'

export const dynamic = 'force-dynamic'

const BADGE = {
  PAGADA: 'badge-pagada', PAGADA_MORA: 'badge-pagada', CONDONADA: 'badge-pagada',
  VENCIDA: 'badge-vencida', PENDIENTE: 'badge-pendiente',
}

export async function GET(request, { params }) {
  const { creditoId } = await params
  return procesarDocumento(request, {
    creditoId,
    tipoSlug: 'plan-pagos',
    titulo: 'Plan de Pagos',
    buildCuerpo: async ({ credito, titular, supabase }) => {
      const { data: plan } = await supabase.from('plan_pago').select('id_plan_pago').eq('id_credito', credito.id_credito).single()
      let cuotas = []
      if (plan) {
        const { data } = await supabase.from('cuota').select('*').eq('id_plan_pago', plan.id_plan_pago).order('numero_cuota')
        cuotas = data || []
      }
      const filas = cuotas.map(c => `
        <tr>
          <td>${c.numero_cuota}</td>
          <td>${fmtFechaDoc(c.fecha_vencimiento)}</td>
          <td style="text-align:right">${formatCOP(c.monto_capital)}</td>
          <td style="text-align:right">${formatCOP(c.monto_interes)}</td>
          <td style="text-align:right;font-weight:700">${formatCOP(c.monto_total_cuota)}</td>
          <td><span class="badge ${BADGE[c.estado_cuota] || 'badge-pendiente'}">${c.estado_cuota}</span></td>
        </tr>`).join('')

      return `
        <div class="grid2">${boxDeudor(titular)}${boxAcreedor()}</div>
        <div class="section">
          <div class="section-title">Resumen</div>
          <div class="box">
            <div class="row"><span class="lbl">Monto</span><span class="val">${formatCOP(credito.monto_desembolsado)}</span></div>
            <div class="row"><span class="lbl">Cuota fija</span><span class="val">${formatCOP(credito.cuota_fija)}</span></div>
            <div class="row"><span class="lbl">Cuotas</span><span class="val">${credito.numero_cuotas}</span></div>
          </div>
        </div>
        <div class="section"><div class="section-title">Cronograma</div>
          <table><thead><tr><th>#</th><th>Vencimiento</th><th>Capital</th><th>Interés</th><th>Total</th><th>Estado</th></tr></thead><tbody>${filas || '<tr><td colspan="6">Sin cuotas</td></tr>'}</tbody></table>
        </div>`
    },
  })
}
