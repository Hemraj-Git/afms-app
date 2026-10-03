import React from 'react'
import { ArrowLeft, Check, Wrench } from 'lucide-react'
import { PASSWORD_RULES } from '@/lib/authPolicy'
import { cn } from './cn'

// The app's mark and name. `size="lg"` heads the sign-in screen; `"sm"` sits
// in the bar on the account pages (forgot / set password, expired link).
export function BrandMark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <div className={cn('flex items-center', lg ? 'gap-3' : 'gap-2.5')}>
      <span className={cn('flex items-center justify-center bg-fa-primary', lg ? 'h-[52px] w-[52px] rounded-[14px]' : 'h-9 w-9 rounded-[10px]')}>
        <Wrench className={cn('text-white', lg ? 'h-7 w-7' : 'h-5 w-5')} strokeWidth={2.25} aria-hidden />
      </span>
      <div className="flex flex-col">
        <span className={cn('font-bold leading-tight text-fa-text', lg ? 'text-2xl' : 'text-[17px]')}>Field Operations</span>
        <span className={cn('text-fa-text-2', lg ? 'text-[15px]' : 'text-[13px]')}>AssetNXG · Campus facilities</span>
      </div>
    </div>
  )
}

// The top of the account pages: the brand in a white bar.
export function BrandBar() {
  return (
    <header className="shrink-0 border-b border-fa-border bg-fa-surface px-5 pb-3.5 pt-[max(14px,env(safe-area-inset-top))]">
      <BrandMark />
    </header>
  )
}

// An inner screen's header: Back, a small line above (an ID or the app name)
// and the screen's title.
export function ScreenHeader({ title, kicker, onBack, aside }: { title: string; kicker?: string; onBack: () => void; aside?: React.ReactNode }) {
  return (
    <header className="shrink-0 border-b border-fa-border bg-fa-surface pl-1 pr-3 pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-[60px] items-center gap-1">
        <button type="button" onClick={onBack} aria-label="Back" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-fa-text hover:bg-fa-sunken">
          <ArrowLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          {kicker ? <span className="font-plex-mono text-[13px] font-medium text-fa-text-2">{kicker}</span> : null}
          <h1 className="m-0 truncate text-lg font-bold text-fa-text">{title}</h1>
        </div>
        {aside}
      </div>
    </header>
  )
}

// "Your new password needs" -- the rules, each ticked as it is met. The
// list is a live region so a screen reader hears progress while typing.
export function PasswordRules({ password, id }: { password: string; id: string }) {
  const met = PASSWORD_RULES.filter(r => r.met(password)).length
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-fa-sunken px-3.5 py-3">
      <span className="text-[15px] font-semibold text-fa-text">
        Your new password needs <span className="font-normal text-fa-text-2">({met} of {PASSWORD_RULES.length})</span>
      </span>
      <ul id={id} aria-live="polite" aria-label="Password rules" className="m-0 flex list-none flex-col gap-1 p-0">
        {PASSWORD_RULES.map(rule => {
          const ok = rule.met(password)
          return (
            <li key={rule.id} data-met={ok} className={cn('flex min-h-[30px] items-center gap-2.5 text-base', ok ? 'text-fa-text' : 'text-fa-text-2')}>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ok ? 'bg-fa-success' : 'border-2 border-fa-border-strong bg-fa-surface')}>
                {ok ? <Check className="h-[15px] w-[15px] text-white" strokeWidth={3} aria-hidden /> : null}
              </span>
              <span>{rule.label}</span>
              <span className="sr-only">{ok ? '(done)' : '(not yet)'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// A tick box that shows the passwords in plain text.
export function ShowPasswordsCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 items-center gap-2.5 self-start text-base font-medium text-fa-text"
    >
      <span className={cn('flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border-2', checked ? 'border-fa-primary bg-fa-primary' : 'border-fa-text-2')}>
        {checked ? <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden /> : null}
      </span>
      Show passwords
    </button>
  )
}
