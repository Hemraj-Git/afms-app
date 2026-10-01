import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '@/lib/authPolicy'

// The password rules (see authPolicy.ts), each ticking off as it is met, so
// nobody has to learn them from an error. `id` is what the password field's
// aria-describedby points at.
export function PasswordChecklist({ password, id, tone = 'light' }: { password: string; id: string; tone?: 'light' | 'dark' }) {
  const metText = tone === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
  const metIcon = tone === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
  const unmetText = tone === 'dark' ? 'text-slate-400' : 'text-slate-500'
  const unmetIcon = tone === 'dark' ? 'text-slate-600' : 'text-slate-300'
  return (
    <ul id={id} aria-label="Password rules" className="pt-1 space-y-1">
      {PASSWORD_RULES.map(rule => {
        const ok = rule.met(password)
        return (
          <li key={rule.id} data-met={ok} className={`flex items-center gap-2 text-[11px] font-medium transition ${ok ? metText : unmetText}`}>
            {ok ? <Check className={`w-3.5 h-3.5 ${metIcon}`} /> : <Circle className={`w-3 h-3 ${unmetIcon}`} />}
            <span>{rule.label}</span>
            <span className="sr-only">{ok ? '(done)' : '(not yet)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
