import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { solicitudId, monto, plazo } = await request.json()
  if (!solicitudId) {
    return NextResponse.json({ error: 'solicitudId requerido' }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail    = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  if (!resendApiKey) {
    // Sin clave Resend configurada — loguear y continuar sin error
    console.log('[Resend] API key no configurada. Email omitido.')
    return NextResponse.json({ ok: true, msg: 'Email omitido (sin API key)' })
  }

  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('nombre_completo, email')
    .eq('id_usuario_cuenta', user.id)
    .single()

  const nombre     = clienteRow?.nombre_completo?.split(' ')[0] || 'Cliente'
  const emailDest  = clienteRow?.email || user.email

  const montoFmt = new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(monto)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background:#f8f9fa; margin:0; padding:0;">
  <div style="max-width:600px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#0F1B2D; padding:32px 40px; text-align:center;">
      <div style="display:inline-flex; align-items:center; gap:8px;">
        <div style="width:36px; height:36px; background:#FF9800; border-radius:6px; display:inline-block;"></div>
        <span style="color:#fff; font-size:22px; font-weight:800; letter-spacing:0.05em;">PLURALL</span>
      </div>
    </div>
    <!-- Body -->
    <div style="padding:40px;">
      <h2 style="color:#0F1B2D; font-size:24px; margin:0 0 8px 0;">¡Solicitud recibida, ${nombre}! 🎉</h2>
      <p style="color:#64748b; font-size:15px; line-height:1.6; margin:0 0 24px 0;">
        Hemos recibido tu solicitud de crédito con los siguientes detalles:
      </p>
      <!-- Info box -->
      <div style="background:#f8f9fa; border-radius:12px; padding:24px; margin:0 0 24px 0; border:1px solid #e2e8f0;">
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8; font-size:14px;">Monto solicitado</span>
          <span style="color:#0F1B2D; font-weight:700; font-size:14px;">${montoFmt}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8; font-size:14px;">Plazo</span>
          <span style="color:#0F1B2D; font-weight:700; font-size:14px;">${plazo} meses</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:8px 0;">
          <span style="color:#94a3b8; font-size:14px;">Número de solicitud</span>
          <span style="color:#FF9800; font-weight:700; font-size:13px; font-family:monospace;">${solicitudId.slice(0,8).toUpperCase()}</span>
        </div>
      </div>
      <!-- Pasos -->
      <p style="color:#0F1B2D; font-weight:600; font-size:15px; margin:0 0 12px 0;">¿Qué sigue?</p>
      <ol style="color:#64748b; font-size:14px; line-height:2; padding-left:20px; margin:0 0 24px 0;">
        <li>Un analista revisará tu solicitud (máx. 48 horas hábiles).</li>
        <li>Asegúrate de tener tus documentos KYC subidos en el portal.</li>
        <li>Te notificaremos por email con la decisión.</li>
      </ol>
      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/creditos"
          style="background:#FF9800; color:#fff; text-decoration:none; font-weight:700; font-size:15px; padding:14px 32px; border-radius:12px; display:inline-block;">
          Ver mis créditos
        </a>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#f8f9fa; padding:24px 40px; text-align:center; border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8; font-size:12px; margin:0;">
        PLURALL — Proyecto Formativo SENA | Tecnólogo ADSO<br/>
        Este correo es informativo. No requiere respuesta.
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    fromEmail,
        to:      [emailDest],
        subject: `✅ Tu solicitud de ${montoFmt} fue recibida — PLURALL`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Resend] Error al enviar:', err)
      return NextResponse.json({ ok: false, msg: 'Error Resend', detail: err }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Resend] Excepción:', err)
    return NextResponse.json({ ok: false, msg: 'Error inesperado' }, { status: 500 })
  }
}
