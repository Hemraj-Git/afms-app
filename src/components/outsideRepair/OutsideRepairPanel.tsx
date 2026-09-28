'use client'

import React, { useState } from 'react'
import { CalendarClock, PackageOpen, Truck, Undo2 } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { formatDateDisplay, getLocalDateStr } from '@/lib/dateUtils'
import {
  daysOut, isOverdueReturn, isOutForRepair, repairItemLabel, repairsForWorkOrder, validateReturn, validateSend,
  workOrderRepairTag,
} from '@/lib/outsideRepairState'
import { CameraCaptureButton } from '@/components/ui/CameraCaptureButton'
import type { OutsideRepair, WorkOrder } from '@/types/afms'

// Parts or the whole asset sent to an outside workshop during a corrective job:
// the list for one work order, plus the forms to send something out, record its
// return and move its expected return date. Used in the technician's mobile app
// (dark) and on the desktop work-order details (light).

type Theme = 'dark' | 'light'

const T: Record<Theme, Record<string, string>> = {
  dark: {
    box: 'bg-slate-950 border-slate-800',
    card: 'bg-slate-900 border-slate-800',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    label: 'text-[12px] text-slate-400',
    input: 'w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white',
    ghost: 'bg-slate-800 hover:bg-slate-700 text-slate-200',
    tab: 'bg-slate-900 text-slate-400',
    tabOn: 'bg-amber-600 text-white',
  },
  light: {
    box: 'bg-slate-50 border-slate-200',
    card: 'bg-white border-slate-200',
    text: 'text-slate-800',
    muted: 'text-slate-500',
    label: 'text-[11px] font-semibold text-slate-500',
    input: 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800',
    ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    tab: 'bg-white text-slate-500 border border-slate-200',
    tabOn: 'bg-amber-600 text-white border border-amber-600',
  },
}

const inr = (n?: number) => (n === undefined ? undefined : `₹${n.toLocaleString('en-IN')}`)

