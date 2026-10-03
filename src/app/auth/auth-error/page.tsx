import Link from 'next/link'
import { KeyRound, LinkIcon } from 'lucide-react'
import { EMAIL_LINK_VALID_HOURS } from '@/lib/authPolicy'
import { AccountFrame, AccountIcon, HelpLine } from '@/components/field'

const primary =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-fa-primary bg-fa-primary px-[18px] text-[17px] font-semibold text-white hover:bg-fa-primary-strong'
const secondary =
  'flex min-h-[52px] w-full items-center justify-center rounded-xl border-[1.5px] border-fa-border-strong bg-fa-surface px-[18px] text-[17px] font-semibold text-fa-text hover:bg-fa-sunken'

// Where an invite or reset link lands when it is used up or too old.
export default function AuthErrorPage() {
  return (
    <AccountFrame>
      <AccountIcon tone="danger">
        <LinkIcon className="h-[34px] w-[34px]" strokeWidth={2} aria-hidden />
      </AccountIcon>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] font-bold leading-tight">This link has expired</h1>
        <p className="m-0 text-[17px] leading-relaxed text-fa-text-2">
          For your security, each link works once and only for {EMAIL_LINK_VALID_HOURS} hours. Ask for a new one below.
        </p>
        <p className="m-0 text-base leading-relaxed text-fa-text-2">
          New to AssetNXG? Your administrator can resend your invite. Already set a password? Just sign in.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <Link href="/auth/forgot-password" className={primary}>
          <KeyRound className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          Get a new link
        </Link>
        <Link href="/login" className={secondary}>
          Go to sign in
        </Link>
      </div>
      <HelpLine />
    </AccountFrame>
  )
}
