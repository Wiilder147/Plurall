import { procesarDocumento, boxDeudor, boxAcreedor, firmasDoc, fmtFechaDoc, formatCOP } from '@/lib/documentosHandler'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { creditoId } = await params
  return procesarDocumento(request, {
    creditoId,
    tipoSlug: 'paz-y-salvo',
    titulo: 'Paz y Salvo',
    extraValidate: (credito) =>
      credito.estado_credito !== 'CANCELADO' ? 'El paz y salvo solo está disponible para créditos cancelados.' : null,
    buildCuerpo: async ({ credito, titular, supabase }) => {
      const { data: plan } = await supabase.from('plan_pago').select('id_plan_pago').eq('id_credito', credito.id_credito).single()
      let totalPagado = 0
      if (plan) {
        const { data: cuotas } = await supabase.from('cuota').select('monto_total_cuota').eq('id_plan_pago', plan.id_plan_pago).in('estado_cuota', ['PAGADA', 'PAGADA_MORA', 'CONDONADA'])
        totalPagado = cuotas?.reduce((s, c) => s + (c.monto_total_cuota || 0), 0) || 0
      }
      return `
        <div class="grid2">${boxDeudor(titular)}${boxAcreedor()}</div>
        <div class="section">
          <div class="legal" style="text-align:center;padding:32px">
            <p style="font-size:18px;font-weight:800;color:#166534;margin-bottom:16px">PAZ Y SALVO</p>
            <p>PLURALL certifica que <strong>${titular.nombre_completo}</strong>, identificado con C.C. <strong>${titular.dni}</strong>,
            ha cancelado en su totalidad el crédito N.° ${credito.id_credito.slice(-8).toUpperCase()} por valor de
            <strong>${formatCOP(credito.monto_desembolsado)}</strong>, con un total pagado de <strong>${formatCOP(totalPagado)}</strong>.</p>
            <p style="margin-top:16px">Fecha de expedición: ${fmtFechaDoc(new Date().toISOString())}</p>
          </div>
        </div>
        ${firmasDoc(titular)}`
    },
  })
}
