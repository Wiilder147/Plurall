import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return new Response('No autorizado', { status: 401 })

  const { creditoId } = await params

  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (!clienteRow) return new Response('Cliente no encontrado', { status: 404 })

  const { data: credito } = await supabase
    .from('credito')
    .select(`
      id_credito, monto_desembolsado, numero_cuotas, cuota_fija,
      tasa_interes_anual, tasa_interes_mensual, fecha_desembolso,
      fecha_primera_cuota, fecha_ultima_cuota, estado_credito,
      id_solicitud
    `)
    .eq('id_credito', creditoId)
    .eq('id_cliente', clienteRow.id_cliente)
    .single()

  if (!credito) return new Response('Crédito no encontrado', { status: 404 })

  const { nombre_completo = 'Cliente', dni = '—' } = user.user_metadata || {}
  const email = user.email || '—'
  const ref   = String(credito.id_credito).slice(-8).toUpperCase()
  const hoy   = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  const fmtFecha = (iso) => iso
    ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  const tasaMensual = credito.tasa_interes_mensual
    ? (credito.tasa_interes_mensual * 100).toFixed(4)
    : (Math.pow(1 + credito.tasa_interes_anual / 100, 1 / 12) - 1).toFixed(4) * 100

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contrato de Crédito — ${ref} — Plurall</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;font-size:14px;line-height:1.6}
    button.print-btn{position:fixed;top:20px;right:20px;background:#1e293b;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;z-index:100;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,.15)}
    button.print-btn:hover{background:#334155}
    .doc{max-width:800px;margin:48px auto;padding:0 24px 80px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #f97316;margin-bottom:36px}
    .logo{font-size:26px;font-weight:900;color:#1e293b;letter-spacing:-.5px}.logo span{color:#f97316}
    .doc-meta{text-align:right}.doc-meta h1{font-size:18px;font-weight:700;color:#1e293b}
    .doc-meta p{font-size:12px;color:#64748b;margin-top:4px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
    .box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
    .box h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:600;margin-bottom:12px}
    .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9}
    .row:last-child{border-bottom:none}
    .row .lbl{color:#64748b;font-size:13px}.row .val{font-weight:600;color:#0f172a;font-size:13px}
    .section{margin-bottom:28px}
    .section-title{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}
    .legal{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;font-size:13px;color:#475569;line-height:1.7}
    .legal p{margin-bottom:10px}.legal p:last-child{margin-bottom:0}
    .legal strong{color:#1e293b}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
    .sig-line{border-top:1px solid #94a3b8;padding-top:8px;font-size:12px;color:#64748b;text-align:center}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
    @media print{button.print-btn{display:none!important}body{background:#fff}.doc{margin:0;padding:16px}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">⬇ Guardar PDF</button>
  <div class="doc">

    <div class="header">
      <div class="logo">Plu<span>r</span>all</div>
      <div class="doc-meta">
        <h1>Contrato de Crédito</h1>
        <p>N.° ${ref} &nbsp;·&nbsp; Emitido: ${hoy}</p>
      </div>
    </div>

    <div class="grid2">
      <div class="box">
        <h3>Deudor</h3>
        <div class="row"><span class="lbl">Nombre completo</span><span class="val">${nombre_completo}</span></div>
        <div class="row"><span class="lbl">C.C.</span><span class="val">${dni}</span></div>
        <div class="row"><span class="lbl">Correo electrónico</span><span class="val">${email}</span></div>
      </div>
      <div class="box">
        <h3>Acreedor</h3>
        <div class="row"><span class="lbl">Razón social</span><span class="val">Plurall S.A.S.</span></div>
        <div class="row"><span class="lbl">NIT</span><span class="val">901.XXX.XXX-X</span></div>
        <div class="row"><span class="lbl">Ciudad</span><span class="val">Colombia</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Condiciones del Crédito</div>
      <div class="box">
        <div class="row"><span class="lbl">Monto desembolsado</span><span class="val">${formatCOP(credito.monto_desembolsado)}</span></div>
        <div class="row"><span class="lbl">Número de cuotas</span><span class="val">${credito.numero_cuotas} cuotas mensuales</span></div>
        <div class="row"><span class="lbl">Valor cuota fija</span><span class="val">${formatCOP(credito.cuota_fija)}</span></div>
        <div class="row"><span class="lbl">Tasa de interés anual (E.A.)</span><span class="val">${Number(credito.tasa_interes_anual).toFixed(2)}%</span></div>
        <div class="row"><span class="lbl">Tasa de interés mensual (E.M.)</span><span class="val">${Number(credito.tasa_interes_mensual * 100).toFixed(4)}%</span></div>
        <div class="row"><span class="lbl">Fecha de desembolso</span><span class="val">${fmtFecha(credito.fecha_desembolso)}</span></div>
        <div class="row"><span class="lbl">Fecha primera cuota</span><span class="val">${fmtFecha(credito.fecha_primera_cuota)}</span></div>
        <div class="row"><span class="lbl">Fecha última cuota</span><span class="val">${fmtFecha(credito.fecha_ultima_cuota)}</span></div>
        <div class="row"><span class="lbl">Estado actual</span><span class="val">${credito.estado_credito}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cláusulas del Contrato</div>
      <div class="legal">
        <p><strong>PRIMERA — OBJETO:</strong> Mediante el presente contrato, PLURALL S.A.S. entrega al DEUDOR la suma indicada anteriormente a título de préstamo, y el DEUDOR se compromete a devolver dicha suma junto con los intereses pactados, en las cuotas, plazos y condiciones establecidas en este documento.</p>
        <p><strong>SEGUNDA — TASA DE INTERÉS:</strong> El crédito devenga una tasa de interés efectiva anual del ${Number(credito.tasa_interes_anual).toFixed(2)}%, equivalente a una tasa efectiva mensual del ${Number(credito.tasa_interes_mensual * 100).toFixed(4)}%. Las tasas no superan el límite de usura certificado por la Superintendencia Financiera de Colombia.</p>
        <p><strong>TERCERA — FORMA DE PAGO:</strong> El DEUDOR cancelará el crédito en ${credito.numero_cuotas} cuotas mensuales iguales de ${formatCOP(credito.cuota_fija)} cada una, mediante el sistema de amortización francés (cuota fija). El primer vencimiento es el ${fmtFecha(credito.fecha_primera_cuota)}.</p>
        <p><strong>CUARTA — MORA:</strong> En caso de mora, el crédito generará intereses de mora a la tasa máxima legal vigente certificada por la Superintendencia Financiera de Colombia. La mora se configura a partir del día siguiente del vencimiento de cada cuota no pagada.</p>
        <p><strong>QUINTA — PREPAGO:</strong> El DEUDOR podrá realizar pagos anticipados total o parciales sin penalidad, previa comunicación a PLURALL S.A.S. Los prepagos se aplicarán al capital en la proporción que acuerden las partes.</p>
        <p><strong>SEXTA — INCUMPLIMIENTO:</strong> El incumplimiento de dos (2) o más cuotas consecutivas faculta a PLURALL S.A.S. para hacer exigible la totalidad del saldo insoluto y ejercer las acciones legales correspondientes.</p>
        <p><strong>SÉPTIMA — TRATAMIENTO DE DATOS:</strong> El DEUDOR autoriza el tratamiento de sus datos personales conforme a la Política de Privacidad de PLURALL S.A.S. y la Ley 1581 de 2012.</p>
        <p><strong>OCTAVA — LEY APLICABLE:</strong> Este contrato se rige por las leyes de la República de Colombia. Para cualquier controversia, las partes se someten a los jueces competentes de la ciudad de Colombia.</p>
      </div>
    </div>

    <div class="sigs">
      <div>
        <div class="sig-line">Firma del Deudor<br/>${nombre_completo}<br/>C.C. ${dni}</div>
      </div>
      <div>
        <div class="sig-line">Representante Legal<br/>PLURALL S.A.S.<br/>NIT: 901.XXX.XXX-X</div>
      </div>
    </div>

    <div class="footer">
      <span>PLURALL S.A.S. — Documento generado el ${hoy}</span>
      <span>Contrato N.° ${ref}</span>
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
