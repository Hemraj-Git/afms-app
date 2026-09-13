import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Thin redirect only — the real scanned-entity UI lives in the /mobile PWA
// shell (Scan tab). Printed QR codes (src/lib/qrPdfGenerator.ts) still point
// here with the same `type`/`id` query params, so no codes need reprinting;
// this route just forwards into /mobile with those params intact, after
// resolving auth (unauthenticated scans go to /login first, preserving the
// destination, exactly like every other route via proxy.ts — /qr itself
// stays a public path so a logged-out scan can still reach this redirect).
export default async function QrRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const readParam = (key: string) => {
    const value = params[key]
    return typeof value === 'string' ? value : undefined
  }

  const type = readParam('type')
  const id = readParam('id') || readParam('code')

  const query = new URLSearchParams()
  if (type) query.set('type', type)
  if (id) query.set('id', id)
  const mobileDestination = `/mobile${query.toString() ? `?${query.toString()}` : ''}`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(mobileDestination)}`)
  }

  redirect(mobileDestination)
}
