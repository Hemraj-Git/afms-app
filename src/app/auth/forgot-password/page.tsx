'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CircleCheck, Lock, Mail, Send } from 'lucide-react'
import { requestPasswordReset } from '@/app/actions/auth'
import { EMAIL_LINK_VALID_HOURS } from '@/lib/authPolicy'
import { AccountFrame, AccountIcon, Button, HelpLine, TextField } from '@/components/field'

const looksLikeEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim())

const backLink =
  'inline-flex min-h-12 items-center justify-center gap-1.5 self-center px-1 text-base font-semibold text-fa-primary underline underline-offset-[3px] hover:text-fa-primary-strong'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!looksLikeEmail(email)) {
      setFieldError('Enter a full email address, like name@campus.example')
      formRef.current?.querySelector('input')?.focus()
      return
    }
    setFieldError('')
    setIsSubmitting(true)
    const result = await requestPasswordReset(email)
    setIsSubmitting(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setIsSent(true)
  }

  if (isSent) {
    return (
      <AccountFrame>
        <AccountIcon tone="success">
          <CircleCheck className="h-9 w-9" strokeWidth={2} aria-hidden />
        </AccountIcon>
        {/* The same answer for every address, registered or not. Saying "not
            registered" would let anyone test which emails have staff or Admin
            accounts, so it never does; instead it says what to do if nothing
            arrives. */}
        <div role="status" className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] font-bold leading-tight">Check your email</h1>
          <p className="m-0 text-[17px] leading-relaxed text-fa-text-2">
            If <strong className="break-all font-semibold text-fa-text">{email.trim()}</strong> belongs to a staff account, a link to set a new
            password is on its way. It can take a few minutes, and the link works for {EMAIL_LINK_VALID_HOURS} hours.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-fa-sunken px-3.5 py-3 text-base text-fa-text-2">
          <p className="m-0 font-semibold text-fa-text">Nothing after 5 minutes?</p>
          <ul className="m-0 list-disc space-y-1 pl-5">
            <li>Look in your spam or junk folder.</li>
            <li>Check the spelling of the email address.</li>
            <li>Still nothing? Ask your administrator to send you a new link.</li>
          </ul>
        </div>
        <Button variant="secondary" onClick={() => setIsSent(false)}>
          Use a different email
        </Button>
        <Link href="/login" className={backLink}>
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
          Back to sign in
        </Link>
        <HelpLine />
      </AccountFrame>
    )
  }

  return (
    <AccountFrame>
      <AccountIcon>
        <Lock className="h-[34px] w-[34px]" strokeWidth={2} aria-hidden />
      </AccountIcon>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] font-bold leading-tight">Reset your password</h1>
        <p className="m-0 text-[17px] leading-relaxed text-fa-text-2">Enter your work email. We’ll email you a link to set a new password.</p>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error ? (
          <div role="alert" className="rounded-xl border border-fa-danger/30 bg-fa-danger-weak px-3.5 py-3 text-[15px] font-medium text-fa-danger">
            {error}
          </div>
        ) : null}
        <TextField
          label="Work email"
          type="email"
          icon={Mail}
          autoComplete="email"
          inputMode="email"
          placeholder="name@campus.example"
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            if (fieldError) setFieldError('')
          }}
          error={fieldError || undefined}
        />
        <Button type="submit" icon={Send} loading={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <Link href="/login" className={backLink}>
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
        Back to sign in
      </Link>
      <HelpLine />
    </AccountFrame>
  )
}
