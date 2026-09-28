// In-app confirmation, replacing the browser's confirm() pop-up:
//
//   if (await confirmAction(`Delete room "${name}"?`)) deleteRoom(id)
//
// A module-level store (like src/lib/toast.ts) so any handler can ask without a
// hook; <ConfirmHost /> in the root layout shows the dialog. One question at a
// time: asking again while one is open answers the first with "no".

export interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  // Red confirm button for deletions and other destructive actions.
  danger?: boolean
}

export interface ConfirmRequest extends Required<ConfirmOptions> {
  id: number
  message: string
  resolve: (ok: boolean) => void
}

type Listener = (request: ConfirmRequest | null) => void

let current: ConfirmRequest | null = null
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach(l => l(current))
}

export function confirmAction(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  current?.resolve(false)
  return new Promise<boolean>(resolve => {
    current = {
      id: nextId++,
      message,
      title: options.title ?? 'Please confirm',
      confirmLabel: options.confirmLabel ?? 'Delete',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      danger: options.danger ?? true,
      resolve,
    }
    emit()
  })
}

export function answerConfirm(ok: boolean) {
  const request = current
  current = null
  emit()
  request?.resolve(ok)
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener)
  listener(current)
  return () => {
    listeners.delete(listener)
  }
}
