'use client'

import React, { useMemo, useState } from 'react'
import { CalendarClock, CircleCheck, ClipboardList, Lock, Package, Wrench } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { WorkOrder } from '@/types/afms'
import { technicianWorkOrders } from '@/lib/fieldWork'
import { assetFor, jobDateText, jobKindOf, placeText, preventiveLock, taskCounts, tasksFor, type TaskFilter } from '@/lib/fieldTasks'
import { isWithVendor } from '@/lib/workOrderState'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { workOrderRepairTag } from '@/lib/outsideRepairState'
import { EmptyState, FilterChips, SummaryTile, Tag, WithVendorTag, WorkCard, WorkStatusPill, cn } from '@/components/field'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const todayLong = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`

// Tasks, the technician's home (redesign canvas, "Tasks · Technician home"):
// the numbers, a filter, and a card per preventive or breakdown job assigned
// to them. A preventive job not yet in its window says when it opens.
export function TasksScreen({ onOpen }: { onOpen: (wo: WorkOrder) => void }) {
  const { currentUser, workOrders, assets, rooms, buildings, outsideRepairs } = useAFMS()
  const [filter, setFilter] = useState<TaskFilter>('All')

  const mine = useMemo(() => technicianWorkOrders(workOrders, currentUser), [workOrders, currentUser])
  const counts = useMemo(() => taskCounts(mine), [mine])
  const shown = useMemo(() => tasksFor(mine, filter), [mine, filter])
  const now = new Date()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="m-0 text-[26px] font-bold leading-tight">Tasks</h1>
        <p className="m-0 text-base text-fa-text-2">{todayLong(now)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <SummaryTile count={counts.open} label="Open work orders" icon={ClipboardList} tint="primary" pressed={filter === 'All'} onClick={() => setFilter('All')} />
        <SummaryTile count={counts.preventive} label="PM due" icon={CalendarClock} tint="warning" pressed={filter === 'Preventive'} onClick={() => setFilter('Preventive')} />
        <SummaryTile count={counts.corrective} label="Breakdowns" icon={Wrench} tint="danger" pressed={filter === 'Corrective'} onClick={() => setFilter('Corrective')} />
        <SummaryTile count={counts.completed} label="Completed" icon={CircleCheck} tint="success" pressed={filter === 'Completed'} onClick={() => setFilter('Completed')} />
      </div>

      <FilterChips
        label="Show"
        value={filter}
        onChange={setFilter}
        chips={[
          { value: 'All', label: 'All', count: counts.open },
          { value: 'Preventive', label: 'Preventive', count: counts.preventive },
          { value: 'Corrective', label: 'Corrective', count: counts.corrective },
          { value: 'Completed', label: 'Completed', count: counts.completed },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState icon={filter === 'Completed' ? CircleCheck : ClipboardList} title={filter === 'Completed' ? 'Nothing completed yet' : 'All caught up'}>
          {filter === 'Completed'
            ? 'Jobs you complete show here.'
            : filter === 'All'
              ? 'No open work is assigned to you. New jobs show up here and on the bell.'
              : `No open ${filter === 'Preventive' ? 'preventive' : 'breakdown'} jobs.`}
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Work orders">
          {shown.map(wo => {
            const asset = assetFor(assets, wo.assetId)
            const room = rooms.find(r => r.id === (asset?.roomId ?? wo.roomId))
            const due = jobDateText(wo, now)
            const lock = preventiveLock(wo, now)
            const repair = workOrderRepairTag(outsideRepairs, wo.id)
            const done = wo.status === 'Completed' || wo.status === 'Cancelled'
            return (
              <li key={wo.id}>
                <WorkCard
                  id={isPendingWorkOrder(wo.woNumber) ? 'Number pending' : wo.woNumber}
                  kind={jobKindOf(wo) as 'Preventive' | 'Breakdown'}
                  priority={wo.priority}
                  title={asset?.name ?? wo.title ?? 'Room equipment'}
                  assetId={asset?.assetId}
                  location={placeText(room, buildings) || undefined}
                  due={due}
                  badges={
                    <>
                      <WorkStatusPill value={wo.status} />
                      {due?.overdue ? <WorkStatusPill value="Overdue" /> : null}
                      {isWithVendor(wo) ? <WithVendorTag /> : null}
                      {repair ? (
                        <Tag icon={Package} className={cn(repair.overdue && 'bg-fa-danger-weak text-fa-danger')}>
                          {repair.overdue ? 'Overdue back from repair' : repair.label}
                        </Tag>
                      ) : null}
                    </>
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
                    label: done ? 'View' : wo.status === 'In Progress' ? 'Continue' : 'Start',
                    variant: done ? 'secondary' : 'primary',
                    disabled: !!lock,
                    onClick: () => onOpen(wo),
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
