'use client'

import React, { useState } from 'react'
import { CalendarClock, CircleAlert, ClipboardCheck, ImageIcon, MapPin, Minus, Package, Plus, Sparkles, StickyNote, Trash2, User, Wrench, type LucideIcon } from 'lucide-react'
import type { WorkOrderPartItem } from '@/types/afms'
import { BottomSheet, Button, Card, CardTitle, IconButton, IdText, TextAreaField, TextField } from '@/components/field'

// The pieces of the work-order screen (redesign canvas, WO-Preventive and
// WO-Corrective), kept apart from the screen's state and saving.

// What the job is on (an asset, or a room for cleaning): what it is, where,
// how urgent, and a few facts.
export function AssetSummary({
  kind,
  name,
  code,
  place,
  pills,
  facts,
}: {
  kind: 'Preventive' | 'Breakdown' | 'Cleaning' | 'Inspection'
  name: string
  code?: string
  place?: string
  pills: React.ReactNode
  facts: { label: string; value?: string; tone?: 'danger' }[]
}) {
  const Icon = { Preventive: CalendarClock, Breakdown: Wrench, Cleaning: Sparkles, Inspection: ClipboardCheck }[kind]
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fa-primary-weak">
          <Icon className="h-6 w-6 text-fa-primary" strokeWidth={2} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-[19px] font-bold leading-tight">{name}</span>
          {code ? <IdText className="text-sm">{code}</IdText> : null}
        </div>
      </div>
      {place ? (
        <div className="flex items-center gap-[7px] text-[15px] text-fa-text-2">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>{place}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">{pills}</div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
        {facts.map(f => (
          <div key={f.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-sm text-fa-text-2">{f.label}</dt>
            <dd className={f.tone === 'danger' ? 'm-0 text-base font-semibold text-fa-danger' : 'm-0 text-base font-medium text-fa-text'}>{f.value || '—'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

// A numbered step of the job ("1. Start on site"), with its anchor so a
// problem on save can scroll to it.
export function Step({
  id,
  icon,
  title,
  aside,
  children,
}: {
  id?: string
  icon: LucideIcon
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-4 gap-3">
      <CardTitle icon={icon} aside={aside}>
        {title}
      </CardTitle>
      {children}
    </Card>
  )
}

// What went wrong on save, said where it went wrong.
export function StepError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p className="m-0 flex items-center gap-1.5 text-[15px] font-medium text-fa-danger">
      <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      {children}
    </p>
  )
}

// The complaint that started a breakdown, from the person who raised it.
export function ReportedIssue({ ticket, text, who, when }: { ticket: string; text: string; who?: string; when?: string }) {
  return (
    <Card className="gap-2">
      <CardTitle icon={CircleAlert} aside={<IdText>{ticket}</IdText>}>
        Reported issue
      </CardTitle>
      <p className="m-0 text-[17px] leading-relaxed">{text}</p>
      {who ? (
        <div className="flex items-center gap-[7px] text-[15px] text-fa-text-2">
          <User className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {who}
        </div>
      ) : null}
      {when ? <p className="m-0 text-sm text-fa-text-2">{when}</p> : null}
    </Card>
  )
}

// A photo already on a finished record (nothing to take or retake).
export function PhotoView({ label, url }: { label: string; url?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-fa-border p-2.5">
      <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-fa-photo">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label}`} className="h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded photo */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </a>
        ) : (
          <ImageIcon className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        <span className="text-sm text-fa-text-2">{url ? 'Tap to open' : 'No photo was taken'}</span>
      </div>
    </div>
  )
}

// Parts used on the job: name and quantity, changed with − and +.
export function PartsList({ parts, onChange, readOnly }: { parts: WorkOrderPartItem[]; onChange: (p: WorkOrderPartItem[]) => void; readOnly: boolean }) {
  const [adding, setAdding] = useState(false)
  const setQty = (i: number, q: number) => onChange(parts.map((p, j) => (j === i ? { ...p, quantity: Math.max(1, q) } : p)))
  return (
    <>
      {parts.length === 0 ? <p className="m-0 text-[15px] text-fa-text-2">{readOnly ? 'No parts were used.' : 'No parts added.'}</p> : null}
      {parts.length ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {parts.map((p, i) => (
            <li key={`${p.partName}-${i}`} className="flex min-h-14 items-center gap-2 border-b border-fa-border py-1.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium">{p.partName}</div>
                {p.notes ? <div className="text-sm text-fa-text-2">{p.notes}</div> : null}
              </div>
              {readOnly ? (
                <span className="font-semibold tabular-nums">× {p.quantity}</span>
              ) : (
                <>
                  <div className="flex items-center rounded-xl border-[1.5px] border-fa-border-strong">
                    <IconButton icon={Minus} label={`One less ${p.partName}`} onClick={() => setQty(i, p.quantity - 1)} disabled={p.quantity <= 1} />
                    <span className="min-w-7 text-center text-[17px] font-semibold tabular-nums" aria-label={`Quantity ${p.quantity}`}>
                      {p.quantity}
                    </span>
                    <IconButton icon={Plus} label={`One more ${p.partName}`} onClick={() => setQty(i, p.quantity + 1)} />
                  </div>
                  <IconButton icon={Trash2} label={`Remove ${p.partName}`} onClick={() => onChange(parts.filter((_, j) => j !== i))} />
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {!readOnly ? (
        <Button variant="secondary" size="md" icon={Plus} onClick={() => setAdding(true)}>
          Add part
        </Button>
      ) : null}
      {adding ? (
        <AddPartSheet
          onClose={() => setAdding(false)}
          onAdd={part => {
            onChange([...parts, part])
            setAdding(false)
          }}
        />
      ) : null}
    </>
  )
}

function AddPartSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (p: WorkOrderPartItem) => void }) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | undefined>()
  const add = () => {
    if (!name.trim()) return setError('Enter the part’s name.')
    onAdd({ partName: name.trim(), quantity: Math.max(1, Math.round(Number(qty)) || 1), notes: notes.trim() || undefined })
  }
  return (
    <BottomSheet title="Add part" onClose={onClose}>
      <h2 className="m-0 flex items-center gap-2 text-[22px] font-bold">
        <Package className="h-6 w-6" strokeWidth={2} aria-hidden />
        Add part
      </h2>
      <TextField label="Part" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Air filter element" error={error} autoFocus />
      <TextField label="Quantity" type="number" inputMode="numeric" min={1} value={qty} onChange={e => setQty(e.target.value)} />
      <TextField label="Note" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional, e.g. litres, size" />
      <div className="flex flex-col gap-2.5">
        <Button icon={Plus} onClick={add}>
          Add part
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}

// A note on one checklist step.
export function NoteSheet({ step, value, onSave, onClose }: { step: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value)
  return (
    <BottomSheet title="Note" onClose={onClose}>
      <div>
        <h2 className="m-0 flex items-center gap-2 text-[22px] font-bold">
          <StickyNote className="h-6 w-6" strokeWidth={2} aria-hidden />
          Note
        </h2>
        <p className="m-0 text-base text-fa-text-2">{step}</p>
      </div>
      <TextAreaField label="What you found or did" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Topped up 0.5 L" autoFocus />
      <div className="flex flex-col gap-2.5">
        <Button onClick={() => onSave(text.trim())}>Save note</Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}
