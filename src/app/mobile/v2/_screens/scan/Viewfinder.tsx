'use client'

import React, { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, CameraOff, Flashlight, FlashlightOff, ScanLine } from 'lucide-react'
import { cn } from '@/components/field'

// The camera, reading QR codes (redesign canvas, "Scan"). The phone's own
// BarcodeDetector where there is one (Chrome, Android), else frames decoded
// with jsQR (iPhone Safari) -- the same two ways the live app scans. The
// camera starts by itself only when permission was already given; otherwise
// a tap starts it, so opening the tab never springs a permission prompt.

interface Detected {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Detected[]>
}

type CameraState = 'idle' | 'starting' | 'on' | 'denied' | 'unavailable'

export function Viewfinder({ onCode }: { onCode: (raw: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onCodeRef = useRef(onCode)
  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])

  const [state, setState] = useState<CameraState>('idle')
  const [wanted, setWanted] = useState(false)
  const [torch, setTorch] = useState<boolean | null>(null)

  const begin = () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable')
    setState('starting')
    setWanted(true)
  }

  // Start straight away if the camera is already allowed.
  useEffect(() => {
    let alive = true
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then(p => {
        if (alive && p.state === 'granted') begin()
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    let raf: number | null = null
    let stream: MediaStream | null = null
    // After a code is read, a pause before reading again (in case it was not ours).
    let quietUntil = 0

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) return
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        // The torch is not in the DOM types yet.
        setTorch((track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch ? false : null)
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setState('on')

        // @ts-expect-error BarcodeDetector is not yet in lib.dom.d.ts
        const detector: BarcodeDetectorLike | null = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null
        const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null

        const tick = async () => {
          if (cancelled || !videoRef.current) return
          const v = videoRef.current
          let found: string | null = null
          if (Date.now() < quietUntil) {
            raf = requestAnimationFrame(tick)
            return
          }
          if (detector) {
            try {
              found = (await detector.detect(v))[0]?.rawValue ?? null
            } catch {
              // a frame that will not decode; try the next
            }
          } else if (ctx && canvasRef.current && v.videoWidth > 0) {
            canvasRef.current.width = v.videoWidth
            canvasRef.current.height = v.videoHeight
            ctx.drawImage(v, 0, 0)
            found = jsQR(ctx.getImageData(0, 0, v.videoWidth, v.videoHeight).data, v.videoWidth, v.videoHeight, { inversionAttempts: 'dontInvert' })?.data ?? null
          }
          if (found && !cancelled) {
            quietUntil = Date.now() + 1500
            onCodeRef.current(found)
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (err) {
        if (!cancelled) setState(err instanceof Error && err.name === 'NotAllowedError' ? 'denied' : 'unavailable')
      }
    }
    void start()

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      stream?.getTracks().forEach(t => t.stop())
      trackRef.current = null
    }
  }, [wanted])

  const toggleTorch = async () => {
    const track = trackRef.current
    if (!track || torch === null) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch {
      setTorch(null)
    }
  }

  const blocked = state === 'denied' || state === 'unavailable'

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#0B1220]">
      <video ref={videoRef} muted playsInline className={cn('h-full w-full object-cover', state === 'on' ? 'opacity-100' : 'opacity-0')} />
      <canvas ref={canvasRef} className="hidden" />

      {/* The frame to aim with */}
      {!blocked ? (
        <div className="pointer-events-none absolute inset-[18%]">
          {['left-0 top-0 border-l-4 border-t-4 rounded-tl-xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'].map(c => (
            <span key={c} className={cn('absolute h-9 w-9 border-white', c)} />
          ))}
        </div>
      ) : null}

      {state !== 'on' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          {blocked ? (
            <>
              <CameraOff className="h-10 w-10 text-white/80" strokeWidth={1.75} aria-hidden />
              <p className="m-0 text-base leading-relaxed">
                {state === 'denied'
                  ? 'The camera is blocked for this site. Allow it in the browser’s site settings, or choose the room or asset below.'
                  : 'No camera is available here. Choose the room or asset below.'}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={begin}
              disabled={state === 'starting'}
              className="flex min-h-14 items-center gap-2.5 rounded-full bg-white px-6 text-[17px] font-semibold text-fa-text shadow-fa-e2 disabled:opacity-70"
            >
              {state === 'starting' ? <ScanLine className="h-5 w-5 animate-pulse" strokeWidth={2} aria-hidden /> : <Camera className="h-5 w-5" strokeWidth={2} aria-hidden />}
              {state === 'starting' ? 'Starting camera…' : 'Tap to scan'}
            </button>
          )}
        </div>
      ) : null}

      {state === 'on' && torch !== null ? (
        <button
          type="button"
          onClick={() => void toggleTorch()}
          aria-pressed={torch}
          aria-label={torch ? 'Turn the torch off' : 'Turn the torch on'}
          className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white"
        >
          {torch ? <FlashlightOff className="h-5 w-5" strokeWidth={2} aria-hidden /> : <Flashlight className="h-5 w-5" strokeWidth={2} aria-hidden />}
        </button>
      ) : null}
    </div>
  )
}
