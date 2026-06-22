import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: perfil } = await supabase.from('perfil_usuario').select('rol(nombre_rol)').eq('id', user.id).single()
  if (perfil?.rol?.nombre_rol?.toUpperCase() !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Solo admin' }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const [{ data: modelo }, { data: preguntas }] = await Promise.all([
    supabase.from('modelo_score').select('*').eq('activo', true).order('vigente_desde', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('pregunta').select('*, opcion_pregunta(*)').order('orden'),
  ])

  return NextResponse.json({ modelo, preguntas: preguntas ?? [] })
}

export async function PATCH(request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth
  const body = await request.json()

  if (body.tipo === 'modelo' && body.id) {
    const { puntaje_minimo, puntaje_maximo } = body
    await supabase.from('modelo_score').update({ puntaje_minimo, puntaje_maximo }).eq('id_modelo_score', body.id)
    return NextResponse.json({ ok: true })
  }

  if (body.tipo === 'opcion' && body.id) {
    await supabase.from('opcion_pregunta').update({ valor_puntos: body.valor_puntos }).eq('id_opcion', body.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 })
}
