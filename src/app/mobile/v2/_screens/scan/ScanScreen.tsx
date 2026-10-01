'use client'

import React from 'react'
import { Boxes, ChevronRight, DoorOpen, type LucideIcon } from 'lucide-react'
import { parseScan } from '@/lib/fieldRequests'
import { Viewfinder } from './Viewfinder'

// Scan (redesign canvas, "Scan"): the camera, aimed at a room's or an asset's
// QR code -- or a room or asset chosen by hand.
export function ScanScreen({
  onFound,
  onPick,
  onNotOurs,
}: {
  onFound: (target: { type: 'room' | 'asset'; id: string }) => void
  onPick: (what: 'room' | 'asset') => void
  onNotOurs: () => void
}) {
  const read = (raw: string) => {
    const target = parseScan(raw, window.location.origin)
    if (target) onFound(target)
    else onNotOurs()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Viewfinder onCode={read} />
      <div className="text-center">
        <p className="m-0 text-xl font-bold">Point at the QR code</p>
        <p className="m-0 text-base text-fa-text-2">on a room door or an asset label</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-fa-text-2">Or choose manually</h2>
        <PickButton icon={DoorOpen} label="Pick a room" detail="Check in, or report a problem there" onClick={() => onPick('room')} />
        <PickButton icon={Boxes} label="Pick an asset" detail="See its details and open work" onClick={() => onPick('asset')} />
      </div>
    </div>
  )
}

function PickButton({ icon: Icon, label, detail, onClick }: { icon: LucideIcon; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 rounded-[14px] border border-fa-border bg-fa-surface px-4 py-3 text-left shadow-fa-e1 transition hover:border-fa-border-strong"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fa-primary-weak">
        <Icon className="h-6 w-6 text-fa-primary" strokeWidth={2} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[17px] font-semibold">{label}</span>
        <span className="text-sm text-fa-text-2">{detail}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-fa-text-2" strokeWidth={2} aria-hidden />
    </button>
  )
}
