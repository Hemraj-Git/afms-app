'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, CircleAlert, CircleCheck, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { finishPasswordSetup, signOutAction } from '@/app/actions/auth'
import { friendlyPasswordError, passwordMeetsPolicy } from '@/lib/authPolicy'
import { AccountFrame, Button, HelpLine, PasswordRules, ShowPasswordsCheck, TextButton, TextField } from '@/components/field'

// Landed on after /auth/confirm establishes a real session for an invited
// (or password-reset) user. This is the step the invite flow was missing
// entirely — without it, an invited person had a valid session but no way
// to ever set a password for signing back in later.
//
// The password rules are Supabase's (see authPolicy.ts), shown as a list that
// ticks off while typing, so nobody learns them from an error.
export default function SetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Whose password this is: the session /auth/confirm just made.
  useEffect(() => {
    let alive = true
    supabase.auth
      .getUser()
      .then(({ data }) => alive && setEmail(data.user?.email ?? ''))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

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
    // Password saved: the app opens up (proxy.ts routes non-Admin roles to /mobile).
    await finishPasswordSetup()
    router.push('/dashboard')
  }

  // Remembered the old password, or opened the link by mistake: leave without
  // changing anything. The link's sign-in ends here.
  const [leaving, setLeaving] = useState(false)
  const cancelAndSignOut = async () => {
    setLeaving(true)
    await signOutAction()
    await supabase.auth.signOut().catch(() => {})
    router.replace('/login')
  }

  return (
    <AccountFrame>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] font-bold leading-tight">Set your password</h1>
        <p className="m-0 text-[17px] leading-relaxed text-fa-text-2">
          {email ? (
            <>
              For <strong className="break-all font-semibold text-fa-text">{email}</strong>.{' '}
            </>
          ) : null}
          Choose a password you don’t use anywhere else.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error ? (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-fa-danger/30 bg-fa-danger-weak px-3.5 py-3 text-[15px] font-medium text-fa-danger">
            <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}
        <TextField
          label="New password"
          type={showPassword ? 'text' : 'password'}
          icon={Lock}
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          aria-describedby="password-rules"
        />
        <PasswordRules password={password} id="password-rules" />
        <TextField
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          icon={Lock}
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />
        {confirmPassword.length > 0 ? (
          <div role="status" className={`flex items-center gap-1.5 text-[15px] font-semibold ${matches ? 'text-fa-success' : 'text-fa-danger'}`}>
            {matches ? <CircleCheck className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden /> : <CircleAlert className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />}
            {matches ? 'Passwords match' : 'Passwords do not match yet'}
          </div>
        ) : null}
        <ShowPasswordsCheck checked={showPassword} onChange={setShowPassword} />
        <Button type="submit" icon={ChevronRight} loading={isSubmitting} disabled={!strongEnough || !matches}>
          {isSubmitting ? 'Saving…' : 'Set password & continue'}
        </Button>
        <TextButton type="button" onClick={() => void cancelAndSignOut()} disabled={leaving || isSubmitting}>
          {leaving ? 'Signing out…' : 'Cancel and sign out'}
        </TextButton>
      </form>
      <HelpLine />
    </AccountFrame>
  )
}
