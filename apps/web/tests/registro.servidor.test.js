import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearFakeDb } from './helpers/fakeSupabase.js'

// CA-01: un celular = una cuenta. El registro pasa por el servidor, que
// rechaza el duplicado con un mensaje claro (antes: falso "¡Cuenta creada!").
// WF-02: el servidor exige una cédula real (antes: documento de relleno 'SN…').
const db = crearFakeDb()
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: async () => ({ success: true }), getClientIp: () => '203.0.113.1' }))

const VALIDO = {
  primer_nombre: 'Ana', primer_apellido: 'Pérez', telefono: '3001234567', dni: '1020304050',
  email: 'ana@correo.com', password: 'Segura123', aceptaTerminos: true,
}

async function registrar(cambios = {}) {
  const { POST } = await import('../app/api/auth/registro/route.js')
  const res = await POST(new Request('http://localhost/api/auth/registro', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...VALIDO, ...cambios }),
  }))
  return { status: res.status, body: await res.json() }
}

// Auth simulado: el email sintético es único (como GoTrue) y el "trigger" crea
// el cliente salvo que se indique que falla (dni tomado entre verificación y alta).
let triggerFalla
beforeEach(() => {
  triggerFalla = false
  db.tablas = { usuarios: [], cliente: [] }
  db.rpcs = {
    id_usuario_por_celular: ({ cel }, d) => d.tablas.usuarios.find(u => u.email === `${cel}@plurall.app`)?.id ?? null,
    fn_verificar_disponibilidad: ({ p_email, p_dni }, d) => ({
      email_disponible: !d.tablas.cliente.some(c => c.email === p_email),
      dni_disponible:   !d.tablas.cliente.some(c => c.dni === p_dni),
    }),
  }
  db.auth = {
    admin: {
      createUser: vi.fn(async ({ email, user_metadata }) => {
        if (db.tablas.usuarios.some(u => u.email === email)) {
          return { data: { user: null }, error: { code: 'email_exists', message: 'A user with this email address has already been registered' } }
        }
        const user = { id: `u-${db.tablas.usuarios.length + 1}`, email }
        db.tablas.usuarios.push(user)
        if (!triggerFalla) {
          db.tablas.cliente.push({ id_cliente: `c-${user.id}`, id_usuario_cuenta: user.id, dni: user_metadata.dni, email: user_metadata.email_real, telefono: user_metadata.telefono })
        }
        return { data: { user }, error: null }
      }),
      deleteUser: vi.fn(async (id) => { db.tablas.usuarios = db.tablas.usuarios.filter(u => u.id !== id); return { error: null } }),
    },
  }
})

describe('POST /api/auth/registro', () => {
  it('registra con datos válidos: crea el usuario con el celular y la cédula reales', async () => {
    const r = await registrar()
    expect(r.status).toBe(201)
    expect(db.tablas.cliente).toHaveLength(1)
    expect(db.tablas.cliente[0]).toMatchObject({ telefono: '3001234567', dni: '1020304050' })
    expect(db.auth.admin.createUser.mock.calls[0][0]).toMatchObject({ email: '3001234567@plurall.app', email_confirm: true })
  })

  it('CA-01: el mismo celular con otro correo y documento → 409 con mensaje claro, sin segunda cuenta', async () => {
    await registrar()
    const r = await registrar({ email: 'otra@correo.com', dni: '99887766' })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('Este número de celular ya está registrado.')
    expect(db.tablas.usuarios).toHaveLength(1)
    expect(db.tablas.cliente).toHaveLength(1)
  })

  it('CA-01: el celular se normaliza antes de comparar ("300 123 4567" = "3001234567")', async () => {
    await registrar()
    const r = await registrar({ telefono: '300 123 4567', email: 'otra@correo.com', dni: '99887766' })
    expect(r.status).toBe(409)
  })

  it('CA-01: alta concurrente (pasa la verificación previa) → Auth la rechaza y responde 409', async () => {
    db.rpcs.id_usuario_por_celular = () => null      // ambas solicitudes vieron el número libre
    await registrar()
    const r = await registrar({ email: 'otra@correo.com', dni: '99887766' })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('Este número de celular ya está registrado.')
  })

  it('si el trigger no pudo crear el cliente, revierte el usuario de Auth (sin cuentas huérfanas)', async () => {
    triggerFalla = true
    const r = await registrar()
    expect(r.status).toBe(409)
    expect(db.auth.admin.deleteUser).toHaveBeenCalledWith('u-1')
    expect(db.tablas.usuarios).toHaveLength(0)
  })

  it('correo o documento ya registrados → 409 indicando el campo', async () => {
    await registrar()
    expect((await registrar({ telefono: '3009999999', dni: '55555555' })).body.campo).toBe('email')
    expect((await registrar({ telefono: '3009999999', email: 'otra@correo.com' })).body.campo).toBe('dni')
  })

  it.each([
    ['dni', ''], ['dni', 'abc'], ['dni', '1234'], ['dni', '1234567890123'],
    ['telefono', '300123'], ['email', 'ana@correo'], ['primer_nombre', '  '],
    ['primer_apellido', 'P3rez'], ['password', 'corta'], ['aceptaTerminos', false],
  ])('WF-02 / validación en servidor: %s = %j → 422 sin crear usuario', async (campo, valor) => {
    const r = await registrar({ [campo]: valor })
    expect(r.status).toBe(422)
    expect(db.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('honeypot lleno → 400 sin crear usuario', async () => {
    expect((await registrar({ website: 'http://spam' })).status).toBe(400)
    expect(db.auth.admin.createUser).not.toHaveBeenCalled()
  })
})
