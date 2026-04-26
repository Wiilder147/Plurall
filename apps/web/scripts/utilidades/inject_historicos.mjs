import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function injectHistoricos() {
  console.log('--- Inyectando créditos históricos pagados ---');

  // Buscar cliente
  const { data: cliente } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('dni', 'SUPER123456')
    .single();

  if (!cliente) return console.error('Cliente no encontrado');

  // Buscar solicitud existente para reusar como referencia
  const { data: solExistente } = await supabase
    .from('solicitud_credito')
    .select('id_solicitud')
    .eq('id_cliente', cliente.id_cliente)
    .limit(1)
    .single();

  const idSolicitud = solExistente?.id_solicitud;

  // ── CRÉDITO HISTÓRICO 1: $2.000.000 - 6 cuotas - Pagado hace 2 años ──
  const { data: cred1, error: err1 } = await supabase
    .from('credito')
    .insert({
      id_solicitud: idSolicitud,
      id_cliente: cliente.id_cliente,
      monto_desembolsado: 2000000,
      tasa_interes_anual: 24,
      tasa_interes_mensual: 0.02,
      numero_cuotas: 6,
      cuota_fija: 360000,
      fecha_desembolso: '2023-06-15T10:00:00Z',
      fecha_primera_cuota: '2023-07-15',
      fecha_ultima_cuota: '2023-12-15',
      estado_credito: 'PAGADO',
      saldo_pendiente: 0,
      cuotas_pagadas: 6,
      cuotas_en_mora: 0,
      dias_mora_maximo: 0,
      created_at: '2023-06-15T10:00:00Z',
      updated_at: '2023-12-20T10:00:00Z'
    })
    .select('id_credito')
    .single();

  if (err1) return console.error('Error crédito 1:', err1);
  console.log('=> Crédito histórico 1 creado:', cred1.id_credito);

  // ── CRÉDITO HISTÓRICO 2: $3.500.000 - 12 cuotas - Pagado hace 1 año ──
  const { data: cred2, error: err2 } = await supabase
    .from('credito')
    .insert({
      id_solicitud: idSolicitud,
      id_cliente: cliente.id_cliente,
      monto_desembolsado: 3500000,
      tasa_interes_anual: 26,
      tasa_interes_mensual: 0.0193,
      numero_cuotas: 12,
      cuota_fija: 340000,
      fecha_desembolso: '2024-03-01T10:00:00Z',
      fecha_primera_cuota: '2024-04-01',
      fecha_ultima_cuota: '2025-03-01',
      estado_credito: 'PAGADO',
      saldo_pendiente: 0,
      cuotas_pagadas: 12,
      cuotas_en_mora: 0,
      dias_mora_maximo: 0,
      created_at: '2024-03-01T10:00:00Z',
      updated_at: '2025-03-05T10:00:00Z'
    })
    .select('id_credito')
    .single();

  if (err2) return console.error('Error crédito 2:', err2);
  console.log('=> Crédito histórico 2 creado:', cred2.id_credito);

  // ── CRÉDITO HISTÓRICO 3: $1.000.000 - 3 cuotas - Pagado hace 6 meses ──
  const { data: cred3, error: err3 } = await supabase
    .from('credito')
    .insert({
      id_solicitud: idSolicitud,
      id_cliente: cliente.id_cliente,
      monto_desembolsado: 1000000,
      tasa_interes_anual: 22,
      tasa_interes_mensual: 0.0167,
      numero_cuotas: 3,
      cuota_fija: 345000,
      fecha_desembolso: '2025-07-10T10:00:00Z',
      fecha_primera_cuota: '2025-08-10',
      fecha_ultima_cuota: '2025-10-10',
      estado_credito: 'PAGADO',
      saldo_pendiente: 0,
      cuotas_pagadas: 3,
      cuotas_en_mora: 0,
      dias_mora_maximo: 0,
      created_at: '2025-07-10T10:00:00Z',
      updated_at: '2025-10-15T10:00:00Z'
    })
    .select('id_credito')
    .single();

  if (err3) return console.error('Error crédito 3:', err3);
  console.log('=> Crédito histórico 3 creado:', cred3.id_credito);

  console.log('\n--- 🎉 3 créditos históricos inyectados ---');
}

injectHistoricos().catch(console.error);
