/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/documentos/estado-cuenta/[creditoId]/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de [creditoId]
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/calculadora'

export const dynamic = 'force-dynamic'

const ESTADO_BADGE = {
  PAGADA:      { label: 'Pagada',        bg: '#dcfce7', color: '#15803d' },
  PAGADA_MORA: { label: 'Pagada c/mora', bg: '#fef9c3', color: '#b45309' },
  CONDONADA:   { label: 'Condonada',     bg: '#f3e8ff', color: '#7e22ce' },
  VENCIDA:     { label: 'Vencida',       bg: '#fee2e2', color: '#dc2626' },
  PENDIENTE:   { label: 'Pendiente',     bg: '#f1f5f9', color: '#475569' },
}

export async function GET(request, { params }) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return new Response('No autorizado', { status: 401 })

  const { creditoId } = await params

  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_cliente, email')
    .eq('id_usuario_cuenta', user.id)
    .single()

  if (!clienteRow) return new Response('Cliente no encontrado', { status: 404 })

  const { data: credito } = await supabase
    .from('credito')
    .select(`
      id_credito, monto_desembolsado, numero_cuotas, cuota_fija,
      tasa_interes_anual, tasa_interes_mensual, fecha_desembolso,
      fecha_primera_cuota, fecha_ultima_cuota, estado_credito,
      saldo_pendiente, cuotas_pagadas, cuotas_en_mora
    `)
    .eq('id_credito', creditoId)
    .eq('id_cliente', clienteRow.id_cliente)
    .single()

  if (!credito) return new Response('Crédito no encontrado', { status: 404 })

  const { data: planPago } = await supabase
    .from('plan_pago')
    .select('id_plan_pago')
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
  // Usar el email real del cliente (no el email autogenerado de Supabase Auth)
  const email = clienteRow.email || '—'
  const ref   = String(credito.id_credito).slice(-8).toUpperCase()
  const hoy   = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const fmtF  = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const pagadas   = cuotas.filter(c => ['PAGADA', 'PAGADA_MORA', 'CONDONADA'].includes(c.estado_cuota))
  const pendientes = cuotas.filter(c => c.estado_cuota === 'PENDIENTE')
  const vencidas   = cuotas.filter(c => c.estado_cuota === 'VENCIDA')

  const totalPagado    = pagadas.reduce((s, c) => s + c.monto_total_cuota, 0)
  const totalPendiente = [...pendientes, ...vencidas].reduce((s, c) => s + c.monto_total_cuota, 0)
  const totalIntereses = cuotas.reduce((s, c) => s + c.monto_interes, 0)
  const interesesPagados = pagadas.reduce((s, c) => s + c.monto_interes, 0)

  const proximaCuota = cuotas.find(c => c.estado_cuota === 'PENDIENTE' || c.estado_cuota === 'VENCIDA')

  const porcentaje = credito.numero_cuotas > 0
    ? Math.round((pagadas.length / credito.numero_cuotas) * 100)
    : 0

  // Últimas 5 transacciones (cuotas pagadas)
  const historial = [...pagadas].reverse().slice(0, 10)
  const filasHistorial = historial.map(c => {
    const badge = ESTADO_BADGE[c.estado_cuota] || ESTADO_BADGE.PAGADA
    return `
      <tr>
        <td style="text-align:center;font-weight:600;color:#475569">${c.numero_cuota}</td>
        <td>${fmtF(c.fecha_vencimiento)}</td>
        <td style="text-align:right">${formatCOP(c.monto_capital)}</td>
        <td style="text-align:right">${formatCOP(c.monto_interes)}</td>
        <td style="text-align:right;font-weight:700">${formatCOP(c.monto_total_cuota)}</td>
        <td style="text-align:center">
          <span style="background:${badge.bg};color:${badge.color};padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600">${badge.label}</span>
        </td>
      </tr>`
  }).join('')

  // Cuotas pendientes/vencidas
  const filasPendientes = [...vencidas, ...pendientes].slice(0, 6).map(c => {
    const badge = ESTADO_BADGE[c.estado_cuota] || ESTADO_BADGE.PENDIENTE
    return `
      <tr>
        <td style="text-align:center;font-weight:600;color:#475569">${c.numero_cuota}</td>
        <td>${fmtF(c.fecha_vencimiento)}</td>
        <td style="text-align:right;font-weight:700">${formatCOP(c.monto_total_cuota)}</td>
        <td style="text-align:right;color:#475569">${formatCOP(c.saldo_despues_pago)}</td>
        <td style="text-align:center">
          <span style="background:${badge.bg};color:${badge.color};padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600">${badge.label}</span>
        </td>
      </tr>`
  }).join('')

  const estadoColor = credito.estado_credito === 'EN_MORA'
    ? '#dc2626' : credito.estado_credito === 'CANCELADO' ? '#15803d' : '#0d9488'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Estado de Cuenta — ${ref} — Plurall</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;font-size:14px;line-height:1.6}
    button.print-btn{position:fixed;top:20px;right:20px;background:#1e293b;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.15)}
    button.print-btn:hover{background:#334155}
    .doc{max-width:860px;margin:48px auto;padding:0 24px 80px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #f97316;margin-bottom:36px}
    .logo{font-size:26px;font-weight:900;color:#1e293b;letter-spacing:-.5px}.logo span{color:#f97316}
    .doc-meta{text-align:right}.doc-meta h1{font-size:18px;font-weight:700;color:#1e293b}
    .doc-meta p{font-size:12px;color:#64748b;margin-top:4px}
    .hero{background:linear-gradient(135deg,#1e293b,#334155);color:#fff;border-radius:16px;padding:28px;margin-bottom:28px;position:relative;overflow:hidden}
    .hero::after{content:'';position:absolute;right:-40px;top:-40px;width:200px;height:200px;background:rgba(249,115,22,.15);border-radius:50%}
    .hero-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;position:relative;z-index:1}
    .hero-item .lbl{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
    .hero-item .val{font-size:22px;font-weight:900}
    .hero-item .sub{font-size:12px;color:#94a3b8;margin-top:2px}
    .progress-wrap{margin-top:20px;position:relative;z-index:1}
    .progress-lbl{display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-bottom:6px}
    .progress-bar{height:8px;background:rgba(255,255,255,.15);border-radius:999px;overflow:hidden}
    .progress-fill{height:100%;background:#f97316;border-radius:999px;transition:width .5s}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
    .box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
    .box h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:600;margin-bottom:12px}
    .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9}
    .row:last-child{border-bottom:none}
    .row .lbl{color:#64748b;font-size:13px}.row .val{font-weight:600;color:#0f172a;font-size:13px}
    .alert{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 18px;margin-bottom:24px;color:#991b1b;font-size:13px;display:flex;align-items:center;gap:10px}
    .section-title{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:14px}
    .table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px}
    .table-title{padding:14px 20px;font-weight:700;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
    .table-title span{font-size:12px;font-weight:500;color:#64748b}
    table{width:100%;border-collapse:collapse;font-size:13px}
    thead tr{background:#f8fafc}
    th{padding:9px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0}
    td{padding:9px 14px;border-bottom:1px solid #f8fafc;color:#334155}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f8fafc}
    .empty{padding:24px;text-align:center;color:#94a3b8;font-size:13px}
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
        <h1>Estado de Cuenta</h1>
        <p>Crédito N.° ${ref} &nbsp;·&nbsp; Corte: ${hoy}</p>
      </div>
    </div>

    <!-- Héroe -->
    <div class="hero">
      <div class="hero-grid">
        <div class="hero-item">
          <div class="lbl">Saldo pendiente</div>
          <div class="val">${formatCOP(credito.saldo_pendiente)}</div>
          <div class="sub">de ${formatCOP(credito.monto_desembolsado)} prestados</div>
        </div>
        <div class="hero-item">
          <div class="lbl">Total pagado</div>
          <div class="val">${formatCOP(totalPagado)}</div>
          <div class="sub">${pagadas.length} cuota${pagadas.length !== 1 ? 's' : ''} cancelada${pagadas.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="hero-item">
          <div class="lbl">Estado</div>
          <div class="val" style="color:${estadoColor}">${credito.estado_credito}</div>
          <div class="sub">${vencidas.length > 0 ? `${vencidas.length} cuota${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''}` : 'Al día'}</div>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-lbl">
          <span>Progreso de pago</span>
          <span>${porcentaje}% completado (${pagadas.length}/${credito.numero_cuotas} cuotas)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${porcentaje}%"></div>
        </div>
      </div>
    </div>

    ${vencidas.length > 0 ? `
    <div class="alert">
      ⚠️ Tienes <strong>${vencidas.length} cuota${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''}</strong>. Regulariza tu situación para evitar reportes negativos en centrales de riesgo.
    </div>` : ''}

    <!-- Info -->
    <div class="grid2">
      <div class="box">
        <h3>Titular</h3>
        <div class="row"><span class="lbl">Nombre</span><span class="val">${nombre_completo}</span></div>
        <div class="row"><span class="lbl">C.C.</span><span class="val">${dni}</span></div>
        <div class="row"><span class="lbl">Correo</span><span class="val">${email}</span></div>
      </div>
      <div class="box">
        <h3>Condiciones del crédito</h3>
        <div class="row"><span class="lbl">Monto desembolsado</span><span class="val">${formatCOP(credito.monto_desembolsado)}</span></div>
        <div class="row"><span class="lbl">Cuota mensual</span><span class="val">${formatCOP(credito.cuota_fija)}</span></div>
        <div class="row"><span class="lbl">Tasa E.A.</span><span class="val">${Number(credito.tasa_interes_anual).toFixed(2)}%</span></div>
        <div class="row"><span class="lbl">Fecha desembolso</span><span class="val">${fmtF(credito.fecha_desembolso)}</span></div>
        <div class="row"><span class="lbl">Última cuota</span><span class="val">${fmtF(credito.fecha_ultima_cuota)}</span></div>
      </div>
    </div>

    <!-- Resumen financiero -->
    <div class="box" style="margin-bottom:24px">
      <h3>Resumen financiero al corte</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0">
        <div style="padding:12px 16px;border-right:1px solid #f1f5f9">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Capital pagado</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">${formatCOP(pagadas.reduce((s,c)=>s+c.monto_capital,0))}</div>
        </div>
        <div style="padding:12px 16px;border-right:1px solid #f1f5f9">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Intereses pagados</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">${formatCOP(interesesPagados)}</div>
        </div>
        <div style="padding:12px 16px;border-right:1px solid #f1f5f9">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Capital pendiente</div>
          <div style="font-size:18px;font-weight:800;color:#dc2626">${formatCOP(credito.saldo_pendiente)}</div>
        </div>
        <div style="padding:12px 16px">
          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Próx. vencimiento</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">${proximaCuota ? fmtF(proximaCuota.fecha_vencimiento) : '—'}</div>
        </div>
      </div>
    </div>

    <!-- Cuotas pendientes -->
    ${filasPendientes ? `
    <div class="table-wrap">
      <div class="table-title">
        Cuotas por pagar
        <span>${pendientes.length + vencidas.length} pendiente${pendientes.length + vencidas.length !== 1 ? 's' : ''}</span>
      </div>
      <table>
        <thead><tr>
          <th style="text-align:center">#</th>
          <th>Vencimiento</th>
          <th style="text-align:right">Cuota</th>
          <th style="text-align:right">Saldo tras pago</th>
          <th style="text-align:center">Estado</th>
        </tr></thead>
        <tbody>${filasPendientes}</tbody>
      </table>
      ${pendientes.length + vencidas.length > 6 ? `<div class="empty">... y ${pendientes.length + vencidas.length - 6} cuotas más</div>` : ''}
    </div>` : ''}

    <!-- Historial de pagos -->
    <div class="table-wrap">
      <div class="table-title">
        Historial de pagos
        <span>${pagadas.length} pago${pagadas.length !== 1 ? 's' : ''} realizado${pagadas.length !== 1 ? 's' : ''}</span>
      </div>
      ${historial.length > 0 ? `
      <table>
        <thead><tr>
          <th style="text-align:center">#</th>
          <th>Fecha venc.</th>
          <th style="text-align:right">Capital</th>
          <th style="text-align:right">Interés</th>
          <th style="text-align:right">Total pagado</th>
          <th style="text-align:center">Estado</th>
        </tr></thead>
        <tbody>${filasHistorial}</tbody>
      </table>
      ${pagadas.length > 10 ? `<div class="empty">Se muestran los últimos 10 pagos de ${pagadas.length} totales.</div>` : ''}` : `
      <div class="empty">No hay pagos registrados aún.</div>`}
    </div>

    <div class="footer">
      <span>PLURALL S.A.S. — Estado de cuenta generado el ${hoy}</span>
      <span>Crédito N.° ${ref}</span>
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
