'use client'

import React, { useMemo, useState } from 'react'
import { CalendarDays, CircleCheck, Play, Sparkles } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { WorkOrder } from '@/types/afms'
import { housekeepingWorkOrders } from '@/lib/fieldWork'
import { cleaningCounts, cleaningFor, jobDateText, type CleaningFilter } from '@/lib/fieldTasks'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { EmptyState, FilterChips, SummaryTile, WorkCard, WorkStatusPill } from '@/components/field'
import { todayLong } from './TasksScreen'

// Cleaning, housekeeping's home (redesign canvas, "Cleaning"): the rooms
// assigned to them, as Scheduled / In progress / Completed, each a card that
// opens the cleaning task.
export function CleaningScreen({ onOpen }: { onOpen: (wo: WorkOrder) => void }) {
  const { currentUser, workOrders, rooms, buildings } = useAFMS()
  const [filter, setFilter] = useState<CleaningFilter>('Open')

  const mine = useMemo(() => housekeepingWorkOrders(workOrders, currentUser), [workOrders, currentUser])
  const counts = useMemo(() => cleaningCounts(mine), [mine])
  const shown = useMemo(() => cleaningFor(mine, filter), [mine, filter])
  const now = new Date()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="m-0 text-[26px] font-bold leading-tight">Cleaning</h1>
        <p className="m-0 text-base text-fa-text-2">{todayLong(now)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <SummaryTile count={counts.scheduled} label="Scheduled" icon={CalendarDays} tint="hk" pressed={filter === 'Scheduled'} onClick={() => setFilter('Scheduled')} />
        <SummaryTile count={counts.inProgress} label="In progress" icon={Play} tint="primary" pressed={filter === 'In Progress'} onClick={() => setFilter('In Progress')} />
        <SummaryTile count={counts.completed} label="Completed" icon={CircleCheck} tint="success" pressed={filter === 'Completed'} onClick={() => setFilter('Completed')} />
      </div>

      <FilterChips
        label="Show"
        value={filter}
        onChange={setFilter}
        chips={[
          { value: 'Open', label: 'To do', count: counts.open },
          { value: 'Scheduled', label: 'Scheduled', count: counts.scheduled },
          { value: 'In Progress', label: 'In progress', count: counts.inProgress },
          { value: 'Completed', label: 'Completed', count: counts.completed },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState icon={filter === 'Completed' ? CircleCheck : Sparkles} title={filter === 'Completed' ? 'Nothing completed yet' : 'All caught up'}>
          {filter === 'Completed' ? 'Rooms you finish show here.' : 'No rooms are waiting for you. New cleaning tasks show up here and on the bell.'}
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Cleaning tasks">
          {shown.map(wo => {
            const room = rooms.find(r => r.id === wo.roomId)
            const building = buildings.find(b => b.id === room?.buildingId)?.name
            const when = jobDateText(wo, now)
            const done = wo.status === 'Completed' || wo.status === 'Cancelled'
            return (
              <li key={wo.id}>
                <WorkCard
                  id={isPendingWorkOrder(wo.woNumber) ? 'Number pending' : wo.woNumber}
                  kind="Cleaning"
                  priority={wo.priority}
                  title={room ? `${room.name}${room.roomNumber ? ` (${room.roomNumber})` : ''}` : wo.title || 'Cleaning task'}
                  location={building}
                  due={when ? { text: room && wo.title ? `${wo.title} · ${when.text}` : when.text, overdue: when.overdue } : undefined}
                  badges={
                    <>
                      <WorkStatusPill value={wo.status} />
                      {when?.overdue ? <WorkStatusPill value="Overdue" /> : null}
                    </>
                  }
                  action={{
                    label: done ? 'View' : wo.status === 'In Progress' ? 'Continue' : 'Start',
                    variant: done ? 'secondary' : 'primary',
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
