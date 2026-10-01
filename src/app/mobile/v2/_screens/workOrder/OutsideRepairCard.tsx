'use client'

import React, { useState } from 'react'
import { CalendarClock, PackageCheck, Truck } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { OutsideRepair, WorkOrder } from '@/types/afms'
import { getLocalDateStr } from '@/lib/dateUtils'
import { expectedBackText, longDate, shortDate } from '@/lib/fieldTasks'
import { repairItemLabel, repairsForWorkOrder, validateReturn, validateSend } from '@/lib/outsideRepairState'
import {
  BottomSheet, Button, Card, CardTitle, PhotoCapture, SegmentedControl, SelectField, TextAreaField, TextButton, TextField, Timeline, cn,
} from '@/components/field'
import { usePhotoSlots } from '../usePhotoSlots'

const inr = (n?: number) => (n === undefined ? '' : `₹${n.toLocaleString('en-IN')}`)
const amount = (v: string) => (v.trim() === '' ? undefined : Number(v))

// Parts, or the whole asset, sent to an outside workshop during a breakdown
// (redesign canvas, WO-Corrective -> "Outside repair"). Each one is a
// timeline: sent out, at the workshop, received back. The job cannot be
// closed until everything sent out has come back.
export function OutsideRepairCard({ workOrder, readOnly, onToast }: { workOrder: WorkOrder; readOnly: boolean; onToast: (t: string) => void }) {
  const { outsideRepairs, vendors } = useAFMS()
  const list = repairsForWorkOrder(outsideRepairs, workOrder.id)
  const [sheet, setSheet] = useState<{ kind: 'send' } | { kind: 'return' | 'etd'; repair: OutsideRepair } | null>(null)
  const vendorName = (id?: string) => vendors.find(v => v.id === id)?.name ?? 'the vendor'

  return (
    <Card>
      <CardTitle icon={Truck}>Outside repair</CardTitle>
      {list.length === 0 ? (
        <p className="m-0 text-[15px] leading-relaxed text-fa-text-2">
          Nothing has been sent off site for this job. Use this when a part, or the whole asset, has to go to a workshop.
        </p>
      ) : (
        list.map(r => {
          const out = r.status === 'Out for Repair'
          const back = expectedBackText(r.expectedReturnDate)
          return (
            <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-fa-border p-3">
              <Timeline
                label={`${repairItemLabel(r)}, ${r.repairNumber}`}
                steps={[
                  {
                    title: `Sent out · ${repairItemLabel(r)}`,
                    state: 'done',
                    detail: (
                      <>
                        {shortDate(r.sentDate)} · {r.sentBy === 'Vendor' ? 'by the vendor' : `by ${r.recordedBy || 'technician'}`} · to {vendorName(r.vendorId)}
                        {r.faultDescription ? <span className="block">Fault: {r.faultDescription}</span> : null}
                        {r.estimatedCost !== undefined ? <span className="block">Estimate {inr(r.estimatedCost)}</span> : null}
                      </>
                    ),
                  },
                  {
                    title: 'At vendor workshop',
                    state: out ? 'current' : 'done',
                    detail: out ? <span className={cn(back.late && 'font-semibold text-fa-danger')}>{back.text}</span> : undefined,
                    action:
                      out && !readOnly ? (
                        <TextButton onClick={() => setSheet({ kind: 'etd', repair: r })}>
                          <CalendarClock className="h-4 w-4" strokeWidth={2} aria-hidden />
                          Change expected date
                        </TextButton>
                      ) : undefined,
                  },
                  {
                    title: 'Received back',
                    state: out ? 'upcoming' : 'done',
                    detail: out ? (
                      'Mark when it is back on site'
                    ) : (
                      <>
                        {longDate(r.returnedDate)} · <b className={r.outcome === 'Not repairable' ? 'text-fa-danger' : 'text-fa-success'}>{r.outcome}</b>
                        {r.actualCost !== undefined ? ` · ${inr(r.actualCost)}` : ''}
                        {r.returnRemarks ? <span className="block">{r.returnRemarks}</span> : null}
                      </>
                    ),
                    action:
                      out && !readOnly ? (
                        <Button size="md" variant="secondary" block={false} icon={PackageCheck} onClick={() => setSheet({ kind: 'return', repair: r })}>
                          Mark received back
                        </Button>
                      ) : undefined,
                  },
                ]}
              />
              <span className="font-plex-mono text-[13px] text-fa-text-3">{r.repairNumber}</span>
            </div>
          )
        })
      )}
      {!readOnly ? (
        <Button variant="secondary" icon={Truck} onClick={() => setSheet({ kind: 'send' })}>
          Send a part or the asset out
        </Button>
      ) : null}

      {sheet?.kind === 'send' ? (
        <SendSheet
          workOrder={workOrder}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null)
            onToast('Recorded as sent for outside repair')
          }}
        />
      ) : null}
      {sheet?.kind === 'return' ? (
        <ReturnSheet
          repair={sheet.repair}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null)
            onToast(`${repairItemLabel(sheet.repair)} marked as back`)
          }}
        />
      ) : null}
      {sheet?.kind === 'etd' ? <EtdSheet repair={sheet.repair} onClose={() => setSheet(null)} /> : null}
    </Card>
  )
}