export function OutsideRepairStatusPill({ repair }: { repair: Pick<OutsideRepair, 'status' | 'expectedReturnDate'> }) {
  const overdue = isOverdueReturn(repair)
  const cls = overdue
    ? 'bg-rose-500/15 text-rose-600 border-rose-500/40'
    : isOutForRepair(repair)
    ? 'bg-amber-500/15 text-amber-600 border-amber-500/40'
    : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40'
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${cls}`}>
      {overdue ? 'Overdue return' : repair.status}
    </span>
  )
}

// The tag on a work-order card or row while something is at an outside workshop.
export function OutsideRepairTag({ workOrderId, theme }: { workOrderId: string; theme: Theme }) {
  const { outsideRepairs } = useAFMS()
  const tag = workOrderRepairTag(outsideRepairs, workOrderId)
  if (!tag) return null
  const cls = theme === 'dark'
    ? tag.overdue ? 'rounded-md text-[12px] bg-rose-500/20 text-rose-300 border-rose-500/30' : 'rounded-md text-[12px] bg-orange-500/20 text-orange-300 border-orange-500/30'
    : tag.overdue ? 'rounded-full text-[10px] bg-rose-50 text-rose-700 border-rose-200' : 'rounded-full text-[10px] bg-orange-50 text-orange-700 border-orange-200'
  return <span className={`px-2 py-0.5 font-bold border whitespace-nowrap ${cls}`}>{tag.overdue ? 'Overdue return' : tag.label}</span>
}

type Mode = { kind: 'none' } | { kind: 'send' } | { kind: 'return'; id: string } | { kind: 'etd'; id: string }

export function OutsideRepairPanel({
  workOrder,
  theme,
  readOnly = false,
}: {
  workOrder: WorkOrder
  theme: Theme
  readOnly?: boolean
}) {
  const { outsideRepairs, vendors, sendOutsideRepair, recordOutsideRepairReturn, updateOutsideRepair } = useAFMS()
  const t = T[theme]
  const list = repairsForWorkOrder(outsideRepairs, workOrder.id)
  const today = getLocalDateStr()

  const [mode, setMode] = useState<Mode>({ kind: 'none' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Send-out form
  const [scope, setScope] = useState<OutsideRepair['scope']>('Component')
  const [componentName, setComponentName] = useState('')
  const [fault, setFault] = useState('')
  const [sentBy, setSentBy] = useState<OutsideRepair['sentBy']>('Technician')
  const [vendorId, setVendorId] = useState('')
  const [sentDate, setSentDate] = useState(today)
  const [etd, setEtd] = useState('')
  const [dispatchRef, setDispatchRef] = useState('')
  const [vendorRef, setVendorRef] = useState('')
  const [estCost, setEstCost] = useState('')
  const [dispatchPhoto, setDispatchPhoto] = useState('')

  // Return form
  const [returnedDate, setReturnedDate] = useState(today)
  const [outcome, setOutcome] = useState<OutsideRepair['outcome'] | ''>('')
  const [actualCost, setActualCost] = useState('')
  const [remarks, setRemarks] = useState('')
  const [returnPhoto, setReturnPhoto] = useState('')

  // New ETD
  const [newEtd, setNewEtd] = useState('')

  const cost = (v: string) => (v.trim() === '' ? undefined : Number(v))

  const openSend = () => {
    setScope('Component')
    setComponentName('')
    setFault('')
    // A job handed to a vendor is usually sent out by that vendor, to themselves.
    setSentBy(workOrder.executedBy === 'Vendor' ? 'Vendor' : 'Technician')
    setVendorId(workOrder.executedBy === 'Vendor' ? workOrder.vendorId || '' : '')
    setSentDate(today)
    setEtd('')
    setDispatchRef('')
    setVendorRef('')
    setEstCost('')
    setDispatchPhoto('')
    setError(null)
    setMode({ kind: 'send' })
  }

  const openReturn = (r: OutsideRepair) => {
    setReturnedDate(today)
    setOutcome('')
    setActualCost('')
    setRemarks('')
    setReturnPhoto('')
    setError(null)
    setMode({ kind: 'return', id: r.id })
  }

  const close = () => {
    setMode({ kind: 'none' })
    setError(null)
  }

  const submitSend = async () => {
    if (uploading) return setError('Please wait for the photo to finish uploading.')
    const input = {
      scope, componentName, vendorId, sentDate, expectedReturnDate: etd, estimatedCost: cost(estCost),
    }
    const problem = validateSend(input, today)
    if (problem) return setError(problem)
    setBusy(true)
    const saved = await sendOutsideRepair({
      workOrderId: workOrder.id,
      assetId: workOrder.assetId,
      scope,
      componentName: scope === 'Component' ? componentName.trim() : undefined,
      faultDescription: fault.trim() || undefined,
      sentBy,
      vendorId,
      sentDate,
      expectedReturnDate: etd,
      dispatchRef: dispatchRef.trim() || undefined,
      vendorRef: vendorRef.trim() || undefined,
      estimatedCost: cost(estCost),
      dispatchPhotoUrl: dispatchPhoto || undefined,
    })
    setBusy(false)
    if (saved) close()
  }

  const submitReturn = async (r: OutsideRepair) => {
    if (uploading) return setError('Please wait for the photo to finish uploading.')
    const input = { returnedDate, outcome: outcome || undefined, actualCost: cost(actualCost) }
    const problem = validateReturn(input, r.sentDate, today)
    if (problem) return setError(problem)
    setBusy(true)
    const ok = await recordOutsideRepairReturn(r.id, {
      returnedDate,
      outcome: outcome as NonNullable<OutsideRepair['outcome']>,
      actualCost: cost(actualCost),
      returnRemarks: remarks.trim() || undefined,
      returnPhotoUrl: returnPhoto || undefined,
    })
    setBusy(false)
    if (ok) close()
  }

  const submitEtd = (r: OutsideRepair) => {
    if (!newEtd) return setError('Enter the new expected return date.')
    if (newEtd < r.sentDate) return setError('The expected return date cannot be before the sent date.')
    updateOutsideRepair(r.id, { expectedReturnDate: newEtd })
    close()
  }

  const field = (label: string, node: React.ReactNode, required = false) => (
    <label className="block space-y-1">
      <span className={t.label}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </span>
      {node}
    </label>
  )

  const photoButton = (value: string, set: (v: string) => void, label: string) => (
    <div className="flex items-center gap-2">
      <CameraCaptureButton
        onCapture={set}
        onUploadingChange={setUploading}
        label={value ? 'Retake photo' : label}
        className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 ${t.ghost}`}
      />
      {value && <img src={value} alt="" className="h-10 w-auto rounded-md border border-slate-500/30 object-cover" />}
    </div>
  )

  const errorLine = error && <p className="text-[12px] font-semibold text-rose-500">{error}</p>

  const buttons = (onSave: () => void, saveLabel: string) => (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={close} disabled={busy} className={`flex-1 py-2 rounded-xl text-xs font-semibold ${t.ghost}`}>
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={busy || uploading}
        className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-60"
      >
        {busy ? 'Saving…' : saveLabel}
      </button>
    </div>
  )

  return (
    <div className={`border rounded-2xl p-3 space-y-3 text-xs ${t.box}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-bold flex items-center gap-1.5 ${t.text}`}>
          <Truck className="w-4 h-4 text-amber-500" />
          Outside repair
        </p>
        {!readOnly && mode.kind === 'none' && (
          <button
            type="button"
            onClick={openSend}
            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px]"
          >
            + Send outside for repair
          </button>
        )}
      </div>

      {list.length === 0 && mode.kind !== 'send' && (
        <p className={t.muted}>
          Nothing has been sent off site for this job. Use this when a part, or the whole asset, has to go to an outside workshop.
        </p>
      )}

      {list.map(r => {
        const vendor = vendors.find(v => v.id === r.vendorId)
        return (
          <div key={r.id} className={`border rounded-xl p-2.5 space-y-1.5 ${t.card}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`font-bold ${t.text}`}>
                  {repairItemLabel(r)} <span className={`font-mono font-normal ${t.muted}`}>· {r.repairNumber}</span>
                </p>
                <p className={t.muted}>
                  To {vendor?.name || 'vendor'} · sent by {r.sentBy === 'Vendor' ? 'the vendor' : 'technician'}
                  {r.recordedBy ? ` (recorded by ${r.recordedBy})` : ''}
                </p>
              </div>
              <OutsideRepairStatusPill repair={r} />
            </div>

            <div className={`grid grid-cols-2 gap-x-3 gap-y-0.5 ${t.muted}`}>
              <span>Sent: <b className={t.text}>{formatDateDisplay(r.sentDate)}</b></span>
              <span>Expected back: <b className={t.text}>{formatDateDisplay(r.expectedReturnDate)}</b></span>
              <span>{r.status === 'Returned' ? 'Took' : 'Out for'}: <b className={t.text}>{daysOut(r)} day(s)</b></span>
              {r.estimatedCost !== undefined && <span>Estimate: <b className={t.text}>{inr(r.estimatedCost)}</b></span>}
              {r.dispatchRef && <span>Gate pass / DC: <b className={t.text}>{r.dispatchRef}</b></span>}
              {r.vendorRef && <span>Vendor job no: <b className={t.text}>{r.vendorRef}</b></span>}
            </div>
            {r.faultDescription && <p className={t.muted}>Fault: <span className={t.text}>{r.faultDescription}</span></p>}
            {r.dispatchPhotoUrl && <img src={r.dispatchPhotoUrl} alt="Dispatch" className="h-16 w-auto rounded-lg border border-slate-500/30 object-cover" />}

            {r.status === 'Returned' && (
              <div className={`pt-1.5 border-t border-slate-500/20 space-y-0.5 ${t.muted}`}>
                <p>
                  Returned <b className={t.text}>{r.returnedDate ? formatDateDisplay(r.returnedDate) : ''}</b> ·{' '}
                  <b className={r.outcome === 'Not repairable' ? 'text-rose-500' : 'text-emerald-500'}>{r.outcome}</b>
                  {r.actualCost !== undefined && <> · cost <b className={t.text}>{inr(r.actualCost)}</b></>}
                  {r.returnedBy && <> · by {r.returnedBy}</>}
                </p>
                {r.returnRemarks && <p className={t.text}>{r.returnRemarks}</p>}
                {r.returnPhotoUrl && <img src={r.returnPhotoUrl} alt="Job sheet" className="h-16 w-auto rounded-lg border border-slate-500/30 object-cover" />}
              </div>
            )}

            {!readOnly && isOutForRepair(r) && mode.kind === 'none' && (
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => openReturn(r)} className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1">
                  <Undo2 className="w-3.5 h-3.5" /> Record return
                </button>
                <button
                  type="button"
                  onClick={() => { setNewEtd(r.expectedReturnDate); setError(null); setMode({ kind: 'etd', id: r.id }) }}
                  className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1 ${t.ghost}`}
                >
                  <CalendarClock className="w-3.5 h-3.5" /> Change ETD
                </button>
              </div>
            )}

            {mode.kind === 'return' && mode.id === r.id && (
              <div className="pt-2 border-t border-slate-500/20 space-y-2">
                <p className={`font-bold flex items-center gap-1.5 ${t.text}`}><PackageOpen className="w-4 h-4 text-emerald-500" /> Record return</p>
                <div className="grid grid-cols-2 gap-2">
                  {field('Returned on', <input type="date" value={returnedDate} max={today} onChange={e => setReturnedDate(e.target.value)} className={t.input} />, true)}
                  {field('Outcome', (
                    <select value={outcome} onChange={e => setOutcome(e.target.value as OutsideRepair['outcome'])} className={t.input}>
                      <option value="" disabled>-- Select --</option>
                      <option value="Repaired">Repaired</option>
                      <option value="Replaced by vendor">Replaced by vendor</option>
                      <option value="Not repairable">Not repairable</option>
                    </select>
                  ), true)}
                </div>
                {field('Repair cost (INR)', <input type="number" min={0} step="0.01" inputMode="decimal" value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder="0.00" className={t.input} />)}
                {field('Remarks', <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="What the vendor did, warranty on the repair…" className={t.input} />)}
                {field('Vendor invoice / job sheet', photoButton(returnPhoto, setReturnPhoto, 'Photograph job sheet'))}
                {errorLine}
                {buttons(() => submitReturn(r), 'Save return')}
              </div>
            )}

            {mode.kind === 'etd' && mode.id === r.id && (
              <div className="pt-2 border-t border-slate-500/20 space-y-2">
                {field('New expected return date', <input type="date" value={newEtd} min={r.sentDate} onChange={e => setNewEtd(e.target.value)} className={t.input} />, true)}
                {errorLine}
                {buttons(() => submitEtd(r), 'Save date')}
              </div>
            )}
          </div>
        )
      })}

      {mode.kind === 'send' && (
        <div className={`border rounded-xl p-2.5 space-y-2 ${t.card}`}>
          <p className={`font-bold ${t.text}`}>Send outside for repair</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['Component', 'Complete Asset'] as const).map(s => (
              <button key={s} type="button" onClick={() => setScope(s)} className={`py-1.5 rounded-lg text-[11px] font-bold ${scope === s ? t.tabOn : t.tab}`}>
                {s === 'Component' ? 'A part / component' : 'The complete asset'}
              </button>
            ))}
          </div>
          {scope === 'Component' && field('Part name', <input value={componentName} onChange={e => setComponentName(e.target.value)} placeholder="e.g. Motherboard" className={t.input} />, true)}
          {field('Fault found', <textarea rows={2} value={fault} onChange={e => setFault(e.target.value)} placeholder="What is wrong with it" className={t.input} />)}
          <div className="grid grid-cols-2 gap-2">
            {field('Sent by', (
              <select value={sentBy} onChange={e => setSentBy(e.target.value as OutsideRepair['sentBy'])} className={t.input}>
                <option value="Technician">Technician</option>
                <option value="Vendor">Vendor (on site)</option>
              </select>
            ), true)}
            {field('Repair vendor', (
              <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={t.input}>
                <option value="" disabled>-- Select vendor --</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            ), true)}
            {field('Sent on', <input type="date" value={sentDate} max={today} onChange={e => setSentDate(e.target.value)} className={t.input} />, true)}
            {field('Expected return (ETD)', <input type="date" value={etd} min={sentDate} onChange={e => setEtd(e.target.value)} className={t.input} />, true)}
            {field('Gate pass / DC no.', <input value={dispatchRef} onChange={e => setDispatchRef(e.target.value)} className={t.input} />)}
            {field("Vendor's job no.", <input value={vendorRef} onChange={e => setVendorRef(e.target.value)} className={t.input} />)}
          </div>
          {field('Estimated cost (INR)', <input type="number" min={0} step="0.01" inputMode="decimal" value={estCost} onChange={e => setEstCost(e.target.value)} placeholder="0.00" className={t.input} />)}
          {field('Photo of what was sent', photoButton(dispatchPhoto, setDispatchPhoto, 'Take photo'))}
          <p className={t.muted}>The work order stays open until this comes back and its return is recorded.</p>
          {errorLine}
          {buttons(submitSend, 'Send out')}
        </div>
      )}
    </div>
  )
}
