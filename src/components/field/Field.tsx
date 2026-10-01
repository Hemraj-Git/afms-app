import React, { useId } from 'react'
import { ChevronDown, CircleAlert, Info, type LucideIcon } from 'lucide-react'
import { cn } from './cn'

// Form fields (redesign canvas, Components -> Form fields): 52 px tall, 17 px
// text, the label above, an error under the field in red with an icon -- never
// a pop-up. `id`s are wired so the error is read out with the field.

interface FieldShellProps {
  label: string
  required?: boolean
  error?: string
  hint?: React.ReactNode
  // Supplied by the field component; the shell needs it for the <label>.
  id: string
  children: React.ReactNode
}

function FieldShell({ label, required, error, hint, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-semibold text-fa-text">
        {label}
        {required ? (
          <span className="text-fa-danger" aria-hidden>
            {' '}*
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <div id={`${id}-error`} className="flex items-center gap-1.5 text-[15px] font-medium text-fa-danger">
          <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          {error}
        </div>
      ) : hint ? (
        <div id={`${id}-hint`} className="flex items-start gap-1.5 text-sm text-fa-text-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>{hint}</span>
        </div>
      ) : null}
    </div>
  )
}

const boxClass = (error: string | undefined, readOnly: boolean | undefined, withIcon: boolean) =>
  cn(
    'w-full rounded-[10px] text-[17px] text-fa-text placeholder:text-fa-text-3 focus:outline-none focus:ring-3 focus:ring-fa-primary/25',
    error ? 'border-2 border-fa-danger' : 'border-[1.5px] border-fa-border-strong focus:border-fa-primary',
    readOnly ? 'bg-fa-sunken' : 'bg-fa-surface',
    withIcon ? 'pl-11 pr-3.5' : 'px-3.5',
  )

const describedBy = (id: string, error?: string, hint?: React.ReactNode) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined)

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: React.ReactNode
  icon?: LucideIcon
  // Something to the right inside the box (e.g. a show-password button).
  trailing?: React.ReactNode
}

export function TextField({ label, required, error, hint, icon: Icon, trailing, readOnly, className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} id={id}>
      <div className="relative">
        {Icon ? (
          <span className="pointer-events-none absolute left-3.5 top-4 flex">
            <Icon className="h-5 w-5 text-fa-text-2" strokeWidth={2} aria-hidden />
          </span>
        ) : null}
        <input
          id={id}
          readOnly={readOnly}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn('h-[52px]', boxClass(error, readOnly, !!Icon), trailing ? 'pr-12' : '', className)}
          {...rest}
        />
        {trailing ? <span className="absolute right-0.5 top-0.5">{trailing}</span> : null}
      </div>
    </FieldShell>
  )
}

export interface TextAreaFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  error?: string
  hint?: React.ReactNode
}

export function TextAreaField({ label, required, error, hint, rows = 3, className, ...rest }: TextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} id={id}>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn('py-3 leading-relaxed', boxClass(error, false, false), className)}
        {...rest}
      />
    </FieldShell>
  )
}

export interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  error?: string
  hint?: React.ReactNode
  icon?: LucideIcon
  // The first, empty choice: "Select the equipment".
  placeholder?: string
  options: { value: string; label: string }[]
}

// A native select styled like the design's picker button: on a phone the
// system list is the easiest thing to scroll with a thumb.
export function SelectField({ label, required, error, hint, icon: Icon, placeholder, options, className, value, ...rest }: SelectFieldProps) {
  const id = useId()
  const empty = value === '' || value === undefined
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} id={id}>
      <div className="relative">
        {Icon ? (
          <span className="pointer-events-none absolute left-3.5 top-4 flex">
            <Icon className="h-5 w-5 text-fa-text-2" strokeWidth={2} aria-hidden />
          </span>
        ) : null}
        <select
          id={id}
          value={value}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn('h-[52px] appearance-none pr-11', boxClass(error, false, !!Icon), empty && 'text-fa-text-3', className)}
          {...rest}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map(o => (
            <option key={o.value} value={o.value} className="text-fa-text">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-4 h-5 w-5 text-fa-text-2" strokeWidth={2} aria-hidden />
      </div>
    </FieldShell>
  )
}
