'use client'

import React, { useMemo } from 'react'
import { Boxes, ChevronRight, CircleCheck, History, MapPin, SearchX, Wrench, type LucideIcon } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { lockedSlaPriority } from '@/lib/assetSlaPriority'
import { getLocalDateStr } from '@/lib/dateUtils'
import { assetFor, longDate, placeText, shortDate } from '@/lib/fieldTasks'
import { isOpenWorkOrder } from '@/lib/workOrderState'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { Button, Card, CardTitle, EmptyState, IdText, Pill, ScreenHeader, WorkStatusPill, type PillTone } from '@/components/field'

const STATUS: Record<string, { tone: PillTone; icon: LucideIcon; label: string }> = {
  Operational: { tone: 'success', icon: CircleCheck, label: 'Operational' },
  'Under Maintenance': { tone: 'warning', icon: Wrench, label: 'Under repair' },
  'In Storage': { tone: 'neutral', icon: Boxes, label: 'In storage' },
  Retired: { tone: 'muted', icon: Boxes, label: 'Retired' },
}

// A scanned asset (redesign canvas, "Scan-Asset"): its details, the open work
// on it (staff), what has happened to it lately, and "Report a breakdown".
export function AssetScreen({
  assetId,
  onBack,
  onReport,
  onOpenWork,
}: {
  assetId: string
  onBack: () => void
  onReport: (roomId: string, assetId: string) => void
  onOpenWork: (workOrderId: string) => void
}) {
  const { assets, rooms, buildings, subCategories, workOrders, assetActivityLogs, currentUser } = useAFMS()
  const asset = assetFor(assets, assetId)
  const guest = currentUser.role === 'Guest'

  const openWork = useMemo(() => (asset ? workOrders.filter(w => w.assetId === asset.id && isOpenWorkOrder(w)) : []), [workOrders, asset])
  const history = useMemo(
    () =>
      asset
        ? assetActivityLogs
            .filter(l => l.assetId === asset.id)
            .sort((a, b) => (b.timestampEpoch ?? Date.parse(b.timestamp)) - (a.timestampEpoch ?? Date.parse(a.timestamp)))
            .slice(0, 5)
        : [],
    [assetActivityLogs, asset],
  )

  if (!asset) {
    return (
      <>
        <ScreenHeader kicker="Scanned asset" title="Asset not found" onBack={onBack} />
        <main className="flex-1 overflow-y-auto p-4">
          <EmptyState icon={SearchX} title="We don’t know this asset" action={<Button block={false} onClick={onBack}>Go back</Button>}>
            The label may be old or from another site. Try choosing the asset by hand.
          </EmptyState>
        </main>
      </>
    )
  }

  const room = rooms.find(r => r.id === asset.roomId)
  const status = STATUS[asset.status] ?? STATUS.Operational
  const sla = lockedSlaPriority(asset, subCategories.find(s => s.id === asset.subCategoryId))

  return (
    <>
      <ScreenHeader kicker="Scanned asset" title={`${asset.name} · ${asset.assetId}`} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 gap-3.5 overflow-y-auto p-4">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fa-primary-weak">
              <Boxes className="h-6 w-6 text-fa-primary" strokeWidth={2} aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-[19px] font-bold leading-tight">{asset.name}</span>
              <IdText className="text-sm">{asset.assetId}</IdText>
            </div>
            <Pill tone={status.tone} icon={status.icon}>
              {status.label}
            </Pill>
          </div>
          {room ? (
            <div className="flex items-center gap-[7px] text-[15px] text-fa-text-2">
              <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              {placeText(room, buildings)}
            </div>
          ) : null}
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ['Model', asset.modelNumber],
              ['Serial', asset.serialNumber],
              ['Warranty expiry', longDate(asset.warrantyTill)],
              ['SLA priority', sla?.priority],
            ].map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-sm text-fa-text-2">{k}</dt>
                <dd className="m-0 break-words text-base font-medium">{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {!guest && currentUser.role !== 'Faculty' ? (
          <Card className="gap-0 py-2">
            <CardTitle as="h3" icon={Wrench}>
              Open work
            </CardTitle>
            {openWork.length === 0 ? (
              <p className="m-0 py-2 text-[15px] text-fa-text-2">None that you’re working on.</p>
            ) : (
              <ul className="m-0 mt-1 flex list-none flex-col p-0">
                {openWork.map(w => {
                  const mine = w.assignedTechnicianId === currentUser.id
                  const row = (
                    <>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <IdText>{isPendingWorkOrder(w.woNumber) ? 'Number pending' : w.woNumber}</IdText>
                        <span className="text-base">{w.title || w.type}</span>
                      </span>
                      <WorkStatusPill value={w.status} />
                      {mine ? <ChevronRight className="h-5 w-5 shrink-0 text-fa-text-2" strokeWidth={2} aria-hidden /> : null}
                    </>
                  )
                  return (
                    <li key={w.id} className="border-b border-fa-border last:border-b-0">
                      {mine ? (
                        <button type="button" onClick={() => onOpenWork(w.id)} className="flex min-h-14 w-full items-center gap-2 py-2 text-left">
                          {row}
                        </button>
                      ) : (
                        <div className="flex min-h-14 items-center gap-2 py-2">{row}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        ) : null}

        {!guest && history.length ? (
          <Card className="gap-0 py-2">
            <CardTitle as="h3" icon={History}>
              Recent history
            </CardTitle>
            <ul className="m-0 mt-1 flex list-none flex-col p-0">
              {history.map(l => (
                <li key={l.id} className="flex flex-col gap-0.5 border-b border-fa-border py-2.5 last:border-b-0">
                  <span className="text-base font-medium">{l.action}</span>
                  <span className="text-sm text-fa-text-2">
                    {[l.timestampEpoch ? shortDate(getLocalDateStr(new Date(l.timestampEpoch))) : l.timestamp, l.referenceId && !isPendingWorkOrder(l.referenceId) ? l.referenceId : '', l.byUser].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Button icon={Wrench} onClick={() => onReport(asset.roomId, asset.id)}>
          Report a breakdown for this asset
        </Button>
      </main>
    </>
  )
}
