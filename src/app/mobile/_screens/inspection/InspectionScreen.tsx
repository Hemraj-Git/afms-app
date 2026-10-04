'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Camera, CircleCheck, CircleX, ClipboardCheck, Flag, Lock, SearchX, Send, Wrench } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { Inspection } from '@/types/afms'
import { assetFor, dueFact, placeText, shortDate, whenText } from '@/lib/fieldTasks'
import {
  answerOf, checkpointsFor, inspectionLock, inspectionProblems, inspectionRemarks, previousResult, resultOf,
} from '@/lib/fieldInspections'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import {
  Button, Card, CardTitle, CheckpointCard, ConfirmSheet, EmptyState, PhotoCapture, ResultPill, ScreenHeader, StickyActionBar, TextAreaField,
  WorkStatusPill, cn,
} from '@/components/field'
import { usePhotoSlots } from '../usePhotoSlots'
import { AssetSummary, OfficeNotes, PhotoView, StepError } from '../workOrder/Sections'

// An inspection on the phone (redesign canvas, "Inspection run" and
// "Inspection result"). Until it is submitted: PASS or FAIL per checkpoint,
// what is wrong with a failure, the photos, then Submit. Afterwards the same
// screen shows the result -- and, for a failure, the breakdown job it raised.

export interface InspectionScreenProps {
  inspectionId: string
  onBack: () => void
  onToast: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
}

export function InspectionScreen(props: InspectionScreenProps) {
  const { inspections } = useAFMS()
  const insp = inspections.find(i => i.id === props.inspectionId)
  if (!insp) {
    return (
      <>
        <ScreenHeader title="Inspection" onBack={props.onBack} />
        <main className="flex-1 overflow-y-auto p-4">
          <EmptyState icon={SearchX} title="Inspection not found" action={<Button block={false} onClick={props.onBack}>Back to inspections</Button>}>
            It may have been reassigned or removed.
          </EmptyState>
        </main>
      </>
    )
  }
  if (insp.status === 'Completed') return <InspectionResult insp={insp} onBack={props.onBack} />
  return <InspectionRun key={insp.id} insp={insp} {...props} />
}

function useInspectionContext(insp: Inspection) {
  const { inspections, checklistTemplates, assets, rooms, buildings } = useAFMS()
  const asset = assetFor(assets, insp.assetId)
  const room = rooms.find(r => r.id === asset?.roomId)
  const template = checklistTemplates.find(t => t.id === insp.templateId)
  const items = useMemo(() => checkpointsFor(insp, checklistTemplates), [insp, checklistTemplates])
  const last = previousResult(inspections, insp)
  return { asset, room, buildings, template, items, last }
}

