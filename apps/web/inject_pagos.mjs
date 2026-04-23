import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function injectPagos() {
  console.log('--- Iniciando inyección de pagos y mora ---');

  // Buscar el cliente supervisor y su crédito
  const { data: client, error: errC } = await supabase
    .from('cliente')
    .select('id_cliente')
    .eq('dni', 'SUPER123456')
    .single();

  if (errC || !client) return console.error('Cliente no encontrado', errC);

  const { data: cred, error: errCr } = await supabase
    .from('credito')
    .select('*')
    .eq('id_cliente', client.id_cliente)
    .single();

  if (errCr || !cred) return console.error('Crédito no encontrado', errCr);

  // 1. Limpiar cualquier plan anterior por si acaso
  await supabase.from('plan_pago').delete().eq('id_credito', cred.id_credito);

  // 2. Crear plan de pagos
  const now = new Date();
  const hace150dias = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000);
  const mas180dias = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const { data: plan, error: errPlan } = await supabase
    .from('plan_pago')
    .insert({
      id_credito: cred.id_credito,
      num_cuotas_totales: 12,
      fecha_inicio_cobro: hace150dias.toISOString(),
      fecha_fin_cobro: mas180dias.toISOString(),
      tasa_mora_diaria: 0.001
    })
    .select('id_plan_pago')
    .single();

  if (errPlan) return console.error('Error en plan:', errPlan);

  console.log('=> Plan creado:', plan.id_plan_pago);

  // 3. Crear 12 Cuotas
  const cuotasToInsert = [];
  let saldo = 5000000;
  
  for (let i = 1; i <= 12; i++) {
    const interes = saldo * 0.02; // 2% mensual
    const capital = 450000 - interes;
    saldo = saldo - capital;
    if (saldo < 0) saldo = 0;

    // Fechas simuladas:
    // 5 PAGADAS (mes -5, -4, -3, -2, -1)
    // 2 VENCIDAS (mes 0, +1 que ya venció? asumimos mes 0 actual está en mora y el mes pasado)
    // Mejor: Vencidas hace 45 y 15 días. Pagadas hace 165, 135, 105 días.
    let estado = 'PENDIENTE';
    let fechaVenc = new Date(hace150dias.getTime() + (i * 30 * 24 * 60 * 60 * 1000));
    let montoPagado = null;
    let fechaPagoReal = null;

    if (i <= 5) {
      estado = 'PAGADA';
      montoPagado = 450000;
      fechaPagoReal = new Date(fechaVenc.getTime() - (2 * 24 * 60 * 60 * 1000)).toISOString();
    } else if (i === 6 || i === 7) {
      estado = 'VENCIDA';
      // venció en el paso, no tiene pagos
    }

    cuotasToInsert.push({
      id_plan_pago: plan.id_plan_pago,
      numero_cuota: i,
      monto_capital: capital,
      monto_interes: interes,
      monto_total_cuota: 450000,
      saldo_despues_pago: saldo,
      fecha_vencimiento: fechaVenc.toISOString(),
      estado_cuota: estado,
      monto_pagado_real: montoPagado,
      fecha_pago_real: fechaPagoReal
    });
  }

  const { data: cuotas, error: errCuotas } = await supabase
    .from('cuota')
    .insert(cuotasToInsert)
    .select('id_cuota, numero_cuota');

  if (errCuotas) return console.error('Error insertando cuotas:', errCuotas);
  console.log(`=> Insertadas ${cuotas.length} cuotas (5 Pagadas, 2 En Mora, 5 Pendientes)`);

  // 4. Crear los 5 registros en la tabla PAGO
  const pagosToInsert = [];
  for (let i = 1; i <= 5; i++) {
    const cuotaRef = cuotas.find(c => c.numero_cuota === i);
    pagosToInsert.push({
      id_cuota: cuotaRef.id_cuota,
      id_credito: cred.id_credito,
      monto_pagado: 450000,
      monto_capital: cuotasToInsert[i-1].monto_capital,
      monto_interes: cuotasToInsert[i-1].monto_interes,
      monto_mora: 0,
      fecha_pago: cuotasToInsert[i-1].fecha_pago_real,
      metodo_pago: 'PSE',
      referencia_externa: `REF-TEST-${i}`,
      estado: 'CONFIRMADO',
      intentos_cobro: 1
    });
  }

  const { error: errPagos } = await supabase.from('pago').insert(pagosToInsert);
  if (errPagos) return console.error('Error insertando pagos:', errPagos);

  // 5. Actualizar el crédito para reflejar la mora y cuotas pagadas
  await supabase.from('credito').update({
    cuotas_pagadas: 5,
    cuotas_en_mora: 2,
    estado_credito: 'EN_MORA',
    saldo_pendiente: cuotasToInsert[5].saldo_despues_pago + 450000 // Aprox
  }).eq('id_credito', cred.id_credito);

  console.log('=> 5 pagos inyectados. Crédito actualizado a EN_MORA con 2 cuotas vencidas.');
  console.log('\n--- 🎉 DONE ---');
}

injectPagos().catch(console.error);
