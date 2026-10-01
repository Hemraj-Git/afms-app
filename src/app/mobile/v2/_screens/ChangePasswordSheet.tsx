'use client'

import React, { useState } from 'react'
import { CircleAlert, CircleCheck, KeyRound, Lock } from 'lucide-react'
import { changePassword } from '@/app/actions/auth'
import { passwordMeetsPolicy } from '@/lib/authPolicy'
import { BottomSheet, Button, PasswordRules, ShowPasswordsCheck, TextField } from '@/components/field'

// Profile -> Change password (redesign canvas, "Change password" boards). The
// current password is checked on the server before anything changes; the
// person stays signed in on this phone afterwards.
export function ChangePasswordSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ current?: string; new?: string; form?: string }>({})

  const strongEnough = passwordMeetsPolicy(next)
  const matches = confirm.length > 0 && next === confirm
  const ready = current.length > 0 && strongEnough && matches

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready || saving) return
    setErrors({})
    setSaving(true)
    try {
      const result = await changePassword(current, next)
      if (result.success) {
        onDone()
        return
      }
      if (result.field === 'current') setErrors({ current: result.error })
      else if (result.field === 'new') setErrors({ new: result.error })
      else setErrors({ form: result.error })
    } catch {
      setErrors({ form: 'Could not change the password. Check your connection and try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet title="Change password" onClose={onClose} preventClose={saving}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fa-primary-weak">
          <KeyRound className="h-6 w-6 text-fa-primary" strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h2 className="m-0 text-[22px] font-bold leading-tight">Change password</h2>
          <p className="m-0 text-[15px] text-fa-text-2">You stay signed in on this phone.</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form ? (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-fa-danger/30 bg-fa-danger-weak px-3.5 py-3 text-[15px] font-medium text-fa-danger">
            <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            <span>{errors.form}</span>
          </div>
        ) : null}
        <TextField
          label="Current password"
          type={show ? 'text' : 'password'}
          icon={Lock}
          autoComplete="current-password"
          value={current}
          onChange={e => {
            setCurrent(e.target.value)
            setErrors(x => ({ ...x, current: undefined }))
          }}
          error={errors.current}
        />
        <TextField
          label="New password"
          type={show ? 'text' : 'password'}
          icon={Lock}
          autoComplete="new-password"
          placeholder="Create a password"
          value={next}
          onChange={e => {
            setNext(e.target.value)
            setErrors(x => ({ ...x, new: undefined }))
          }}
          error={errors.new}
          aria-describedby="cp-rules"
        />
        <PasswordRules password={next} id="cp-rules" />
        <TextField
          label="Confirm new password"
          type={show ? 'text' : 'password'}
          icon={Lock}
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
        {confirm.length > 0 ? (
          <div role="status" className={`flex items-center gap-1.5 text-[15px] font-semibold ${matches ? 'text-fa-success' : 'text-fa-danger'}`}>
            {matches ? <CircleCheck className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden /> : <CircleAlert className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />}
            {matches ? 'Passwords match' : 'Passwords do not match yet'}
          </div>
        ) : null}
        <ShowPasswordsCheck checked={show} onChange={setShow} />
        <div className="flex flex-col gap-2.5">
          <Button type="submit" icon={KeyRound} loading={saving} disabled={!ready}>
            {saving ? 'Saving…' : 'Save new password'}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </BottomSheet>
  )
}
