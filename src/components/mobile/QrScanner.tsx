'use client'

import React, { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, X, AlertTriangle } from 'lucide-react'

interface QrScannerProps {
  onDetected: (rawValue: string) => void
  onClose: () => void
}

// Minimal shape of the experimental BarcodeDetector API — not yet in
// lib.dom.d.ts, so declared locally rather than typing it `any`.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}

// Real camera scanning everywhere a camera is available. Uses the native
// BarcodeDetector API where the browser supports it (faster, Chrome/Edge/
// Android), and otherwise falls back to decoding video frames with jsQR (a
// small, dependency-free pure-JS QR decoder) via an offscreen canvas — this
// is what actually makes scanning work on iOS Safari, which has no
// BarcodeDetector and is this app's real deployment target. The manual
// selector is a genuine fallback now, not the only working path.
export function QrScanner({ onDetected, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    let cancelled = false
    let detector: BarcodeDetectorLike | null = null
    let rafId: number | null = null
    const hasBarcodeDetector = 'BarcodeDetector' in window

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        if (hasBarcodeDetector) {
          // @ts-expect-error BarcodeDetector is not yet in lib.dom.d.ts
          detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        }

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d', { willReadFrequently: true }) || null

        const tick = async () => {
          if (cancelled || !videoRef.current) return
          const video = videoRef.current

          if (detector) {
            try {
              const codes = await detector.detect(video)
              if (codes.length > 0 && !cancelled) {
                setScanning(false)
                onDetected(codes[0].rawValue)
                return
              }
            } catch {
              // Transient decode errors are normal between frames — keep scanning.
            }
          } else if (canvas && ctx && video.videoWidth > 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const result = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            })
            if (result && !cancelled) {
              setScanning(false)
              onDetected(result.data)
              return
            }
          }
          rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error && err.name === 'NotAllowedError'
              ? 'Camera access was denied. Allow camera permission, or use the manual selector below.'
              : 'Could not access the camera. Use the manual selector below.'
          )
        }
      }
    }

    start()

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Camera className="w-4 h-4" />
          <span>Scan QR Code</span>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="max-w-xs text-center space-y-3 p-6">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm text-slate-200">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
            >
              Use Manual Selector
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {/* Offscreen — only used as a decode buffer for the jsQR fallback path */}
            <canvas ref={canvasRef} className="hidden" />
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-blue-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
