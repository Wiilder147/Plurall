import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { formatNombre } from '@/lib/nombre'

const GMAIL_USER = process.env.GMAIL_FROM_EMAIL || 'wfeoorjuela@gmail.com'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function createTransporter() {
  if (!process.env.GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_APP_PASSWORD no está configurado en las variables de entorno')
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function POST(request) {
  try {
    const { celular } = await request.json()
    if (!celular) return NextResponse.json({ error: 'Celular es requerido' }, { status: 400 })

    const service = getServiceClient()

    // Buscar cliente por teléfono para obtener su email
    const { data: clientes } = await service
      .from('cliente')
      .select('email, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido')
      .eq('telefono', celular)
      .limit(1)

    let emailReal = null
    let nombre = 'Cliente'

    if (clientes && clientes.length > 0) {
      emailReal = clientes[0].email
      nombre = formatNombre(clientes[0]) || 'Cliente'
    }

    if (!emailReal) {
      console.warn('[OTP] Cliente no encontrado para el celular:', celular)
      // Respuesta genérica para evitar enumeración de usuarios
      return NextResponse.json({
        ok: true,
        message: 'Si el celular está registrado, hemos enviado un código a su correo asociado.',
      })
    }

    // Generar OTP de 6 dígitos
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Guardar en DB con expiración de 10 minutos
    const expiracion = new Date()
    expiracion.setMinutes(expiracion.getMinutes() + 10)

    const { error: otpErr } = await service
      .from('otp_recuperacion')
      .insert({ celular, otp_code: otpCode, expiracion: expiracion.toISOString() })

    if (otpErr) throw otpErr

    // Enviar email via Gmail SMTP
    const transporter = createTransporter()
    await transporter.sendMail({
      from: `"Plurall" <${GMAIL_USER}>`,
      to: emailReal,
      subject: 'Código de Recuperación de Contraseña - Plurall',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e1b4b; text-align: center;">Plurall</h2>
          <p>Hola ${nombre},</p>
          <p>Has solicitado restablecer tu contraseña. Usa el siguiente código para continuar. <strong>Expira en 10 minutos.</strong></p>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0; color: #1e1b4b;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #64748b;">Si no solicitaste este código, puedes ignorar este mensaje.</p>
        </div>
      `,
    })

    console.log(`[OTP] Código enviado a ${emailReal} para celular ${celular}`)

    // Enmascarar el correo antes de enviarlo al frontend
    const [namePart, domainPart] = emailReal.split('@')
    const maskedName = namePart.length > 2
      ? namePart.substring(0, 2) + '*'.repeat(namePart.length - 2)
      : namePart
    const maskedEmail = `${maskedName}@${domainPart}`

    return NextResponse.json({
      ok: true,
      message: `Hemos enviado un código de 6 dígitos al correo: ${maskedEmail}`,
    })
  } catch (error) {
    console.error('[OTP Enviar Error]:', error.message)
    return NextResponse.json({ error: 'Error al enviar el código. Intenta de nuevo.' }, { status: 500 })
  }
}
