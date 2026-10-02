'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { answerConfirm, subscribeConfirm, type ConfirmRequest } from '@/lib/confirm'

// Shows confirmAction() questions (src/lib/confirm.ts). Mounted once in the
// root layout. Focus starts on Cancel, so Enter never deletes by accident;
// Escape cancels.
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => subscribeConfirm(setRequest), [])

  if (!request) return null

  return (
    <Modal
      key={request.id}
      title={request.title}
      description={request.message}
      onClose={() => answerConfirm(false)}
      initialFocusRef={cancelRef}
      overlayClassName="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            request.danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1 pt-0.5">
          <h3 className="text-base font-bold text-slate-900">{request.title}</h3>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{request.message}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => answerConfirm(false)}
          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {request.cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => answerConfirm(true)}
          className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs ${
            request.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {request.confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
