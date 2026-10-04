'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { showToast } from '@/lib/toast'
import { ChangePasswordForm } from './ChangePasswordForm'

// Header → account menu → Change password, for everyone on the desktop. The
// person stays signed in here and on their other devices.
export function ChangePasswordDialog({ email, onClose }: { email: string; onClose: () => void }) {
  // Into <body>, like About: the header's stacking layer would hold it under the sidebar.
  return createPortal(
    <Modal title="Change password" onClose={onClose} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Change password</h2>
          <p className="text-xs text-slate-500 break-all">For {email}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ChangePasswordForm
        onCancel={onClose}
        onDone={() => {
          showToast('success', 'Password changed. Use the new one next time you sign in.')
          onClose()
        }}
      />
    </Modal>,
    document.body,
  )
}
