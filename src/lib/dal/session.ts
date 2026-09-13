import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/afms'

export type VerifiedSession = {
  userId: string
  email: string | null
}

// Verifies the session against Supabase Auth (never trusts a decoded cookie
// alone). Memoized per request via React.cache so repeated calls across
// Server Components/Actions in the same render pass don't re-hit the network.
export const verifySession = cache(async (): Promise<VerifiedSession> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { userId: user.id, email: user.email ?? null }
})

export type SessionProfile = {
  id: string
  email: string
  fullName: string
  role: UserRole
  department: string
  phone: string
}

// DTO — only the fields a Server Component/Action needs, never the raw row.
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const session = await verifySession()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, department, phone')
    .eq('id', session.userId)
    .maybeSingle()

  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as UserRole,
    department: profile.department || '',
    phone: profile.phone || '',
  }
})
