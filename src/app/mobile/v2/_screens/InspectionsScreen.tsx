'use client'

import React, { useMemo, useState } from 'react'
import { CircleCheck, CircleX, ClipboardCheck, Clock, Lock } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { Inspection } from '@/types/afms'
import { getLocalDateStr } from '@/lib/dateUtils'
import { myInspections } from '@/lib/fieldWork'
import { assetFor, dueText, placeText, shortDate } from '@/lib/fieldTasks'
import { inspectionCounts, inspectionLock, inspectionsFor, type InspectionFilter } from '@/lib/fieldInspections'
import { EmptyState, FilterChips, ResultPill, SummaryTile, WorkCard, WorkStatusPill } from '@/components/field'

// Inspections assigned to this person (redesign canvas, "Inspections"): what
// is to do, what passed, what found a defect. One not yet in its window says
// when it opens.
export function InspectionsScreen({ onOpen }: { onOpen: (insp: Inspection) => void }) {
  const { currentUser, inspections, checklistTemplates, assets, rooms, buildings } = useAFMS()
  const [filter, setFilter] = useState<InspectionFilter>('To do')

  const mine = useMemo(() => myInspections(inspections, currentUser), [inspections, currentUser])
  const counts = useMemo(() => inspectionCounts(mine, getLocalDateStr()), [mine])
  const shown = useMemo(() => inspectionsFor(mine, filter), [mine, filter])
  const now = new Date()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="m-0 text-[26px] font-bold leading-tight">Inspections</h1>
        <p className="m-0 text-base text-fa-text-2">Assigned to you</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <SummaryTile count={counts.todo} label="To do" icon={ClipboardCheck} tint="insp" pressed={filter === 'To do'} onClick={() => setFilter('To do')} />
        <SummaryTile count={counts.overdue} label="Overdue" icon={Clock} tint="danger" />
        <SummaryTile count={counts.passed} label="Passed" icon={CircleCheck} tint="success" pressed={filter === 'Passed'} onClick={() => setFilter('Passed')} />
        <SummaryTile count={counts.defects} label="Defects found" icon={CircleX} tint="danger" pressed={filter === 'Defects'} onClick={() => setFilter('Defects')} />
      </div>

      <FilterChips
        label="Show"
        value={filter}
        onChange={setFilter}
        chips={[
          { value: 'To do', label: 'To do', count: counts.todo },
          { value: 'Passed', label: 'Passed', count: counts.passed },
          { value: 'Defects', label: 'Defects', count: counts.defects },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={filter === 'To do' ? 'Nothing to inspect' : filter === 'Passed' ? 'No passed inspections yet' : 'No defects found'}>
          {filter === 'To do' ? 'Inspections assigned to you show up here and on the bell.' : 'Inspections you complete show here.'}
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Inspections">
          {shown.map(insp => {
            const asset = assetFor(assets, insp.assetId)
            const room = rooms.find(r => r.id === asset?.roomId)
            const done = insp.status === 'Completed'
            const due = done ? { text: `Done ${shortDate(insp.completedAt || insp.dueDate, now)}`, overdue: false } : dueText(insp.dueDate, now)
            const lock = inspectionLock(insp, checklistTemplates.find(t => t.id === insp.templateId)?.interval, now)
            return (
              <li key={insp.id}>
                <WorkCard
                  id={insp.inspectionNumber}
                  kind="Inspection"
                  title={asset?.name ?? 'Asset'}
                  assetId={asset?.assetId}
                  location={placeText(room, buildings) || undefined}
                  due={due}
                  badges={
                    done ? (
                      <ResultPill value={insp.result ?? 'Pending'} />
                    ) : (
                      <>
                        <WorkStatusPill value={insp.status} />
                        {due?.overdue ? <WorkStatusPill value="Overdue" /> : null}
                      </>
                    )
                  }
                  notice={
                    lock ? (
                      <p className="m-0 flex items-center gap-1.5 text-[15px] font-medium text-fa-text-2">
                        <Lock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                        Opens {lock.opensOn} · {lock.rule.replace('scheduled date', 'it’s due')}
                      </p>
                    ) : undefined
                  }
                  action={{
                    label: done ? 'View result' : insp.status === 'In Progress' ? 'Continue inspection' : 'Start inspection',
                    variant: done ? 'secondary' : 'primary',
                    disabled: !!lock,
                    onClick: () => onOpen(insp),
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
