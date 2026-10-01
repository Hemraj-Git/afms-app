import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'

// A white card with the design's hairline border and soft shadow.
export function Card({ as: As = 'section', className, ...rest }: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' | 'li' }) {
  return <As className={cn('flex flex-col gap-2.5 rounded-[14px] border border-fa-border bg-fa-surface p-4 shadow-fa-e1', className)} {...rest} />
}

// A card's heading row: icon, title, optional count or action on the right.
export function CardTitle({ icon: Icon, children, aside, as: As = 'h2' }: { icon?: LucideIcon; children: React.ReactNode; aside?: React.ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? <Icon className="h-5 w-5 shrink-0 text-fa-text" strokeWidth={2} aria-hidden /> : null}
      <As className="m-0 flex-1 text-lg font-bold text-fa-text">{children}</As>
      {aside}
    </div>
  )
}

// A record or asset ID in the mono face: WO-PM-0012, SR-2026-0041, AST-0153.
export function IdText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-plex-mono text-sm font-medium tracking-normal text-fa-text-2', className)}>{children}</span>
}

// A line of detail with its icon: location, due date, who.
export function MetaRow({ icon: Icon, children, tone = 'plain', className }: { icon: LucideIcon; children: React.ReactNode; tone?: 'plain' | 'danger'; className?: string }) {
  return (
    <div className={cn('flex items-center gap-[7px] text-[15px] leading-snug', tone === 'danger' ? 'font-semibold text-fa-danger' : 'text-fa-text-2', className)}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </div>
  )
}

// The numbers at the top of a home screen. Tapping one filters the list below.
export type TileTint = 'primary' | 'warning' | 'danger' | 'success' | 'hk' | 'insp'
const TINTS: Record<TileTint, string> = {
  primary: 'bg-fa-primary-weak text-fa-primary',
  warning: 'bg-fa-warning-weak text-fa-high',
  danger: 'bg-fa-danger-weak text-fa-danger',
  success: 'bg-fa-success-weak text-fa-success',
  hk: 'bg-fa-hk-weak text-fa-hk',
  insp: 'bg-fa-insp-weak text-fa-insp',
}

export function SummaryTile({
  count,
  label,
  icon: Icon,
  tint,
  onClick,
  pressed,
}: {
  count: number
  label: string
  icon: LucideIcon
  tint: TileTint
  onClick?: () => void
  // When the tile also works as a filter, whether it is the active one.
  pressed?: boolean
}) {
  const inner = (
    <>
      <div className="flex w-full items-center justify-between">
        <span className="text-[30px] font-bold leading-none tabular-nums text-fa-text">{count}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-[10px]', TINTS[tint])}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
      </div>
      <span className="text-[15px] font-medium text-fa-text-2">{label}</span>
    </>
  )
  const box = cn(
    'flex min-h-[88px] flex-col gap-1.5 rounded-[14px] border bg-fa-surface px-3.5 py-3 text-left text-fa-text shadow-fa-e1',
    pressed ? 'border-fa-primary ring-2 ring-fa-primary/25' : 'border-fa-border',
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={cn(box, 'transition hover:border-fa-border-strong')}>
      {inner}
    </button>
  ) : (
    <div className={box}>{inner}</div>
  )
}

// The save buttons pinned to the bottom of a long screen, above the safe area.
export function StickyActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 flex shrink-0 flex-col gap-2.5 border-t border-fa-border bg-fa-surface px-4 pt-3 shadow-fa-e2',
        'pb-[max(16px,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  )
}

// Nothing to show: say why, and offer the next step.
export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-fa-border bg-fa-surface px-4 py-10 text-center">
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-fa-primary-weak">
        <Icon className="h-9 w-9 text-fa-primary" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="mt-1 text-xl font-bold text-fa-text">{title}</h2>
      {children ? <p className="m-0 max-w-[300px] text-base leading-relaxed text-fa-text-2">{children}</p> : null}
      {action}
    </div>
  )
}

// A loading placeholder shaped like a work card, so the list does not jump.
export function CardSkeleton() {
  const bar = 'block rounded-md bg-fa-skeleton'
  return (
    <div aria-hidden className="flex animate-pulse flex-col gap-2.5 rounded-[14px] border border-fa-border bg-fa-surface p-4 shadow-fa-e1">
      <div className="flex justify-between">
        <span className={cn(bar, 'h-3.5 w-[38%]')} />
        <span className={cn(bar, 'h-[26px] w-[72px] rounded-full')} />
      </div>
      <span className={cn(bar, 'h-5 w-[80%]')} />
      <span className={cn(bar, 'h-3.5 w-[64%]')} />
      <span className={cn(bar, 'h-3.5 w-[46%]')} />
      <div className="-mx-4 -mb-1 border-t border-fa-border px-4 pt-3">
        <span className={cn(bar, 'h-12 w-full rounded-xl')} />
      </div>
    </div>
  )
}

// Several skeleton cards, announced once as loading.
export function ListSkeleton({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