function InspectionRun({ insp, onBack, onToast, onDirtyChange }: InspectionScreenProps & { insp: Inspection }) {
  const { completeInspection } = useAFMS()
  const { asset, room, buildings, template, items, last } = useInspectionContext(insp)
  const lock = inspectionLock(insp, template?.interval)
  const readOnly = !!lock

  const [answers, setAnswers] = useState<Record<string, 'Pass' | 'Fail' | undefined>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [overall, setOverall] = useState('')
  const photos = usePhotoSlots({}, onToast)
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const answered = items.filter(i => answers[i.id]).length
  // The checkpoints open once the photo at the asset has uploaded.
  const started = !!photos.urlOf('start')
  const dirty = !readOnly && (answered > 0 || overall.trim() !== '' || Object.values(notes).some(n => n.trim()) || items.some(i => photos.has(i.id)) || photos.has('start') || photos.has('end'))
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const draft = {
    items,
    answers,
    notes,
    photos: Object.fromEntries(items.map(i => [i.id, !!photos.urlOf(i.id)])),
    startPhoto: !!photos.urlOf('start'),
    endPhoto: !!photos.urlOf('end'),
    uploading: photos.uploading,
    failed: photos.failed,
  }
  const problems = tried ? inspectionProblems(draft) : []
  const problemsFor = (id: string) => problems.filter(p => p.field === id).map(p => p.message)
  const result = resultOf(answers)
  const failures = items.filter(i => answers[i.id] === 'Fail').length

  const trySubmit = () => {
    setTried(true)
    const found = inspectionProblems(draft)
    if (found.length) {
      document.getElementById(`insp-${found[0].field}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setConfirming(true)
  }

  const submit = () => {
    const responses = Object.fromEntries(
      items.filter(i => answers[i.id]).map(i => [i.id, notes[i.id]?.trim() ? { value: answers[i.id], remarks: notes[i.id].trim() } : { value: answers[i.id] }]),
    )
    const itemPhotos = Object.fromEntries(items.map(i => [i.id, photos.urlOf(i.id)]).filter(([, url]) => url))
    setConfirming(false)
    onDirtyChange(false)
    completeInspection(
      insp.id,
      result,
      inspectionRemarks(items, answers, notes, overall),
      responses,
      photos.urlOf('end') || undefined,
      Object.keys(itemPhotos).length ? itemPhotos : undefined,
      photos.urlOf('start') || undefined,
    )
    onToast(`${insp.inspectionNumber} submitted`)
  }

  const fact = dueFact({ status: insp.status === 'In Progress' ? 'In Progress' : 'Scheduled', dueDate: insp.dueDate })

  return (
    <>
      {photos.input}
      <ScreenHeader kicker={insp.inspectionNumber} title={template?.title ?? 'Inspection'} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 gap-3.5 overflow-y-auto p-4">
        <AssetSummary
          kind="Inspection"
          name={asset?.name ?? 'Asset'}
          code={asset?.assetId}
          place={placeText(room, buildings) || undefined}
          pills={
            <>
              <WorkStatusPill value={insp.status} />
              {fact.tone === 'danger' ? <WorkStatusPill value="Overdue" /> : null}
            </>
          }
          facts={[
            { label: 'Template', value: template?.title },
            fact,
            { label: 'Last result', value: last ? `${last.result === 'Pass' ? 'PASS' : 'FAIL'} · ${shortDate(last.completedAt || last.dueDate)}` : 'First inspection' },
            { label: 'Serial', value: asset?.serialNumber },
          ]}
        />

        <OfficeNotes instructions={insp.instructions} />

        {lock ? (
          <Card className="flex-row items-start gap-3 border-fa-warning-weak bg-fa-warning-weak">
            <Lock className="mt-0.5 h-6 w-6 shrink-0 text-fa-warning-ink" strokeWidth={2.25} aria-hidden />
            <div>
              <p className="m-0 text-base font-semibold text-fa-warning-ink">Opens on {lock.opensOn}</p>
              <p className="m-0 text-[15px] text-fa-warning-ink">This inspection can be done {lock.rule.replace('scheduled date', 'it’s due')}. Until then you can look, not submit.</p>
            </div>
          </Card>
        ) : null}

        {!readOnly ? (
          <Card id="insp-start" className="scroll-mt-4 gap-3">
            <CardTitle icon={Camera}>1. Start at the asset</CardTitle>
            <PhotoCapture
              label="Photo at the asset"
              required
              note="Needed before you can start the checkpoints"
              state={photos.stateOf('start')}
              onTake={() => photos.take('start')}
              onRetry={() => photos.retry('start')}
            />
            <StepError>{problemsFor('start').join(' ')}</StepError>
          </Card>
        ) : null}

        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
          <h2 className="m-0 flex-1 text-lg font-bold">2. Checkpoints</h2>
          <span className="text-[15px] font-semibold tabular-nums text-fa-text-2">
            {answered} of {items.length} answered
          </span>
        </div>

        {items.length === 0 ? <p className="m-0 text-[15px] text-fa-text-2">This inspection has no checkpoints. Add your observations below.</p> : null}
        {!readOnly && !started && items.length ? (
          <p className="m-0 flex items-center gap-1.5 rounded-lg bg-fa-sunken px-3 py-2.5 text-[15px] text-fa-text-2">
            <Lock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Take the photo at the asset above to start the checkpoints.
          </p>
        ) : null}

        {items.map((item, i) => {
          const answer = answers[item.id] ?? null
          const itemProblems = problemsFor(item.id)
          const showPhoto = item.photoRequired || answer === 'Fail'
          return (
            <div key={item.id} id={`insp-${item.id}`} className="scroll-mt-4">
              <CheckpointCard
                number={i + 1}
                label={item.itemText}
                photoRequired={item.photoRequired}
                result={answer}
                disabled={readOnly || !started}
                onResult={r => setAnswers(prev => ({ ...prev, [item.id]: r }))}
              >
                {answer === 'Fail' ? (
                  <TextAreaField
                    label="What is wrong?"
                    required
                    rows={2}
                    value={notes[item.id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="e.g. Hairline crack near the horn coupling"
                    error={itemProblems.includes('Say what is wrong.') ? 'Say what is wrong.' : undefined}
                  />
                ) : null}
                {showPhoto && !readOnly && started ? (
                  <PhotoCapture
                    label="Photo of this checkpoint"
                    required={item.photoRequired}
                    state={photos.stateOf(item.id)}
                    onTake={() => photos.take(item.id)}
                    onRetry={() => photos.retry(item.id)}
                  />
                ) : null}
                <StepError>{itemProblems.filter(m => m !== 'Say what is wrong.').join(' ')}</StepError>
              </CheckpointCard>
            </div>
          )
        })}

        <Card id="insp-end" className="scroll-mt-4 gap-3">
          <CardTitle icon={Flag}>3. Finish</CardTitle>
          <TextAreaField
            label="Observations"
            rows={3}
            value={overall}
            onChange={e => setOverall(e.target.value)}
            placeholder="Anything else you noticed"
            disabled={readOnly}
          />
          {!readOnly ? (
            <PhotoCapture
              label="Photo at the end"
              required
              note="Needed to submit the inspection"
              state={photos.stateOf('end')}
              onTake={() => photos.take('end')}
              onRetry={() => photos.retry('end')}
            />
          ) : null}
          <StepError>{[...problemsFor('end'), ...problemsFor('photos')].join(' ')}</StepError>
        </Card>
      </main>

      {!readOnly ? (
        <StickyActionBar>
          {problems.length ? (
            <p role="alert" className="m-0 text-[15px] font-medium text-fa-danger">
              {problems.length === 1 ? problems[0].message : `${problems.length} things to fix first — shown in red above.`}
            </p>
          ) : null}
          <Button icon={Send} onClick={trySubmit}>
            Submit &amp; complete
          </Button>
        </StickyActionBar>
      ) : null}

      {confirming ? (
        <ConfirmSheet
          title={result === 'Fail' ? 'Submit as FAILED?' : 'Submit as PASSED?'}
          body={
            result === 'Fail'
              ? `${failures} of ${items.length} checkpoint${items.length === 1 ? '' : 's'} failed. A breakdown job will be raised for the maintenance team. You can’t change the answers after this.`
              : `All answered checkpoints passed. You can’t change the answers after this.`
          }
          icon={result === 'Fail' ? CircleX : CircleCheck}
          tone={result === 'Fail' ? 'destructive' : 'primary'}
          confirmLabel="Submit & complete"
          onConfirm={submit}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  )
}

function InspectionResult({ insp, onBack }: { insp: Inspection; onBack: () => void }) {
  const { workOrders } = useAFMS()
  const { asset, template, items } = useInspectionContext(insp)
  const failed = insp.result === 'Fail'
  const answers = items.map(i => ({ item: i, ...answerOf(insp.checklistResponses?.[i.id]) }))
  const failures = answers.filter(a => a.result === 'Fail').length
  // The breakdown job a failure raised, if this person can see it (it is
  // usually still waiting for a technician).
  // completedAt is a plain date on most records; a time only when there is one.
  const submitted = insp.completedAt ? (insp.completedAt.length <= 10 ? shortDate(insp.completedAt) : whenText(insp.completedAt)) : ''
  const followUp = workOrders.find(w => w.source === 'Failed Inspection' && w.sourceRefId === insp.inspectionNumber)

  return (
    <>
      <ScreenHeader kicker={`${insp.inspectionNumber} · Result`} title={asset?.name ?? template?.title ?? 'Inspection'} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 gap-3.5 overflow-y-auto p-4">
        <section
          className={cn(
            'flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-6 text-center',
            failed ? 'border-fa-danger bg-fa-danger-weak' : 'border-fa-success bg-fa-success-weak',
          )}
        >
          {failed ? (
            <CircleX className="h-12 w-12 text-fa-danger" strokeWidth={2} aria-hidden />
          ) : (
            <CircleCheck className="h-12 w-12 text-fa-success" strokeWidth={2} aria-hidden />
          )}
          <h2 className={cn('m-0 text-[28px] font-bold tracking-[0.04em]', failed ? 'text-fa-danger' : 'text-fa-success')}>{failed ? 'FAILED' : 'PASSED'}</h2>
          <p className="m-0 text-[17px] leading-relaxed text-fa-text">
            {failed
              ? `${failures || 'A'} of ${items.length} checkpoint${items.length === 1 ? '' : 's'} failed. A breakdown job was raised for the maintenance team.`
              : `All ${items.length} checkpoint${items.length === 1 ? '' : 's'} passed.`}
          </p>
          <p className="m-0 text-sm text-fa-text-2">
            Submitted {submitted}
            {insp.assignedInspectorName ? ` by ${insp.assignedInspectorName}` : ''}
          </p>
        </section>

        {items.length ? (
          <Card className="gap-0 py-2">
            <CardTitle as="h3">Checkpoint results</CardTitle>
            <ol className="m-0 mt-1 flex list-none flex-col p-0">
              {answers.map(({ item, result, note }, i) => (
                <li key={item.id} className="flex items-start gap-2.5 border-b border-fa-border py-3 last:border-b-0">
                  <span className="pt-0.5 font-plex-mono text-sm text-fa-text-2">{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-base leading-snug">{item.itemText}</span>
                    {note ? <span className="text-[15px] text-fa-danger">{note}</span> : null}
                    {insp.itemPhotos?.[item.id] ? (
                      <a href={insp.itemPhotos[item.id]} target="_blank" rel="noreferrer" className="w-fit">
                        {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded photo */}
                        <img src={insp.itemPhotos[item.id]} alt={`Photo for ${item.itemText}`} className="h-14 w-14 rounded-lg object-cover" />
                      </a>
                    ) : null}
                  </div>
                  <ResultPill value={result ?? 'Pending'} />
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        {insp.startPhotoUrl || insp.photoUrl ? (
          <Card>
            <CardTitle as="h3" icon={Camera}>
              Photos
            </CardTitle>
            <PhotoView label="At the start" url={insp.startPhotoUrl} />
            <PhotoView label="At the end" url={insp.photoUrl} />
          </Card>
        ) : null}

        {insp.inspectorRemarks ? (
          <Card>
            <CardTitle as="h3">Observations</CardTitle>
            {insp.inspectorRemarks ? <p className="m-0 whitespace-pre-line text-[17px] leading-relaxed text-fa-text-2">{insp.inspectorRemarks}</p> : null}
          </Card>
        ) : null}

        {failed ? (
          <Card>
            <CardTitle as="h3" icon={Wrench}>
              Follow-up
            </CardTitle>
            {followUp ? (
              <p className="m-0 text-base">
                <span className="font-plex-mono text-sm text-fa-text-2">{isPendingWorkOrder(followUp.woNumber) ? 'Breakdown job' : followUp.woNumber}</span> ·{' '}
                {followUp.assignedTechnicianName ? `assigned to ${followUp.assignedTechnicianName}` : 'waiting for a technician'}
              </p>
            ) : (
              <p className="m-0 text-base text-fa-text-2">The maintenance team has the breakdown job and will assign a technician.</p>
            )}
          </Card>
        ) : null}

        <Button onClick={onBack}>Back to inspections</Button>
      </main>
    </>
  )
}