function SendSheet({ workOrder, onClose, onDone }: { workOrder: WorkOrder; onClose: () => void; onDone: () => void }) {
  const { vendors, sendOutsideRepair } = useAFMS()
  const today = getLocalDateStr()
  const byVendor = workOrder.executedBy === 'Vendor'
  const [scope, setScope] = useState<OutsideRepair['scope']>('Component')
  const [componentName, setComponentName] = useState('')
  const [fault, setFault] = useState('')
  const [sentBy, setSentBy] = useState<OutsideRepair['sentBy']>(byVendor ? 'Vendor' : 'Technician')
  const [vendorId, setVendorId] = useState(byVendor ? workOrder.vendorId ?? '' : '')
  const [sentDate, setSentDate] = useState(today)
  const [etd, setEtd] = useState('')
  const [dispatchRef, setDispatchRef] = useState('')
  const [vendorRef, setVendorRef] = useState('')
  const [estCost, setEstCost] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const photos = usePhotoSlots({}, setError)

  const submit = async () => {
    if (photos.uploading) return setError('Wait for the photo to finish uploading.')
    if (photos.failed) return setError('The photo did not upload. Retry it or retake it.')
    const problem = validateSend({ scope, componentName, vendorId, sentDate, expectedReturnDate: etd, estimatedCost: amount(estCost) }, today)
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
      estimatedCost: amount(estCost),
      dispatchPhotoUrl: photos.urlOf('dispatch') || undefined,
    })
    setBusy(false)
    if (saved) onDone()
  }

  return (
    <BottomSheet title="Send for outside repair" onClose={onClose} preventClose={busy}>
      {photos.input}
      <h2 className="m-0 text-[22px] font-bold">Send for outside repair</h2>
      <SegmentedControl
        label="What is going"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'Component', label: 'A part' },
          { value: 'Complete Asset', label: 'The whole asset' },
        ]}
      />
      {scope === 'Component' ? <TextField label="Part name" required value={componentName} onChange={e => setComponentName(e.target.value)} placeholder="e.g. Compressor control PCB" /> : null}
      <TextAreaField label="Fault found" rows={2} value={fault} onChange={e => setFault(e.target.value)} placeholder="What is wrong with it" />
      <SelectField
        label="Repair vendor"
        required
        placeholder="Choose the vendor"
        value={vendorId}
        onChange={e => setVendorId(e.target.value)}
        options={vendors.map(v => ({ value: v.id, label: v.name }))}
      />
      <SegmentedControl
        label="Who took it"
        value={sentBy}
        onChange={setSentBy}
        options={[
          { value: 'Technician', label: 'I sent it' },
          { value: 'Vendor', label: 'Vendor took it' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Sent on" required type="date" value={sentDate} max={today} onChange={e => setSentDate(e.target.value)} />
        <TextField label="Expected back" required type="date" value={etd} min={sentDate} onChange={e => setEtd(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Gate pass / DC no." value={dispatchRef} onChange={e => setDispatchRef(e.target.value)} />
        <TextField label="Vendor’s job no." value={vendorRef} onChange={e => setVendorRef(e.target.value)} />
      </div>
      <TextField label="Estimated cost (₹)" type="number" inputMode="decimal" min={0} value={estCost} onChange={e => setEstCost(e.target.value)} placeholder="0" />
      <PhotoCapture label="Photo of what was sent" state={photos.stateOf('dispatch')} onTake={() => photos.take('dispatch')} onRetry={() => photos.retry('dispatch')} />
      <p className="m-0 text-sm text-fa-text-2">The job stays open until this comes back and is marked received.</p>
      {error ? <p role="alert" className="m-0 text-[15px] font-medium text-fa-danger">{error}</p> : null}
      <div className="flex flex-col gap-2.5">
        <Button icon={Truck} loading={busy} onClick={() => void submit()}>
          Record as sent
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}

function ReturnSheet({ repair, onClose, onDone }: { repair: OutsideRepair; onClose: () => void; onDone: () => void }) {
  const { recordOutsideRepairReturn } = useAFMS()
  const today = getLocalDateStr()
  const [returnedDate, setReturnedDate] = useState(today)
  const [outcome, setOutcome] = useState<OutsideRepair['outcome'] | ''>('')
  const [actualCost, setActualCost] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const photos = usePhotoSlots({}, setError)

  const submit = async () => {
    if (photos.uploading) return setError('Wait for the photo to finish uploading.')
    if (photos.failed) return setError('The photo did not upload. Retry it or retake it.')
    const problem = validateReturn({ returnedDate, outcome: outcome || undefined, actualCost: amount(actualCost) }, repair.sentDate, today)
    if (problem) return setError(problem)
    setBusy(true)
    const ok = await recordOutsideRepairReturn(repair.id, {
      returnedDate,
      outcome: outcome as NonNullable<OutsideRepair['outcome']>,
      actualCost: amount(actualCost),
      returnRemarks: remarks.trim() || undefined,
      returnPhotoUrl: photos.urlOf('return') || undefined,
    })
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <BottomSheet title="Received back" onClose={onClose} preventClose={busy}>
      {photos.input}
      <div>
        <h2 className="m-0 text-[22px] font-bold">Received back</h2>
        <p className="m-0 text-base text-fa-text-2">
          {repairItemLabel(repair)} · <span className="font-plex-mono text-sm">{repair.repairNumber}</span>
        </p>
      </div>
      <TextField label="Back on" required type="date" value={returnedDate} min={repair.sentDate} max={today} onChange={e => setReturnedDate(e.target.value)} />
      <SelectField
        label="Outcome"
        required
        placeholder="Choose the outcome"
        value={outcome}
        onChange={e => setOutcome(e.target.value as OutsideRepair['outcome'])}
        options={[
          { value: 'Repaired', label: 'Repaired' },
          { value: 'Replaced by vendor', label: 'Replaced by vendor' },
          { value: 'Not repairable', label: 'Not repairable' },
        ]}
      />
      <TextField label="Repair cost (₹)" type="number" inputMode="decimal" min={0} value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder="0" />
      <TextAreaField label="Remarks" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="What the vendor did, warranty on the repair…" />
      <PhotoCapture label="Vendor invoice or job sheet" state={photos.stateOf('return')} onTake={() => photos.take('return')} onRetry={() => photos.retry('return')} />
      {error ? <p role="alert" className="m-0 text-[15px] font-medium text-fa-danger">{error}</p> : null}
      <div className="flex flex-col gap-2.5">
        <Button icon={PackageCheck} loading={busy} onClick={() => void submit()}>
          Save
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}

function EtdSheet({ repair, onClose }: { repair: OutsideRepair; onClose: () => void }) {
  const { updateOutsideRepair } = useAFMS()
  const [etd, setEtd] = useState(repair.expectedReturnDate)
  const [error, setError] = useState<string | undefined>()
  const save = () => {
    if (!etd) return setError('Enter the new expected date.')
    if (etd < repair.sentDate) return setError('It can’t be before the day it was sent.')
    updateOutsideRepair(repair.id, { expectedReturnDate: etd })
    onClose()
  }
  return (
    <BottomSheet title="Change expected date" onClose={onClose}>
      <h2 className="m-0 text-[22px] font-bold">Change expected date</h2>
      <TextField label="Expected back" required type="date" value={etd} min={repair.sentDate} onChange={e => setEtd(e.target.value)} error={error} />
      <div className="flex flex-col gap-2.5">
        <Button icon={CalendarClock} onClick={save}>
          Save date
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}
