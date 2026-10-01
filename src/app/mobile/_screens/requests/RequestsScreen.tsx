'use client'

import React, { useMemo, useState } from 'react'
import { Inbox, Plus } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { myRequests, requestCounts, requestsFor, slaText, type RequestFilter } from '@/lib/fieldRequests'
import { Button, EmptyState, FilterChips, RequestRow, RequestStatusPill } from '@/components/field'

// Requests (redesign canvas, "Requests"): the problems this person reported,
// newest first, each with how long is left -- and "New request".
export function RequestsScreen({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { serviceRequests, rooms, currentUser } = useAFMS()
  const [filter, setFilter] = useState<RequestFilter>('All')
  const mine = useMemo(() => myRequests(serviceRequests, currentUser), [serviceRequests, currentUser])
  const counts = requestCounts(mine)
  const shown = requestsFor(mine, filter)
  const now = new Date()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="m-0 flex-1 text-[26px] font-bold leading-tight">Requests</h1>
        <Button block={false} size="md" icon={Plus} onClick={onNew}>
          New request
        </Button>
      </div>

      <FilterChips
        label="Show"
        value={filter}
        onChange={setFilter}
        chips={[
          { value: 'All', label: 'All', count: counts.all },
          { value: 'Open', label: 'Open', count: counts.open },
          { value: 'Resolved', label: 'Resolved', count: counts.resolved },
          { value: 'Closed', label: 'Closed', count: counts.closed },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={mine.length ? 'Nothing here' : 'No requests yet'}
          action={mine.length ? undefined : <Button block={false} icon={Plus} onClick={onNew}>Report a problem</Button>}
        >
          {mine.length ? 'No requests in this list.' : 'Something broken, leaking or needing a clean? Report it and follow it here.'}
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="My requests">
          {shown.map(sr => {
            const room = rooms.find(r => r.id === sr.roomId)
            return (
              <li key={sr.id}>
                <RequestRow
                  id={sr.ticketId}
                  status={<RequestStatusPill value={sr.status} />}
                  title={sr.title}
                  location={room ? `${room.name}${room.roomNumber ? ` (${room.roomNumber})` : ''}` : undefined}
                  sla={slaText(sr, now)}
                  onOpen={() => onOpen(sr.id)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
