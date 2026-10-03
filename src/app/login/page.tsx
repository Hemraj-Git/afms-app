'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import { CheckCircle2, ChevronRight, CircleAlert, Eye, EyeOff, Lock, LogIn, Mail, Phone, ScanLine, ShieldCheck, UserRound } from 'lucide-react'
import { signIn, guestSignIn } from '@/app/actions/auth'
import { safeRedirectPath } from '@/lib/safeRedirect'
import { supabase } from '@/lib/supabase'
import { BrandMark, Button, IconButton, SegmentedControl, TextField } from '@/components/field'
import { CLIENT_NAME } from '@/lib/brand'

function LoginFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = safeRedirectPath(searchParams.get('redirect'), '/dashboard')
  // A QR scan arrives as /mobile?type=room&id=… (see src/app/qr/page.tsx), not
  // as /qr -- that route is public, so the proxy never redirects back to it.
  const isQrRedirect = redirectTarget.startsWith('/mobile') && redirectTarget.includes('type=')

  const { login } = useAFMS()

  const [activeTab, setActiveTab] = useState<'staff' | 'guest'>(isQrRedirect ? 'guest' : 'staff')

  // Staff Credentials State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  // Guest Details State
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestError, setGuestError] = useState('')
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false)

  const getDestination = (userRole: string) => {
    // Technician and Housekeeping default to mobile PWA field view; others to dashboard
    const roleDefault = userRole === 'Technician' || userRole === 'Housekeeping' ? '/mobile' : '/dashboard'
    // Checked, not trusted: it comes from the query string.
    return safeRedirectPath(searchParams.get('redirect'), roleDefault)
  }

  const handleStaffSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsAuthenticating(true)

    try {
      const result = await signIn(email, password)
      if (!result.success) {
        setLoginError(result.error)
        return
      }
      login(result.profile)
      router.push(getDestination(result.profile.role))
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication error. Please try again.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleGuestSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestEmail.trim() || !guestPhone.trim()) {
      setGuestError('Please provide both email address and mobile number.')
      return
    }
    setGuestError('')
    setIsGuestSubmitting(true)
    try {
      const result = await guestSignIn({
        fullName: guestName.trim(),
        email: guestEmail.trim(),
        phone: guestPhone.trim(),
      })
      if (!result.success) {
        setGuestError(result.error)
        return
      }
      login({
        id: result.profile.id,
        fullName: result.profile.fullName,
        email: result.profile.email,
        phone: result.profile.phone,
        role: 'Guest',
        department: 'Visitor Services',
      })
      router.push(redirectTarget)
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : 'Could not start guest session. Please try again.')
    } finally {
      setIsGuestSubmitting(false)
    }
  }

  // Which room or asset was scanned, to name it in the notice. Signed-out
  // visitors may read rooms and assets for exactly this ("Public read ... for
  // QR scan"); if the lookup fails the notice simply leaves the name out.
  const [scannedName, setScannedName] = useState('')
  useEffect(() => {
    if (!isQrRedirect) return
    const params = new URLSearchParams(redirectTarget.split('?')[1] ?? '')
    const type = params.get('type')
    const id = params.get('id')
    if (!id || (type !== 'room' && type !== 'asset')) return
    let alive = true
    const lookup =
      type === 'room'
        ? supabase.from('rooms').select('name, room_number').eq('id', id).maybeSingle()
        : supabase.from('assets').select('name, asset_id').eq('id', id).maybeSingle()
    lookup.then(({ data }) => {
      if (!alive || !data) return
      const row = data as { name?: string; room_number?: string; asset_id?: string }
      const code = row.room_number || row.asset_id
      setScannedName(code ? `${row.name} (${code})` : row.name || '')
    })
    return () => {
      alive = false
    }
  }, [isQrRedirect, redirectTarget])

  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [guestNameError, setGuestNameError] = useState('')
  const [guestEmailError, setGuestEmailError] = useState('')
  const [guestPhoneError, setGuestPhoneError] = useState('')

  const onStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const eErr = !email.trim() ? 'Enter your work email' : !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Enter a full email address, like name@campus.example' : ''
    const pErr = !password ? 'Enter your password' : ''
    setEmailError(eErr)
    setPasswordError(pErr)
    if (eErr || pErr) return
    void handleStaffSignIn(e)
  }

  const onGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nErr = !guestName.trim() ? 'Enter your full name' : ''
    const eErr = !guestEmail.trim() ? 'Enter your email' : !/^\S+@\S+\.\S+$/.test(guestEmail.trim()) ? 'Enter a full email address, like name@example.com' : ''
    const pErr = guestPhone.replace(/\D/g, '').length < 10 ? 'Enter your 10-digit mobile number' : ''
    setGuestNameError(nErr)
    setGuestEmailError(eErr)
    setGuestPhoneError(pErr)
    if (nErr || eErr || pErr) return
    void handleGuestSignIn(e)
  }

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-5">
      {/* On a phone the brand sits on top of the form (the photo panel is
          desktop only). */}
      <div className="md:hidden">
        <BrandMark size="lg" />
      </div>

      {isQrRedirect ? (
        <div role="status" className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-[#BFD0FB] bg-fa-primary-weak px-3 py-2.5 text-[15px] leading-snug text-fa-primary-strong">
          <ScanLine className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            <strong className="font-semibold">Scanned QR detected</strong>
            {scannedName ? ` — ${scannedName}` : ''}. Sign in or continue as guest.
          </span>
        </div>
      ) : null}

      <div className="hidden flex-col gap-1.5 md:flex">
        <h2 className="m-0 text-[28px] font-bold leading-tight">{activeTab === 'staff' ? 'Sign in' : 'Guest access'}</h2>
        <p className="m-0 text-base text-fa-text-2">
          {activeTab === 'staff' ? 'Use your work email and password.' : 'Enter your details to check in or report a problem.'}
        </p>
      </div>

      <SegmentedControl
        label="How are you signing in?"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'staff', label: 'Staff sign in', icon: LogIn },
          { value: 'guest', label: 'Guest access', icon: UserRound },
        ]}
      />

      {activeTab === 'staff' ? (
        <form onSubmit={onStaffSubmit} noValidate className="flex flex-col gap-4">
          {loginError ? (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-fa-danger/30 bg-fa-danger-weak px-3.5 py-3 text-[15px] font-medium text-fa-danger">
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>{loginError}</span>
            </div>
          ) : null}
          <TextField
            label="Work email"
            type="email"
            icon={Mail}
            autoComplete="username"
            inputMode="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (emailError) setEmailError('')
            }}
            error={emailError || undefined}
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            icon={Lock}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError('')
            }}
            error={passwordError || undefined}
            trailing={
              <IconButton
                icon={showPassword ? EyeOff : Eye}
                label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(s => !s)}
                className="text-fa-text-2"
              />
            }
          />
          <div className="-mt-1.5 flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="inline-flex min-h-12 items-center px-1 text-base font-semibold text-fa-primary underline underline-offset-[3px] hover:text-fa-primary-strong"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" icon={LogIn} loading={isAuthenticating}>
            {isAuthenticating ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      ) : (
        <form onSubmit={onGuestSubmit} noValidate className="flex flex-col gap-4">
          {guestError ? (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-fa-danger/30 bg-fa-danger-weak px-3.5 py-3 text-[15px] font-medium text-fa-danger">
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>{guestError}</span>
            </div>
          ) : null}
          <TextField
            label="Full name"
            required
            icon={UserRound}
            autoComplete="name"
            placeholder="e.g. Anita Desai"
            value={guestName}
            onChange={e => {
              setGuestName(e.target.value)
              if (guestNameError) setGuestNameError('')
            }}
            error={guestNameError || undefined}
          />
          <TextField
            label="Email"
            required
            type="email"
            icon={Mail}
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            value={guestEmail}
            onChange={e => {
              setGuestEmail(e.target.value)
              if (guestEmailError) setGuestEmailError('')
            }}
            error={guestEmailError || undefined}
          />
          <TextField
            label="Mobile number"
            required
            type="tel"
            icon={Phone}
            autoComplete="tel"
            inputMode="tel"
            placeholder="10-digit mobile number"
            value={guestPhone}
            onChange={e => {
              setGuestPhone(e.target.value)
              if (guestPhoneError) setGuestPhoneError('')
            }}
            error={guestPhoneError || undefined}
            hint="So the facilities team can reach you about your visit."
          />
          <Button type="submit" icon={ChevronRight} loading={isGuestSubmitting}>
            {isGuestSubmitting ? 'Starting your visit…' : 'Continue as guest'}
          </Button>
        </form>
      )}

      <p className="m-0 pt-2 text-center text-sm leading-normal text-fa-text-2">Trouble signing in? Contact the facilities help desk.</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-fa-surface md:flex-row">
      {/* Desktop only: the brand panel. On a phone the form comes first. */}
      <div className="relative hidden min-h-screen w-1/2 flex-col justify-between overflow-hidden bg-[#031d4d] p-16 text-white md:flex">
        {/* Photographic Cruise Ship Bow Background Image */}
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-[right_bottom] opacity-80"
          style={{ backgroundImage: "url('/images/login-sea.jpg')" }}
        />
        {/* Deep Maritime Gradient Overlay for Text Readability */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-[#031b48] via-[#052668]/90 to-[#07388e]/60" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-[#021333]/90 via-transparent to-[#031b48]/70" />

        <div className="relative z-10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static brand file at a fixed size */}
          <img src="/images/assetnxg-hexagon-white.svg" alt="" className="h-11 w-11" />
          <span className="text-2xl font-extrabold tracking-tight">AssetNXG</span>
        </div>

        <div className="relative z-10 my-12 max-w-lg space-y-6">
          <h1 className="text-5xl font-extrabold leading-none tracking-tight text-white lg:text-6xl">
            Streamline.<br />
            Track. Maintain.
          </h1>
          <p className="text-base leading-relaxed text-blue-100 opacity-90">
            One operational command center for every asset, facility and service decision that keeps maritime training moving.
          </p>
          <div className="space-y-3 pt-2">
            {['Mission-critical asset visibility', 'Maintenance before downtime', 'Compliance-ready by default'].map(t => (
              <div key={t} className="flex items-center gap-3 text-sm font-medium text-blue-50">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-300" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The client this deployment is for (set per deployment, see lib/brand). */}
        {CLIENT_NAME ? (
          <div className="relative z-10 flex items-center gap-2 text-xs text-blue-100/90">
            <ShieldCheck className="h-4 w-4" />
            <span>{CLIENT_NAME}</span>
          </div>
        ) : (
          <div />
        )}
      </div>

      <div className="flex w-full flex-1 justify-center px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(48px,env(safe-area-inset-top))] md:w-1/2 md:items-center md:p-16">
        <Suspense fallback={<div className="text-sm text-fa-text-2">Loading…</div>}>
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  )
}
