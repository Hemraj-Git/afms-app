import React from 'react'
import { Check } from 'lucide-react'
import { cn } from './cn'

// Steps of something that happens over time: an outside repair, a request's
// progress. Done steps are green and ticked, the current one is a ringed blue
// dot, upcoming ones are grey.
export interface TimelineStep {
  title: string
  detail?: React.ReactNode
  state: 'done' | 'current' | 'upcoming'
  // An action belonging to the step ("Mark received back").
  action?: React.ReactNode
}

export function Timeline({ steps, label }: { steps: TimelineStep[]; label?: string }) {
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col p-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <li key={`${s.title}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center gap-1">
              {s.state === 'done' ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fa-success">
                  <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
                </span>
              ) : s.state === 'current' ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-fa-primary bg-fa-primary-weak">
                  <span className="h-2.5 w-2.5 rounded-full bg-fa-primary" />
                </span>
              ) : (
                <span className="h-7 w-7 shrink-0 rounded-full border-[3px] border-fa-border bg-fa-surface" />
              )}
              {!last ? <span className={cn('min-h-[18px] w-0.5 flex-1', s.state === 'done' ? 'bg-fa-success' : 'bg-fa-border')} /> : null}
            </div>
            <div className={cn('flex flex-col gap-0.5 pt-[3px]', last ? 'pb-0' : 'pb-3.5')}>
              <span className={cn('text-base font-semibold', s.state === 'upcoming' ? 'text-fa-text-2' : 'text-fa-text')}>
                {s.title}
                <span className="sr-only">{s.state === 'done' ? ' (done)' : s.state === 'current' ? ' (now)' : ' (not yet)'}</span>
              </span>
              {s.detail ? <span className="text-sm leading-snug text-fa-text-2">{s.detail}</span> : null}
              {s.action ? <div className="pt-1">{s.action}</div> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
