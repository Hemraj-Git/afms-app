import { createClient } from '@/lib/supabase/client'

// Re-exports the cookie-based browser client (see src/lib/supabase/client.ts)
// so the session is visible to proxy.ts and Server Components/Actions, not
// just to this browser tab's localStorage. Existing `import { supabase } from
// '@/lib/supabase'` call sites across the app keep working unchanged.
export const supabase = createClient()
