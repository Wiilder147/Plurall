import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bnemrismjmvmemypokaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profiles, error: pErr } = await supabase.from('perfil_usuario').select('*');
  console.log('Profiles Error?', pErr);
  console.log('Profiles:', profiles);
}

run().catch(console.error);
