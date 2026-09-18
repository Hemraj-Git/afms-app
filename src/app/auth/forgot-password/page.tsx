'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Mail, AlertCircle, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { requestPasswordReset } from '@/app/actions/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = await requestPasswordReset(email)
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.error)
      return
    }
    setIsSent(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Reset Your Password</h1>
          <p className="text-xs text-slate-500">
            Enter your account email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {isSent ? (
          <div className="space-y-5">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>If an account exists for that email, a reset link has been sent. Check your inbox.</span>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition text-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@hemrajmarineservices.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-semibold rounded-xl shadow-xs transition text-sm flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? 'Sending...' : 'Send Reset Link'}</span>
            </button>

            <Link
              href="/login"
              className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
