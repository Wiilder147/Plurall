/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/cliente/celular/confirmar/route.js
 * DESCRIPCIÓN: Confirma con OTP el cambio de celular solicitado por el CLIENTE.
 * FUNCIONALIDAD: POST { nuevoCelular, otp } — valida el OTP y aplica el cambio:
 *                el número anterior se registra en el historial y el nuevo queda
 *                como identidad de acceso (el anterior deja de servir).
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { aplicarCambioCelular } from '@/lib/celular'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nuevoCelular, otp } = await request.json()
  const cel = String(nuevoCelular || '').replace(/\D/g, '')
  const code = String(otp || '').replace(/\D/g, '')
  if (cel.length !== 10) return NextResponse.json({ error: 'Celular inválido.' }, { status: 422 })
  if (code.length !== 6)  return NextResponse.json({ error: 'El código debe tener 6 dígitos.' }, { status: 422 })

  const service = createServiceClient()

  const { data: cliente } = await service
    .from('cliente')
    .select('id_cliente, id_usuario_cuenta, telefono')
    .eq('id_usuario_cuenta', user.id)
    .single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Validar el OTP: mismo número, vigente y no usado
  const { data: registro } = await service
    .from('otp_cambio_celular')
    .select('id_otp, otp_code, expiracion, usado')
    .eq('id_cliente', cliente.id_cliente)
    .eq('nuevo_celular', cel)
    .eq('usado', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!registro) return NextResponse.json({ error: 'No hay un código pendiente para ese número. Solicítalo de nuevo.' }, { status: 404 })
  if (new Date(registro.expiracion) < new Date()) return NextResponse.json({ error: 'El código expiró. Solicítalo de nuevo.' }, { status: 410 })
  if (registro.otp_code !== code) return NextResponse.json({ error: 'Código incorrecto.' }, { status: 400 })

  // Aplicar el cambio (registra el número anterior; el viejo deja de servir).
  const res = await aplicarCambioCelular(service, {
    cliente,
    nuevoCelular: cel,
    liberadoPor: null,
    motivo: 'Cambio solicitado por el cliente (OTP)',
  })
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.status })

  // Marcar el OTP como usado
  await service.from('otp_cambio_celular').update({ usado: true }).eq('id_otp', registro.id_otp)

  return NextResponse.json({ ok: true, celular: res.celular })
}
