import React from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from './cn'

// Field app buttons (redesign canvas, Components -> Buttons). Every one is at
// least 48 px tall: they are pressed standing up, often with one hand.

type Variant = 'primary' | 'secondary' | 'destructive'

const VARIANTS: Record<Variant, string> = {
  primary: 'border-fa-primary bg-fa-primary text-white hover:bg-fa-primary-strong hover:border-fa-primary-strong',
  secondary: 'border-fa-border-strong bg-fa-surface text-fa-text hover:bg-fa-sunken',
  destructive: 'border-fa-danger bg-fa-danger text-white hover:bg-[#991B1B] hover:border-[#991B1B]',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  // 'lg' (52 px) for the main action of a screen, 'md' (48 px) inside cards.
  size?: 'lg' | 'md'
  icon?: LucideIcon
  // Shows a spinner and blocks a second press while saving.
  loading?: boolean
  // Full width is the norm on a phone; inline buttons opt out.
  block?: boolean
  // React 19 passes ref as an ordinary prop (e.g. to focus Cancel in a sheet).
  ref?: React.Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  loading = false,
  block = true,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const off = disabled || loading
  return (
    <button
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] px-[18px] text-[17px] font-semibold transition active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-fa-primary',
        size === 'lg' ? 'min-h-[52px]' : 'min-h-12',
        block && 'w-full',
        off ? 'cursor-not-allowed border-fa-disabled bg-fa-disabled text-fa-text-3 active:scale-100' : VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : Icon ? <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden /> : null}
      {children}
    </button>
  )
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  // Required: an icon alone says nothing to a screen reader.
  label: string
  // A number shown on the corner (e.g. unread alerts).
  badge?: number
  tone?: 'plain' | 'onDark'
}

export function IconButton({ icon: Icon, label, badge, tone = 'plain', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={badge ? `${label}, ${badge} unread` : label}
      className={cn(
        'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[1.5px] transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-fa-primary',
        tone === 'onDark'
          ? 'h-[52px] w-[52px] border-white/35 bg-white/15 text-white hover:bg-white/25'
          : 'border-transparent text-fa-text hover:bg-fa-sunken',
        className,
      )}
      {...rest}
    >
      <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
      {badge ? (
        <span className="absolute right-[3px] top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-fa-danger px-[5px] text-xs font-bold tabular-nums text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  )
}

// An underlined text action, e.g. "Forgot password?".
export function TextButton({ className, type = 'button', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-12 items-center gap-1.5 px-1 text-base font-semibold text-fa-primary underline underline-offset-[3px] hover:text-fa-primary-strong',
        className,
      )}
      {...rest}
    />
  )
}
