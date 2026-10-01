'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Camera, CheckCheck, CircleCheck, ClipboardList, Save, Sparkles } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { WorkOrder } from '@/types/afms'
import { checklistProgress, draftProblems, dueFact, jobDateText, longDate, type ChecklistResponses, type DraftField, type SaveIntent } from '@/lib/fieldTasks'
import { HK_CHECKLIST_ITEMS, HK_SOLUTION } from '@/lib/housekeeping'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import {
  Button, Card, ChecklistRow, ConfirmSheet, PhotoCapture, PriorityPill, ScreenHeader, StickyActionBar, TextAreaField, WorkStatusPill, type PhotoState,
} from '@/components/field'
import { usePhotoSlots } from '../usePhotoSlots'
import { AssetSummary, NoteSheet, PhotoView, Step, StepError } from './Sections'

// One room to clean (redesign canvas, "Cleaning task"): a before photo, the
// sanitation checklist with a note and photo per step, then the after photo --
// which is what it takes to complete it. A finished task opens read-only.

const itemKey = (id: string) => `item:${id}`

function rowPhoto(state: PhotoState, onRetry: () => void) {
  if (state.status === 'empty') return undefined
  return { url: state.previewUrl, status: state.status, onRetry }
}

export function CleaningTaskScreen({
  wo,
  onBack,
  onSaved,
  onToast,
  onDirtyChange,
}: {
  wo: WorkOrder
  onBack: () => void
  onSaved: (message: string) => void
  onToast: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { rooms, buildings, updateWorkOrderStatus } = useAFMS()
  const room = rooms.find(r => r.id === wo.roomId)
  const building = buildings.find(b => b.id === room?.buildingId)?.name
  // The steps saved with the task, or the standard five for a new one.
  const items = useMemo(() => [...(wo.checklistSnapshot?.length ? wo.checklistSnapshot : HK_CHECKLIST_ITEMS)].sort((a, b) => a.order - b.order), [wo.checklistSnapshot])
  const readOnly = wo.status === 'Completed' || wo.status === 'Cancelled'
  const number = isPendingWorkOrder(wo.woNumber) ? 'Cleaning task' : wo.woNumber

  const [responses, setResponses] = useState<ChecklistResponses>(() =>
    Object.fromEntries(items.map(i => [i.id, { value: wo.checklistResponses?.[i.id]?.value === true, remarks: wo.checklistResponses?.[i.id]?.remarks ?? '' }])),
  )
  const [notes, setNotes] = useState(wo.technicianRemarks ?? '')
  const photos = usePhotoSlots(
    {
      start: wo.startPhotoUrl,
      completion: wo.completionPhotoUrl,
      ...Object.fromEntries(items.map(i => [itemKey(i.id), wo.checklistResponses?.[i.id]?.photoUrl])),
    },
    onToast,
  )
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<SaveIntent | null>(null)
  const [confirming, setConfirming] = useState(false)

  const draftKey = JSON.stringify([responses, notes, ['start', 'completion', ...items.map(i => itemKey(i.id))].map(photos.urlOf)])
  const [openedKey] = useState(draftKey)
  const dirty = !readOnly && (draftKey !== openedKey || photos.uploading > 0 || photos.failed > 0)
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const draft = {
    type: wo.type,
    mode: 'In House' as const,
    startPhoto: photos.urlOf('start'),
    completionPhoto: photos.urlOf('completion'),
    vendorId: '',
    vendorTicketNo: '',
    uploading: photos.uploading,
    failed: photos.failed,
  }
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
      executedBy: 'In House',
      checklistSnapshot: items,
      checklistResponses: Object.fromEntries(items.map(i => [i.id, { ...responses[i.id], photoUrl: photos.urlOf(itemKey(i.id)) || undefined }])),
    }
    if (intent === 'Completed') extra.solutionTaken = HK_SOLUTION
    setConfirming(false)
    if (!updateWorkOrderStatus(wo.id, intent, notes.trim(), extra)) return
    onDirtyChange(false)
    onSaved(intent === 'Completed' ? `${room?.name ?? number} is done` : `${number} saved as in progress`)
  }

  const due = jobDateText(wo)
  const progress = checklistProgress(items, responses)

  const photoSlot = (key: string, label: string, required?: boolean) =>
    readOnly ? (
      <PhotoView label={label} url={photos.urlOf(key)} />
    ) : (
      <PhotoCapture label={label} state={photos.stateOf(key)} required={required} onTake={() => photos.take(key)} onRetry={() => photos.retry(key)} />
    )

  return (
    <>
      {photos.input}
      <ScreenHeader kicker={`${number} · Housekeeping`} title={wo.title || room?.name || 'Cleaning task'} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        <AssetSummary
          kind="Cleaning"
          name={room?.name ?? 'Room'}
          code={room?.roomNumber}
          place={[building, room?.floor ? (/^\d+$/.test(room.floor) ? `Floor ${room.floor}` : `${room.floor} floor`) : ''].filter(Boolean).join(' · ') || undefined}
          pills={
            <>
              <PriorityPill value={wo.priority ?? 'Medium'} />
              <WorkStatusPill value={wo.status} />
              {due?.overdue ? <WorkStatusPill value="Overdue" /> : null}
            </>
          }
          facts={[dueFact(wo), { label: 'Checklist', value: `${items.length} steps` }]}
        />

        {readOnly ? (
          <Card className="flex-row items-center gap-3 border-fa-success-weak bg-fa-success-weak">
            <CircleCheck className="h-6 w-6 shrink-0 text-fa-success" strokeWidth={2.25} aria-hidden />
            <p className="m-0 text-base font-semibold text-fa-success">
              {wo.status === 'Completed' ? `Done${wo.completedAt ? ` on ${longDate(wo.completedAt)}` : ''}. This record can’t be changed.` : 'This task was cancelled.'}
            </p>
          </Card>
        ) : null}

        <Step id="wo-startPhoto" icon={Camera} title="1. Before cleaning">
          {photoSlot('start', 'Before cleaning photo')}
        </Step>

        <Step icon={ClipboardList} title="2. Checklist" aside={<span className="text-[15px] font-semibold tabular-nums text-fa-text-2">{progress.done} of {progress.total}</span>}>
          <div role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress" className="h-2 rounded-full bg-fa-sunken">
            <div className="h-2 rounded-full bg-fa-success transition-[width]" style={{ width: `${progress.percent}%` }} />
          </div>
          <div>
            {items.map(item => {
              const r = responses[item.id] ?? { value: false }
              const key = itemKey(item.id)
              return (
                <ChecklistRow
                  key={item.id}
                  label={item.itemText}
                  done={r.value === true}
                  disabled={readOnly}
                  onToggle={() => setResponses(prev => ({ ...prev, [item.id]: { ...prev[item.id], value: !(prev[item.id]?.value === true) } }))}
                  note={r.remarks || undefined}
                  photo={rowPhoto(photos.stateOf(key), () => photos.retry(key))}
                  onNote={readOnly ? undefined : () => setNoteFor(item.id)}
                  onPhoto={readOnly ? undefined : () => photos.take(key)}
                />
              )
            })}
          </div>
        </Step>

        <Step id="wo-completionPhoto" icon={Sparkles} title="3. After cleaning">
          {photoSlot('completion', 'After cleaning photo', true)}
          <StepError>{err('completionPhoto')}</StepError>
          {readOnly ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Notes</span>
              <p className="m-0 whitespace-pre-line text-[17px] text-fa-text-2">{notes.trim() || '—'}</p>
            </div>
          ) : (
            <TextAreaField label="Notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything to report: damage, missing supplies, a leak" />
          )}
        </Step>
      </main>

      {!readOnly ? (
        <StickyActionBar>
          {problems.length ? (
            <p role="alert" className="m-0 text-[15px] font-medium text-fa-danger">
              {problems.length === 1 ? problems[0].message : `${problems.length} things to fix first — shown in red above.`}
            </p>
          ) : null}
          <Button icon={CheckCheck} onClick={() => tryIntent('Completed')}>
            Complete sanitisation
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
          title={`Mark ${room?.name ?? 'this room'} as done?`}
          body={`It moves to Completed and can’t be changed after this.${progress.total - progress.done ? ` ${progress.total - progress.done} checklist step${progress.total - progress.done === 1 ? ' is' : 's are'} not ticked.` : ''}`}
          icon={CheckCheck}
          confirmLabel="Complete sanitisation"
          onConfirm={() => save('Completed')}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  )
}
