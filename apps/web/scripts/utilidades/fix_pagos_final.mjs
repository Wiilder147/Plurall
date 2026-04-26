import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPagos() {
  console.log('--- Corrigiendo Tabla de Pagos ---');

  const { data: cred } = await supabase.from('credito').select('id_credito, id_cliente').eq('cuotas_pagadas', 5).single();
  if (!cred) return console.log('Crédito no encontrado');

  const { data: plan } = await supabase.from('plan_pago').select('id_plan_pago').eq('id_credito', cred.id_credito).single();
  const { data: cuotas } = await supabase.from('cuota').select('*').eq('id_plan_pago', plan.id_plan_pago).lte('numero_cuota', 5);

  const pagosToInsert = cuotas.map(c => ({
    id_cuota: c.id_cuota,
    id_credito: cred.id_credito,
    monto_pagado: 450000,
    monto_capital: c.monto_capital,
    monto_interes: c.monto_interes,
    monto_mora: 0,
    fecha_pago: c.fecha_pago_real || new Date().toISOString(),
    metodo_pago: 'PSE',
    referencia_externa: `REF-FIX-${c.numero_cuota}`,
    estado: 'CONFIRMADO',
    intentos_cobro: 1
  }));

  const { error } = await supabase.from('pago').insert(pagosToInsert);
  if (error) console.error('Error insertando pagos:', error);
  else console.log('=> 5 Pagos inyectados correctamente.');
}

fixPagos().catch(console.error);
