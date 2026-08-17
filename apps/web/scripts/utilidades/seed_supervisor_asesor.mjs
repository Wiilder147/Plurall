/**
 * seed_supervisor_asesor.mjs
 * Crea usuarios de prueba para los portales de Supervisor y Asesor.
 *
 * Ejecutar desde apps/web/:
 *   node scripts/utilidades/seed_supervisor_asesor.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { parseNombre } from '../../lib/nombre.js'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getRolId(nombre) {
  const { data } = await supabase.from('rol').select('id_rol').eq('nombre_rol', nombre).single()
  if (!data) throw new Error(`Rol '${nombre}' no encontrado. Ejecuta db/04_roles_supervisor_asesor.sql primero.`)
  return data.id_rol
}

async function getEstadoClienteId(nombre) {
  const { data } = await supabase.from('estado_cliente').select('id_estado_cliente').eq('nombre', nombre).single()
  return data?.id_estado_cliente
}

async function getEstadoSolicitudId(nombre) {
  const { data } = await supabase.from('estado_solicitud').select('id_estado_solicitud').eq('nombre', nombre).single()
  return data?.id_estado_solicitud
}

async function crearUsuario({ celular, password, nombre, dni, email }) {
  const fakeEmail = `${celular}@plurall.app`
  // Intentar crear; si ya existe, obtener el ID
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: fakeEmail,
    password,
    email_confirm: true,
    user_metadata: { ...parseNombre(nombre), dni, telefono: celular, email_real: email },
  })

  if (error && !error.message.includes('already')) {
    throw new Error(`Error creando auth user ${celular}: ${error.message}`)
  }

  if (created?.user) return created.user.id

  // Ya existía — buscar por email
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existing = users.find(u => u.email === fakeEmail)
  if (!existing) throw new Error(`No se pudo encontrar el usuario ${fakeEmail}`)
  return existing.id
}

async function asegurarPerfil(userId, rolId, nombre = null) {
  // Nombre en perfil solo para roles internos; clientes: canónico en tabla cliente
  const row = { id: userId, id_rol: rolId, activo: true, intentos_fallidos: 0 }
  if (nombre) Object.assign(row, parseNombre(nombre))
  await supabase.from('perfil_usuario').upsert(row, { onConflict: 'id' })
}

async function muniId(ciudad, departamento) {
  if (!ciudad) return null
  const { data } = await supabase
    .from('municipio')
    .select('id_municipio, departamento!inner ( nombre )')
    .ilike('nombre', ciudad)
    .ilike('departamento.nombre', departamento ?? '')
    .limit(1)
    .maybeSingle()
  return data?.id_municipio ?? null
}

async function asegurarCliente(userId, estadoId, datos) {
  // Modelo normalizado (post mig. 27): `cliente` NO tiene negocio/ubicación/score.
  // Se separan aquí y se escriben en negocio_cliente / direccion. El score de
  // seed se descarta (opción A: el score real vive en la tabla `score`).
  const {
    nombre_negocio, descripcion_negocio, antiguedad_negocio_meses, id_tipo_negocio,
    score_credito, ciudad, departamento, direccion,
    ...ident
  } = datos

  const { data: existing } = await supabase
    .from('cliente').select('id_cliente').eq('id_usuario_cuenta', userId).single()
  const clienteId = existing?.id_cliente ?? (await supabase.from('cliente').insert({
    id_usuario_cuenta: userId,
    id_estado_cliente: estadoId,
    ...ident,
  }).select('id_cliente').single()).data.id_cliente

  if (nombre_negocio) {
    const { data: neg } = await supabase.from('negocio_cliente')
      .select('id_negocio').eq('id_cliente', clienteId).limit(1).maybeSingle()
    if (!neg) await supabase.from('negocio_cliente').insert({
      id_cliente: clienteId, nombre_negocio, descripcion: descripcion_negocio ?? null,
      antiguedad_meses: antiguedad_negocio_meses ?? null, id_tipo_negocio: id_tipo_negocio ?? null,
    })
  }
  if (ciudad || direccion) {
    await supabase.from('direccion').upsert({
      id_cliente: clienteId, tipo: 'NEGOCIO', linea: direccion ?? null,
      id_municipio: await muniId(ciudad, departamento),
    }, { onConflict: 'id_cliente,tipo' })
  }
  return clienteId
}

// ── Función principal ─────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Iniciando seed de Supervisor y Asesor...\n')

  // Catálogos
  const [rolSupervisor, rolAsesor, rolCliente, rolAdmin] = await Promise.all([
    getRolId('SUPERVISOR'),
    getRolId('ASESOR'),
    getRolId('CLIENTE'),
    getRolId('ADMIN'),
  ])
  const estadoActivo      = await getEstadoClienteId('ACTIVO')
  const estadoPendiente   = await getEstadoSolicitudId('PENDIENTE')
  const estadoAprobada    = await getEstadoSolicitudId('APROBADA')
  const estadoDesembolsada = await getEstadoSolicitudId('DESEMBOLSADA')

  // ── 1. SUPERVISOR ────────────────────────────────────────────────────────────
  console.log('👔 Creando SUPERVISOR...')
  const supId = await crearUsuario({
    celular:  '3100000001',
    password: 'Plurall2025!',
    nombre:   'Laura Supervisora',
    dni:      '52100001',
    email:    'laura.supervisora@plurall.app',
  })
  await asegurarPerfil(supId, rolSupervisor, 'Laura Supervisora')
  console.log(`   ✅ Supervisor creado — ID: ${supId}`)

  // ── 2. ASESOR ────────────────────────────────────────────────────────────────
  console.log('📞 Creando ASESOR...')
  const asesorId = await crearUsuario({
    celular:  '3100000002',
    password: 'Plurall2025!',
    nombre:   'Carlos Asesor',
    dni:      '52100002',
    email:    'carlos.asesor@plurall.app',
  })
  await asegurarPerfil(asesorId, rolAsesor, 'Carlos Asesor')
  // El asesor también necesita registro en cliente para que el trigger no falle
  await asegurarCliente(asesorId, estadoActivo, {
    ...parseNombre('Carlos Asesor'),
    dni:      '52100002',
    email:    'carlos.asesor@plurall.app',
    telefono: '3100000002',
  })
  console.log(`   ✅ Asesor creado — ID: ${asesorId}`)

  // ── 3. CLIENTES EN MORA (para que el asesor tenga cartera) ───────────────────
  console.log('\n👥 Creando clientes con créditos en mora...')

  const clientesMora = [
    { celular: '3200000001', nombre: 'Pedro Mora Leve',   dni: '10200001', negocio: 'Tienda La Esperanza',   monto: 2000000, plazo: 12, diasMora: 25 },
    { celular: '3200000002', nombre: 'Ana Mora Media',    dni: '10200002', negocio: 'Restaurante El Sabor',   monto: 3500000, plazo: 18, diasMora: 45 },
    { celular: '3200000003', nombre: 'Luis Mora Critica', dni: '10200003', negocio: 'Ferretería Don Luis',    monto: 5000000, plazo: 24, diasMora: 75 },
    { celular: '3200000004', nombre: 'Rosa Mora Alta',    dni: '10200004', negocio: 'Peluquería Bella Rosa',  monto: 1500000, plazo: 6,  diasMora: 95 },
  ]

  const idsClientesMora = []

  for (const c of clientesMora) {
    const uid = await crearUsuario({
      celular:  c.celular,
      password: 'Plurall2025!',
      nombre:   c.nombre,
      dni:      c.dni,
      email:    `${c.celular}@plurall.app`,
    })
    await asegurarPerfil(uid, rolCliente)
    const clienteId = await asegurarCliente(uid, estadoActivo, {
      ...parseNombre(c.nombre),
      dni:                c.dni,
      email:              `${c.celular}@plurall.app`,
      telefono:           c.celular,
      nombre_negocio:     c.negocio,
      score_credito:      Math.floor(Math.random() * 300) + 400,
      ciudad:             'Bogotá',
      departamento:       'Cundinamarca',
    })

    // Solicitud desembolsada
    const { data: sol } = await supabase.from('solicitud_credito').insert({
      id_cliente:          clienteId,
      id_estado_solicitud: estadoDesembolsada,
      monto_solicitado:    c.monto,
      plazo_meses:         c.plazo,
      proposito:           `Capital de trabajo — ${c.negocio}`,
      canal_solicitud:     'WEB',
    }).select('id_solicitud').single()

    // Fechas: desembolso hace (diasMora + 30) días
    const fechaDesembolso = new Date(Date.now() - (c.diasMora + 30) * 86400000)
    const fechaPrimera    = new Date(fechaDesembolso.getTime() + 30 * 86400000)
    const fechaUltima     = new Date(fechaDesembolso.getTime() + c.plazo * 30 * 86400000)

    const tasaEM  = 0.020742
    const tasaEA  = (Math.pow(1 + tasaEM, 12) - 1) * 100
    const factor  = Math.pow(1 + tasaEM, c.plazo)
    const cuotaFija = Math.round((c.monto * tasaEM * factor) / (factor - 1))

    const { data: cred } = await supabase.from('credito').insert({
      id_solicitud:         sol.id_solicitud,
      id_cliente:           clienteId,
      monto_desembolsado:   c.monto,
      tasa_interes_anual:   tasaEA,
      tasa_interes_mensual: tasaEM,
      numero_cuotas:        c.plazo,
      cuota_fija:           cuotaFija,
      fecha_desembolso:     fechaDesembolso.toISOString(),
      fecha_primera_cuota:  fechaPrimera.toISOString().split('T')[0],
      fecha_ultima_cuota:   fechaUltima.toISOString().split('T')[0],
      estado_credito:       'EN_MORA',
      saldo_pendiente:      c.monto,
      cuotas_pagadas:       0,
      cuotas_en_mora:       Math.ceil(c.diasMora / 30),
      dias_mora_maximo:     c.diasMora,
    }).select('id_credito').single()

    // Plan de pago
    const { data: plan } = await supabase.from('plan_pago').insert({
      id_credito:         cred.id_credito,
      num_cuotas_totales: c.plazo,
      frecuencia_pago:    'MENSUAL',
      fecha_inicio_cobro: fechaPrimera.toISOString().split('T')[0],
      fecha_fin_cobro:    fechaUltima.toISOString().split('T')[0],
      tasa_mora_diaria:   0.001,
    }).select('id_plan_pago').single()

    // Cuotas — las primeras vencidas, el resto pendientes
    let saldo = c.monto
    const cuotasVencidas = Math.ceil(c.diasMora / 30)
    for (let i = 1; i <= c.plazo; i++) {
      const interes = Math.round(saldo * tasaEM * 100) / 100
      const capital = Math.round((cuotaFija - interes) * 100) / 100
      saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100)

      const fechaVenc = new Date(fechaPrimera.getTime() + (i - 1) * 30 * 86400000)
      const esVencida = i <= cuotasVencidas

      await supabase.from('cuota').insert({
        id_plan_pago:       plan.id_plan_pago,
        numero_cuota:       i,
        monto_capital:      capital,
        monto_interes:      interes,
        monto_total_cuota:  cuotaFija,
        saldo_despues_pago: saldo,
        fecha_vencimiento:  fechaVenc.toISOString().split('T')[0],
        estado_cuota:       esVencida ? 'VENCIDA' : 'PENDIENTE',
      })
    }

    idsClientesMora.push(clienteId)
    console.log(`   ✅ ${c.nombre} — ${c.diasMora}d mora — ID cliente: ${clienteId}`)
  }

  // ── 4. CLIENTES AL DÍA (para completar la cartera del asesor) ───────────────
  console.log('\n✅ Creando clientes con créditos al día...')

  const clientesAlDia = [
    { celular: '3300000001', nombre: 'Sofía Al Día',    dni: '20300001', negocio: 'Droguería San José',    monto: 2500000, plazo: 12 },
    { celular: '3300000002', nombre: 'Miguel Puntual',  dni: '20300002', negocio: 'Transporte Rápido',     monto: 4000000, plazo: 18 },
  ]

  const idsClientesAlDia = []

  for (const c of clientesAlDia) {
    const uid = await crearUsuario({
      celular:  c.celular,
      password: 'Plurall2025!',
      nombre:   c.nombre,
      dni:      c.dni,
      email:    `${c.celular}@plurall.app`,
    })
    await asegurarPerfil(uid, rolCliente)
    const clienteId = await asegurarCliente(uid, estadoActivo, {
      ...parseNombre(c.nombre),
      dni:             c.dni,
      email:           `${c.celular}@plurall.app`,
      telefono:        c.celular,
      nombre_negocio:  c.negocio,
      score_credito:   Math.floor(Math.random() * 200) + 700,
      ciudad:          'Medellín',
      departamento:    'Antioquia',
    })

    const { data: sol } = await supabase.from('solicitud_credito').insert({
      id_cliente:          clienteId,
      id_estado_solicitud: estadoDesembolsada,
      monto_solicitado:    c.monto,
      plazo_meses:         c.plazo,
      proposito:           `Expansión del negocio — ${c.negocio}`,
      canal_solicitud:     'WEB',
    }).select('id_solicitud').single()

    const fechaDesembolso = new Date(Date.now() - 45 * 86400000)
    const fechaPrimera    = new Date(fechaDesembolso.getTime() + 30 * 86400000)
    const fechaUltima     = new Date(fechaDesembolso.getTime() + c.plazo * 30 * 86400000)
    const tasaEM  = 0.020742
    const tasaEA  = (Math.pow(1 + tasaEM, 12) - 1) * 100
    const factor  = Math.pow(1 + tasaEM, c.plazo)
    const cuotaFija = Math.round((c.monto * tasaEM * factor) / (factor - 1))

    const { data: cred } = await supabase.from('credito').insert({
      id_solicitud:         sol.id_solicitud,
      id_cliente:           clienteId,
      monto_desembolsado:   c.monto,
      tasa_interes_anual:   tasaEA,
      tasa_interes_mensual: tasaEM,
      numero_cuotas:        c.plazo,
      cuota_fija:           cuotaFija,
      fecha_desembolso:     fechaDesembolso.toISOString(),
      fecha_primera_cuota:  fechaPrimera.toISOString().split('T')[0],
      fecha_ultima_cuota:   fechaUltima.toISOString().split('T')[0],
      estado_credito:       'ACTIVO',
      saldo_pendiente:      Math.round(c.monto * 0.9),
      cuotas_pagadas:       1,
      cuotas_en_mora:       0,
      dias_mora_maximo:     0,
    }).select('id_credito').single()

    const { data: plan } = await supabase.from('plan_pago').insert({
      id_credito:         cred.id_credito,
      num_cuotas_totales: c.plazo,
      frecuencia_pago:    'MENSUAL',
      fecha_inicio_cobro: fechaPrimera.toISOString().split('T')[0],
      fecha_fin_cobro:    fechaUltima.toISOString().split('T')[0],
      tasa_mora_diaria:   0.001,
    }).select('id_plan_pago').single()

    let saldo = c.monto
    for (let i = 1; i <= c.plazo; i++) {
      const interes = Math.round(saldo * tasaEM * 100) / 100
      const capital = Math.round((cuotaFija - interes) * 100) / 100
      saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100)
      const fechaVenc = new Date(fechaPrimera.getTime() + (i - 1) * 30 * 86400000)
      await supabase.from('cuota').insert({
        id_plan_pago:       plan.id_plan_pago,
        numero_cuota:       i,
        monto_capital:      capital,
        monto_interes:      interes,
        monto_total_cuota:  cuotaFija,
        saldo_despues_pago: saldo,
        fecha_vencimiento:  fechaVenc.toISOString().split('T')[0],
        estado_cuota:       i === 1 ? 'PAGADA' : 'PENDIENTE',
      })
    }

    idsClientesAlDia.push(clienteId)
    console.log(`   ✅ ${c.nombre} — Al día — ID cliente: ${clienteId}`)
  }

  // ── 5. SOLICITUDES PENDIENTES (para que el supervisor tenga cola) ────────────
  console.log('\n📋 Creando solicitudes pendientes para el supervisor...')

  const solicitantes = [
    { celular: '3400000001', nombre: 'Diana Solicitante',  dni: '30400001', negocio: 'Emprendimiento Artesanal', monto: 1800000, plazo: 9  },
    { celular: '3400000002', nombre: 'Jorge Nuevo Cliente', dni: '30400002', negocio: 'Comercio de Ropa',         monto: 3200000, plazo: 12 },
    { celular: '3400000003', nombre: 'Valentina Crédito',  dni: '30400003', negocio: 'Servicios de Belleza',     monto: 2500000, plazo: 6  },
  ]

  for (const c of solicitantes) {
    const uid = await crearUsuario({
      celular:  c.celular,
      password: 'Plurall2025!',
      nombre:   c.nombre,
      dni:      c.dni,
      email:    `${c.celular}@plurall.app`,
    })
    await asegurarPerfil(uid, rolCliente)
    const clienteId = await asegurarCliente(uid, estadoActivo, {
      ...parseNombre(c.nombre),
      dni:             c.dni,
      email:           `${c.celular}@plurall.app`,
      telefono:        c.celular,
      nombre_negocio:  c.negocio,
      score_credito:   Math.floor(Math.random() * 300) + 500,
      ciudad:          'Cali',
      departamento:    'Valle del Cauca',
    })

    // Insertar perfil financiero para que el supervisor vea datos (modelo normalizado)
    await supabase.from('perfil_financiero').upsert({
      id_cliente:          clienteId,
      ingresos_mensuales:  Math.floor(Math.random() * 3000000) + 1500000,
      egresos_mensuales:   Math.floor(Math.random() * 1000000) + 500000,
      otras_obligaciones:  Math.floor(Math.random() * 500000),
      patrimonio_estimado: Math.floor(Math.random() * 10000000) + 2000000,
      personas_cargo:      Math.floor(Math.random() * 4),
    }, { onConflict: 'id_cliente' })

    const { data: sol } = await supabase.from('solicitud_credito').insert({
      id_cliente:          clienteId,
      id_estado_solicitud: estadoPendiente,
      monto_solicitado:    c.monto,
      plazo_meses:         c.plazo,
      proposito:           `Score interno: 650 pts`,
      canal_solicitud:     'WEB',
    }).select('id_solicitud').single()

    // Insertar score para que el supervisor lo vea
    const { data: modelo } = await supabase
      .from('modelo_score').select('id_modelo_score').eq('activo', true).single()
    if (modelo) {
      const puntaje = Math.floor(Math.random() * 400) + 400
      await supabase.from('score').insert({
        id_solicitud:          sol.id_solicitud,
        id_modelo_score:       modelo.id_modelo_score,
        puntaje_total:         puntaje,
        puntaje_maximo_posible: 1000,
        porcentaje:            Math.round(puntaje / 10),
        recomendacion:         puntaje >= 600 ? 'APROBAR' : puntaje >= 400 ? 'REVISAR_MANUAL' : 'RECHAZAR',
      })
    }

    console.log(`   ✅ ${c.nombre} — Solicitud PENDIENTE`)
  }

  // ── 6. ASIGNAR CLIENTES AL ASESOR ────────────────────────────────────────────
  console.log('\n🔗 Asignando clientes al asesor...')

  const todosLosClientes = [...idsClientesMora, ...idsClientesAlDia]
  for (const clienteId of todosLosClientes) {
    await supabase.from('asignacion_asesor').upsert({
      id_asesor:        asesorId,
      id_cliente:       clienteId,
      activa:           true,
      fecha_asignacion: new Date().toISOString(),
    }, { onConflict: 'id_asesor,id_cliente' })
  }
  console.log(`   ✅ ${todosLosClientes.length} clientes asignados al asesor`)

  // ── 7. GESTIONES DE COBRANZA DE EJEMPLO ─────────────────────────────────────
  console.log('\n📞 Insertando gestiones de cobranza de ejemplo...')

  // Obtener créditos en mora para insertar gestiones
  const { data: creditosMora } = await supabase
    .from('credito')
    .select('id_credito, id_cliente')
    .eq('estado_credito', 'EN_MORA')
    .in('id_cliente', idsClientesMora)

  const tiposGestion = ['LLAMADA', 'WHATSAPP', 'LLAMADA', 'VISITA', 'LLAMADA']
  const resultados   = ['SIN_RESPUESTA', 'PROMESA', 'EXITOSO', 'SIN_RESPUESTA', 'PROMESA']

  for (let i = 0; i < Math.min(creditosMora?.length ?? 0, 4); i++) {
    const cr = creditosMora[i]
    const diasAtras = [3, 7, 1, 5][i] ?? 2
    await supabase.from('gestion_cobranza').insert({
      id_credito:      cr.id_credito,
      id_cliente:      cr.id_cliente,
      id_asesor:       asesorId,
      tipo_gestion:    tiposGestion[i],
      resultado:       resultados[i],
      observaciones:   ['No contestó el teléfono', 'Prometió pagar el viernes', 'Acordó plan de pago', 'Número equivocado'][i],
      monto_prometido: resultados[i] === 'PROMESA' ? 190000 : null,
      fecha_promesa:   resultados[i] === 'PROMESA'
        ? new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
        : null,
      fecha_gestion:   new Date(Date.now() - diasAtras * 86400000).toISOString(),
    })
  }
  console.log('   ✅ Gestiones de cobranza insertadas')

  // ── RESUMEN FINAL ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('🎉 SEED COMPLETADO EXITOSAMENTE')
  console.log('═'.repeat(60))
  console.log('\n📋 USUARIOS CREADOS:\n')
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│  ROL        │  CELULAR       │  CONTRASEÑA              │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log('│  SUPERVISOR │  3100000001    │  Plurall2025!            │')
  console.log('│  ASESOR     │  3100000002    │  Plurall2025!            │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log('│  CLIENTE    │  3200000001    │  Plurall2025!  (mora 25d)│')
  console.log('│  CLIENTE    │  3200000002    │  Plurall2025!  (mora 45d)│')
  console.log('│  CLIENTE    │  3200000003    │  Plurall2025!  (mora 75d)│')
  console.log('│  CLIENTE    │  3200000004    │  Plurall2025!  (mora 95d)│')
  console.log('│  CLIENTE    │  3300000001    │  Plurall2025!  (al día)  │')
  console.log('│  CLIENTE    │  3300000002    │  Plurall2025!  (al día)  │')
  console.log('│  CLIENTE    │  3400000001    │  Plurall2025!  (pendiente│')
  console.log('│  CLIENTE    │  3400000002    │  Plurall2025!  (pendiente│')
  console.log('│  CLIENTE    │  3400000003    │  Plurall2025!  (pendiente│')
  console.log('└─────────────────────────────────────────────────────────┘')
  console.log('\n🌐 PORTALES:')
  console.log('   Supervisor → http://localhost:3000/supervisor')
  console.log('   Asesor     → http://localhost:3000/asesor')
  console.log('   Admin      → http://localhost:3000/admin')
  console.log('\n💡 El login usa el CELULAR como usuario (sin @plurall.app)')
  console.log('═'.repeat(60) + '\n')
}

seed().catch(err => {
  console.error('\n❌ Error en el seed:', err.message)
  process.exit(1)
})
