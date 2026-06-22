/**
 * Plantillas legales compartidas — contrato, plan pagos, estado cuenta, paz y salvo.
 */

export const EMPRESA = {
  razonSocial: process.env.PLURALL_RAZON_SOCIAL || 'PLURALL S.A.S.',
  nit: process.env.PLURALL_NIT || '901.567.890-1',
  ciudad: process.env.PLURALL_CIUDAD || 'Bogotá D.C., Colombia',
  email: process.env.PLURALL_EMAIL || 'legal@plurall.app',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export function buildQrUrl(text) {
  const encoded = encodeURIComponent(text)
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encoded}`
}

export function docRef(id) {
  return String(id).slice(-8).toUpperCase()
}

export function fmtFechaDoc(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function hoyDoc() {
  return new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function wrapDocumentHtml({ titulo, tipoDoc, ref, creditoId, cuerpo }) {
  const verificacionUrl = `${APP_URL}/api/documentos/verificar-ref?ref=${ref}&credito=${creditoId}&tipo=${tipoDoc}`
  const qr = buildQrUrl(verificacionUrl)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo} — ${ref} — PLURALL</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;font-size:14px;line-height:1.6}
    button.print-btn{position:fixed;top:20px;right:20px;background:#1e293b;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;z-index:100}
    button.print-btn:hover{background:#334155}
    .doc{max-width:800px;margin:48px auto;padding:0 24px 80px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #f97316;margin-bottom:28px;gap:16px}
    .logo-wrap{display:flex;align-items:center;gap:12px}
    .logo-box{width:44px;height:44px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:22px}
    .logo-text{font-size:24px;font-weight:900;color:#1e293b;letter-spacing:-.5px}.logo-text span{color:#f97316}
    .doc-meta{text-align:right}.doc-meta h1{font-size:18px;font-weight:700;color:#1e293b}
    .doc-meta p{font-size:12px;color:#64748b;margin-top:4px}
    .verify{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:28px}
    .verify img{border-radius:8px;border:1px solid #e2e8f0}
    .verify p{font-size:11px;color:#64748b;line-height:1.5}
    .verify strong{color:#1e293b;display:block;font-size:12px;margin-bottom:4px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
    .box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
    .box h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:600;margin-bottom:12px}
    .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;gap:12px}
    .row:last-child{border-bottom:none}
    .row .lbl{color:#64748b;font-size:13px;flex-shrink:0}.row .val{font-weight:600;color:#0f172a;font-size:13px;text-align:right}
    .section{margin-bottom:24px}
    .section-title{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}
    .legal{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;font-size:13px;color:#475569;line-height:1.7}
    .legal p{margin-bottom:10px}.legal p:last-child{margin-bottom:0}.legal strong{color:#1e293b}
    table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}
    th{background:#f8fafc;color:#64748b;font-weight:600;text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0}
    td{padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#334155}
    tr:last-child td{border-bottom:none}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}
    .badge-pagada{background:#dcfce7;color:#166534}.badge-vencida{background:#fee2e2;color:#991b1b}.badge-pendiente{background:#fef9c3;color:#854d0e}
    .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
    .sig-line{border-top:1px solid #94a3b8;padding-top:8px;font-size:12px;color:#64748b;text-align:center;line-height:1.6}
    .footer{margin-top:36px;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;flex-wrap:wrap;gap:8px}
    @media print{button.print-btn{display:none!important}body{background:#fff}.doc{margin:0;padding:16px}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">⬇ Descargar PDF</button>
  <div class="doc">
    <div class="header">
      <div class="logo-wrap">
        <div class="logo-box">P</div>
        <div class="logo-text">Plu<span>r</span>all</div>
      </div>
      <div class="doc-meta">
        <h1>${titulo}</h1>
        <p>Doc. N.° ${ref} · ${hoyDoc()}</p>
      </div>
    </div>
    <div class="verify">
      <img src="${qr}" width="72" height="72" alt="QR verificación" />
      <div>
        <strong>Documento verificable PLURALL</strong>
        <p>Escanee el código QR o visite el enlace de verificación para confirmar la autenticidad de este documento.<br/>Ref: ${ref} · NIT ${EMPRESA.nit}</p>
      </div>
    </div>
    ${cuerpo}
    <div class="footer">
      <span>${EMPRESA.razonSocial} · NIT ${EMPRESA.nit} · ${EMPRESA.ciudad}</span>
      <span>${titulo} N.° ${ref}</span>
    </div>
  </div>
</body>
</html>`
}

export function boxDeudor(titular) {
  return `<div class="box">
    <h3>Deudor</h3>
    <div class="row"><span class="lbl">Nombre</span><span class="val">${titular.nombre_completo || '—'}</span></div>
    <div class="row"><span class="lbl">C.C.</span><span class="val">${titular.dni || '—'}</span></div>
    <div class="row"><span class="lbl">Email</span><span class="val">${titular.email || '—'}</span></div>
  </div>`
}

export function boxAcreedor() {
  return `<div class="box">
    <h3>Acreedor</h3>
    <div class="row"><span class="lbl">Razón social</span><span class="val">${EMPRESA.razonSocial}</span></div>
    <div class="row"><span class="lbl">NIT</span><span class="val">${EMPRESA.nit}</span></div>
    <div class="row"><span class="lbl">Ciudad</span><span class="val">${EMPRESA.ciudad}</span></div>
  </div>`
}

export function firmasDoc(titular) {
  return `<div class="sigs">
    <div><div class="sig-line">Firma del Deudor<br/>${titular.nombre_completo || '—'}<br/>C.C. ${titular.dni || '—'}</div></div>
    <div><div class="sig-line">Representante Legal<br/>${EMPRESA.razonSocial}<br/>NIT: ${EMPRESA.nit}</div></div>
  </div>`
}
