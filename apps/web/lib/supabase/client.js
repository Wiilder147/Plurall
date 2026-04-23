import { createBrowserClient } from '@supabase/ssr'

// Crea cliente Supabase en el navegador (front-end) usando envs públicas.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
