import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLogin() {
  console.log('Buscando usuario...');
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'supervisor_test@plurall.com');
  
  if (user) {
    console.log('Usuario encontrado. Cambiando email para login con celular...');
    await supabase.auth.admin.updateUserById(user.id, { email: '3001234567@plurall.app' });
    await supabase.from('cliente').update({ email: '3001234567@plurall.app' }).eq('email', 'supervisor_test@plurall.com');
    console.log('¡Listo!');
  } else {
    console.log('No se encontro el usuario original supervisor_test@plurall.com. Quiza ya fue actualizado.');
  }
}

fixLogin().catch(console.error);
