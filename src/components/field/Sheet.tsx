'use client'

import React, { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from './Button'
import { cn } from './cn'

// A panel that slides up from the bottom of the phone (redesign canvas,
// Components -> Bottom sheet). Built on the app's shared Modal, so Escape,
// focus trapping and "nothing behind it scrolls" all come with it.
export const SHEET_OVERLAY = 'fixed inset-0 z-50 flex items-end justify-center bg-fa-text/50 animate-in fade-in'

export function BottomSheet({
  title,
  onClose,
  children,
  className,
  preventClose,
  initialFocusRef,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  className?: string
  preventClose?: boolean
  initialFocusRef?: React.RefObject<HTMLElement | null>
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      preventClose={preventClose}
      initialFocusRef={initialFocusRef}
      overlayClassName={SHEET_OVERLAY}
      className={cn(
        'flex max-h-[92dvh] w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-t-[22px] bg-fa-surface px-4 pt-2.5 font-plex text-fa-text shadow-fa-sheet',
        'pb-[max(20px,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom',
        className,
      )}
    >
      <span className="h-[5px] w-10 shrink-0 self-center rounded-full bg-fa-border-strong" aria-hidden />
      {children}
    </Modal>
  )
}

// "Are you sure?" for things that cannot be undone: Complete & close, Check
// out, Sign out. The safe choice (Cancel) has the focus, so Enter does not
// confirm by accident.
export function ConfirmSheet({
  title,
  body,
  icon: Icon,
  tone = 'primary',
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string
  body: React.ReactNode
  icon: LucideIcon
  tone?: 'primary' | 'destructive'
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <BottomSheet title={title} onClose={onCancel} preventClose={busy} initialFocusRef={cancelRef}>
      <span className={cn('flex h-14 w-14 items-center justify-center rounded-full', tone === 'destructive' ? 'bg-fa-danger-weak' : 'bg-fa-primary-weak')}>
        <Icon className={cn('h-7 w-7', tone === 'destructive' ? 'text-fa-danger' : 'text-fa-primary')} strokeWidth={2} aria-hidden />
      </span>
      <h2 className="m-0 text-[22px] font-bold leading-tight">{title}</h2>
      <div className="m-0 text-[17px] leading-relaxed text-fa-text-2">{body}</div>
      <div className="flex flex-col gap-2.5">
        <Button variant={tone === 'destructive' ? 'destructive' : 'primary'} icon={Icon} loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button ref={cancelRef} variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}
