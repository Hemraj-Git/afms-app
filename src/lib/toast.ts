// Tiny app-wide toast store. A module-level store (not React state) so code
// outside components -- e.g. the AFMSContext mutators -- can surface an error
// without needing a hook. Rendered by <Toaster /> in the root layout.
export type ToastType = 'success' | 'error'

export interface ToastItem {
  id: number
  type: ToastType
  text: string
}

type Listener = (toasts: ToastItem[]) => void

const AUTO_DISMISS_MS = 6000

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach(l => l(toasts))
}

export function dismissToast(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function showToast(type: ToastType, text: string) {
  const id = nextId++
  toasts = [...toasts, { id, type, text }]
  emit()
  if (typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
  }
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  listener(toasts)
  return () => {
    listeners.delete(listener)
  }
}
