import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { EMAIL_LINK_VALID_HOURS } from '@/lib/authPolicy'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-slate-900">Link Expired or Invalid</h1>
          <p className="text-xs text-slate-500">
            This link is no longer valid. Each link works once, for {EMAIL_LINK_VALID_HOURS} hours.
          </p>
          <ul className="text-xs text-slate-600 text-left list-disc pl-5 space-y-1">
            <li>
              <strong>New account?</strong> Ask your administrator to resend the invite, or use{' '}
              <strong>Forgot password?</strong> with the same email.
            </li>
            <li>
              <strong>Resetting a password?</strong> Ask for a new link from <strong>Forgot password?</strong>
            </li>
            <li>Already set a password? Just sign in.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/auth/forgot-password"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Get a new link
          </Link>
          <Link href="/login" className="inline-block px-4 py-2 text-blue-600 hover:text-blue-700 text-xs font-semibold">
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
