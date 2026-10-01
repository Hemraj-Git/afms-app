import React from 'react'
import { Camera, CircleAlert, CircleCheck, ImageIcon, RefreshCw, X } from 'lucide-react'
import { cn } from './cn'

// One photo slot (redesign canvas, Components -> Photo capture), in the four
// states a photo goes through on a phone with patchy signal:
//   empty     -> a large dashed button that opens the camera
//   uploading -> the picture dimmed, a progress bar, and Cancel
//   uploaded  -> the picture, when it was taken, and Retake
//   failed    -> the picture is KEPT on the phone; Retry sends it again
export type PhotoState =
  | { status: 'empty' }
  | { status: 'uploading'; previewUrl?: string; percent: number; detail?: string }
  | { status: 'uploaded'; previewUrl?: string; at?: string }
  | { status: 'failed'; previewUrl?: string }

export interface PhotoCaptureProps {
  label: string
  state: PhotoState
  required?: boolean
  // Opens the camera (or file picker). Used for the first photo and for Retake.
  onTake: () => void
  onRetry?: () => void
  onCancel?: () => void
  // Shown under the empty button instead of Required / Optional.
  note?: string
  className?: string
}

function Thumb({ url, dim }: { url?: string; dim?: boolean }) {
  return (
    <span className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-fa-photo">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or an upload URL, not a static asset
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden />
      )}
      {dim ? <span className="absolute inset-0 bg-fa-text/45" /> : null}
    </span>
  )
}

export function PhotoCapture({ label, state, required, onTake, onRetry, onCancel, note, className }: PhotoCaptureProps) {
  if (state.status === 'empty') {
    return (
      <button
        type="button"
        onClick={onTake}
        className={cn(
          'flex min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-fa-border-strong bg-fa-surface p-3 transition hover:border-fa-primary hover:bg-fa-primary-weak/40',
          className,
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fa-primary-weak">
          <Camera className="h-6 w-6 text-fa-primary" strokeWidth={2} aria-hidden />
        </span>
        <span className="text-[17px] font-semibold text-fa-text">{label}</span>
        <span className={cn('text-sm font-semibold', required ? 'text-fa-danger' : 'text-fa-text-2')}>{note ?? (required ? 'Required' : 'Optional')}</span>
      </button>
    )
  }

  const row = 'flex items-center gap-3 rounded-[14px] border-[1.5px] bg-fa-surface p-2.5'

  if (state.status === 'uploading') {
    return (
      <div className={cn(row, 'border-fa-border', className)}>
        <Thumb url={state.previewUrl} dim />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-base font-semibold text-fa-text">{label}</span>
          <div role="progressbar" aria-valuenow={state.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: uploading`} className="h-2 overflow-hidden rounded-full bg-fa-sunken">
            <div className="h-2 rounded-full bg-fa-primary transition-[width]" style={{ width: `${Math.max(2, Math.min(100, state.percent))}%` }} />
          </div>
          <span className="text-sm tabular-nums text-fa-text-2">
            Uploading… {Math.round(state.percent)}%{state.detail ? ` · ${state.detail}` : ''}
          </span>
        </div>
        {onCancel ? (
          <button type="button" onClick={onCancel} aria-label="Cancel upload" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-fa-text-2 hover:bg-fa-sunken">
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    )
  }

  if (state.status === 'uploaded') {
    return (
      <div className={cn(row, 'border-fa-border', className)}>
        <Thumb url={state.previewUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold text-fa-text">{label}</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-fa-success">
            <CircleCheck className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Uploaded{state.at ? ` · ${state.at}` : ''}
          </span>
        </div>
        <button type="button" onClick={onTake} className="flex min-h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[15px] font-semibold text-fa-primary hover:bg-fa-primary-weak">
          <Camera className="h-4 w-4" strokeWidth={2} aria-hidden />
          Retake
        </button>
      </div>
    )
  }

  return (
    <div className={cn(row, 'border-fa-danger', className)}>
      <Thumb url={state.previewUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-fa-text">{label}</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-fa-danger">
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          Upload failed — kept on phone
        </span>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="flex min-h-11 items-center gap-1.5 rounded-[10px] border-[1.5px] border-fa-danger px-2.5 text-[15px] font-semibold text-fa-danger hover:bg-fa-danger-weak">
          <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  )
}
