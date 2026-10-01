import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'

// Filter chips: one choice shown at a time ("All 7 / Preventive 3 / ...").
// Toggle buttons with aria-pressed, so a screen reader says which is on.
export interface Chip<V extends string> {
  value: V
  label: string
  count?: number
  icon?: LucideIcon
}

export function FilterChips<V extends string>({
  chips,
  value,
  onChange,
  label,
  className,
}: {
  chips: Chip<V>[]
  value: V
  onChange: (v: V) => void
  // What the chips filter, for screen readers ("Filter work orders").
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 pb-1', className)}>
      {chips.map(chip => {
        const on = chip.value === value
        const Icon = chip.icon
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(chip.value)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-[15px] font-semibold transition',
              on ? 'border-fa-text bg-fa-text text-white' : 'border-fa-border-strong bg-fa-surface text-fa-text hover:bg-fa-sunken',
            )}
          >
            {Icon ? <Icon className="h-4 w-4" strokeWidth={2} aria-hidden /> : null}
            {chip.label}
            {chip.count !== undefined ? <span className="font-bold tabular-nums opacity-90">{chip.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

// Two or three mutually exclusive options side by side ("In-house" /
// "Hand over to vendor"). A radio group under the hood.
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: V; label: string; icon?: LucideIcon }[]
  value: V
  onChange: (v: V) => void
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1 rounded-[13px] bg-fa-sunken p-1', className)}>
      {options.map(o => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-12 flex-1 basis-0 items-center justify-center gap-2 rounded-[10px] border-[1.5px] px-2 text-base font-semibold transition',
              on ? 'border-fa-primary bg-fa-surface text-fa-primary shadow-[0_1px_3px_rgba(15,23,42,0.15)]' : 'border-transparent text-fa-text-2 hover:text-fa-text',
            )}
          >
            {Icon ? <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// An on/off switch (52 x 32). `label` is read out with its state.
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-8 w-[52px] shrink-0 items-center rounded-full p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-fa-primary' : 'bg-fa-border-strong',
      )}
    >
      <span
        className={cn('h-7 w-7 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-[margin]', checked ? 'ml-[22px]' : 'ml-0.5')}
      />
    </button>
  )
}

// A settings line: icon tile, title, optional explanation, and a control on
// the right (usually a Toggle).
export function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-h-14 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-fa-sunken">
        <Icon className="h-5 w-5 text-fa-text" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold text-fa-text">{title}</div>
        {description ? <div className="text-sm leading-snug text-fa-text-2">{description}</div> : null}
      </div>
      {children}
    </div>
  )
}
