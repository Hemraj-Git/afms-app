'use client'

import React, { useState } from 'react'
import type { z } from 'zod'
import { FieldError, focusFirstError, invalidProps } from '@/components/ui/FormField'
import { fieldErrors } from '@/lib/validation/forms'

// Inline errors for forms that keep their fields in plain useState (most of
// the smaller forms). Nothing shows until the first save attempt; after that
// the messages follow the fields live, so fixing one clears it at once.
//
//   const v = useFormCheck(categorySchema, { name }, 'cat')
//   <input {...v.props('name')} className={`... ${INVALID}`} />  {v.error('name')}
//   const save = () => { if (!v.check()) return; ... ; v.reset() }

export function useFormCheck<S extends z.ZodType>(schema: S, values: z.input<S>, prefix: string) {
  const [shown, setShown] = useState(false)
  const errors: Record<string, string> = shown ? fieldErrors(schema, values) : {}

  return {
    errors,
    // True when valid. Otherwise shows the messages and focuses the first bad field.
    check(): boolean {
      if (Object.keys(fieldErrors(schema, values)).length === 0) {
        setShown(false)
        return true
      }
      setShown(true)
      requestAnimationFrame(() => focusFirstError(document.body))
      return false
    },
    // Hide the messages (e.g. when the form is closed or opened afresh).
    reset: () => setShown(false),
    props: (key: string) => invalidProps(`${prefix}-${key}`, errors[key]),
    error: (key: string): React.ReactNode => <FieldError id={`${prefix}-${key}-error`} message={errors[key]} />,
  }
}
