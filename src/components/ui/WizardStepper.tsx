import { Check } from 'lucide-react'

export interface WizardStep {
  number: number
  title: string
}

// The progress bar of a multi-step form (add asset, add spare, sub-category):
// evenly spaced numbered circles joined by a line that fills in blue up to the
// current step. Done steps show a tick. On a phone only the current step's
// title shows, with "Step 2 of 5" above the bar.
export function WizardStepper({ steps, current, className = '' }: { steps: WizardStep[]; current: number; className?: string }) {
  const now = steps.find(s => s.number === current)
  return (
    <div className={`w-full ${className}`}>
      <p className="sm:hidden mb-3 text-center text-xs font-semibold text-slate-500">
        Step {current} of {steps.length}
        {now ? <span className="text-slate-900"> · {now.title}</span> : null}
      </p>
      <ol className="grid w-full" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progress">
        {steps.map((step, i) => {
          const done = current > step.number
          const isCurrent = current === step.number
          return (
            <li key={step.number} className="relative flex flex-col items-center text-center" aria-current={isCurrent ? 'step' : undefined}>
              {/* The line from the previous step's circle to this one */}
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2 transition-colors duration-300 ${current >= step.number ? 'bg-blue-600' : 'bg-slate-200'}`}
                />
              ) : null}
              <span
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : done
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-400 border-2 border-slate-200'
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-label="Done" /> : step.number}
              </span>
              <span
                className={`mt-2 hidden sm:block px-1 text-xs leading-tight ${
                  isCurrent ? 'font-bold text-slate-900' : done ? 'font-medium text-slate-600' : 'font-medium text-slate-400'
                }`}
              >
                {step.title}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
