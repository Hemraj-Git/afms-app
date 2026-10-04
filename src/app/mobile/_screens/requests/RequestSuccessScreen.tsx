'use client'

import React from 'react'
import { CircleCheck, Clock, MapPin } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { slaHoursOf } from '@/lib/queries/slaSettings'
import { whenText } from '@/lib/fieldTasks'
import { Button, Card, IdText } from '@/components/field'

// Request submitted (redesign canvas, "Request-Success"): its number, and
// when it should be sorted by.
export function RequestSuccessScreen({ requestId, onViewAll, onDone }: { requestId: string; onViewAll: () => void; onDone: () => void }) {
  const { serviceRequests, rooms, slaConfig } = useAFMS()
  const sr = serviceRequests.find(s => s.id === requestId)
  const room = rooms.find(r => r.id === sr?.roomId)

  return (
    <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 items-center gap-5 overflow-y-auto px-4 pb-6 pt-[max(48px,env(safe-area-inset-top))] text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-fa-success-weak">
        <CircleCheck className="h-14 w-14 text-fa-success" strokeWidth={2} aria-hidden />
      </span>
      <h1 className="m-0 text-[28px] font-bold leading-tight">Request submitted</h1>
      {sr ? (
        <Card className="w-full items-start gap-2 text-left">
          <IdText>{sr.ticketId}</IdText>
          <span className="text-[19px] font-bold leading-snug">{sr.title}</span>
          {room ? (
            <span className="flex items-center gap-[7px] text-[15px] text-fa-text-2">
              <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              {room.name}
              {room.roomNumber ? ` (${room.roomNumber})` : ''}
            </span>
          ) : null}
          <span className="flex items-start gap-[7px] text-[15px]">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-fa-text-2" strokeWidth={2} aria-hidden />
            <span>
              <b>Expected within {slaHoursOf(sr, slaConfig)} h</b>
              <span className="block text-fa-text-2">
                by {whenText(sr.slaDueDate)} · {sr.priority} SLA
              </span>
            </span>
          </span>
        </Card>
      ) : (
        <p className="m-0 text-base text-fa-text-2">It’s with the facilities team.</p>
      )}
      <p className="m-0 text-base text-fa-text-2">Follow it under Requests — you’ll see when it’s assigned and resolved.</p>
      <div className="flex w-full flex-col gap-2.5">
        <Button onClick={onViewAll}>View my requests</Button>
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
    </main>
  )
}
