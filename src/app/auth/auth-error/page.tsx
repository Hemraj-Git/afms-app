import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900">Link Expired or Invalid</h1>
          <p className="text-xs text-slate-500">
            This confirmation link is no longer valid. It may have already been used or expired.
            Ask an Admin to send a new invite, or sign in if you already have a password set.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  )
}
