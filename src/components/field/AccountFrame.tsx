import React from 'react'
import { BrandBar } from './Headers'

// The page around an account screen (forgot / set password, expired link):
// the whole screen on a phone, a centred card on a computer.
export function AccountFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-fa-bg sm:items-start sm:py-10">
      <div className="flex min-h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-fa-surface sm:min-h-0 sm:rounded-2xl sm:border sm:border-fa-border sm:shadow-fa-e1">
        <BrandBar />
        <main className="flex flex-1 flex-col gap-5 px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-7">{children}</main>
      </div>
    </div>
  )
}

// The large round icon at the top of an account screen.
export function AccountIcon({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'success' | 'danger' }) {
  const bg = tone === 'success' ? 'bg-fa-success-weak text-fa-success' : tone === 'danger' ? 'bg-fa-danger-weak text-fa-danger' : 'bg-fa-primary-weak text-fa-primary'
  return <span className={`flex h-[72px] w-[72px] items-center justify-center rounded-full ${bg}`}>{children}</span>
}

export function HelpLine({ children = 'Need help? Contact the facilities help desk.' }: { children?: React.ReactNode }) {
  return <p className="m-0 mt-auto pt-4 text-center text-sm leading-normal text-fa-text-2">{children}</p>
}
