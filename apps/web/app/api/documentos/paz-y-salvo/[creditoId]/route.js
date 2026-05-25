/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/documentos/paz-y-salvo/[creditoId]/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de [creditoId]
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
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
      tasa_interes_anual, fecha_desembolso, fecha_ultima_cuota,
      estado_credito
    `)
    .eq('id_credito', creditoId)
    .eq('id_cliente', clienteRow.id_cliente)
    .single()

  if (!credito) return new Response('Crédito no encontrado', { status: 404 })

  if (credito.estado_credito !== 'CANCELADO') {
    return new Response('El paz y salvo solo está disponible para créditos cancelados.', { status: 403 })
  }

  // Fecha del último pago (última cuota pagada)
  const { data: planPago } = await supabase
    .from('plan_pago')
    .select('id_plan_pago')
    .eq('id_credito', creditoId)
    .single()

  let fechaUltimoPago = credito.fecha_ultima_cuota
  let totalPagado = 0

  if (planPago) {
    const { data: cuotas } = await supabase
      .from('cuota')
      .select('estado_cuota, monto_total_cuota, fecha_vencimiento')
      .eq('id_plan_pago', planPago.id_plan_pago)
      .in('estado_cuota', ['PAGADA', 'PAGADA_MORA', 'CONDONADA'])
      .order('fecha_vencimiento', { ascending: false })

    if (cuotas && cuotas.length > 0) {
      fechaUltimoPago = cuotas[0].fecha_vencimiento
      totalPagado = cuotas.reduce((s, c) => s + c.monto_total_cuota, 0)
    }
  }

  const { nombre_completo = 'Cliente', dni = '—' } = user.user_metadata || {}
  const email = user.email || '—'
  const ref   = String(credito.id_credito).slice(-8).toUpperCase()
  const hoy   = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const fmtF  = (iso) => iso
    ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  // Número de paz y salvo: PS-AÑO-REF
  const anio = new Date().getFullYear()
  const numPS = `PS-${anio}-${ref}`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Paz y Salvo — ${ref} — Plurall</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;font-size:14px;line-height:1.6}
    button.print-btn{position:fixed;top:20px;right:20px;background:#1e293b;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.15)}
    button.print-btn:hover{background:#334155}
    .doc{max-width:780px;margin:48px auto;padding:0 24px 80px}
    /* Borde decorativo del certificado */
    .certificate{background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:48px;position:relative;overflow:hidden}
    .certificate::before{content:'';position:absolute;top:12px;left:12px;right:12px;bottom:12px;border:1px dashed #e2e8f0;border-radius:14px;pointer-events:none}
    /* Marca de agua */
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;font-weight:900;color:rgba(21,128,61,.04);letter-spacing:-2px;white-space:nowrap;pointer-events:none;user-select:none;z-index:0}
    .content{position:relative;z-index:1}
    /* Header */
    .cert-header{text-align:center;margin-bottom:40px}
    .logo{font-size:28px;font-weight:900;color:#1e293b;letter-spacing:-.5px;margin-bottom:8px}.logo span{color:#f97316}
    .cert-num{font-size:12px;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase}
    /* Sello verde */
    .seal-wrap{display:flex;justify-content:center;margin:32px 0}
    .seal{width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#15803d,#16a34a);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba(21,128,61,.25)}
    .seal-icon{font-size:40px;line-height:1}
    .seal-text{font-size:9px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.1em;margin-top:4px}
    /* Título */
    .cert-title{text-align:center;margin-bottom:32px}
    .cert-title h1{font-size:28px;font-weight:900;color:#1e293b;letter-spacing:-.5px}
    .cert-title p{font-size:14px;color:#64748b;margin-top:6px}
    /* Texto certificación */
    .cert-text{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px 28px;margin-bottom:32px;font-size:15px;line-height:1.8;color:#166534;text-align:center}
    .cert-text strong{color:#15803d;font-size:17px}
    /* Grid de datos */
    .data-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px}
    .data-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
    .data-box h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:600;margin-bottom:10px}
    .data-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0}
    .data-row:last-child{border-bottom:none}
    .data-row .lbl{color:#64748b;font-size:13px}
    .data-row .val{font-weight:600;color:#0f172a;font-size:13px}
    /* Monto destacado */
    .amount-box{text-align:center;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:32px}
    .amount-box .lbl{font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
    .amount-box .amount{font-size:36px;font-weight:900;color:#15803d}
    .amount-box .sub{font-size:13px;color:#4ade80;margin-top:4px}
    /* Firmas */
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}
    .sig-block{text-align:center}
    .sig-line{border-top:1px solid #94a3b8;padding-top:10px;margin-top:48px}
    .sig-name{font-weight:700;color:#1e293b;font-size:14px}
    .sig-role{font-size:12px;color:#64748b}
    /* Aviso legal */
    .legal-note{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:12px;color:#64748b;text-align:center;margin-top:32px;line-height:1.6}
    /* Footer */
    .cert-footer{display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;padding-top:20px;margin-top:24px;border-top:1px solid #e2e8f0}
    @media print{button.print-btn{display:none!important}body{background:#fff}.doc{margin:0;padding:0}.certificate{border:2px solid #e2e8f0;padding:32px}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">⬇ Guardar PDF</button>
  <div class="doc">
    <div class="certificate">
      <div class="watermark">PAZ Y SALVO</div>
      <div class="content">

        <!-- Header -->
        <div class="cert-header">
          <div class="logo">Plu<span>r</span>all</div>
          <div class="cert-num">Certificado N.° ${numPS}</div>
        </div>

        <!-- Sello -->
        <div class="seal-wrap">
          <div class="seal">
            <div class="seal-icon">✓</div>
            <div class="seal-text">Cancelado</div>
          </div>
        </div>

        <!-- Título -->
        <div class="cert-title">
          <h1>Paz y Salvo</h1>
          <p>Certificado de cancelación total de obligación crediticia</p>
        </div>

        <!-- Texto certificación -->
        <div class="cert-text">
          La empresa <strong>PLURALL S.A.S.</strong> certifica que el señor(a)<br/>
          <strong>${nombre_completo}</strong>, identificado(a) con Cédula de Ciudadanía<br/>
          N.° <strong>${dni}</strong>, se encuentra a <strong>PAZ Y SALVO</strong> por concepto<br/>
          del crédito N.° <strong>${ref}</strong>, habiéndose cancelado la totalidad<br/>
          del capital e intereses pactados en el contrato de crédito.
        </div>

        <!-- Monto cancelado -->
        <div class="amount-box">
          <div class="lbl">Total cancelado</div>
          <div class="amount">${formatCOP(totalPagado || credito.monto_desembolsado)}</div>
          <div class="sub">${credito.numero_cuotas} cuotas de ${formatCOP(credito.cuota_fija)}</div>
        </div>

        <!-- Datos del crédito y cliente -->
        <div class="data-grid">
          <div class="data-box">
            <h3>Datos del titular</h3>
            <div class="data-row"><span class="lbl">Nombre completo</span><span class="val">${nombre_completo}</span></div>
            <div class="data-row"><span class="lbl">C.C.</span><span class="val">${dni}</span></div>
            <div class="data-row"><span class="lbl">Correo</span><span class="val">${email}</span></div>
          </div>
          <div class="data-box">
            <h3>Datos del crédito</h3>
            <div class="data-row"><span class="lbl">N.° crédito</span><span class="val">${ref}</span></div>
            <div class="data-row"><span class="lbl">Monto desembolsado</span><span class="val">${formatCOP(credito.monto_desembolsado)}</span></div>
            <div class="data-row"><span class="lbl">Fecha desembolso</span><span class="val">${fmtF(credito.fecha_desembolso)}</span></div>
            <div class="data-row"><span class="lbl">Fecha último pago</span><span class="val">${fmtF(fechaUltimoPago)}</span></div>
            <div class="data-row"><span class="lbl">Tasa E.A.</span><span class="val">${Number(credito.tasa_interes_anual).toFixed(2)}%</span></div>
          </div>
        </div>

        <!-- Firmas -->
        <div class="sigs">
          <div class="sig-block">
            <div class="sig-line">
              <div class="sig-name">Representante Legal</div>
              <div class="sig-role">PLURALL S.A.S.</div>
            </div>
          </div>
          <div class="sig-block">
            <div class="sig-line">
              <div class="sig-name">${nombre_completo}</div>
              <div class="sig-role">C.C. ${dni} — Deudor</div>
            </div>
          </div>
        </div>

        <!-- Nota legal -->
        <div class="legal-note">
          Este documento tiene validez legal como prueba de cancelación total de la obligación crediticia.<br/>
          Expedido en Colombia el <strong>${hoy}</strong>. PLURALL S.A.S. — NIT: 901.XXX.XXX-X
        </div>

        <div class="cert-footer">
          <span>Certificado expedido el ${hoy}</span>
          <span>${numPS}</span>
        </div>

      </div>
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
