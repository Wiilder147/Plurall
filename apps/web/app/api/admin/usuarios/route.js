/* ==========================================================================
 * ARCHIVO: route.js
 * RUTA: apps/web/app/api/admin/usuarios/route.js
 * DESCRIPCIÓN: Gestión de usuarios de staff (ASESOR/SUPERVISOR) por el ADMIN.
 * FUNCIONALIDAD:
 *   GET  → lista los asesores y supervisores con su celular de acceso.
 *   POST → crea una cuenta de staff: usuario auth (login por celular) + perfil
 *          con el rol elegido. Solo ADMIN.
 * ========================================================================== */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ROLES_STAFF = ['ASESOR', 'SUPERVISOR']

// Verifica que quien llama sea ADMIN. Devuelve { error, status } o { ok:true }.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'No autorizado', status: 401 }
  const { data: perfil } = await supabase
    .from('perfil_usuario').select('rol ( nombre_rol )').eq('id', user.id).single()
  if (perfil?.rol?.nombre_rol?.toUpperCase() !== 'ADMIN') {
    return { error: 'Solo un administrador puede gestionar usuarios de staff.', status: 403 }
  }
  return { ok: true }
}

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const service = createServiceClient()
  const { data, error } = await service.rpc('admin_listar_staff')
  if (error) {
    console.error('[admin/usuarios GET]', error.message)
    return NextResponse.json({ error: 'No se pudieron listar los usuarios' }, { status: 500 })
  }
  return NextResponse.json({ usuarios: data ?? [] })
}

export async function POST(request) {
  const guard = await requireAdmin()
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await request.json()
  const cel = String(body.celular || '').replace(/\D/g, '')
  const rol = String(body.rol || '').toUpperCase()
  const primer_nombre   = String(body.primer_nombre || '').trim()
  const primer_apellido = String(body.primer_apellido || '').trim()
  const segundo_nombre  = String(body.segundo_nombre || '').trim() || null
  const segundo_apellido= String(body.segundo_apellido || '').trim() || null
  const emailReal       = String(body.email || '').trim().toLowerCase() || null
  const password        = String(body.password || '')

  // ── Validaciones ──────────────────────────────────────────────
  if (cel.length !== 10)          return NextResponse.json({ error: 'El celular debe tener 10 dígitos.' }, { status: 422 })
  if (!ROLES_STAFF.includes(rol)) return NextResponse.json({ error: 'Rol inválido (ASESOR o SUPERVISOR).' }, { status: 422 })
  if (!primer_nombre || !primer_apellido) return NextResponse.json({ error: 'Nombre y apellido son obligatorios.' }, { status: 422 })
  if (password.length < 8)        return NextResponse.json({ error: 'La contraseña requiere al menos 8 caracteres.' }, { status: 422 })

  const service = createServiceClient()

  // No duplicar: el celular es la identidad de acceso.
  const { data: yaExiste } = await service.rpc('usuario_existe_por_celular', { cel })
  if (yaExiste) return NextResponse.json({ error: 'Ese celular ya está registrado.' }, { status: 409 })

  // Rol destino
  const { data: rolRow } = await service.from('rol').select('id_rol').eq('nombre_rol', rol).single()
  if (!rolRow) return NextResponse.json({ error: 'Rol no encontrado.' }, { status: 500 })

  // 1. Crear el usuario de acceso (login por celular). SIN 'telefono' en la
  //    metadata para que el trigger de registro NO lo cree como cliente.
  const email = `${cel}@plurall.app`
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, email_real: emailReal },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message?.toLowerCase() || ''
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return NextResponse.json({ error: 'Ese celular ya está registrado.' }, { status: 409 })
    }
    console.error('[admin/usuarios POST createUser]', createErr?.message)
    return NextResponse.json({ error: 'No se pudo crear la cuenta.' }, { status: 500 })
  }

  const nuevoId = created.user.id

  // 2. Crear el perfil con el rol de staff (el trigger no lo creó por no traer
  //    celular en la metadata).
  const { error: perfilErr } = await service.from('perfil_usuario').upsert({
    id:               nuevoId,
    id_rol:           rolRow.id_rol,
    activo:           true,
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
  }, { onConflict: 'id' })

  if (perfilErr) {
    // Rollback: si no se pudo crear el perfil, eliminar el usuario auth huérfano.
    await service.auth.admin.deleteUser(nuevoId).catch(() => null)
    console.error('[admin/usuarios POST perfil]', perfilErr.message)
    return NextResponse.json({ error: 'No se pudo crear el perfil del usuario.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: nuevoId, celular: cel, rol })
}
