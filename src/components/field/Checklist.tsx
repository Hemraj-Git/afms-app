import React from 'react'
import { Camera, Check, CircleAlert, CircleCheck, CircleX, ImageIcon, LoaderCircle, RefreshCw, StickyNote } from 'lucide-react'
import { cn } from './cn'

// A tick-off step of a maintenance or cleaning checklist: a big tick box, the
// step, and under it the note and photos the technician added, with buttons to
// add or change them.
export interface ChecklistRowProps {
  label: string
  done: boolean
  onToggle: () => void
  note?: string
  photoCount?: number
  // The step's own photo, when it has one: shown as a thumbnail with how its
  // upload is going (a failed one stays on the phone and can be sent again).
  photo?: { url?: string; status: 'uploading' | 'uploaded' | 'failed'; onRetry?: () => void }
  onNote?: () => void
  onPhoto?: () => void
  disabled?: boolean
}

export function ChecklistRow({ label, done, onToggle, note, photoCount = 0, photo, onNote, onPhoto, disabled }: ChecklistRowProps) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-fa-border py-1.5 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={disabled}
        onClick={onToggle}
        className="flex min-h-[52px] items-center gap-2.5 text-left text-[17px] leading-snug text-fa-text disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={cn(
            'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border-2',
            done ? 'border-fa-success bg-fa-success' : 'border-fa-border-strong bg-fa-surface',
          )}
        >
          {done ? <Check className="h-[18px] w-[18px] text-white" strokeWidth={3} aria-hidden /> : null}
        </span>
        <span>{label}</span>
      </button>
      {note || photoCount > 0 || photo ? (
        <div className="ml-[38px] flex flex-col gap-2">
          {note ? (
            <div className="flex items-start gap-1.5 rounded-lg bg-fa-sunken px-2.5 py-2 text-[15px] text-fa-text-2">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>{note}</span>
            </div>
          ) : null}
          {photo ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-fa-photo">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview or an upload URL
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-white" strokeWidth={1.75} aria-hidden />
                )}
              </span>
              {photo.status === 'uploading' ? (
                <span className="flex items-center gap-1.5 text-sm text-fa-text-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
                  Uploading…
                </span>
              ) : photo.status === 'failed' ? (
                <>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-fa-danger">
                    <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    Upload failed
                  </span>
                  {photo.onRetry ? (
                    <button type="button" onClick={photo.onRetry} className="flex min-h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[15px] font-semibold text-fa-danger hover:bg-fa-danger-weak">
                      <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Retry
                    </button>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-fa-text-2">1 photo</span>
              )}
            </div>
          ) : photoCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-fa-photo">
                <ImageIcon className="h-4 w-4 text-white" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-sm text-fa-text-2">
                {photoCount} photo{photoCount === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {onNote || onPhoto ? (
        <div className="ml-[38px] flex gap-1">
          {onNote ? (
            <button type="button" onClick={onNote} disabled={disabled} className="flex min-h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[15px] font-semibold text-fa-primary hover:bg-fa-primary-weak disabled:opacity-50">
              <StickyNote className="h-4 w-4" strokeWidth={2} aria-hidden />
              {note ? 'Edit note' : 'Note'}
            </button>
          ) : null}
          {onPhoto ? (
            <button type="button" onClick={onPhoto} disabled={disabled} className="flex min-h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[15px] font-semibold text-fa-primary hover:bg-fa-primary-weak disabled:opacity-50">
              <Camera className="h-4 w-4" strokeWidth={2} aria-hidden />
              {photo ? 'Retake' : 'Photo'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// One inspection checkpoint: PASS or FAIL as two big buttons. A FAIL turns the
// card red and asks what is wrong; `children` holds that field and the photo.
export type CheckpointResult = 'Pass' | 'Fail' | null

export function CheckpointCard({
  number,
  label,
  photoRequired,
  result,
  onResult,
  children,
  disabled,
}: {
  number: number
  label: string
  photoRequired?: boolean
  result: CheckpointResult
  onResult: (r: 'Pass' | 'Fail') => void
  children?: React.ReactNode
  disabled?: boolean
}) {
  const choice = (r: 'Pass' | 'Fail') => {
    const on = result === r
    const pass = r === 'Pass'
    const Icon = pass ? CircleCheck : CircleX
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={() => onResult(r)}
        className={cn(
          'flex min-h-14 flex-1 basis-0 items-center justify-center gap-2 rounded-xl border-2 text-lg font-bold tracking-[0.02em] transition disabled:cursor-not-allowed disabled:opacity-60',
          pass
            ? on
              ? 'border-fa-success bg-fa-success text-white'
              : 'border-fa-success bg-fa-surface text-fa-success hover:bg-fa-success-weak'
            : on
              ? 'border-fa-danger bg-fa-danger text-white'
              : 'border-fa-danger bg-fa-surface text-fa-danger hover:bg-fa-danger-weak',
        )}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={2.25} aria-hidden />
        {pass ? 'PASS' : 'FAIL'}
      </button>
    )
  }

  return (
    <section
      aria-label={`Checkpoint ${number}: ${label}`}
      className={cn(
        'flex flex-col gap-3 rounded-[14px] bg-fa-surface p-4 shadow-fa-e1',
        result === 'Fail' ? 'border-2 border-fa-danger' : 'border border-fa-border',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="pt-0.5 font-plex-mono text-sm text-fa-text-2">{String(number).padStart(2, '0')}</span>
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-[17px] font-semibold leading-snug text-fa-text">{label}</span>
          {photoRequired ? (
            <span className="inline-flex h-[26px] w-fit items-center gap-[5px] rounded-md bg-fa-warning-weak px-2 text-sm font-semibold text-fa-warning-ink">
              <Camera className="h-[15px] w-[15px]" strokeWidth={2.25} aria-hidden />
              Photo required
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2.5">
        {choice('Pass')}
        {choice('Fail')}
      </div>
      {children}
    </section>
  )
}
