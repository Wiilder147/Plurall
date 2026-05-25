/* ==========================================================================
 * ARCHIVO: notificaciones.js
 * RUTA: apps/web/lib/notificaciones.js
 * DESCRIPCIÓN: Módulo de utilidades y funciones compartidas.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
/**
 * lib/notificaciones.js
 * Módulo centralizado de envío de emails transaccionales con Resend.
 * Se usa desde API Routes del servidor — nunca desde el cliente.
 */

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const FROM     = process.env.RESEND_FROM_EMAIL   || 'onboarding@resend.dev'
const API_KEY  = process.env.RESEND_API_KEY

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor ?? 0)
}

/** Envía un email via Resend. Retorna { ok, id?, error? } */
async function enviar({ to, subject, html }) {
  if (!API_KEY) {
    console.log('[Resend] Sin API key — email omitido:', subject)
    return { ok: true, omitido: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: FROM, to: [to], subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[Resend] Error:', err)
      return { ok: false, error: err }
    }
    const data = await res.json()
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[Resend] Excepción:', err)
    return { ok: false, error: err.message }
  }
}

// ── Plantilla base ────────────────────────────────────────────────────────────

function layout({ titulo, subtitulo, cuerpo, ctaTexto, ctaUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f1f5f9;margin:0;padding:0;">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#0F1B2D;padding:28px 40px;text-align:center;">
    <div style="display:inline-flex;align-items:center;gap:10px;">
      <div style="width:34px;height:34px;background:#FF9800;border-radius:7px;display:inline-block;"></div>
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:0.06em;">PLURALL</span>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:40px;">
    <h2 style="color:#0F1B2D;font-size:22px;margin:0 0 6px 0;">${titulo}</h2>
    ${subtitulo ? `<p style="color:#64748b;font-size:14px;margin:0 0 24px 0;">${subtitulo}</p>` : ''}
    ${cuerpo}
    ${ctaTexto && ctaUrl ? `
    <div style="text-align:center;margin-top:28px;">
      <a href="${ctaUrl}" style="background:#FF9800;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;display:inline-block;">${ctaTexto}</a>
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      PLURALL — Proyecto Formativo SENA | Tecnólogo ADSO<br/>
      Este correo es informativo. No requiere respuesta.
    </p>
  </div>
</div>
</body>
</html>`
}

function infoBox(filas) {
  const rows = filas.map(([label, value]) => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
      <span style="color:#94a3b8;font-size:13px;">${label}</span>
      <span style="color:#0F1B2D;font-weight:700;font-size:13px;">${value}</span>
    </div>`).join('')
  return `<div style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin:0 0 24px 0;border:1px solid #e2e8f0;">${rows}</div>`
}

function alertBox(color, texto) {
  const colores = {
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    red:    { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    yellow: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  }[color] ?? { bg: '#f8fafc', border: '#e2e8f0', text: '#334155' }
  return `<div style="background:${colores.bg};border:1px solid ${colores.border};border-radius:10px;padding:14px 18px;margin:0 0 20px 0;font-size:14px;color:${colores.text};line-height:1.6;">${texto}</div>`
}

// ── Tipos de notificación ─────────────────────────────────────────────────────

/**
 * Email al cliente cuando su solicitud es recibida.
 */
export async function notificarSolicitudRecibida({ email, nombre, solicitudId, monto, plazo }) {
  const primerNombre = nombre?.split(' ')[0] || 'Cliente'
  return enviar({
    to:      email,
    subject: `✅ Tu solicitud de ${formatCOP(monto)} fue recibida — PLURALL`,
    html:    layout({
      titulo:    `¡Solicitud recibida, ${primerNombre}! 🎉`,
      subtitulo: 'Hemos recibido tu solicitud de crédito con los siguientes detalles:',
      cuerpo:    infoBox([
        ['Monto solicitado', formatCOP(monto)],
        ['Plazo',            `${plazo} meses`],
        ['N.° de solicitud', solicitudId.slice(0, 8).toUpperCase()],
      ]) + `
      <p style="color:#0F1B2D;font-weight:600;font-size:14px;margin:0 0 10px 0;">¿Qué sigue?</p>
      <ol style="color:#64748b;font-size:13px;line-height:2;padding-left:20px;margin:0;">
        <li>Un analista revisará tu solicitud (máx. 48 horas hábiles).</li>
        <li>Asegúrate de tener tus documentos KYC subidos en el portal.</li>
        <li>Te notificaremos por email con la decisión.</li>
      </ol>`,
      ctaTexto: 'Ver mis créditos',
      ctaUrl:   `${APP_URL}/dashboard/creditos`,
    }),
  })
}

/**
 * Email al cliente cuando su solicitud es APROBADA.
 */
export async function notificarSolicitudAprobada({ email, nombre, solicitudId, montoAprobado, plazoAprobado, cuotaFija, comentariosCliente }) {
  const primerNombre = nombre?.split(' ')[0] || 'Cliente'
  return enviar({
    to:      email,
    subject: `🎉 ¡Tu crédito fue aprobado! — PLURALL`,
    html:    layout({
      titulo:    `¡Felicitaciones, ${primerNombre}! Tu crédito fue aprobado`,
      subtitulo: 'Tu solicitud de crédito ha sido revisada y aprobada por nuestro equipo.',
      cuerpo:    alertBox('green', '✅ <strong>Solicitud aprobada.</strong> En breve recibirás el desembolso en tu cuenta.') +
        infoBox([
          ['N.° de solicitud',  solicitudId.slice(0, 8).toUpperCase()],
          ['Monto aprobado',    formatCOP(montoAprobado)],
          ['Plazo',             `${plazoAprobado} meses`],
          ['Cuota mensual est.', formatCOP(cuotaFija)],
        ]) +
        (comentariosCliente ? `<p style="color:#64748b;font-size:13px;margin:0 0 16px 0;"><strong>Mensaje del analista:</strong> ${comentariosCliente}</p>` : ''),
      ctaTexto: 'Ver mi crédito',
      ctaUrl:   `${APP_URL}/dashboard/creditos`,
    }),
  })
}

/**
 * Email al cliente cuando su solicitud es RECHAZADA.
 */
export async function notificarSolicitudRechazada({ email, nombre, solicitudId, comentariosCliente }) {
  const primerNombre = nombre?.split(' ')[0] || 'Cliente'
  return enviar({
    to:      email,
    subject: `Actualización sobre tu solicitud — PLURALL`,
    html:    layout({
      titulo:    `Hola ${primerNombre}, tenemos novedades sobre tu solicitud`,
      subtitulo: 'Hemos revisado tu solicitud de crédito y queremos informarte el resultado.',
      cuerpo:    alertBox('red', '❌ <strong>Solicitud no aprobada.</strong> En esta ocasión no fue posible aprobar tu solicitud.') +
        infoBox([
          ['N.° de solicitud', solicitudId.slice(0, 8).toUpperCase()],
          ['Motivo',           comentariosCliente || 'No cumple los requisitos actuales de elegibilidad.'],
        ]) + `
        <p style="color:#64748b;font-size:13px;line-height:1.7;margin:0;">
          Puedes volver a solicitar un crédito después de <strong>90 días</strong>.
          Si tienes dudas, comunícate con nuestro equipo de soporte.
        </p>`,
      ctaTexto: 'Volver al portal',
      ctaUrl:   `${APP_URL}/dashboard/inicio`,
    }),
  })
}

/**
 * Email al cliente cuando su crédito es DESEMBOLSADO.
 */
export async function notificarDesembolso({ email, nombre, creditoId, monto, cuotaFija, numeroCuotas, fechaPrimeraCuota }) {
  const primerNombre = nombre?.split(' ')[0] || 'Cliente'
  const fechaFmt = fechaPrimeraCuota
    ? new Date(fechaPrimeraCuota + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  return enviar({
    to:      email,
    subject: `💰 Tu crédito fue desembolsado — PLURALL`,
    html:    layout({
      titulo:    `¡Tu dinero está en camino, ${primerNombre}!`,
      subtitulo: 'El desembolso de tu crédito ha sido procesado exitosamente.',
      cuerpo:    alertBox('green', '💰 <strong>Desembolso confirmado.</strong> El monto será acreditado según los tiempos de tu entidad bancaria.') +
        infoBox([
          ['Monto desembolsado',  formatCOP(monto)],
          ['Cuota mensual',       formatCOP(cuotaFija)],
          ['Número de cuotas',    `${numeroCuotas} meses`],
          ['Primera cuota',       fechaFmt],
          ['N.° de crédito',      creditoId.slice(0, 8).toUpperCase()],
        ]) + `
        <p style="color:#64748b;font-size:13px;line-height:1.7;margin:0;">
          Recuerda pagar tu cuota mensual antes de la fecha de vencimiento para evitar intereses de mora.
          Puedes ver tu plan de pagos completo en el portal.
        </p>`,
      ctaTexto: 'Ver mi plan de pagos',
      ctaUrl:   `${APP_URL}/dashboard/cuotas`,
    }),
  })
}

/**
 * Email de recordatorio de cuota próxima a vencer (RN-13: 3 días antes).
 */
export async function notificarRecordatorioCuota({ email, nombre, numeroCuota, totalCuotas, monto, fechaVencimiento, creditoId }) {
  const primerNombre = nombre?.split(' ')[0] || 'Cliente'
  const fechaFmt = new Date(fechaVencimiento + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  return enviar({
    to:      email,
    subject: `⏰ Tu cuota #${numeroCuota} vence en 3 días — PLURALL`,
    html:    layout({
      titulo:    `Recordatorio de pago, ${primerNombre}`,
      subtitulo: `Tu cuota #${numeroCuota} de ${totalCuotas} vence pronto.`,
      cuerpo:    alertBox('yellow', `⏰ <strong>Cuota próxima a vencer.</strong> Tienes hasta el <strong>${fechaFmt}</strong> para realizar tu pago sin mora.`) +
        infoBox([
          ['Cuota',           `#${numeroCuota} de ${totalCuotas}`],
          ['Monto a pagar',   formatCOP(monto)],
          ['Fecha límite',    fechaFmt],
        ]) + `
        <p style="color:#64748b;font-size:13px;line-height:1.7;margin:0;">
          Paga a tiempo para mantener tu historial crediticio en buen estado y evitar intereses de mora.
        </p>`,
      ctaTexto: 'Pagar ahora',
      ctaUrl:   `${APP_URL}/dashboard/cuotas`,
    }),
  })
}

/**
 * Email de confirmación de pago recibido.
 */
export async function notificarPagoConfirmado({ email, nombre, numeroCuota, montoPagado, saldoPendiente, referencia }) {
  const primerNombre = nombre?.split(' ')[0] || 'Cliente'
  return enviar({
    to:      email,
    subject: `✅ Pago recibido — Cuota #${numeroCuota} — PLURALL`,
    html:    layout({
      titulo:    `Pago confirmado, ${primerNombre}`,
      subtitulo: `Hemos recibido tu pago de la cuota #${numeroCuota}.`,
      cuerpo:    alertBox('green', '✅ <strong>Pago procesado exitosamente.</strong> Tu cuota ha sido registrada en nuestro sistema.') +
        infoBox([
          ['Cuota pagada',     `#${numeroCuota}`],
          ['Monto pagado',     formatCOP(montoPagado)],
          ['Saldo pendiente',  formatCOP(saldoPendiente)],
          ['Referencia',       referencia || '—'],
        ]),
      ctaTexto: 'Ver mis cuotas',
      ctaUrl:   `${APP_URL}/dashboard/cuotas`,
    }),
  })
}
