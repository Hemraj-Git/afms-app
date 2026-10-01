'use client'

import React, { useState } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { changePassword } from '@/app/actions/auth'
import { PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from '@/lib/authPolicy'
import { PasswordChecklist } from './PasswordChecklist'

// Change the password of the person signed in: current password first (the
// server checks it), then the new one against the rules. Used on the field
// app's Profile tab; `tone` matches the screen it sits on.
export function ChangePasswordForm({
  onDone,
  onCancel,
  tone = 'light',
}: {
  onDone: () => void
  onCancel?: () => void
  tone?: 'light' | 'dark'
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ current?: string; new?: string; form?: string }>({})

  const dark = tone === 'dark'
  const label = `block text-xs font-semibold ${dark ? 'text-slate-300' : 'text-slate-700'}`
  const input = (bad?: string) =>
    `w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 ${
      dark
        ? `bg-slate-950 text-white placeholder:text-slate-600 border ${bad ? 'border-rose-500 focus:ring-rose-500/30' : 'border-slate-700 focus:ring-blue-500/30 focus:border-blue-500'}`
        : `bg-slate-50 border ${bad ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'}`
    }`
  const fieldError = `text-[11px] font-medium ${dark ? 'text-rose-400' : 'text-rose-600'}`

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
    <form onSubmit={submit} noValidate className="space-y-4">
      {errors.form && (
        <div role="alert" className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${dark ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errors.form}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="cp-current" className={label}>Current password</label>
        <input
          id="cp-current"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={current}
          onChange={e => { setCurrent(e.target.value); setErrors(x => ({ ...x, current: undefined })) }}
          aria-invalid={!!errors.current}
          aria-describedby={errors.current ? 'cp-current-error' : undefined}
          className={input(errors.current)}
        />
        {errors.current && <p id="cp-current-error" className={fieldError}>{errors.current}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="cp-new" className={label}>New password</label>
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{show ? 'Hide' : 'Show'} passwords</span>
          </button>
        </div>
        <input
          id="cp-new"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={next}
          onChange={e => { setNext(e.target.value); setErrors(x => ({ ...x, new: undefined })) }}
          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          aria-invalid={!!errors.new}
          aria-describedby={errors.new ? 'cp-new-error cp-rules' : 'cp-rules'}
          className={input(errors.new)}
        />
        {errors.new && <p id="cp-new-error" className={fieldError}>{errors.new}</p>}
        <PasswordChecklist password={next} id="cp-rules" tone={tone} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cp-confirm" className={label}>Confirm new password</label>
        <input
          id="cp-confirm"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className={input(confirm.length > 0 && !matches ? 'mismatch' : undefined)}
        />
        {confirm.length > 0 && (
          <p className={`text-[11px] font-medium ${matches ? (dark ? 'text-emerald-400' : 'text-emerald-700') : (dark ? 'text-rose-400' : 'text-rose-600')}`}>
            {matches ? 'Passwords match.' : 'Passwords do not match yet.'}
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!ready || saving}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{saving ? 'Saving...' : 'Change password'}</span>
        </button>
      </div>
    </form>
  )
}
