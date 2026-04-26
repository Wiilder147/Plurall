import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
  const { data: profiles } = await supabase.from('perfil_usuario').select('*, rol(*)');
  console.log('Perfiles y roles:');
  console.log(JSON.stringify(profiles, null, 2));

  const { data: roles } = await supabase.from('rol').select('*');
  console.log('Roles disponibles:');
  console.log(roles);
}

checkRoles().catch(console.error);
