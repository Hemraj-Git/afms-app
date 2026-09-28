'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'

// Inline form errors, replacing alert() pop-ups: the message sits under the
// field, the field turns red, and screen readers hear it.
//
//   <input {...register('title')} aria-invalid={!!errors.title} aria-describedby="title-error"
//          className={`... ${INVALID}`} />
//   <FieldError id="title-error" message={errors.title?.message} />

// Add to a field's classes; it only shows while the field has aria-invalid="true".
export const INVALID =
  'aria-[invalid=true]:border-rose-400 aria-[invalid=true]:bg-rose-50/40 aria-[invalid=true]:focus:ring-rose-500/20'

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
      <AlertCircle className="w-3 h-3 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

// Props for a field that may be in error: pair with <FieldError id={`${name}-error`} />.
export function invalidProps(name: string, message?: string) {
  return message
    ? ({ 'aria-invalid': true, 'aria-describedby': `${name}-error` } as const)
    : ({ 'aria-invalid': false } as const)
}

// Moves focus (and the view) to the first field that has an error, so a
// long form doesn't fail silently below the fold.
export function focusFirstError(container: HTMLElement | null) {
  const el = container?.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!el) return
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  el.focus({ preventScroll: true })
}
