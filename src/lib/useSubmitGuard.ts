'use client'

import { useCallback, useRef, useState } from 'react'

// One submit at a time. Wrap a form's submit (or a Save button's click)
// handler: while it runs -- and for a short moment after -- a second press is
// ignored, so a double click or an impatient tap on a slow network can never
// save the same thing twice. The lock is a ref, so even two presses in the
// same frame see it; `pending` is there to show a busy state if wanted.
//
//   const { guard } = useSubmitGuard()
//   <form onSubmit={guard(handleSubmit)}>
export function useSubmitGuard(cooldownMs = 600) {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)

  const guard = useCallback(
    <A extends unknown[]>(handler: (...args: A) => unknown) =>
      async (...args: A) => {
        if (busy.current) {
          // A blocked form submit must still not reload the page.
          const e = args[0] as { preventDefault?: () => void } | undefined
          e?.preventDefault?.()
          return
        }
        busy.current = true
        setPending(true)
        try {
          await handler(...args)
        } finally {
          setTimeout(() => {
            busy.current = false
            setPending(false)
          }, cooldownMs)
        }
      },
    [cooldownMs],
  )

  return { guard, pending }
}
