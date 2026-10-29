import { labelEstadoCredito } from '@/lib/estados'
import {
  procesarDocumento, boxDeudor, boxAcreedor, firmasDoc, fmtFechaDoc, formatCOP,
} from '@/lib/documentosHandler'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { creditoId } = await params

  return procesarDocumento(request, {
    creditoId,
    tipoSlug: 'contrato',
    titulo: 'Contrato de Crédito',
    buildCuerpo: async ({ credito, titular, ref }) => {
      const tasaMensual = credito.tasa_interes_mensual
        ? (credito.tasa_interes_mensual * 100).toFixed(4)
        : ((Math.pow(1 + credito.tasa_interes_anual / 100, 1 / 12) - 1) * 100).toFixed(4)

      return `
        <div class="grid2">${boxDeudor(titular)}${boxAcreedor()}</div>
        <div class="section">
          <div class="section-title">Condiciones del Crédito</div>
          <div class="box">
            <div class="row"><span class="lbl">Monto desembolsado</span><span class="val">${formatCOP(credito.monto_desembolsado)}</span></div>
            <div class="row"><span class="lbl">Cuotas</span><span class="val">${credito.numero_cuotas} mensuales</span></div>
            <div class="row"><span class="lbl">Cuota fija</span><span class="val">${formatCOP(credito.cuota_fija)}</span></div>
            <div class="row"><span class="lbl">Tasa E.A.</span><span class="val">${Number(credito.tasa_interes_anual).toFixed(2)}%</span></div>
            <div class="row"><span class="lbl">Tasa E.M.</span><span class="val">${tasaMensual}%</span></div>
            <div class="row"><span class="lbl">Desembolso</span><span class="val">${fmtFechaDoc(credito.fecha_desembolso)}</span></div>
            <div class="row"><span class="lbl">Primera cuota</span><span class="val">${fmtFechaDoc(credito.fecha_primera_cuota)}</span></div>
            <div class="row"><span class="lbl">Estado</span><span class="val">${labelEstadoCredito(credito.estado_credito)}</span></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Cláusulas</div>
          <div class="legal">
            <p><strong>PRIMERA — OBJETO:</strong> PLURALL entrega al DEUDOR el monto indicado; el DEUDOR se obliga a pagar capital e intereses en las cuotas pactadas.</p>
            <p><strong>SEGUNDA — INTERÉS:</strong> Tasa efectiva anual ${Number(credito.tasa_interes_anual).toFixed(2)}%, sin superar la usura legal.</p>
            <p><strong>TERCERA — PAGO:</strong> ${credito.numero_cuotas} cuotas de ${formatCOP(credito.cuota_fija)} mediante amortización francesa.</p>
            <p><strong>CUARTA — MORA:</strong> Intereses de mora a tasa máxima legal desde el día siguiente al vencimiento.</p>
            <p><strong>QUINTA — LEY:</strong> República de Colombia. Ref. ${ref}.</p>
          </div>
        </div>
        ${firmasDoc(titular)}`
    },
  })
}
