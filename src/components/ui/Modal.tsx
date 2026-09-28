'use client'

import React, { useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

// The one modal every screen uses. It swaps in for a screen's own two wrapper
// divs (the dimmed overlay and the white panel) and keeps that screen's panel
// classes and content as they were, so nothing looks different. What it adds:
// Escape closes it, keyboard focus stays inside while it is open and returns to
// where it was afterwards, the page behind doesn't scroll, and screen readers
// announce it as a dialog with its title.
//
// Usage: {isOpen && (<Modal title="Assign technician" onClose={close} className="w-full max-w-md ...">…</Modal>)}

export const MODAL_OVERLAY =
  'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in'

// A panel sliding in from the right (detail drawers).
export const DRAWER_OVERLAY = 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in'

// The field app's dark modals.
export const MOBILE_OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-in fade-in'

export interface ModalProps {
  // Existing screens render the modal conditionally, so it is open by default.
  open?: boolean
  // Escape, and (when allowed) a click on the dimmed background, call this.
  onClose: () => void
  // Read out by screen readers; the visible heading stays in the content.
  title: string
  description?: string
  // Classes of the panel (the white box).
  className?: string
  overlayClassName?: string
  // Forms keep their typing safe from a stray click outside; only opt in for
  // read-only views.
  closeOnOverlayClick?: boolean
  // e.g. while saving: Escape does nothing.
  preventClose?: boolean
  // Element to focus on open instead of the dialog itself (e.g. the safe
  // "Cancel" button of a confirmation).
  initialFocusRef?: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}

export function Modal({
  open = true,
  onClose,
  title,
  description,
  className = 'w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5',
  overlayClassName = MODAL_OVERLAY,
  closeOnOverlayClick = false,
  preventClose = false,
  initialFocusRef,
  children,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    // Not portalled: the modal stays where the screen renders it, so stacking,
    // print styles and nested modals keep working exactly as before.
    <Dialog.Root
      open={open}
      onOpenChange={next => {
        if (!next && !preventClose) onClose()
      }}
    >
      <Dialog.Overlay className={overlayClassName}>
        <Dialog.Content
          ref={contentRef}
          className={`${className} focus:outline-none`}
          // Without a description, say so explicitly (Radix warns otherwise).
          {...(description ? {} : { 'aria-describedby': undefined })}
          // Focus the dialog itself rather than its first button (usually the X),
          // and never pop up the phone keyboard by focusing a field.
          onOpenAutoFocus={e => {
            e.preventDefault()
            ;(initialFocusRef?.current ?? contentRef.current)?.focus()
          }}
          onPointerDownOutside={e => {
            if (!closeOnOverlayClick || preventClose) e.preventDefault()
          }}
          onInteractOutside={e => {
            if (!closeOnOverlayClick || preventClose) e.preventDefault()
          }}
        >
          {children}
          {/* Last, not first: panels using space-y-* would otherwise push the
              visible header down (sr-only is absolutely positioned, so here it
              takes no room). */}
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : null}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  )
}
