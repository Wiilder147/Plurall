import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'

export const dynamic = 'force-dynamic'

const ESTADO_BADGE = {
  PAGADA:      { label: 'Pagada',       bg: '#dcfce7', color: '#15803d' },
  PAGADA_MORA: { label: 'Pagada c/mora', bg: '#fef9c3', color: '#b45309' },
  CONDONADA:   { label: 'Condonada',    bg: '#f3e8ff', color: '#7e22ce' },
  VENCIDA:     { label: 'Vencida',      bg: '#fee2e2', color: '#dc2626' },
  PENDIENTE:   { label: 'Pendiente',    bg: '#f1f5f9', color: '#475569' },
}

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
      fecha_primera_cuota, fecha_ultima_cuota, estado_credito
    `)
    .eq('id_credito', creditoId)
    .eq('id_cliente', clienteRow.id_cliente)
    .single()

  if (!credito) return new Response('Crédito no encontrado', { status: 404 })

  const { data: planPago } = await supabase
    .from('plan_pago')
    .select('id_plan_pago, num_cuotas_totales, frecuencia_pago, fecha_inicio_cobro, fecha_fin_cobro')
    .eq('id_credito', creditoId)
    .single()

  let cuotas = []
  if (planPago) {
    const { data } = await supabase
      .from('cuota')
      .select('*')
      .eq('id_plan_pago', planPago.id_plan_pago)
      .order('numero_cuota', { ascending: true })
    cuotas = data || []
  }

  const { nombre_completo = 'Cliente', dni = '—' } = user.user_metadata || {}
  const ref  = String(credito.id_credito).slice(-8).toUpperCase()
  const hoy  = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const fmtF = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const totalPagado   = cuotas.filter(c => ['PAGADA','PAGADA_MORA','CONDONADA'].includes(c.estado_cuota)).reduce((s,c) => s + c.monto_total_cuota, 0)
  const totalPendiente = cuotas.filter(c => ['PENDIENTE','VENCIDA'].includes(c.estado_cuota)).reduce((s,c) => s + c.monto_total_cuota, 0)

  const filas = cuotas.map((c) => {
    const badge = ESTADO_BADGE[c.estado_cuota] || ESTADO_BADGE.PENDIENTE
    return `
      <tr>
        <td style="text-align:center;font-weight:600;color:#475569">${c.numero_cuota}</td>
        <td>${fmtF(c.fecha_vencimiento)}</td>
        <td style="text-align:right">${formatCOP(c.monto_capital)}</td>
        <td style="text-align:right">${formatCOP(c.monto_interes)}</td>
        <td style="text-align:right;font-weight:700">${formatCOP(c.monto_total_cuota)}</td>
        <td style="text-align:right;color:#475569">${formatCOP(c.saldo_despues_pago)}</td>
        <td style="text-align:center">
          <span style="background:${badge.bg};color:${badge.color};padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600">${badge.label}</span>
        </td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Plan de Pagos — ${ref} — Plurall</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;font-size:14px;line-height:1.6}
    button.print-btn{position:fixed;top:20px;right:20px;background:#1e293b;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.15)}
    button.print-btn:hover{background:#334155}
    .doc{max-width:900px;margin:48px auto;padding:0 24px 80px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #f97316;margin-bottom:36px}
    .logo{font-size:26px;font-weight:900;color:#1e293b;letter-spacing:-.5px}.logo span{color:#f97316}
    .doc-meta{text-align:right}.doc-meta h1{font-size:18px;font-weight:700;color:#1e293b}
    .doc-meta p{font-size:12px;color:#64748b;margin-top:4px}
    .highlight{background:linear-gradient(135deg,#1e293b,#334155);color:#fff;border-radius:16px;padding:28px;margin-bottom:28px}
    .highlight .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    .highlight .item .lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
    .highlight .item .val{font-size:20px;font-weight:800}
    .info-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
    .box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
    .box h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:600;margin-bottom:12px}
    .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9}
    .row:last-child{border-bottom:none}
    .row .lbl{color:#64748b;font-size:13px}.row .val{font-weight:600;color:#0f172a;font-size:13px}
    .table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
    .table-title{padding:16px 20px;font-weight:700;font-size:15px;color:#1e293b;border-bottom:1px solid #e2e8f0}
    table{width:100%;border-collapse:collapse;font-size:13px}
    thead tr{background:#f8fafc}
    th{padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0}
    td{padding:10px 14px;border-bottom:1px solid #f8fafc;color:#334155}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f8fafc}
    .totales{background:#f8fafc;border-top:2px solid #e2e8f0}
    .totales td{font-weight:700;color:#1e293b;padding:12px 14px}
    .footer{margin-top:32px;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;padding-top:16px;border-top:1px solid #e2e8f0}
    @media print{button.print-btn{display:none!important}body{background:#fff}.doc{margin:0;padding:12px}th,td{padding:6px 10px}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">⬇ Guardar PDF</button>
  <div class="doc">

    <div class="header">
      <div class="logo">Plu<span>r</span>all</div>
      <div class="doc-meta">
        <h1>Plan de Pagos</h1>
        <p>Crédito N.° ${ref} &nbsp;·&nbsp; ${hoy}</p>
      </div>
    </div>

    <div class="highlight">
      <div class="grid">
        <div class="item"><div class="lbl">Monto prestado</div><div class="val">${formatCOP(credito.monto_desembolsado)}</div></div>
        <div class="item"><div class="lbl">Cuota mensual</div><div class="val">${formatCOP(credito.cuota_fija)}</div></div>
        <div class="item"><div class="lbl">Tasa E.A.</div><div class="val">${Number(credito.tasa_interes_anual).toFixed(2)}%</div></div>
        <div class="item"><div class="lbl">Plazo</div><div class="val">${credito.numero_cuotas} meses</div></div>
      </div>
    </div>

    <div class="info-row">
      <div class="box">
        <h3>Titular</h3>
        <div class="row"><span class="lbl">Nombre</span><span class="val">${nombre_completo}</span></div>
        <div class="row"><span class="lbl">C.C.</span><span class="val">${dni}</span></div>
        <div class="row"><span class="lbl">Estado crédito</span><span class="val">${credito.estado_credito}</span></div>
      </div>
      <div class="box">
        <h3>Resumen de pagos</h3>
        <div class="row"><span class="lbl">Total pagado</span><span class="val" style="color:#15803d">${formatCOP(totalPagado)}</span></div>
        <div class="row"><span class="lbl">Total pendiente</span><span class="val" style="color:#dc2626">${formatCOP(totalPendiente)}</span></div>
        <div class="row"><span class="lbl">Cuotas pagadas</span><span class="val">${cuotas.filter(c=>['PAGADA','PAGADA_MORA','CONDONADA'].includes(c.estado_cuota)).length} de ${credito.numero_cuotas}</span></div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-title">Tabla de Amortización</div>
      <table>
        <thead>
          <tr>
            <th style="text-align:center">#</th>
            <th>Vencimiento</th>
            <th style="text-align:right">Capital</th>
            <th style="text-align:right">Interés</th>
            <th style="text-align:right">Cuota</th>
            <th style="text-align:right">Saldo</th>
            <th style="text-align:center">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
        <tfoot>
          <tr class="totales">
            <td colspan="2">TOTALES</td>
            <td style="text-align:right">${formatCOP(cuotas.reduce((s,c)=>s+c.monto_capital,0))}</td>
            <td style="text-align:right">${formatCOP(cuotas.reduce((s,c)=>s+c.monto_interes,0))}</td>
            <td style="text-align:right">${formatCOP(cuotas.reduce((s,c)=>s+c.monto_total_cuota,0))}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="footer">
      <span>PLURALL S.A.S. — Documento generado el ${hoy}</span>
      <span>Plan de Pagos N.° ${ref}</span>
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
