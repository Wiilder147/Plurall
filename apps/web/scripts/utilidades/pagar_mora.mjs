import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function pagarCuotasVencidas() {
  console.log('--- Simulando pago de cuotas vencidas ---');

  // 1. Buscar crédito activo
  const { data: cred } = await supabase
    .from('credito')
    .select('id_credito')
    .eq('estado_credito', 'EN_MORA')
    .single();

  if (!cred) return console.log('No hay crédito en mora');

  // 2. Buscar plan de pago
  const { data: plan } = await supabase
    .from('plan_pago')
    .select('id_plan_pago')
    .eq('id_credito', cred.id_credito)
    .single();

  // 3. Buscar las cuotas vencidas (6 y 7)
  const { data: cuotasVencidas } = await supabase
    .from('cuota')
    .select('*')
    .eq('id_plan_pago', plan.id_plan_pago)
    .eq('estado_cuota', 'VENCIDA')
    .order('numero_cuota', { ascending: true });

  console.log(`=> Cuotas vencidas encontradas: ${cuotasVencidas.length}`);

  const ahora = new Date().toISOString();

  for (const cuota of cuotasVencidas) {
    // Calcular días de mora
    const diasMora = Math.max(0, Math.floor((Date.now() - new Date(cuota.fecha_vencimiento).getTime()) / (1000*60*60*24)));
    const montoMora = Math.round(cuota.monto_total_cuota * 0.001 * diasMora); // tasa_mora_diaria 0.1%

    console.log(`\n=> Pagando cuota #${cuota.numero_cuota}`);
    console.log(`   Vencida hace ${diasMora} días | Mora: $${montoMora.toLocaleString()}`);

    // Insertar pago
    const { error: errPago } = await supabase.from('pago').insert({
      id_cuota: cuota.id_cuota,
      id_credito: cred.id_credito,
      monto_pagado: cuota.monto_total_cuota + montoMora,
      monto_capital: cuota.monto_capital,
      monto_interes: cuota.monto_interes,
      monto_mora: montoMora,
      fecha_pago: ahora,
      metodo_pago: 'PSE',
      referencia_externa: `REF-PAGO-MORA-${cuota.numero_cuota}-${Date.now()}`,
      estado: 'CONFIRMADO',
      intentos_cobro: 1
    });

    if (errPago) {
      console.error(`   ERROR insertando pago:`, errPago);
      continue;
    }

    // Actualizar estado de la cuota a PAGADA_MORA
    await supabase.from('cuota').update({
      estado_cuota: 'PAGADA_MORA',
      monto_pagado_real: cuota.monto_total_cuota + montoMora,
      fecha_pago_real: ahora
    }).eq('id_cuota', cuota.id_cuota);

    console.log(`   ✅ Cuota #${cuota.numero_cuota} pagada con mora`);
  }

  // 4. Actualizar estado del crédito a ACTIVO (al día)
  const { error: errUpdate } = await supabase.from('credito').update({
    estado_credito: 'ACTIVO',
    cuotas_pagadas: 7,
    cuotas_en_mora: 0,
    dias_mora_maximo: 0
  }).eq('id_credito', cred.id_credito);

  if (errUpdate) console.error('Error actualizando crédito:', errUpdate);
  else console.log('\n=> ✅ Crédito actualizado a ACTIVO (Al día) — 7/12 cuotas pagadas');

  console.log('\n--- 🎉 DONE ---');
}

pagarCuotasVencidas().catch(console.error);
