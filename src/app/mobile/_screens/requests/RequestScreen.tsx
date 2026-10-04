'use client'

import React from 'react'
import { SearchX } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { requestSteps, slaText } from '@/lib/fieldRequests'
import { whenText } from '@/lib/fieldTasks'
import { Button, Card, CardTitle, EmptyState, IdText, PriorityPill, RequestStatusPill, ScreenHeader, Timeline, cn } from '@/components/field'

// One request (redesign canvas, "Request-Detail"): where, how urgent, when it
// should be done by, what was said, the photos, and how far it has got.
export function RequestScreen({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  const { serviceRequests, rooms, assets, currentUser } = useAFMS()
  const sr = serviceRequests.find(s => s.id === requestId)
  if (!sr) {
    return (
      <>
        <ScreenHeader title="Request" onBack={onBack} />
        <main className="flex-1 overflow-y-auto p-4">
          <EmptyState icon={SearchX} title="Request not found" action={<Button block={false} onClick={onBack}>Back to requests</Button>} />
        </main>
      </>
    )
  }
  const room = rooms.find(r => r.id === sr.roomId)
  const asset = assets.find(a => a.id === sr.assetId)
  const sla = slaText(sr)
  const raised = `${whenText(sr.createdAt)}${sr.requestedByUserId === currentUser.id ? ' · by you' : ` · by ${sr.requestedBy}`}`
  const facts: [string, React.ReactNode][] = [
    ['Location', room ? `${room.name}${room.roomNumber ? ` (${room.roomNumber})` : ''}` : '—'],
    ['Priority', <PriorityPill key="p" value={sr.priority} />],
    ['Raised on', whenText(sr.createdAt)],
    ['Expected by (SLA)', sr.slaDueDate ? whenText(sr.slaDueDate) : '—'],
  ]

  return (
    <>
      <ScreenHeader kicker={sr.ticketId} title={sr.title} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 gap-3.5 overflow-y-auto p-4">
        <Card>
          <div className="flex items-center gap-2">
            <IdText className="flex-1">{sr.ticketId}</IdText>
            <RequestStatusPill value={sr.status} />
          </div>
          <h2 className="m-0 text-xl font-bold leading-snug">{sr.title}</h2>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
            {facts.map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-sm text-fa-text-2">{k}</dt>
                <dd className="m-0 text-base font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {sla && sr.status !== 'Resolved' && sr.status !== 'Closed' ? (
            <p className={cn('m-0 text-[15px] font-semibold', sla.overdue ? 'text-fa-danger' : 'text-fa-text-2')}>
              {sla.overdue ? sla.text : `${sla.text.replace(/^Due in /, '')} remaining`}
            </p>
          ) : null}
          {asset ? (
            <p className="m-0 text-[15px] text-fa-text-2">
              Equipment: {asset.name} <IdText>{asset.assetId}</IdText>
            </p>
          ) : null}
          {sr.description ? <p className="m-0 whitespace-pre-line text-[17px] leading-relaxed">{sr.description}</p> : null}
          {sr.photoUrls?.length ? (
            <div className="flex flex-wrap gap-2">
              {sr.photoUrls.map(url => (
                <a key={url} href={url} target="_blank" rel="noreferrer" aria-label="Open photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded photo */}
                  <img src={url} alt="" className="h-20 w-20 rounded-[10px] object-cover" />
                </a>
              ))}
            </div>
          ) : null}
        </Card>

        <Card>
          <CardTitle as="h3">Progress</CardTitle>
          <Timeline label="Request progress" steps={requestSteps(sr, raised)} />
        </Card>
      </main>
    </>
  )
}
