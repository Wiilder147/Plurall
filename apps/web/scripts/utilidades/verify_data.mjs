import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const u = users.users.find(x => x.phone === '3001234567' || x.email === '3001234567@plurall.app');
  console.log('User Auth:', u?.id, u?.email, u?.phone);

  const { data: cli } = await supabase.from('cliente').select('*').eq('email', '3001234567@plurall.app').single();
  // if not found by email, try DNI
  const { data: cli2 } = await supabase.from('cliente').select('*').eq('dni', 'SUPER123456').single();
  console.log('Cliente Email:', cli?.id_cliente, cli?.id_usuario_cuenta);
  console.log('Cliente DNI:', cli2?.id_cliente, cli2?.email, cli2?.id_usuario_cuenta);

  if (cli2) {
    const { data: creds } = await supabase.from('credito').select('*').eq('id_cliente', cli2.id_cliente);
    console.log('Creditos:', creds);

    if (creds && creds.length > 0) {
      const { data: planes } = await supabase.from('plan_pago').select('*').eq('id_credito', creds[0].id_credito);
      console.log('Planes:', planes);

      if (planes && planes.length > 0) {
        const { data: cuotas } = await supabase.from('cuota').select('numero_cuota, estado_cuota').eq('id_plan_pago', planes[0].id_plan_pago);
        console.log('Cuotas:', cuotas);

        const { data: pagos } = await supabase.from('pago').select('*').eq('id_credito', creds[0].id_credito);
        console.log('Pagos:', pagos);
      }
    }
  }
}

verify().catch(console.error);
