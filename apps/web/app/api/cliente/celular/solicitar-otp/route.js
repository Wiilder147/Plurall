/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/cliente/celular/solicitar-otp/route.js
 * DESCRIPCIÓN: El CLIENTE solicita cambiar su celular; se confirma con OTP.
 * FUNCIONALIDAD: POST { nuevoCelular } — valida el número, genera un OTP de 6
 *                dígitos y lo envía al correo real del cliente. El cambio se
 *                aplica luego en /api/cliente/celular/confirmar.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { emailVisible } from '@/lib/email'
import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_FROM_EMAIL || 'wfeoorjuela@gmail.com'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nuevoCelular } = await request.json()
  const cel = String(nuevoCelular || '').replace(/\D/g, '')
  if (cel.length !== 10) return NextResponse.json({ error: 'El celular debe tener 10 dígitos.' }, { status: 422 })

  const service = createServiceClient()

  // Cliente que hace la solicitud
  const { data: cliente } = await service
    .from('cliente')
    .select('id_cliente, telefono, email, primer_nombre')
    .eq('id_usuario_cuenta', user.id)
    .single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (cel === cliente.telefono) return NextResponse.json({ error: 'El número nuevo es igual al actual.' }, { status: 400 })

  // El número no puede pertenecer a una cuenta activa
  const { data: existe } = await service.rpc('usuario_existe_por_celular', { cel })
  if (existe) return NextResponse.json({ error: 'Ese número ya está registrado en otra cuenta.' }, { status: 409 })

  // Solo se puede confirmar por correo real (no el sintético de acceso)
  const emailReal = emailVisible(cliente.email)
  if (!emailReal) {
    return NextResponse.json(
      { error: 'No tienes un correo registrado para enviar el código. Contacta a soporte para cambiar tu número.' },
      { status: 409 }
    )
  }

  // Generar y guardar el OTP (invalida los previos del cliente)
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiracion = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await service.from('otp_cambio_celular').update({ usado: true }).eq('id_cliente', cliente.id_cliente).eq('usado', false)
  const { error: insErr } = await service.from('otp_cambio_celular').insert({
    id_cliente: cliente.id_cliente, nuevo_celular: cel, otp_code: otp, expiracion,
  })
  if (insErr) {
    console.error('[Cambio celular OTP]', insErr)
    return NextResponse.json({ error: 'No se pudo generar el código. Intenta más tarde.' }, { status: 500 })
  }

  // Enviar el OTP al correo real
  try {
    if (!process.env.GMAIL_APP_PASSWORD) throw new Error('SMTP no configurado')
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
    await transporter.sendMail({
      from: `"Plurall" <${GMAIL_USER}>`,
      to: emailReal,
      subject: 'Código para cambiar tu número - Plurall',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e1b4b; text-align: center;">Plurall</h2>
          <p>Hola ${cliente.primer_nombre || ''},</p>
          <p>Solicitaste cambiar tu número de celular a <strong>${cel}</strong>. Usa este código para confirmar. <strong>Expira en 10 minutos.</strong></p>
          <div style="background:#f1f5f9; padding:15px; text-align:center; font-size:32px; font-weight:bold; letter-spacing:8px; border-radius:8px; margin:20px 0; color:#1e1b4b;">${otp}</div>
          <p style="font-size:12px; color:#64748b;">Si no solicitaste este cambio, ignora este mensaje y tu número seguirá igual.</p>
        </div>`,
    })
  } catch (e) {
    console.error('[Cambio celular email]', e.message)
    return NextResponse.json({ error: 'No se pudo enviar el código. Intenta más tarde.' }, { status: 500 })
  }

  const [np, dp] = emailReal.split('@')
  const masked = `${np.length > 2 ? np.slice(0, 2) + '*'.repeat(np.length - 2) : np}@${dp}`
  return NextResponse.json({ ok: true, message: `Enviamos un código a ${masked}` })
}
