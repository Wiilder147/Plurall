import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request) {
  try {
    const { celular, otp, newPassword } = await request.json()

    if (!celular || !otp || !newPassword) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const service = getServiceClient()

    // 1. Buscar el OTP válido más reciente
    const { data: otps, error: otpErr } = await service
      .from('otp_recuperacion')
      .select('*')
      .eq('celular', celular)
      .eq('usado', false)
      .gte('expiracion', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (otpErr) throw otpErr

    if (!otps || otps.length === 0 || otps[0].otp_code !== otp) {
      return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 })
    }

    // 2. Marcar OTP como usado
    await service
      .from('otp_recuperacion')
      .update({ usado: true })
      .eq('id_otp', otps[0].id_otp)

    // 3. Buscar el user ID en auth.users
    const fakeEmail = `${celular}@plurall.app`
    
    // Para cambiar la contraseña con la Admin API necesitamos el uid.
    // Listamos usuarios filtrando por el email fake
    const { data: { users }, error: usersErr } = await service.auth.admin.listUsers()
    if (usersErr) throw usersErr

    const user = users.find(u => u.email === fakeEmail)

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // 4. Actualizar la contraseña usando Admin API
    const { error: updateErr } = await service.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateErr) throw updateErr

    // 5. Opcional: Desbloquear la cuenta si estaba bloqueada (por RN-02)
    // Borramos los intentos fallidos de este celular si existe la tabla
    const { error: unlockErr } = await service
      .from('intentos_login')
      .delete()
      .eq('celular', celular)

    if (unlockErr) {
      console.warn('[OTP Verificar] No se pudo limpiar intentos_login:', unlockErr)
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('[OTP Verificar Error]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
