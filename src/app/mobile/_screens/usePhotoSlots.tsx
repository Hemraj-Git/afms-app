'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { uploadToStorage, validateUpload } from '@/lib/storageUpload'
import type { PhotoState } from '@/components/field'

// The photos on one screen (the on-site photo, the after-repair photo, a
// checklist step's photo...), each in a named slot. Taking one opens the rear
// camera; the picture uploads straight away. If the upload fails the picture
// stays on the phone and Retry sends it again -- nothing is saved into the
// record until it has really uploaded.

type Slot =
  | { status: 'uploading'; previewUrl: string; file: File }
  | { status: 'uploaded'; url: string; previewUrl: string; at?: string }
  | { status: 'failed'; previewUrl: string; file: File }

const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function usePhotoSlots(saved: Record<string, string | undefined>, onInvalid: (message: string) => void) {
  // Photos already on the record start as uploaded.
  const [slots, setSlots] = useState<Record<string, Slot>>(() => {
    const out: Record<string, Slot> = {}
    for (const [key, url] of Object.entries(saved)) if (url) out[key] = { status: 'uploaded', url, previewUrl: url }
    return out
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingKey = useRef<string | null>(null)
  const previews = useRef<string[]>([])
  useEffect(() => () => previews.current.forEach(u => URL.revokeObjectURL(u)), [])

  const upload = useCallback(async (key: string, file: File, previewUrl: string) => {
    setSlots(prev => ({ ...prev, [key]: { status: 'uploading', previewUrl, file } }))
    const url = await uploadToStorage(file, 'work-order-evidence')
    setSlots(prev => {
      const cur = prev[key]
      // A retake started meanwhile: that one wins.
      if (!cur || !('file' in cur) || cur.file !== file) return prev
      return {
        ...prev,
        [key]: url ? { status: 'uploaded', url, previewUrl, at: clock(new Date()) } : { status: 'failed', previewUrl, file },
      }
    })
  }, [])

  const take = useCallback((key: string) => {
    pendingKey.current = key
    inputRef.current?.click()
  }, [])

  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const key = pendingKey.current
    if (!file || !key) return
    const invalid = validateUpload(file, 'work-order-evidence')
    if (invalid) return onInvalid(invalid)
    const previewUrl = URL.createObjectURL(file)
    previews.current.push(previewUrl)
    void upload(key, file, previewUrl)
  }

  const retry = (key: string) => {
    const s = slots[key]
    if (s?.status === 'failed') void upload(key, s.file, s.previewUrl)
  }

  // The URL to save for a slot: only once it has really uploaded.
  const urlOf = (key: string) => {
    const s = slots[key]
    return s?.status === 'uploaded' ? s.url : ''
  }

  const stateOf = (key: string): PhotoState => {
    const s = slots[key]
    if (!s) return { status: 'empty' }
    if (s.status === 'uploading') return { status: 'uploading', previewUrl: s.previewUrl }
    if (s.status === 'failed') return { status: 'failed', previewUrl: s.previewUrl }
    return { status: 'uploaded', previewUrl: s.previewUrl, at: s.at }
  }

  const has = (key: string) => key in slots
  const all = Object.values(slots)

  const input = <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPicked} tabIndex={-1} aria-hidden />

  return {
    input,
    take,
    retry,
    urlOf,
    stateOf,
    has,
    uploading: all.filter(s => s.status === 'uploading').length,
    failed: all.filter(s => s.status === 'failed').length,
  }
}

export type PhotoSlots = ReturnType<typeof usePhotoSlots>
