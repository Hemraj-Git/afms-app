'use client'

import React, { useState } from 'react'
import { Camera } from 'lucide-react'
import { readFileAsDataUrl, uploadToStorage, validateUpload } from '@/lib/storageUpload'
import { showToast as showAppToast } from '@/lib/toast'

// Real device-camera photo capture, replacing every "Snap" button that
// previously just set the exact same hardcoded stock-photo URL regardless
// of context. `capture="environment"` opens the rear camera directly on
// iOS Safari and Android without any getUserMedia permissions dance.
// Every photo this button captures anywhere in the mobile app (work order
// start/completion, housekeeping, inspection overall + per-checkpoint, and
// service request evidence) uploads to the work-order-evidence bucket;
// base64 (self-contained, survives a reload on its own unlike a blob: URL)
// is only a fallback if the real upload fails.
export function CameraCaptureButton({
  onCapture,
  onUploadingChange,
  onUploadFallback,
  label = 'Snap',
  className,
}: {
  onCapture: (url: string) => void
  // Lets a parent form track this button's busy state (e.g. to disable
  // its own submit button) -- previously isUploading was fully private,
  // so a submit could fire while a capture/retake was still mid-upload
  // and silently save a stale or empty photo value.
  onUploadingChange?: (isUploading: boolean) => void
  // Fired when the real Storage upload failed and a base64 fallback was
  // used instead -- previously this was silent (console.warn only), with
  // no way for the user to know their photo didn't reach cloud storage.
  onUploadFallback?: () => void
  label?: string
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const setUploading = (val: boolean) => {
    setIsUploading(val)
    onUploadingChange?.(val)
  }
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          // A file the bucket would reject must not reach the base64 fallback below.
          const invalid = validateUpload(file, 'work-order-evidence')
          if (invalid) {
            showAppToast('error', invalid)
            return
          }
          setUploading(true)
          try {
            const uploadedUrl = await uploadToStorage(file, 'work-order-evidence')
            if (uploadedUrl) {
              onCapture(uploadedUrl)
            } else {
              onCapture(await readFileAsDataUrl(file))
              onUploadFallback?.()
            }
          } catch (err) {
            console.error('Failed to capture photo:', err)
          } finally {
            setUploading(false)
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={className || 'px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 shrink-0'}
      >
        <Camera className="w-3.5 h-3.5" />
        <span>{isUploading ? 'Uploading…' : label}</span>
      </button>
    </>
  )
}
