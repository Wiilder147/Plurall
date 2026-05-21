/**
 * seed_historico_extendido.mjs
 * Genera 40 clientes adicionales con datos de los últimos 24 meses.
 * Ejecutar: node scripts/utilidades/seed_historico_extendido.mjs
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const rnd  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const isoD = (d)    => d.toISOString().split('T')[0]
const ago  = (dias) => new Date(Date.now() - dias * 86400000)

// 40 clientes distribuidos en 24 meses (días atrás: 730 → 5)
const CLIENTES = [
  // ── Hace 24-22 meses ──────────────────────────────────────────────────────
  { cel:'3600000001', nombre:'Adriana Vega',       dni:'50000001', monto:2000000, plazo:12, dias:730, estado:'CANCELADO' },
  { cel:'3600000002', nombre:'Bernardo Ríos',      dni:'50000002', monto:3500000, plazo:18, dias:720, estado:'CANCELADO' },
  { cel:'3600000003', nombre:'Claudia Mora',       dni:'50000003', monto:1500000, plazo:6,  dias:710, estado:'CANCELADO' },
  { cel:'3600000004', nombre:'Diego Salcedo',      dni:'50000004', monto:4500000, plazo:24, dias:700, estado:'CANCELADO' },
  // ── Hace 21-19 meses ──────────────────────────────────────────────────────
  { cel:'3600000005', nombre:'Elena Castillo',     dni:'50000005', monto:2800000, plazo:12, dias:650, estado:'CANCELADO' },
  { cel:'3600000006', nombre:'Felipe Torres',      dni:'50000006', monto:5000000, plazo:24, dias:640, estado:'CANCELADO' },
  { cel:'3600000007', nombre:'Gloria Peña',        dni:'50000007', monto:1800000, plazo:9,  dias:630, estado:'CANCELADO' },
  { cel:'3600000008', nombre:'Hernán Suárez',      dni:'50000008', monto:3200000, plazo:18, dias:620, estado:'CANCELADO' },
  // ── Hace 18-16 meses ──────────────────────────────────────────────────────
  { cel:'3600000009', nombre:'Isabel Rojas',       dni:'50000009', monto:2500000, plazo:12, dias:560, estado:'CANCELADO' },
  { cel:'3600000010', nombre:'Jaime Vargas',       dni:'50000010', monto:4000000, plazo:18, dias:550, estado:'CANCELADO' },
  { cel:'3600000011', nombre:'Karen Díaz',         dni:'50000011', monto:1600000, plazo:6,  dias:540, estado:'CANCELADO' },
  { cel:'3600000012', nombre:'Luis Herrera',       dni:'50000012', monto:6000000, plazo:24, dias:530, estado:'CANCELADO' },
  // ── Hace 15-13 meses ──────────────────────────────────────────────────────
  { cel:'3600000013', nombre:'Marcela Gómez',      dni:'50000013', monto:3000000, plazo:12, dias:470, estado:'CANCELADO' },
  { cel:'3600000014', nombre:'Nicolás Pardo',      dni:'50000014', monto:2200000, plazo:9,  dias:460, estado:'CANCELADO' },
  { cel:'3600000015', nombre:'Olga Ramírez',       dni:'50000015', monto:4800000, plazo:24, dias:450, estado:'CANCELADO' },
  { cel:'3600000016', nombre:'Pablo Jiménez',      dni:'50000016', monto:1900000, plazo:6,  dias:440, estado:'CANCELADO' },
  // ── Hace 12-10 meses ──────────────────────────────────────────────────────
  { cel:'3600000017', nombre:'Quiteria Lozano',    dni:'50000017', monto:3600000, plazo:18, dias:380, estado:'CANCELADO' },
  { cel:'3600000018', nombre:'Ricardo Ospina',     dni:'50000018', monto:2700000, plazo:12, dias:370, estado:'CANCELADO' },
  { cel:'3600000019', nombre:'Sandra Mejía',       dni:'50000019', monto:5500000, plazo:24, dias:360, estado:'CANCELADO' },
  { cel:'3600000020', nombre:'Tomás Acosta',       dni:'50000020', monto:2100000, plazo:9,  dias:350, estado:'CANCELADO' },
  // ── Hace 9-7 meses ────────────────────────────────────────────────────────
  { cel:'3600000021', nombre:'Úrsula Cárdenas',    dni:'50000021', monto:3300000, plazo:18, dias:290, estado:'ACTIVO'    },
  { cel:'3600000022', nombre:'Víctor Mendoza',     dni:'50000022', monto:4200000, plazo:24, dias:280, estado:'ACTIVO'    },
  { cel:'3600000023', nombre:'Wendy Fuentes',      dni:'50000023', monto:1700000, plazo:6,  dias:270, estado:'CANCELADO' },
  { cel:'3600000024', nombre:'Ximena Guerrero',    dni:'50000024', monto:2900000, plazo:12, dias:260, estado:'EN_MORA'   },
  // ── Hace 6-4 meses ────────────────────────────────────────────────────────
  { cel:'3600000025', nombre:'Yolanda Pineda',     dni:'50000025', monto:5200000, plazo:24, dias:200, estado:'ACTIVO'    },
  { cel:'3600000026', nombre:'Zacarías Blanco',    dni:'50000026', monto:3100000, plazo:18, dias:190, estado:'ACTIVO'    },
  { cel:'3600000027', nombre:'Alicia Montoya',     dni:'50000027', monto:2400000, plazo:12, dias:180, estado:'EN_MORA'   },
  { cel:'3600000028', nombre:'Bruno Serrano',      dni:'50000028', monto:4700000, plazo:24, dias:170, estado:'ACTIVO'    },
  { cel:'3600000029', nombre:'Carmen Delgado',     dni:'50000029', monto:1800000, plazo:9,  dias:160, estado:'ACTIVO'    },
  { cel:'3600000030', nombre:'David Escobar',      dni:'50000030', monto:3800000, plazo:18, dias:150, estado:'ACTIVO'    },
  // ── Hace 3-2 meses ────────────────────────────────────────────────────────
  { cel:'3600000031', nombre:'Emilia Restrepo',    dni:'50000031', monto:2600000, plazo:12, dias:100, estado:'ACTIVO'    },
  { cel:'3600000032', nombre:'Francisco Nieto',    dni:'50000032', monto:5800000, plazo:24, dias:95,  estado:'ACTIVO'    },
  { cel:'3600000033', nombre:'Gabriela Arango',    dni:'50000033', monto:2000000, plazo:9,  dias:90,  estado:'EN_MORA'   },
  { cel:'3600000034', nombre:'Hugo Bermúdez',      dni:'50000034', monto:3400000, plazo:18, dias:85,  estado:'ACTIVO'    },
  { cel:'3600000035', nombre:'Irene Castaño',      dni:'50000035', monto:4100000, plazo:24, dias:80,  estado:'ACTIVO'    },
  // ── Hace 1 mes ────────────────────────────────────────────────────────────
  { cel:'3600000036', nombre:'Julián Córdoba',     dni:'50000036', monto:2300000, plazo:12, dias:45,  estado:'ACTIVO'    },
  { cel:'3600000037', nombre:'Karina Duarte',      dni:'50000037', monto:6500000, plazo:24, dias:35,  estado:'ACTIVO'    },
  { cel:'3600000038', nombre:'Leonardo Fajardo',   dni:'50000038', monto:1900000, plazo:6,  dias:25,  estado:'ACTIVO'    },
  { cel:'3600000039', nombre:'Mónica Galvis',      dni:'50000039', monto:3700000, plazo:18, dias:15,  estado:'ACTIVO'    },
  { cel:'3600000040', nombre:'Néstor Holguín',     dni:'50000040', monto:4900000, plazo:24, dias:7,   estado:'ACTIVO'    },
]

async function getEstado(nombre) {
  const { data } = await db.from('estado_solicitud').select('id_estado_solicitud').eq('nombre', nombre).single()
  return data?.id_estado_solicitud
}
async function getEstadoCli() {
  const { data } = await db.from('estado_cliente').select('id_estado_cliente').eq('nombre', 'ACTIVO').single()
  return data?.id_estado_cliente
}
async function getRol(nombre) {
  const { data } = await db.from('rol').select('id_rol').eq('nombre_rol', nombre).single()
  return data?.id_rol
}

async function seed() {
  console.log('\n📊 Seed extendido — 40 clientes en 24 meses...\n')

  const idEstadoDesemb = await getEstado('DESEMBOLSADA')
  const idEstadoCli    = await getEstadoCli()
  const idRolCliente   = await getRol('CLIENTE')

  const ciudades = ['Bogotá','Medellín','Cali','Barranquilla','Bucaramanga','Pereira','Manizales','Cartagena']
  const deptos   = ['Cundinamarca','Antioquia','Valle del Cauca','Atlántico','Santander','Risaralda','Caldas','Bolívar']
  const negocios = ['Tienda de barrio','Restaurante','Peluquería','Ferretería','Droguería','Transporte','Emprendimiento','Comercio de ropa']
  const metodos  = ['WOMPI','PSE','EFECTIVO','TRANSFERENCIA']

  let creados = 0

  for (const c of CLIENTES) {
    const fakeEmail = `${c.cel}@plurall.app`

    // Auth user
    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email: fakeEmail, password: 'Plurall2025!', email_confirm: true,
      user_metadata: { nombre_completo: c.nombre, dni: c.dni, telefono: c.cel },
    })
    if (authErr && !authErr.message.includes('already')) { console.warn(`  ⚠️  ${c.nombre}: ${authErr.message}`); continue }

    let userId = authData?.user?.id
    if (!userId) {
      const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
      userId = users.find(u => u.email === fakeEmail)?.id
    }
    if (!userId) continue

    // Perfil
    await db.from('perfil_usuario').upsert(
      { id: userId, id_rol: idRolCliente, nombre_completo: c.nombre, activo: true, intentos_fallidos: 0 },
      { onConflict: 'id' }
    )

    // Cliente
    const { data: existeCli } = await db.from('cliente').select('id_cliente').eq('id_usuario_cuenta', userId).single()
    let clienteId = existeCli?.id_cliente
    if (!clienteId) {
      const idx = rnd(0, 7)
      const { data: newCli } = await db.from('cliente').insert({
        id_usuario_cuenta: userId, id_estado_cliente: idEstadoCli,
        nombre_completo: c.nombre, dni: c.dni, email: fakeEmail, telefono: c.cel,
        score_credito: rnd(520, 920),
        ciudad: ciudades[idx], departamento: deptos[idx],
        nombre_negocio: `${negocios[rnd(0,7)]} ${c.nombre.split(' ')[0]}`,
      }).select('id_cliente').single()
      clienteId = newCli?.id_cliente
    }
    if (!clienteId) continue

    // Solicitud
    const fechaDesemb = ago(c.dias)
    const { data: sol } = await db.from('solicitud_credito').insert({
      id_cliente: clienteId, id_estado_solicitud: idEstadoDesemb,
      monto_solicitado: c.monto, plazo_meses: c.plazo,
      proposito: `Score interno: ${rnd(580, 900)} pts`,
      canal_solicitud: 'WEB',
      fecha_solicitud: fechaDesemb.toISOString(),
    }).select('id_solicitud').single()
    if (!sol) continue

    // Crédito
    const tasaEM  = 0.020742
    const tasaEA  = (Math.pow(1 + tasaEM, 12) - 1) * 100
    const factor  = Math.pow(1 + tasaEM, c.plazo)
    const cuotaFija = Math.round((c.monto * tasaEM * factor) / (factor - 1))
    const fechaPrimera = new Date(fechaDesemb.getTime() + 30 * 86400000)
    const fechaUltima  = new Date(fechaDesemb.getTime() + c.plazo * 30 * 86400000)
    const cuotasPagadas = c.estado === 'CANCELADO' ? c.plazo : Math.min(c.plazo - 1, Math.floor(c.dias / 30))
    const saldoPendiente = c.estado === 'CANCELADO' ? 0
      : Math.max(0, Math.round(c.monto * (1 - cuotasPagadas / c.plazo) * 0.95))

    const { data: cred } = await db.from('credito').insert({
      id_solicitud: sol.id_solicitud, id_cliente: clienteId,
      monto_desembolsado: c.monto, tasa_interes_anual: tasaEA,
      tasa_interes_mensual: tasaEM, numero_cuotas: c.plazo,
      cuota_fija: cuotaFija,
      fecha_desembolso: fechaDesemb.toISOString(),
      fecha_primera_cuota: isoD(fechaPrimera),
      fecha_ultima_cuota:  isoD(fechaUltima),
      estado_credito: c.estado, saldo_pendiente: saldoPendiente,
      cuotas_pagadas: cuotasPagadas,
      cuotas_en_mora: c.estado === 'EN_MORA' ? rnd(1, 3) : 0,
      dias_mora_maximo: c.estado === 'EN_MORA' ? rnd(10, 75) : 0,
    }).select('id_credito').single()
    if (!cred) continue

    // Plan de pago
    const { data: plan } = await db.from('plan_pago').insert({
      id_credito: cred.id_credito, num_cuotas_totales: c.plazo,
      frecuencia_pago: 'MENSUAL',
      fecha_inicio_cobro: isoD(fechaPrimera),
      fecha_fin_cobro:    isoD(fechaUltima),
      tasa_mora_diaria: 0.001,
    }).select('id_plan_pago').single()
    if (!plan) continue

    // Cuotas + pagos
    let saldo = c.monto
    const cuotasInsert = []
    const pagosInsert  = []

    for (let i = 1; i <= c.plazo; i++) {
      const interes = Math.round(saldo * tasaEM * 100) / 100
      const capital = Math.round((cuotaFija - interes) * 100) / 100
      saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100)
      const fechaVenc = new Date(fechaPrimera.getTime() + (i - 1) * 30 * 86400000)

      let estadoCuota = 'PENDIENTE'
      if (c.estado === 'CANCELADO' || i <= cuotasPagadas) estadoCuota = 'PAGADA'
      else if (c.estado === 'EN_MORA' && fechaVenc < new Date()) estadoCuota = 'VENCIDA'

      cuotasInsert.push({
        id_plan_pago: plan.id_plan_pago, numero_cuota: i,
        monto_capital: capital, monto_interes: interes,
        monto_total_cuota: cuotaFija, saldo_despues_pago: saldo,
        fecha_vencimiento: isoD(fechaVenc), estado_cuota: estadoCuota,
        monto_pagado_real: estadoCuota === 'PAGADA' ? cuotaFija : null,
        fecha_pago_real:   estadoCuota === 'PAGADA' ? isoD(new Date(fechaVenc.getTime() + rnd(-4,2)*86400000)) : null,
      })
    }

    const { data: cuotasCreadas } = await db.from('cuota').insert(cuotasInsert)
      .select('id_cuota, numero_cuota, monto_capital, monto_interes, monto_total_cuota, fecha_vencimiento, estado_cuota')

    for (const cuota of (cuotasCreadas ?? [])) {
      if (cuota.estado_cuota !== 'PAGADA') continue
      const fp = new Date(cuota.fecha_vencimiento + 'T00:00:00')
      fp.setDate(fp.getDate() + rnd(-5, 2))
      pagosInsert.push({
        id_cuota: cuota.id_cuota, id_credito: cred.id_credito,
        monto_pagado: cuota.monto_total_cuota,
        monto_capital: cuota.monto_capital, monto_interes: cuota.monto_interes,
        monto_mora: 0,
        metodo_pago: metodos[rnd(0,3)],
        referencia_externa: `PLR-EXT-${cred.id_credito.slice(0,6).toUpperCase()}-${cuota.numero_cuota}`,
        estado: 'CONFIRMADO',
        fecha_pago: fp.toISOString(),
      })
    }
    if (pagosInsert.length > 0) await db.from('pago').insert(pagosInsert)

    creados++
    process.stdout.write(`  ✅ ${c.nombre.padEnd(25)} ${String(c.monto).padStart(10)} COP  ${c.plazo}m  ${c.estado}  ${cuotasPagadas} pagos\n`)
  }

  console.log(`\n✅ ${creados}/40 clientes creados — 24 meses de historia disponibles\n`)
}

seed().catch(err => { console.error('\n❌', err.message); process.exit(1) })
