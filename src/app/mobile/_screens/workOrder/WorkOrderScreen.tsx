'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Camera, CheckCheck, CircleCheck, ClipboardList, Flag, Lock, Package, Phone, Save, SearchX, Truck, Wrench } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { WorkOrder, WorkOrderPartItem } from '@/types/afms'
import { getLocalDateStr } from '@/lib/dateUtils'
import {
  assetFor, checklistProgress, draftProblems, dueFact, jobDateText, whenText, jobKindOf, longDate, placeText, preventiveLock, type ChecklistResponses, type DraftField,
  type SaveIntent,
} from '@/lib/fieldTasks'
import { completionBlockedMessage } from '@/lib/outsideRepairState'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import {
  Button, Card, ChecklistRow, ConfirmSheet, ContractPill, EmptyState, PhotoCapture, PriorityPill, ScreenHeader, SegmentedControl, SelectField,
  StickyActionBar, TextAreaField, TextField, WorkStatusPill, type PhotoState,
} from '@/components/field'
import { usePhotoSlots } from '../usePhotoSlots'
import { AssetSummary, NoteSheet, PartsList, PhotoView, ReportedIssue, Step, StepError } from './Sections'
import { OutsideRepairCard } from './OutsideRepairCard'
import { CleaningTaskScreen } from './CleaningTaskScreen'

// One preventive or breakdown job, worked through on the phone (redesign
// canvas, WO-Preventive, WO-Corrective and "PM · Photo required to begin").
//
// Preventive: the on-site photo first -- it unlocks the checklist -- then the
// checklist, parts and the finish. Breakdown: who is fixing it (in-house or a
// vendor), the outside-repair timeline, and the resolution. The rules for
// saving are in fieldTasks.draftProblems; a finished job opens read-only.

export interface WorkOrderScreenProps {
  workOrderId: string
  onBack: () => void
  onSaved: (message: string) => void
  onToast: (message: string) => void
  // Whether there are unsaved changes, so leaving can ask first.
  onDirtyChange: (dirty: boolean) => void
}

export function WorkOrderScreen(props: WorkOrderScreenProps) {
  const { workOrders } = useAFMS()
  const wo = workOrders.find(w => w.id === props.workOrderId)
  if (!wo) {
    return (
      <>
        <ScreenHeader title="Work order" onBack={props.onBack} />
        <main className="flex-1 overflow-y-auto p-4">
          <EmptyState icon={SearchX} title="Work order not found" action={<Button block={false} onClick={props.onBack}>Go back</Button>}>
            It may have been reassigned or removed.
          </EmptyState>
        </main>
      </>
    )
  }
  // A fresh form per job; a cleaning task has its own screen.
  if (wo.type === 'Housekeeping') return <CleaningTaskScreen key={wo.id} wo={wo} {...props} />
  return <WorkOrderForm key={wo.id} wo={wo} {...props} />
}

const itemKey = (id: string) => `item:${id}`

function rowPhoto(state: PhotoState, onRetry: () => void) {
  if (state.status === 'empty') return undefined
  return { url: state.previewUrl, status: state.status, onRetry }
}

// A saved value on a finished job.
function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[15px] font-semibold">{label}</span>
      <p className="m-0 whitespace-pre-line text-[17px] leading-relaxed text-fa-text-2">{value?.trim() || '—'}</p>
    </div>
  )
}

