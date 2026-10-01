import React from 'react'
import {
  ArrowDown, ArrowUp, Calendar, Circle, CircleCheck, CircleDot, CircleX, Clock, Equal, Package, Phone, Play, ShieldCheck,
  TriangleAlert, Truck, User, type LucideIcon,
} from 'lucide-react'
import { cn } from './cn'

// Status pills (redesign canvas, Components -> pills). The rule of the design:
// colour never travels alone -- every pill is colour + icon + word, so it reads
// for colour-blind people and in direct sunlight.

export type PillTone = 'danger' | 'warning' | 'info' | 'neutral' | 'muted' | 'success' | 'outline' | 'outlineDanger' | 'outlinePrimary'

const TONES: Record<PillTone, string> = {
  danger: 'border-fa-danger-weak bg-fa-danger-weak text-fa-danger',
  warning: 'border-fa-warning-weak bg-fa-warning-weak text-fa-high',
  info: 'border-fa-info-weak bg-fa-info-weak text-fa-primary',
  neutral: 'border-fa-sunken bg-fa-sunken text-fa-text-2',
  muted: 'border-fa-sunken bg-fa-sunken text-fa-text-3',
  success: 'border-fa-success-weak bg-fa-success-weak text-fa-success',
  outline: 'border-fa-border-strong bg-fa-surface text-fa-text-2',
  outlineDanger: 'border-fa-danger bg-fa-surface text-fa-danger',
  outlinePrimary: 'border-fa-primary bg-fa-surface text-fa-primary',
}

export function Pill({ tone, icon: Icon, children, className }: { tone: PillTone; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-[5px] whitespace-nowrap rounded-full border-[1.5px] px-2.5 text-sm font-semibold leading-none',
        TONES[tone],
        className,
      )}
    >
      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2.25} aria-hidden />
      {children}
    </span>
  )
}

// A plain fact about a job, not a status: "With vendor", "Sent for outside repair".
export function Tag({ icon: Icon, children, className }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-[5px] whitespace-nowrap rounded-md bg-fa-sunken px-[9px] text-sm font-medium text-fa-text', className)}>
      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2} aria-hidden />
      {children}
    </span>
  )
}

export const WithVendorTag = () => <Tag icon={Truck}>With vendor</Tag>
export const OutsideRepairTag = () => <Tag icon={Package}>Sent for outside repair</Tag>

type Spec = { tone: PillTone; icon: LucideIcon; label: string }

// Each mapping takes the value as the app stores it and returns how it looks.
// Unknown values get a neutral pill with the value itself, never a crash.
const fallback = (value: string): Spec => ({ tone: 'neutral', icon: Circle, label: value || '—' })

export const PRIORITY: Record<string, Spec> = {
  Critical: { tone: 'danger', icon: TriangleAlert, label: 'Critical' },
  High: { tone: 'warning', icon: ArrowUp, label: 'High' },
  Medium: { tone: 'info', icon: Equal, label: 'Medium' },
  Low: { tone: 'neutral', icon: ArrowDown, label: 'Low' },
}

export const WORK_STATUS: Record<string, Spec> = {
  Scheduled: { tone: 'outline', icon: Calendar, label: 'Scheduled' },
  'In Progress': { tone: 'info', icon: Play, label: 'In progress' },
  Completed: { tone: 'success', icon: CircleCheck, label: 'Completed' },
  Cancelled: { tone: 'muted', icon: CircleX, label: 'Cancelled' },
  Overdue: { tone: 'outlineDanger', icon: Clock, label: 'Overdue' },
}

export const REQUEST_STATUS: Record<string, Spec> = {
  Open: { tone: 'outlinePrimary', icon: CircleDot, label: 'Open' },
  'In Progress': { tone: 'info', icon: Play, label: 'In progress' },
  Resolved: { tone: 'success', icon: CircleCheck, label: 'Resolved' },
  Closed: { tone: 'neutral', icon: CircleCheck, label: 'Closed' },
  Escalated: { tone: 'danger', icon: ArrowUp, label: 'Escalated' },
}

export const RESULT: Record<string, Spec> = {
  Pass: { tone: 'success', icon: CircleCheck, label: 'PASS' },
  Fail: { tone: 'danger', icon: CircleX, label: 'FAIL' },
  Pending: { tone: 'muted', icon: Circle, label: 'Not yet reviewed' },
}

export const ROOM_STATE: Record<string, Spec> = {
  Available: { tone: 'success', icon: CircleCheck, label: 'Available' },
  Occupied: { tone: 'warning', icon: User, label: 'Occupied' },
}

export const CONTRACT: Record<string, Spec> = {
  amc: { tone: 'success', icon: ShieldCheck, label: 'AMC active' },
  onDemand: { tone: 'neutral', icon: Phone, label: 'On-demand' },
}

export function specFor(table: Record<string, Spec>, value: string | undefined | null): Spec {
  return (value && table[value]) || fallback(value ?? '')
}

const from = (table: Record<string, Spec>) =>
  function MappedPill({ value, className }: { value: string | undefined | null; className?: string }) {
    const s = specFor(table, value)
    return (
      <Pill tone={s.tone} icon={s.icon} className={className}>
        {s.label}
      </Pill>
    )
  }

export const PriorityPill = from(PRIORITY)
export const WorkStatusPill = from(WORK_STATUS)
export const RequestStatusPill = from(REQUEST_STATUS)
export const ResultPill = from(RESULT)
export const RoomPill = from(ROOM_STATE)
export const ContractPill = from(CONTRACT)
