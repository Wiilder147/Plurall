import { createClient } from '@supabase/supabase-js';
import { parseNombre } from '../../lib/nombre.js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inject() {
  console.log('--- Iniciando inyección... ---');
  
  // 1. Obtener IDs de catálogos
  const [{data: roles}, {data: estClient}, {data: estSol}] = await Promise.all([
    supabase.from('rol').select('id_rol, nombre_rol'),
    supabase.from('estado_cliente').select('id_estado_cliente, nombre'),
    supabase.from('estado_solicitud').select('id_estado_solicitud, nombre')
  ]);

  const idRolAdmin = roles.find(r => r.nombre_rol === 'ADMIN')?.id_rol;
  const idEstadoCliActivo = estClient.find(e => e.nombre === 'ACTIVO')?.id_estado_cliente;
  let idEstadoSolDesembolsada = estSol.find(e => e.nombre === 'DESEMBOLSADA' || e.nombre === 'APROBADA')?.id_estado_solicitud;

  if (!idRolAdmin || !idEstadoCliActivo || !idEstadoSolDesembolsada) {
    console.error('Faltan IDs de catálogos básicos', {idRolAdmin, idEstadoCliActivo, idEstadoSolDesembolsada});
    return;
  }

  // 2. Crear Auth user
  const email = 'supervisor_test@plurall.com';
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { ...parseNombre('Supervisor QA') }
  });

  if (authErr && authErr.code !== 'email_exists' && authErr.message !== 'User already registered') {
    return console.error('Error creando auth user:', authErr);
  }

  // Find user if already existed
  let targetUserId = authUser?.user?.id;
  if (!targetUserId) {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    targetUserId = users.find(u => u.email === email)?.id;
  }
  console.log('=> Auth User ID:', targetUserId);

  // 3. Crear Perfil Usuario
  const { error: profileErr } = await supabase.from('perfil_usuario').upsert({
    id: targetUserId,
    id_rol: idRolAdmin,
    ...parseNombre('Supervisor QA'),
    activo: true,
    intentos_fallidos: 0
  });
  if (profileErr) return console.error('Error creando perfil:', profileErr);

  // 4. Crear Cliente
  const { data: newClient, error: clientErr } = await supabase.from('cliente').insert({
    id_usuario_cuenta: targetUserId,
    id_estado_cliente: idEstadoCliActivo,
    ...parseNombre('Supervisor QA'),
    dni: '1234567890',
    email: email,
    telefono: '3001234567'
  }).select('id_cliente').single();

  if (clientErr) {
    if(clientErr.code === '23505') console.log('Cliente ya existe (ignorar duplicado)');
    else return console.error('Error creando cliente:', clientErr);
  }

  // Encontrar el id de cliente si ya existía
  let clId = newClient?.id_cliente;
  if (!clId) {
    const { data: existingCl } = await supabase.from('cliente').select('id_cliente').eq('email', email).single();
    clId = existingCl?.id_cliente;
  }
  console.log('=> Cliente ID:', clId);

  // 5. Crear Solicitud de Crédito
  const { data: sol, error: solErr } = await supabase.from('solicitud_credito').insert({
    id_cliente: clId,
    id_estado_solicitud: idEstadoSolDesembolsada,
    monto_solicitado: 5000000,
    plazo_meses: 12,
    tasa_interes_propuesta: 0.02
  }).select('id_solicitud').single();
  if (solErr) return console.error('Error creando solicitud:', solErr);

  console.log('=> Solicitud ID:', sol.id_solicitud);

  // 6. Crear Crédito Activo
  const { data: cred, error: credErr } = await supabase.from('credito').insert({
    id_solicitud: sol.id_solicitud,
    id_cliente: clId,
    monto_desembolsado: 5000000,
    tasa_interes_anual: 24.0,
    tasa_interes_mensual: 0.02,
    numero_cuotas: 12,
    cuota_fija: 450000,
    fecha_desembolso: new Date().toISOString(),
    fecha_primera_cuota: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    fecha_ultima_cuota: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
    estado_credito: 'ACTIVO',
    saldo_pendiente: 5000000,
    cuotas_pagadas: 0,
    cuotas_en_mora: 0,
    dias_mora_maximo: 0
  }).select('id_credito').single();
  
  if (credErr) return console.error('Error creando crédito:', credErr);

  console.log('=> Crédito ID creado con éxito:', cred.id_credito);
  console.log('\n--- 🎉 DONE ---');
  console.log('Email: ', email);
  console.log('Password: ', 'Password123!');
}

inject().catch(console.error);
