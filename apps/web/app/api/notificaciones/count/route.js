import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0 })

  const { count } = await supabase
    .from('notificacion_staff')
    .select('*', { count: 'exact', head: true })
    .eq('id_usuario', user.id)
    .eq('leida', false)

  return NextResponse.json({ count: count ?? 0 })
}

export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await supabase
    .from('notificacion_staff')
    .update({ leida: true })
    .eq('id_usuario', user.id)
    .eq('leida', false)

  return NextResponse.json({ ok: true })
}