function WorkOrderForm({ wo, onBack, onSaved, onToast, onDirtyChange }: WorkOrderScreenProps & { wo: WorkOrder }) {
  const { assets, rooms, buildings, vendors, serviceRequests, inspections, outsideRepairs, updateWorkOrderStatus } = useAFMS()
  const asset = assetFor(assets, wo.assetId)
  const room = rooms.find(r => r.id === (asset?.roomId ?? wo.roomId))
  const items = useMemo(() => [...(wo.checklistSnapshot ?? [])].sort((a, b) => a.order - b.order), [wo.checklistSnapshot])
  const preventive = wo.type === 'Preventive'
  const lock = preventiveLock(wo)
  const finished = wo.status === 'Completed' || wo.status === 'Cancelled'
  const readOnly = finished || !!lock
  const number = isPendingWorkOrder(wo.woNumber) ? 'Work order' : wo.woNumber

  // ---- The draft ----
  const [mode, setMode] = useState<'In House' | 'Vendor'>(wo.executedBy || (wo.vendorId ? 'Vendor' : 'In House'))
  const [responses, setResponses] = useState<ChecklistResponses>(() =>
    Object.fromEntries(items.map(i => [i.id, { value: wo.checklistResponses?.[i.id]?.value === true, remarks: wo.checklistResponses?.[i.id]?.remarks ?? '' }])),
  )
  const [remarks, setRemarks] = useState(wo.technicianRemarks ?? '')
  const [issue, setIssue] = useState(wo.issueLogged ?? '')
  const [solution, setSolution] = useState(wo.solutionTaken ?? '')
  const [parts, setParts] = useState<WorkOrderPartItem[]>(wo.partsReplaced ?? [])
  const [vendorId, setVendorId] = useState(wo.vendorId || asset?.maintenanceVendorId || '')
  const [ticket, setTicket] = useState(wo.vendorTicketNo ?? '')
  const [engineer, setEngineer] = useState(wo.vendorTechName ?? '')
  const [engineerPhone, setEngineerPhone] = useState(wo.vendorTechPhone ?? '')
  const [visitDate, setVisitDate] = useState(wo.vendorServiceDate || getLocalDateStr())
  const [cost, setCost] = useState(wo.vendorCost === undefined ? '' : String(wo.vendorCost))
  const [vendorRemarks, setVendorRemarks] = useState(wo.vendorRemarks ?? '')
  const photos = usePhotoSlots(
    {
      start: wo.startPhotoUrl,
      completion: wo.completionPhotoUrl,
      jobSheet: wo.vendorJobSheetUrl,
      ...Object.fromEntries(items.map(i => [itemKey(i.id), wo.checklistResponses?.[i.id]?.photoUrl])),
    },
    onToast,
  )

  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<SaveIntent | null>(null)
  const [confirming, setConfirming] = useState(false)

  const vendorJob = wo.type === 'Corrective' && mode === 'Vendor'
  const startUploaded = !!photos.urlOf('start')

  // Unsaved changes: everything typed or photographed, compared with the job as opened.
  const draftKey = JSON.stringify([
    mode, responses, remarks, issue, solution, parts, vendorId, ticket, engineer, engineerPhone, visitDate, cost, vendorRemarks,
    ['start', 'completion', 'jobSheet', ...items.map(i => itemKey(i.id))].map(photos.urlOf),
  ])
  const [openedKey] = useState(draftKey)
  const dirty = !readOnly && (draftKey !== openedKey || photos.uploading > 0 || photos.failed > 0)
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const draft = {
    type: wo.type,
    mode,
    startPhoto: photos.urlOf('start'),
    completionPhoto: photos.urlOf('completion'),
    vendorId,
    vendorTicketNo: ticket,
    uploading: photos.uploading,
    failed: photos.failed,
    completionBlocked: completionBlockedMessage(outsideRepairs, wo.id),
  }
  // Once a save has been tried, problems show where they are, and clear as they are fixed.
  const problems = attempt ? draftProblems(draft, attempt) : []
  const err = (f: DraftField) => problems.find(p => p.field === f)?.message

  const tryIntent = (intent: SaveIntent) => {
    setAttempt(intent)
    const found = draftProblems(draft, intent)
    if (found.length) {
      document.getElementById(`wo-${found[0].field}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (intent === 'Completed') setConfirming(true)
    else save('In Progress')
  }

  const save = (intent: SaveIntent) => {
    const extra: Partial<WorkOrder> = {
      startPhotoUrl: photos.urlOf('start') || undefined,
      completionPhotoUrl: photos.urlOf('completion') || undefined,
      executedBy: wo.type === 'Corrective' ? mode : 'In House',
      issueLogged: issue.trim(),
      solutionTaken: solution.trim(),
      partsReplaced: parts,
    }
    if (preventive) {
      extra.checklistResponses = Object.fromEntries(
        items.map(i => [i.id, { ...responses[i.id], photoUrl: photos.urlOf(itemKey(i.id)) || undefined }]),
      )
    }
    if (vendorJob) {
      Object.assign(extra, {
        vendorId,
        vendorTicketNo: ticket.trim(),
        vendorTechName: engineer.trim(),
        vendorTechPhone: engineerPhone.trim(),
        vendorServiceDate: visitDate,
        vendorJobSheetUrl: photos.urlOf('jobSheet') || undefined,
        vendorRemarks: vendorRemarks.trim(),
        vendorCost: cost.trim() === '' ? undefined : Math.max(0, Number(cost)),
      })
    }
    setConfirming(false)
    // Refused (with its own message) when the window is shut or a part is still out.
    if (!updateWorkOrderStatus(wo.id, intent, remarks.trim(), extra)) return
    onDirtyChange(false)
    onSaved(intent === 'Completed' ? `${number} completed` : `${number} saved as in progress`)
  }

  // ---- What the screen shows ----
  const due = jobDateText(wo)
  const dueLine = dueFact(wo)
  const vendor = vendors.find(v => v.id === vendorId)
  const amcActive = !!vendor?.hasAmc && (!vendor.amcEndDate || vendor.amcEndDate >= getLocalDateStr())
  const progress = checklistProgress(items, responses)
  // A breakdown raised from a request links to it by ticket number (older rows: by id).
  const sr = serviceRequests.find(s => (wo.sourceRefId && (s.ticketId === wo.sourceRefId || s.id === wo.sourceRefId)) || s.workOrderId === wo.id)
  const failedInspection = wo.source === 'Failed Inspection' ? inspections.find(i => i.id === wo.sourceRefId) : undefined
  const warranty = asset?.warrantyTill
    ? asset.warrantyTill < getLocalDateStr()
      ? { value: `Expired ${longDate(asset.warrantyTill)}`, tone: 'danger' as const }
      : { value: `Till ${longDate(asset.warrantyTill)}` }
    : { value: 'None recorded' }

  const photoSlot = (key: string, label: string, opts: { required?: boolean; note?: string } = {}) =>
    readOnly ? (
      <PhotoView label={label} url={photos.urlOf(key)} />
    ) : (
      <PhotoCapture label={label} state={photos.stateOf(key)} required={opts.required} note={opts.note} onTake={() => photos.take(key)} onRetry={() => photos.retry(key)} />
    )

  const textArea = (label: string, value: string, set: (v: string) => void, placeholder: string, required?: boolean) =>
    readOnly ? <Fact label={label} value={value} /> : <TextAreaField label={label} required={required} rows={3} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} />

  return (
    <>
      {photos.input}
      <ScreenHeader kicker={`${number} · ${jobKindOf(wo)}`} title={wo.title || asset?.name || 'Work order'} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        <AssetSummary
          kind={preventive ? 'Preventive' : 'Breakdown'}
          name={asset?.name ?? 'Room equipment'}
          code={asset?.assetId}
          place={placeText(room, buildings) || undefined}
          pills={
            <>
              <PriorityPill value={wo.priority ?? 'Medium'} />
              <WorkStatusPill value={wo.status} />
              {due?.overdue ? <WorkStatusPill value="Overdue" /> : null}
            </>
          }
          facts={
            preventive
              ? [
                  dueLine,
                  { label: 'Schedule', value: wo.frequency ? `${wo.frequency} service` : undefined },
                  { label: 'Last done', value: longDate(asset?.lastServicedDate) || undefined },
                  { label: 'Model', value: asset?.modelNumber },
                ]
              : [
                  dueLine,
                  { label: 'Model', value: asset?.modelNumber },
                  { label: 'Warranty', ...warranty },
                ]
          }
        />

        {finished ? (
          <Card className="flex-row items-center gap-3 border-fa-success-weak bg-fa-success-weak">
            <CircleCheck className="h-6 w-6 shrink-0 text-fa-success" strokeWidth={2.25} aria-hidden />
            <p className="m-0 text-base font-semibold text-fa-success">
              {wo.status === 'Completed' ? `Completed${wo.completedAt ? ` on ${longDate(wo.completedAt)}` : ''}. This record can’t be changed.` : 'This job was cancelled.'}
            </p>
          </Card>
        ) : lock ? (
          <Card className="flex-row items-start gap-3 border-fa-warning-weak bg-fa-warning-weak">
            <Lock className="mt-0.5 h-6 w-6 shrink-0 text-fa-warning-ink" strokeWidth={2.25} aria-hidden />
            <div>
              <p className="m-0 text-base font-semibold text-fa-warning-ink">Opens on {lock.opensOn}</p>
              <p className="m-0 text-[15px] text-fa-warning-ink">Preventive work can start {lock.rule.replace('scheduled date', 'it’s due')}. Until then you can look, not save.</p>
            </div>
          </Card>
        ) : null}

        {sr ? (
          <ReportedIssue
            ticket={sr.ticketId}
            text={sr.description || sr.title}
            who={`${sr.requestedBy}${sr.requestedByRole ? ` · ${sr.requestedByRole}` : ''}`}
            when={`Raised ${whenText(sr.createdAt)}${sr.slaDueDate ? ` · fix by ${whenText(sr.slaDueDate)}` : ''}`}
          />
        ) : failedInspection ? (
          <ReportedIssue ticket={failedInspection.inspectionNumber} text={wo.issueLogged || wo.title || 'Raised by a failed inspection.'} who="Failed inspection" />
        ) : null}

        {preventive ? (
          <>
            <Step id="wo-startPhoto" icon={Camera} title="1. Start on site">
              {photoSlot('start', 'Photo with the asset on site', { required: true, note: 'Needed before you can begin servicing' })}
              <StepError>{err('startPhoto')}</StepError>
            </Step>

            <Step
              icon={ClipboardList}
              title="2. Checklist"
              aside={progress.total ? <span className="text-[15px] font-semibold tabular-nums text-fa-text-2">{progress.done} of {progress.total}</span> : undefined}
            >
              {progress.total ? (
                <>
                  <div role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress" className="h-2 rounded-full bg-fa-sunken">
                    <div className="h-2 rounded-full bg-fa-success transition-[width]" style={{ width: `${progress.percent}%` }} />
                  </div>
                  {!readOnly && !startUploaded ? (
                    <p className="m-0 flex items-center gap-1.5 rounded-lg bg-fa-sunken px-3 py-2.5 text-[15px] text-fa-text-2">
                      <Lock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      Take the on-site photo above to unlock the checklist.
                    </p>
                  ) : null}
                  <div>
                    {items.map(item => {
                      const r = responses[item.id] ?? { value: false }
                      const key = itemKey(item.id)
                      const off = readOnly || !startUploaded
                      return (
                        <ChecklistRow
                          key={item.id}
                          label={item.itemText}
                          done={r.value === true}
                          disabled={off}
                          onToggle={() => setResponses(prev => ({ ...prev, [item.id]: { ...prev[item.id], value: !(prev[item.id]?.value === true) } }))}
                          note={r.remarks || undefined}
                          photo={rowPhoto(photos.stateOf(key), () => photos.retry(key))}
                          onNote={off ? undefined : () => setNoteFor(item.id)}
                          onPhoto={off ? undefined : () => photos.take(key)}
                        />
                      )
                    })}
                  </div>
                </>
              ) : (
                <p className="m-0 text-[15px] text-fa-text-2">This job has no checklist. Write what you did under Finish.</p>
              )}
            </Step>

            <Step icon={Package} title="3. Parts used">
              <PartsList parts={parts} onChange={setParts} readOnly={readOnly} />
            </Step>

            <Step icon={Flag} title="4. Finish">
              {textArea('Completion notes', remarks, setRemarks, 'What was serviced, readings taken, anything to watch')}
              {photoSlot('completion', 'Completion proof photo')}
            </Step>
          </>
        ) : (
          <>
            {readOnly ? (
              <Card className="gap-1">
                <span className="text-sm text-fa-text-2">Who fixed it</span>
                <span className="text-[17px] font-semibold">{mode === 'Vendor' ? `Vendor · ${vendor?.name ?? '—'}` : 'In-house'}</span>
              </Card>
            ) : (
              <Card className="gap-3">
                <h2 className="m-0 text-lg font-bold">Who is fixing it?</h2>
                <SegmentedControl
                  label="Who is fixing it"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'In House', label: 'In-house', icon: Wrench },
                    { value: 'Vendor', label: 'Vendor', icon: Truck },
                  ]}
                />
              </Card>
            )}

            {vendorJob ? (
              <Step id="wo-vendorId" icon={Truck} title="Vendor">
                {readOnly ? null : (
                  <SelectField
                    label="Vendor"
                    required
                    placeholder="Choose the vendor"
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                    error={err('vendorId')}
                    options={vendors.map(v => ({ value: v.id, label: v.name }))}
                  />
                )}
                {vendor ? (
                  <div className="flex flex-col gap-2.5 rounded-xl bg-fa-sunken p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1 text-[17px] font-semibold">{vendor.name}</span>
                      <ContractPill value={amcActive ? 'amc' : 'onDemand'} />
                    </div>
                    {amcActive && vendor.amcEndDate ? <span className="text-sm text-fa-text-2">AMC till {longDate(vendor.amcEndDate)}</span> : null}
                    {vendor.phone ? (
                      <a
                        href={`tel:${vendor.phone.replace(/\s+/g, '')}`}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-fa-border-strong bg-fa-surface px-4 text-[17px] font-semibold text-fa-text no-underline hover:bg-fa-sunken"
                      >
                        <Phone className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                        Call vendor
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {readOnly ? (
                  <>
                    <Fact label="Vendor’s job no." value={ticket} />
                    <Fact label="Visit date" value={longDate(visitDate)} />
                    <Fact label="Engineer" value={[engineer, engineerPhone].filter(Boolean).join(' · ')} />
                    <Fact label="Vendor cost" value={cost ? `₹${Number(cost).toLocaleString('en-IN')}` : ''} />
                    <Fact label="Remarks / parts replaced" value={vendorRemarks} />
                  </>
                ) : (
                  <>
                    <div id="wo-vendorTicketNo" className="scroll-mt-4">
                      <TextField
                        label="Vendor’s job no."
                        value={ticket}
                        onChange={e => setTicket(e.target.value)}
                        placeholder="e.g. VND-JOB-8841"
                        hint="Needed to complete the job."
                        error={err('vendorTicketNo')}
                      />
                    </div>
                    <TextField label="Visit date" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="Engineer name" value={engineer} onChange={e => setEngineer(e.target.value)} />
                      <TextField label="Engineer phone" type="tel" inputMode="tel" value={engineerPhone} onChange={e => setEngineerPhone(e.target.value)} />
                    </div>
                    <TextField
                      label="Vendor cost (₹)"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={cost}
                      onChange={e => setCost(e.target.value)}
                      placeholder="0"
                      hint={amcActive ? 'Items covered by the AMC are ₹0.' : undefined}
                    />
                    <TextAreaField label="Remarks / parts replaced" rows={3} value={vendorRemarks} onChange={e => setVendorRemarks(e.target.value)} placeholder="Vendor’s diagnosis, parts they supplied, warranty" />
                  </>
                )}
                {photoSlot('jobSheet', 'Vendor’s job sheet')}
              </Step>
            ) : (
              <Step id="wo-startPhoto" icon={Camera} title="Start on site">
                {photoSlot('start', 'Photo with the asset on site', { required: true, note: 'Needed to complete the job' })}
                <StepError>{err('startPhoto')}</StepError>
              </Step>
            )}

            <div id="wo-outsideRepair" className="scroll-mt-4">
              <OutsideRepairCard workOrder={wo} readOnly={readOnly} onToast={onToast} />
              <StepError>{err('outsideRepair')}</StepError>
            </div>

            <Step id="wo-completionPhoto" icon={CircleCheck} title="Resolution">
              {textArea('Problem found', issue, setIssue, 'e.g. Capacitor blown, drain line blocked')}
              {textArea('Solution taken', solution, setSolution, 'What was repaired, replaced or adjusted')}
              <div className="flex flex-col gap-2">
                <span className="text-[15px] font-semibold">Parts used</span>
                <PartsList parts={parts} onChange={setParts} readOnly={readOnly} />
              </div>
              {photoSlot('completion', 'After repair', vendorJob ? {} : { required: true, note: 'Needed to complete the job' })}
              <StepError>{err('completionPhoto')}</StepError>
            </Step>
          </>
        )}
      </main>

      {!readOnly ? (
        <StickyActionBar>
          {problems.length ? (
            <p role="alert" className="m-0 text-[15px] font-medium text-fa-danger">
              {problems.length === 1 ? problems[0].message : `${problems.length} things to fix first — shown in red above.`}
            </p>
          ) : null}
          <Button icon={CheckCheck} onClick={() => tryIntent('Completed')}>
            Complete &amp; close
          </Button>
          <Button variant="secondary" size="md" icon={Save} onClick={() => tryIntent('In Progress')}>
            Save as in progress
          </Button>
        </StickyActionBar>
      ) : null}

      {noteFor ? (
        <NoteSheet
          step={items.find(i => i.id === noteFor)?.itemText ?? ''}
          value={responses[noteFor]?.remarks ?? ''}
          onClose={() => setNoteFor(null)}
          onSave={text => {
            setResponses(prev => ({ ...prev, [noteFor]: { ...prev[noteFor], value: prev[noteFor]?.value === true, remarks: text } }))
            setNoteFor(null)
          }}
        />
      ) : null}

      {confirming ? (
        <ConfirmSheet
          title={`Complete ${number}?`}
          body={`It moves to Completed and can’t be changed after this.${preventive ? ` ${progress.total - progress.done ? `${progress.total - progress.done} checklist step${progress.total - progress.done === 1 ? ' is' : 's are'} not ticked.` : ''}` : ''}`}
          icon={CheckCheck}
          confirmLabel="Complete & close"
          onConfirm={() => save('Completed')}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  )
}
