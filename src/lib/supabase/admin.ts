import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Uses the SERVICE ROLE key — bypasses RLS entirely and can manage Auth
// users directly. Never import this from a Client Component or expose the
// key with a NEXT_PUBLIC_ prefix; only Server Actions/Route Handlers may use
// this module (the `server-only` import enforces that at build time).
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Supabase Dashboard → Project Settings → API → service_role secret) to enable admin user provisioning.'
    )
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
