import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request) {
  try {
    const { celular } = await request.json()
    if (!celular) return NextResponse.json({ error: 'Celular es requerido' }, { status: 400 })

    const service = getServiceClient()

    // 1. Buscar al cliente en la DB para obtener su email real
    const { data: cliente, error: cliErr } = await service
      .from('cliente')
      .select('email, nombre_completo')
      .eq('dni', celular) // Asumiendo que dni o celular se usa como identificador, la tabla cliente tiene 'telefono' o 'dni'. En el registro guardan celular en teléfono? En login se usa `celular@plurall.app`. Revisemos cómo buscan al cliente.
      // Mejor buscar por email ficticio o directamente por telefono:
      .eq('telefono', celular)
      .limit(1)

    // Ajuste de búsqueda: si la tabla usa formato con o sin código de país, intentamos flexibilizar.
    // Asumiremos que el celular se guarda en 'telefono' exactamente igual.

    let emailReal = null
    let nombre = 'Cliente'

    if (cliente && cliente.length > 0) {
      emailReal = cliente[0].email
      nombre = cliente[0].nombre_completo || 'Cliente'
    } else {
      // Como fallback, intentemos buscar por dni por si acaso guardan el número ahí.
      const { data: clientePorDni } = await service
        .from('cliente')
        .select('email, nombre_completo')
        .eq('dni', celular)
        .limit(1)
        
      if (clientePorDni && clientePorDni.length > 0) {
        emailReal = clientePorDni[0].email
        nombre = clientePorDni[0].nombre_completo || 'Cliente'
      }
    }

    if (!emailReal) {
      // Por seguridad, no decimos si existe o no, pero logueamos.
      console.warn('[OTP] Cliente no encontrado para el celular:', celular)
      // Simulamos éxito para evitar enumeración de usuarios
      return NextResponse.json({ ok: true })
    }

    // 2. Generar OTP de 6 dígitos
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

    // 3. Guardar en DB con expiración de 10 minutos
    const expiracion = new Date()
    expiracion.setMinutes(expiracion.getMinutes() + 10)

    const { error: otpErr } = await service
      .from('otp_recuperacion')
      .insert({
        celular,
        otp_code: otpCode,
        expiracion: expiracion.toISOString(),
      })

    if (otpErr) throw otpErr

    // 4. Enviar email usando Nodemailer (Gmail SMTP)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.RESEND_FROM_EMAIL || 'wfeoorjuela@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD, // La contraseña de aplicación de Google
      },
    })

    const mailOptions = {
      from: '"Plurall App" <' + (process.env.RESEND_FROM_EMAIL || 'wfeoorjuela@gmail.com') + '>',
      to: emailReal,
      subject: 'Código de Recuperación de Contraseña - Plurall',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e1b4b; text-align: center;">Plurall</h2>
          <p>Hola ${nombre},</p>
          <p>Has solicitado restablecer tu contraseña. Usa el siguiente código de 6 dígitos para continuar. El código expira en 10 minutos.</p>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 8px; margin: 20px 0;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #64748b;">Si no solicitaste este código, puedes ignorar este mensaje de forma segura.</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`[OTP] Enviado a ${emailReal} para celular ${celular}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[OTP Enviar Error]:', error)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
