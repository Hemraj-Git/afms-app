'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { dismissToast, subscribeToasts, type ToastItem } from '@/lib/toast'

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => subscribeToasts(setItems), [])

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2 print:hidden"
    >
      {items.map(t => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs shadow-lg ${
            t.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {t.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          )}
          <p className="flex-1 font-medium leading-snug">{t.text}</p>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 text-current opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
