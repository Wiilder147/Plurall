/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/auth/lockout/route.js
 * DESCRIPCIÓN: Endpoint de API (Backend) para manejar la lógica de lockout
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── ENTRENAMIENTO: Método GET (Lectura del estado de bloqueo) ───────────────
// GET /api/auth/lockout?celular=3001234567
// Lo llama el frontend ANTES de enviar la contraseña a Supabase.
// Devuelve: { bloqueado: bool, minutosRestantes: number, intentos: number }
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const celular = searchParams.get('celular')?.replace(/\D/g, '')

  if (!celular || celular.length !== 10) {
    return NextResponse.json({ bloqueado: false, intentos: 0 })
  }

  const supabase = getServiceClient()
  const fakeEmail = `${celular}@plurall.app`

  // Buscar cliente por teléfono para obtener id_usuario_cuenta
  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_usuario_cuenta')
    .eq('telefono', celular)
    .single()

  if (!clienteRow) {
    return NextResponse.json({ bloqueado: false, intentos: 0 })
  }

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('intentos_fallidos, bloqueado_hasta')
    .eq('id', clienteRow.id_usuario_cuenta)
    .single()

  if (!perfil) {
    return NextResponse.json({ bloqueado: false, intentos: 0 })
  }

  const ahora = new Date()
  const bloqueadoHasta = perfil.bloqueado_hasta ? new Date(perfil.bloqueado_hasta) : null
  const estaBloqueado = bloqueadoHasta && bloqueadoHasta > ahora

  const minutosRestantes = estaBloqueado
    ? Math.ceil((bloqueadoHasta - ahora) / 60000)
    : 0

  return NextResponse.json({
    bloqueado: estaBloqueado,
    minutosRestantes,
    intentos: perfil.intentos_fallidos,
  })
}

// ── ENTRENAMIENTO: Método POST (Registro de error) ──────────────────────────
// POST /api/auth/lockout  body: { celular }
// Lo llama el frontend cuando Supabase dice "Contraseña incorrecta".
// Incrementa la columna intentos_fallidos. Si llega a 3, guarda una fecha
// 30 minutos en el futuro en la columna bloqueado_hasta.
// RN-05: Resetear intentos de login por bloqueo
export async function POST(request) {
  const { celular: rawCelular } = await request.json()
  const celular = rawCelular?.replace(/\D/g, '')

  if (!celular || celular.length !== 10) {
    return NextResponse.json({ ok: false })
  }

  const supabase = getServiceClient()

  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_usuario_cuenta')
    .eq('telefono', celular)
    .single()

  if (!clienteRow) return NextResponse.json({ ok: true })

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('intentos_fallidos')
    .eq('id', clienteRow.id_usuario_cuenta)
    .single()

  if (!perfil) return NextResponse.json({ ok: true })

  const nuevosIntentos = (perfil.intentos_fallidos || 0) + 1
  const LIMITE = 3

  const actualizar = { intentos_fallidos: nuevosIntentos }

  if (nuevosIntentos >= LIMITE) {
    // Bloquear por 30 minutos (RN-02)
    const bloqueadoHasta = new Date(Date.now() + 30 * 60 * 1000)
    actualizar.bloqueado_hasta = bloqueadoHasta.toISOString()
  }

  await supabase
    .from('perfil_usuario')
    .update(actualizar)
    .eq('id', clienteRow.id_usuario_cuenta)

  return NextResponse.json({
    ok: true,
    intentos: nuevosIntentos,
    bloqueado: nuevosIntentos >= LIMITE,
  })
}

// DELETE /api/auth/lockout  body: { celular }
// → resetea intentos tras login exitoso
export async function DELETE(request) {
  const { celular: rawCelular } = await request.json()
  const celular = rawCelular?.replace(/\D/g, '')

  if (!celular || celular.length !== 10) {
    return NextResponse.json({ ok: false })
  }

  const supabase = getServiceClient()

  const { data: clienteRow } = await supabase
    .from('cliente')
    .select('id_usuario_cuenta')
    .eq('telefono', celular)
    .single()

  if (!clienteRow) return NextResponse.json({ ok: true })

  await supabase
    .from('perfil_usuario')
    .update({ intentos_fallidos: 0, bloqueado_hasta: null })
    .eq('id', clienteRow.id_usuario_cuenta)

  return NextResponse.json({ ok: true })
}
