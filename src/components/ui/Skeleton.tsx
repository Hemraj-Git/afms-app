import React from 'react'
import { cn } from '@/lib/utils'

// Loading placeholders. Shown instead of empty states/zero counts while the
// first data load is in flight, so "still loading" never looks like "no data".
// `tone` matches the surface: 'light' for the admin app, 'dark' for the mobile
// app. Pulse is switched off for users who prefer reduced motion.
export type SkeletonTone = 'light' | 'dark'

const toneClass: Record<SkeletonTone, string> = {
  light: 'bg-slate-200/80',
  dark: 'bg-slate-800',
}

export function Skeleton({ className, tone = 'light' }: { className?: string; tone?: SkeletonTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block rounded-md animate-pulse motion-reduce:animate-none', toneClass[tone], className)}
    />
  )
}

// Wraps a group of placeholders so assistive tech announces one "Loading"
// instead of reading every block, and so printing skips it.
export function SkeletonRegion({
  children,
  className,
  label = 'Loading',
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('print:hidden', className)}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  )
}

export function StatTilesSkeleton({ count = 4, tone = 'light' }: { count?: number; tone?: SkeletonTone }) {
  const surface = tone === 'light' ? 'bg-white border-slate-200/80' : 'bg-slate-900 border-slate-800'
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn('space-y-3 rounded-2xl border p-4', surface)}>
          <Skeleton tone={tone} className="h-3 w-24" />
          <Skeleton tone={tone} className="h-7 w-16" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 8, cols = 5, tone = 'light' }: { rows?: number; cols?: number; tone?: SkeletonTone }) {
  const surface = tone === 'light' ? 'bg-white border-slate-200/80' : 'bg-slate-900 border-slate-800'
  return (
    <div className={cn('overflow-hidden rounded-2xl border', surface)}>
      <div className="flex gap-4 border-b border-slate-100/10 px-5 py-3.5">
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} tone={tone} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-slate-100/10 px-5 py-4 last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} tone={tone} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[9rem]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6, tone = 'light' }: { count?: number; tone?: SkeletonTone }) {
  const surface = tone === 'light' ? 'bg-white border-slate-200/80' : 'bg-slate-900 border-slate-800'
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn('space-y-3 rounded-2xl border p-5', surface)}>
          <Skeleton tone={tone} className="h-4 w-1/3" />
          <Skeleton tone={tone} className="h-5 w-3/4" />
          <Skeleton tone={tone} className="h-3 w-full" />
          <Skeleton tone={tone} className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5, tone = 'dark' }: { rows?: number; tone?: SkeletonTone }) {
  const surface = tone === 'light' ? 'bg-white border-slate-200/80' : 'bg-slate-900 border-slate-800'
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn('flex items-center gap-3 rounded-2xl border p-3.5', surface)}>
          <Skeleton tone={tone} className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton tone={tone} className="h-3.5 w-2/3" />
            <Skeleton tone={tone} className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// A whole-page placeholder: title block, optional stat tiles, then a table.
// Used as AppLayout's default and reused by pages that pass a layout-matched
// fallback (`tiles`/`rows` differ per page so the shape stays close).
export function PageSkeleton({ tiles = 0, rows = 8, cols = 5 }: { tiles?: number; rows?: number; cols?: number }) {
  return (
    <SkeletonRegion className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </div>
      {tiles > 0 && <StatTilesSkeleton count={tiles} />}
      <TableSkeleton rows={rows} cols={cols} />
    </SkeletonRegion>
  )
}
