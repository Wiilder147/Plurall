/**
 * seed_historico_graficas.mjs
 * Genera datos históricos de 12 meses para alimentar las gráficas del panel supervisor.
 * Crea: créditos desembolsados mes a mes, pagos históricos, y variación de cartera.
 *
 * Ejecutar: node scripts/utilidades/seed_historico_graficas.mjs
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { parseNombre } from '../../lib/nombre.js'
dotenv.config({ path: '.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Helpers ──────────────────────────────────────────────────────────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const rndF = (min, max, dec = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dec))
const fechaHace = (dias) => new Date(Date.now() - dias * 86400000)
const isoDate = (d) => d.toISOString().split('T')[0]

async function getId(tabla, campo, valor) {
  const { data } = await db.from(tabla).select(campo).eq(Object.keys({ valor })[0] === '0' ? 'nombre' : 'nombre', valor).single()
  return data?.[campo]
}

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

// ── Datos de clientes históricos ─────────────────────────────────────────────
const CLIENTES_HISTORICOS = [
  // Mes -12 a -10 (hace 1 año)
  { cel:'3500000001', nombre:'Andrés Histórico 1',  dni:'40000001', monto:1500000, plazo:6,  diasAtras:365, estado:'CANCELADO' },
  { cel:'3500000002', nombre:'Beatriz Histórica 2', dni:'40000002', monto:2000000, plazo:9,  diasAtras:350, estado:'CANCELADO' },
  { cel:'3500000003', nombre:'Carlos Histórico 3',  dni:'40000003', monto:3000000, plazo:12, diasAtras:340, estado:'CANCELADO' },
  // Mes -9 a -7
  { cel:'3500000004', nombre:'Diana Histórica 4',   dni:'40000004', monto:2500000, plazo:12, diasAtras:280, estado:'CANCELADO' },
  { cel:'3500000005', nombre:'Eduardo Histórico 5', dni:'40000005', monto:4000000, plazo:18, diasAtras:270, estado:'CANCELADO' },
  { cel:'3500000006', nombre:'Fernanda Histórica 6',dni:'40000006', monto:1800000, plazo:6,  diasAtras:260, estado:'CANCELADO' },
  { cel:'3500000007', nombre:'Gabriel Histórico 7', dni:'40000007', monto:3500000, plazo:12, diasAtras:250, estado:'CANCELADO' },
  // Mes -6 a -4
  { cel:'3500000008', nombre:'Helena Histórica 8',  dni:'40000008', monto:5000000, plazo:24, diasAtras:190, estado:'ACTIVO'    },
  { cel:'3500000009', nombre:'Iván Histórico 9',    dni:'40000009', monto:2200000, plazo:12, diasAtras:180, estado:'ACTIVO'    },
  { cel:'3500000010', nombre:'Julia Histórica 10',  dni:'40000010', monto:3800000, plazo:18, diasAtras:170, estado:'EN_MORA'   },
  { cel:'3500000011', nombre:'Kevin Histórico 11',  dni:'40000011', monto:1600000, plazo:6,  diasAtras:160, estado:'CANCELADO' },
  { cel:'3500000012', nombre:'Laura Histórica 12',  dni:'40000012', monto:4500000, plazo:24, diasAtras:150, estado:'ACTIVO'    },
  // Mes -3 a -1
  { cel:'3500000013', nombre:'Manuel Histórico 13', dni:'40000013', monto:2800000, plazo:12, diasAtras:90,  estado:'ACTIVO'    },
  { cel:'3500000014', nombre:'Natalia Histórica 14',dni:'40000014', monto:3200000, plazo:18, diasAtras:80,  estado:'ACTIVO'    },
  { cel:'3500000015', nombre:'Oscar Histórico 15',  dni:'40000015', monto:1900000, plazo:9,  diasAtras:70,  estado:'EN_MORA'   },
  { cel:'3500000016', nombre:'Patricia Histórica 16',dni:'40000016',monto:6000000, plazo:24, diasAtras:60,  estado:'ACTIVO'    },
  { cel:'3500000017', nombre:'Quintín Histórico 17',dni:'40000017', monto:2100000, plazo:12, diasAtras:50,  estado:'ACTIVO'    },
  { cel:'3500000018', nombre:'Rosa Histórica 18',   dni:'40000018', monto:3600000, plazo:18, diasAtras:40,  estado:'ACTIVO'    },
  { cel:'3500000019', nombre:'Samuel Histórico 19', dni:'40000019', monto:4200000, plazo:24, diasAtras:30,  estado:'ACTIVO'    },
  { cel:'3500000020', nombre:'Teresa Histórica 20', dni:'40000020', monto:2700000, plazo:12, diasAtras:20,  estado:'ACTIVO'    },
]

async function seed() {
  console.log('\n📊 Iniciando seed de datos históricos para gráficas...\n')

  const idEstadoActivo    = await getEstado('ACTIVO')    // no existe en solicitud, usamos DESEMBOLSADA
  const idEstadoDesemb    = await getEstado('DESEMBOLSADA')
  const idEstadoCli       = await getEstadoCli()
  const idRolCliente      = await getRol('CLIENTE')

  if (!idEstadoDesemb || !idEstadoCli || !idRolCliente) {
    console.error('❌ Faltan catálogos base. Ejecuta primero el SQL del esquema.')
    return
  }

  let creados = 0

  for (const c of CLIENTES_HISTORICOS) {
    const fakeEmail = `${c.cel}@plurall.app`

    // 1. Crear auth user
    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email: fakeEmail,
      password: 'Plurall2025!',
      email_confirm: true,
      user_metadata: { ...parseNombre(c.nombre), dni: c.dni, telefono: c.cel },
    })
    if (authErr && !authErr.message.includes('already')) {
      console.warn(`  ⚠️  ${c.nombre}: ${authErr.message}`)
      continue
    }

    let userId = authData?.user?.id
    if (!userId) {
      const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
      userId = users.find(u => u.email === fakeEmail)?.id
    }
    if (!userId) continue

    // 2. Perfil
    // Perfil CLIENTE sin nombre (canónico en tabla cliente)
    await db.from('perfil_usuario').upsert(
      { id: userId, id_rol: idRolCliente, activo: true, intentos_fallidos: 0 },
      { onConflict: 'id' }
    )

    // 3. Cliente
    const { data: existeCli } = await db.from('cliente').select('id_cliente').eq('id_usuario_cuenta', userId).single()
    let clienteId = existeCli?.id_cliente
    if (!clienteId) {
      const { data: newCli } = await db.from('cliente').insert({
        id_usuario_cuenta: userId,
        id_estado_cliente: idEstadoCli,
        ...parseNombre(c.nombre),
        dni:               c.dni,
        email:             fakeEmail,
        telefono:          c.cel,
        score_credito:     rnd(550, 900),
        ciudad:            ['Bogotá','Medellín','Cali','Barranquilla','Bucaramanga'][rnd(0,4)],
        departamento:      ['Cundinamarca','Antioquia','Valle del Cauca','Atlántico','Santander'][rnd(0,4)],
        nombre_negocio:    `Negocio ${c.nombre.split(' ')[0]}`,
      }).select('id_cliente').single()
      clienteId = newCli?.id_cliente
    }
    if (!clienteId) continue

    // 4. Solicitud
    const fechaDesemb = fechaHace(c.diasAtras)
    const { data: sol } = await db.from('solicitud_credito').insert({
      id_cliente:          clienteId,
      id_estado_solicitud: idEstadoDesemb,
      monto_solicitado:    c.monto,
      plazo_meses:         c.plazo,
      proposito:           `Score interno: ${rnd(600,900)} pts`,
      canal_solicitud:     'WEB',
      fecha_solicitud:     fechaDesemb.toISOString(),
    }).select('id_solicitud').single()
    if (!sol) continue

    // 5. Crédito
    const tasaEM  = 0.020742
    const tasaEA  = (Math.pow(1 + tasaEM, 12) - 1) * 100
    const factor  = Math.pow(1 + tasaEM, c.plazo)
    const cuotaFija = Math.round((c.monto * tasaEM * factor) / (factor - 1))
    const fechaPrimera = new Date(fechaDesemb.getTime() + 30 * 86400000)
    const fechaUltima  = new Date(fechaDesemb.getTime() + c.plazo * 30 * 86400000)

    // Calcular cuántas cuotas ya pasaron
    const diasTranscurridos = c.diasAtras
    const cuotasPagadas = Math.min(c.plazo, Math.floor(diasTranscurridos / 30))
    const saldoPendiente = c.estado === 'CANCELADO' ? 0
      : Math.max(0, Math.round(c.monto * (1 - cuotasPagadas / c.plazo) * 0.95))

    const { data: cred } = await db.from('credito').insert({
      id_solicitud:         sol.id_solicitud,
      id_cliente:           clienteId,
      monto_desembolsado:   c.monto,
      tasa_interes_anual:   tasaEA,
      tasa_interes_mensual: tasaEM,
      numero_cuotas:        c.plazo,
      cuota_fija:           cuotaFija,
      fecha_desembolso:     fechaDesemb.toISOString(),
      fecha_primera_cuota:  isoDate(fechaPrimera),
      fecha_ultima_cuota:   isoDate(fechaUltima),
      estado_credito:       c.estado,
      saldo_pendiente:      saldoPendiente,
      cuotas_pagadas:       c.estado === 'CANCELADO' ? c.plazo : cuotasPagadas,
      cuotas_en_mora:       c.estado === 'EN_MORA' ? rnd(1, 3) : 0,
      dias_mora_maximo:     c.estado === 'EN_MORA' ? rnd(15, 60) : 0,
    }).select('id_credito').single()
    if (!cred) continue

    // 6. Plan de pago
    const { data: plan } = await db.from('plan_pago').insert({
      id_credito:         cred.id_credito,
      num_cuotas_totales: c.plazo,
      frecuencia_pago:    'MENSUAL',
      fecha_inicio_cobro: isoDate(fechaPrimera),
      fecha_fin_cobro:    isoDate(fechaUltima),
      tasa_mora_diaria:   0.001,
    }).select('id_plan_pago').single()
    if (!plan) continue

    // 7. Cuotas + pagos históricos
    let saldo = c.monto
    const cuotasInsert = []
    const pagosInsert  = []

    for (let i = 1; i <= c.plazo; i++) {
      const interes = Math.round(saldo * tasaEM * 100) / 100
      const capital = Math.round((cuotaFija - interes) * 100) / 100
      saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100)
      const fechaVenc = new Date(fechaPrimera.getTime() + (i - 1) * 30 * 86400000)

      let estadoCuota = 'PENDIENTE'
      if (c.estado === 'CANCELADO') estadoCuota = 'PAGADA'
      else if (i <= cuotasPagadas)  estadoCuota = 'PAGADA'
      else if (c.estado === 'EN_MORA' && fechaVenc < new Date()) estadoCuota = 'VENCIDA'

      cuotasInsert.push({
        id_plan_pago:       plan.id_plan_pago,
        numero_cuota:       i,
        monto_capital:      capital,
        monto_interes:      interes,
        monto_total_cuota:  cuotaFija,
        saldo_despues_pago: saldo,
        fecha_vencimiento:  isoDate(fechaVenc),
        estado_cuota:       estadoCuota,
        monto_pagado_real:  estadoCuota === 'PAGADA' ? cuotaFija : null,
        fecha_pago_real:    estadoCuota === 'PAGADA' ? isoDate(new Date(fechaVenc.getTime() + rnd(-3,3) * 86400000)) : null,
      })
    }

    const { data: cuotasCreadas } = await db.from('cuota').insert(cuotasInsert).select('id_cuota, numero_cuota, monto_capital, monto_interes, monto_total_cuota, fecha_vencimiento, estado_cuota')

    // Registrar pagos para las cuotas pagadas
    for (const cuota of (cuotasCreadas ?? [])) {
      if (cuota.estado_cuota !== 'PAGADA') continue
      const fechaPago = new Date(cuota.fecha_vencimiento + 'T00:00:00')
      fechaPago.setDate(fechaPago.getDate() + rnd(-5, 2))
      pagosInsert.push({
        id_cuota:           cuota.id_cuota,
        id_credito:         cred.id_credito,
        monto_pagado:       cuota.monto_total_cuota,
        monto_capital:      cuota.monto_capital,
        monto_interes:      cuota.monto_interes,
        monto_mora:         0,
        metodo_pago:        ['WOMPI','PSE','EFECTIVO','TRANSFERENCIA'][rnd(0,3)],
        referencia_externa: `PLR-HIST-${cred.id_credito.slice(0,6).toUpperCase()}-${cuota.numero_cuota}`,
        estado:             'CONFIRMADO',
        fecha_pago:         fechaPago.toISOString(),
      })
    }

    if (pagosInsert.length > 0) {
      await db.from('pago').insert(pagosInsert)
    }

    creados++
    console.log(`  ✅ ${c.nombre} — ${c.monto.toLocaleString('es-CO')} COP — ${c.plazo}m — ${c.estado} — ${cuotasPagadas} pagos`)
  }

  console.log(`\n✅ ${creados} clientes históricos creados con créditos y pagos`)
  console.log('\n📈 Ahora el panel tendrá datos reales de 12 meses para las gráficas\n')
}

seed().catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
