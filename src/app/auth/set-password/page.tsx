'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck, Check, Circle } from 'lucide-react'
import { friendlyPasswordError, PASSWORD_MIN_LENGTH, PASSWORD_RULES, passwordMeetsPolicy } from '@/lib/authPolicy'

// Landed on after /auth/confirm establishes a real session for an invited
// (or password-reset) user. This is the step the invite flow was missing
// entirely — without it, an invited person had a valid session but no way
// to ever set a password for signing back in later.
//
// The password rules are Supabase's (see authPolicy.ts). They are shown as a
// checklist that ticks off while typing, so nobody learns them from an error.
export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const strongEnough = passwordMeetsPolicy(password)
  const matches = confirmPassword.length > 0 && password === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!strongEnough) {
      setError('The password does not meet every rule in the list yet.')
      return
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }

    setIsSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (updateError) {
      setError(friendlyPasswordError(updateError.message))
      return
    }

    // proxy.ts routes non-Admin roles to /mobile automatically from here.
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Set Your Password</h1>
          <p className="text-xs text-slate-500">
            Choose a password to finish setting up your AFMS account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="new-password" className="block text-xs font-semibold text-slate-700">New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                aria-describedby="password-rules"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <ul id="password-rules" aria-label="Password rules" className="pt-1 space-y-1">
              {PASSWORD_RULES.map(rule => {
                const ok = rule.met(password)
                return (
                  <li
                    key={rule.id}
                    data-met={ok}
                    className={`flex items-center gap-2 text-[11px] font-medium transition ${ok ? 'text-emerald-700' : 'text-slate-500'}`}
                  >
                    {ok ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Circle className="w-3 h-3 text-slate-300" />}
                    <span>{rule.label}</span>
                    <span className="sr-only">{ok ? '(done)' : '(not yet)'}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-700">Confirm Password</label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {confirmPassword.length > 0 && (
              <p className={`text-[11px] font-medium ${matches ? 'text-emerald-700' : 'text-rose-600'}`}>
                {matches ? 'Passwords match.' : 'Passwords do not match yet.'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !strongEnough || !matches}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-xs transition text-sm flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSubmitting ? 'Saving...' : 'Set Password & Continue'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
