'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Anchor,
  ShieldCheck,
  User,
  Mail,
  Phone,
  QrCode,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { signIn, guestSignIn } from '@/app/actions/auth'

function LoginFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get('redirect') || '/dashboard'
  const isQrRedirect = redirectTarget.includes('/qr')

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
    const customRedirect = searchParams.get('redirect')
    if (customRedirect) return customRedirect
    // Technician and Housekeeping default to mobile PWA field view; others to dashboard
    if (userRole === 'Technician' || userRole === 'Housekeeping') {
      return '/mobile'
    }
    return '/dashboard'
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

  return (
    <div className="w-full max-w-md space-y-6">
      {/* QR Access Notice */}
      {isQrRedirect && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900 animate-in fade-in">
          <QrCode className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="font-medium">
            Scanned QR Tag Detected: Sign in or continue as Guest to access the scanned facility entity.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="space-y-1.5">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {activeTab === 'staff' ? 'Sign In' : 'Guest Access'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          {activeTab === 'staff'
            ? 'Sign in with your institute staff credentials to continue.'
            : 'Enter your email & mobile number for instant room or asset access.'}
        </p>
      </div>

      {/* Login Mode Switcher Tabs */}
      <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`flex-1 py-2 rounded-lg transition text-center ${
            activeTab === 'staff'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Staff Sign In
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guest')}
          className={`flex-1 py-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'guest'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Guest Access</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-blue-500 text-white rounded-full">QR</span>
        </button>
      </div>

      {/* STAFF SIGN IN FORM */}
      {activeTab === 'staff' ? (
        <form onSubmit={handleStaffSignIn} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Email<span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-2.5 bg-white border border-blue-200/80 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
              />
            </div>
          </div>

          {loginError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Password<span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-blue-500/25 transition text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Authenticating with Supabase...</span>
              </>
            ) : (
              <span>Sign In & Continue</span>
            )}
          </button>
        </form>
      ) : (
        /* GUEST ACCESS FORM */
        <form onSubmit={handleGuestSignIn} className="space-y-4 animate-in fade-in">
          {guestError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {guestError}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Full Name <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="e.g. Alex Morgan / Visitor"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Email Address<span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                placeholder="e.g. guest@maritime.com"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-blue-200/80 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
              />
            </div>
          </div>

          {/* Mobile Number Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Mobile Number<span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                value={guestPhone}
                onChange={e => setGuestPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Guest Access Privileges:</p>
            <p>• Check in / out of verified maritime training rooms.</p>
            <p>• Directly report maintenance or housekeeping issues.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isGuestSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-blue-500/25 transition text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            {isGuestSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <span>Continue to Scanned Entity</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left Maritime Brand Banner */}
      <div className="w-full md:w-1/2 relative text-white p-8 md:p-16 flex flex-col justify-between overflow-hidden bg-[#031d4d] min-h-[520px] md:min-h-screen">
        {/* Photographic Cruise Ship Bow Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-bottom md:bg-[right_bottom] pointer-events-none z-0 opacity-80"
          style={{ backgroundImage: "url('/images/login-ship.jpg')" }}
        />

        {/* Deep Maritime Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#031b48] via-[#052668]/90 to-[#07388e]/60 pointer-events-none z-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#021333]/90 via-transparent to-[#031b48]/70 pointer-events-none z-0" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
              <Anchor className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight">AFMS</span>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="my-12 relative z-10 max-w-lg space-y-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none text-white">
            Streamline.<br />
            Track. Maintain.
          </h1>
          <p className="text-blue-100 text-sm md:text-base leading-relaxed opacity-90">
            One operational command center for every asset, facility and service decision that keeps maritime training moving.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-sm text-blue-50 font-medium">
              <CheckCircle2 className="w-5 h-5 text-blue-300 shrink-0" />
              <span>Mission-critical asset visibility</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-blue-50 font-medium">
              <CheckCircle2 className="w-5 h-5 text-blue-300 shrink-0" />
              <span>Maintenance before downtime</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-blue-50 font-medium">
              <CheckCircle2 className="w-5 h-5 text-blue-300 shrink-0" />
              <span>Compliance-ready by default</span>
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="relative z-10 text-xs text-blue-200/80 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Maritime Training Institute • Hemraj Marines Services</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white">
        <Suspense fallback={<div className="text-xs text-slate-400">Loading session authentication...</div>}>
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  )
}
