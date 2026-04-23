import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function seed() {
  console.log('🌱 Iniciando carga de datos reales en Supabase...')

  // 1. Aseguramos Rol Admin en la BD
  await supabase.from('rol').insert({ nombre_rol: 'ADMIN', descripcion: 'Administrador del Sistema' }).select()
  const { data: qRolAdmin } = await supabase.from('rol').select('id_rol').eq('nombre_rol', 'ADMIN').single()
  const { data: qEstadoAprob } = await supabase.from('estado_solicitud').select('id_estado_solicitud').eq('nombre', 'DESEMBOLSADA').single()
  const { data: qEstadoPend } = await supabase.from('estado_solicitud').select('id_estado_solicitud').eq('nombre', 'PENDIENTE').single()
  const { data: qEstadoRech } = await supabase.from('estado_solicitud').select('id_estado_solicitud').eq('nombre', 'RECHAZADA').single()
  
  // 3. Crear Bucket si no existe
  console.log('📁 Verificando Bucket Storage KYC...')
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === 'documentos_kyc')) {
    await supabase.storage.createBucket('documentos_kyc', { public: true }) // Público temporal para agilizar sprint
  }

  // --- Usuario 1: ADMIN ---
  console.log('🧑‍💼 Creando ADMIN (Celular: 0000000000 / pass: 123456)...')
  const { data: uAdmin } = await supabase.auth.admin.createUser({
    email: '0000000000@plurall.app',
    password: 'password123',
    email_confirm: true,
    user_metadata: { nombre_completo: 'Julio Administrador', rol_override: 'ADMIN' }
  })
  
  // Cambiamos su rol a ADMIN (el trigger lo puso en CLIENTE por defecto)
  if (uAdmin?.user) {
    await supabase.from('perfil_usuario').update({ id_rol: qRolAdmin.id_rol }).eq('id', uAdmin.user.id)
  }

  // --- Usuario 2: CLIENTE CON CRÉDITO APROBADO ---
  console.log('🟢 Creando Cliente Aprobado (Celular: 1111111111 / pass: password123)...')
  const { data: uAprob } = await supabase.auth.admin.createUser({
    email: '1111111111@plurall.app',
    password: 'password123',
    email_confirm: true,
    user_metadata: { nombre_completo: 'Carlos Aprobado', dni: '123456', telefono: '1111111111' }
  })
  
  if (uAprob?.user) {
    // Buscar Estado Activo
    const { data: qEstadoCli } = await supabase.from('estado_cliente').select('id_estado_cliente').eq('nombre_estado', 'ACTIVO').single()
    
    // Forzar inserción del cliente por seguridad
    await supabase.from('cliente').upsert({
      id_cliente: uAprob.user.id,
      id_usuario_cuenta: uAprob.user.id,
      id_estado_cliente: qEstadoCli?.id_estado_cliente || null,
      nombre_completo: 'Carlos Aprobado',
      dni: '123456',
      email: uAprob.user.email,
      telefono: '1111111111'
    })

    // Generar Solicitud
    const { data: sol, error: solErr } = await supabase.from('solicitud_credito').insert({
      id_cliente: uAprob.user.id,
      id_estado_solicitud: qEstadoAprob.id_estado_solicitud,
      monto_solicitado: 3000000,
      plazo_meses: 6,
      proposito: 'Crédito Demo Activo'
    }).select().single()
    
    if (solErr) {
      console.error('Error insertando solicitud:', solErr)
    }

    // Generar Crédito y Plan
    const { data: cred } = await supabase.from('credito').insert({
      id_cliente: uAprob.user.id,
      id_solicitud: sol.id_solicitud,
      monto_desembolsado: 3000000,
      tasa_interes_anual: 28,
      tasa_interes_mensual: 0.02078,
      numero_cuotas: 6,
      cuota_fija: 531396,
      fecha_desembolso: new Date().toISOString(),
      fecha_primera_cuota: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      fecha_ultima_cuota: new Date(Date.now() + 180*24*60*60*1000).toISOString(),
      saldo_pendiente: 3000000
    }).select().single()

    const { data: plan } = await supabase.from('plan_pago').insert({
      id_credito: cred.id_credito,
      num_cuotas_totales: 6,
      fecha_inicio_cobro: new Date().toISOString(),
      fecha_fin_cobro: new Date(Date.now() + 180*24*60*60*1000).toISOString()
    }).select().single()

    // Llenar Cuotas
    let saldo = 3000000
    for(let i=1; i<=6; i++) {
        const interes = saldo * 0.02078
        const capital = 531396 - interes
        saldo = saldo - capital
        await supabase.from('cuota').insert({
            id_plan_pago: plan.id_plan_pago,
            numero_cuota: i,
            monto_capital: capital,
            monto_interes: interes,
            monto_total_cuota: 531396,
            saldo_despues_pago: saldo,
            fecha_vencimiento: new Date(Date.now() + i*30*24*60*60*1000).toISOString()
        })
    }
  }

  // --- Usuario 3: CLIENTE CON SOLICITUD PENDIENTE ---
  console.log('🟡 Creando Cliente Pendiente (Celular: 2222222222 / pass: password123)...')
  const { data: uPend } = await supabase.auth.admin.createUser({
    email: '2222222222@plurall.app',
    password: 'password123',
    email_confirm: true,
    user_metadata: { nombre_completo: 'María Pendiente', dni: '987654', telefono: '2222222222' }
  })
  
  if (uPend?.user) {
    const { data: qEstadoCli } = await supabase.from('estado_cliente').select('id_estado_cliente').eq('nombre_estado', 'ACTIVO').single()
    // Forzar inserción
    await supabase.from('cliente').upsert({
      id_cliente: uPend.user.id,
      id_usuario_cuenta: uPend.user.id,
      id_estado_cliente: qEstadoCli?.id_estado_cliente || null,
      nombre_completo: 'María Pendiente',
      dni: '987654',
      email: uPend.user.email,
      telefono: '2222222222'
    })

    await supabase.from('solicitud_credito').insert({
      id_cliente: uPend.user.id,
      id_estado_solicitud: qEstadoPend.id_estado_solicitud,
      monto_solicitado: 5000000,
      plazo_meses: 12,
      proposito: 'Compra de inventario'
    })
  }

  console.log('✅ SEED COMPLETADO CON ESTADO CORRECTO.')
}

seed().catch(console.error)
