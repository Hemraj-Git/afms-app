import React from 'react'
import { CalendarClock, ClipboardCheck, Clock, MapPin, Sparkles, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react'
import { cn } from './cn'
import { Button } from './Button'
import { IdText } from './Surfaces'
import { PriorityPill } from './Pill'

// A job in a list: work order, cleaning task or inspection (redesign canvas,
// Components -> Work order card). Header: ID, kind, priority. Then what, where,
// when (red once overdue), its status pills, and one action.
export type JobKind = 'Preventive' | 'Breakdown' | 'Cleaning' | 'Inspection'

const KIND_ICON: Record<JobKind, LucideIcon> = {
  Preventive: CalendarClock,
  Breakdown: Wrench,
  Cleaning: Sparkles,
  Inspection: ClipboardCheck,
}

export interface WorkCardProps {
  id: string
  kind: JobKind
  priority?: string
  title: string
  assetId?: string
  location?: string
  due?: { text: string; overdue?: boolean }
  // Status pills and tags, in order.
  badges?: React.ReactNode
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }
  // Something that blocks the action, said next to it (e.g. "Opens 12 Oct").
  notice?: React.ReactNode
  className?: string
}

export function WorkCard({ id, kind, priority, title, assetId, location, due, badges, action, notice, className }: WorkCardProps) {
  const KindIcon = KIND_ICON[kind]
  return (
    <article className={cn('flex flex-col gap-2.5 rounded-[14px] border border-fa-border bg-fa-surface p-4 shadow-fa-e1', className)}>
      <div className="flex items-center gap-2">
        <IdText>{id}</IdText>
        <span className="text-fa-text-3" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-fa-text-2">
          <KindIcon className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
          {kind}
        </span>
        <span className="flex-1" />
        {priority ? <PriorityPill value={priority} /> : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-lg font-semibold leading-tight text-fa-text">
          {title} {assetId ? <IdText>{assetId}</IdText> : null}
        </h3>
        {location ? (
          <div className="flex items-center gap-[7px] text-[15px] leading-snug text-fa-text-2">
            <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>{location}</span>
          </div>
        ) : null}
        {due ? (
          <div className={cn('flex items-center gap-[7px] text-[15px] leading-snug', due.overdue ? 'font-semibold text-fa-danger' : 'text-fa-text-2')}>
            {due.overdue ? <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden /> : <Clock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />}
            <span>{due.text}</span>
          </div>
        ) : null}
      </div>
      {badges ? <div className="flex flex-wrap gap-1.5">{badges}</div> : null}
      {action || notice ? (
        <div className="-mx-4 -mb-1 flex flex-col gap-2 border-t border-fa-border px-4 pt-3">
          {notice}
          {action ? (
            <Button size="md" variant={action.variant ?? 'primary'} disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

// A service request in "My requests": the whole row opens its details.
export function RequestRow({
  id,
  status,
  title,
  location,
  sla,
  onOpen,
}: {
  id: string
  // A RequestStatusPill (or similar).
  status: React.ReactNode
  title: string
  location?: string
  sla?: { text: string; overdue?: boolean }
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-[7px] rounded-[14px] border border-fa-border bg-fa-surface px-4 py-3.5 text-left text-fa-text shadow-fa-e1 transition hover:border-fa-border-strong"
    >
      <div className="flex w-full items-center gap-2">
        <IdText>{id}</IdText>
        <span className="flex-1" />
        {status}
      </div>
      <span className="text-[17px] font-semibold leading-tight">{title}</span>
      {location ? (
        <span className="flex items-center gap-[7px] text-[15px] text-fa-text-2">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {location}
        </span>
      ) : null}
      {sla ? (
        <span className={cn('flex items-center gap-[7px] text-[15px]', sla.overdue ? 'font-semibold text-fa-danger' : 'text-fa-text-2')}>
          <Clock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {sla.text}
        </span>
      ) : null}
    </button>
  )
}
