'use client'

import React, { useMemo, useState } from 'react'
import { ChevronRight, DoorOpen, LogIn, LogOut, MapPin, MessageSquareWarning, SearchX, UserCheck } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { CHECK_IN_PURPOSES, checkInPurpose, sinceText } from '@/lib/fieldRequests'
import { Button, Card, CardTitle, ConfirmSheet, EmptyState, FilterChips, IdText, Pill, RoomPill, ScreenHeader, TextField } from '@/components/field'

// A scanned room (redesign canvas, "Scan-Room" and "Scan-Room-CheckedIn"):
// what it is and who used it last; check in with a purpose, or -- once in --
// check out or report a problem there. Its equipment opens each asset.
export function RoomScreen({
  roomId,
  onBack,
  onReport,
  onAsset,
  onToast,
}: {
  roomId: string
  onBack: () => void
  onReport: (roomId: string) => void
  onAsset: (assetId: string) => void
  onToast: (message: string) => void
}) {
  const { rooms, buildings, assets, roomAccessLogs, activeCheckIn, checkInRoom, checkOutRoom, currentUser } = useAFMS()
  const room = rooms.find(r => r.id === roomId || r.qrCodeKey === roomId)
  const [choice, setChoice] = useState('')
  const [details, setDetails] = useState('')
  const [problem, setProblem] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)

  const equipment = useMemo(() => (room ? assets.filter(a => a.roomId === room.id && a.status !== 'Retired') : []), [assets, room])
  const lastUse = useMemo(
    () =>
      room
        ? roomAccessLogs
            .filter(l => l.roomId === room.id && l.checkOutTimestamp && l.userId !== currentUser.id)
            .sort((a, b) => (b.checkOutTimestamp ?? 0) - (a.checkOutTimestamp ?? 0))[0]
        : undefined,
    [roomAccessLogs, room, currentUser.id],
  )

  if (!room) {
    return (
      <>
        <ScreenHeader kicker="Scanned room" title="Room not found" onBack={onBack} />
        <main className="flex-1 overflow-y-auto p-4">
          <EmptyState icon={SearchX} title="We don’t know this room" action={<Button block={false} onClick={onBack}>Go back</Button>}>
            The code may be old or from another site. Try choosing the room by hand.
          </EmptyState>
        </main>
      </>
    )
  }

  const building = buildings.find(b => b.id === room.buildingId)?.name
  const here = activeCheckIn?.roomId === room.id
  const elsewhere = activeCheckIn && !here ? activeCheckIn : null
  const label = `${room.name}${room.roomNumber ? ` (${room.roomNumber})` : ''}`

  const checkIn = async () => {
    const { purpose, problem: p } = checkInPurpose(choice, details)
    setProblem(p)
    if (!purpose) return
    setBusy(true)
    try {
      await checkInRoom(room.id, purpose)
      onToast(`Checked in to ${room.name}`)
      setChoice('')
      setDetails('')
    } finally {
      setBusy(false)
    }
  }

  const checkOut = async (id: string, name: string) => {
    setBusy(true)
    try {
      await checkOutRoom(id)
      setConfirmOut(false)
      onToast(`Checked out of ${name}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ScreenHeader kicker="Scanned room" title={label} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fa-primary-weak">
              <DoorOpen className="h-6 w-6 text-fa-primary" strokeWidth={2} aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-[19px] font-bold leading-tight">{room.name}</span>
              {room.roomNumber ? <IdText className="text-sm">{room.roomNumber}</IdText> : null}
            </div>
            {here ? (
              <Pill tone="warning" icon={UserCheck}>
                Occupied · you
              </Pill>
            ) : (
              <RoomPill value={room.status === 'Occupied' ? 'Occupied' : 'Available'} />
            )}
          </div>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ['Building', building],
              ['Floor', room.floor],
              ['Type', room.type],
              ['Size', room.roomSizeSqft ? `${room.roomSizeSqft} sq ft` : undefined],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-sm text-fa-text-2">{k}</dt>
                <dd className="m-0 text-base font-medium">{v || '—'}</dd>
              </div>
            ))}
          </dl>
          {room.status === 'Occupied' && !here && room.currentOccupant ? (
            <p className="m-0 text-[15px] text-fa-text-2">In use by {room.currentOccupant}</p>
          ) : lastUse ? (
            <p className="m-0 text-[15px] text-fa-text-2">
              Last used by {lastUse.userName} · checked out {sinceText(lastUse.checkOutTimestamp, lastUse.checkOutTime ?? '')}
            </p>
          ) : null}
        </Card>

        {here && activeCheckIn ? (
          <Card className="border-fa-success-weak">
            <CardTitle icon={UserCheck}>You’re checked in</CardTitle>
            <p className="m-0 text-[15px] text-fa-text-2">
              Since {sinceText(activeCheckIn.checkInTimestamp, activeCheckIn.checkInTime)}
              {activeCheckIn.purpose ? ` · Purpose: ${activeCheckIn.purpose}` : ''}
            </p>
            <Button variant="secondary" icon={LogOut} loading={busy} onClick={() => setConfirmOut(true)}>
              Check out
            </Button>
          </Card>
        ) : elsewhere ? (
          <Card>
            <CardTitle icon={MapPin}>You’re checked in somewhere else</CardTitle>
            <p className="m-0 text-[15px] text-fa-text-2">Check out of {elsewhere.roomName} first, then check in here.</p>
            <Button variant="secondary" icon={LogOut} loading={busy} onClick={() => void checkOut(elsewhere.roomId, elsewhere.roomName)}>
              Check out of {elsewhere.roomName}
            </Button>
          </Card>
        ) : (
          <Card className="gap-3">
            <CardTitle icon={LogIn}>Check in</CardTitle>
            <div className="flex flex-col gap-1.5">
              <span id="purpose-label" className="text-[15px] font-semibold">
                Purpose of visit <span className="text-fa-danger" aria-hidden>*</span>
              </span>
              <FilterChips
                label="Purpose of visit"
                value={choice}
                onChange={v => {
                  setChoice(v)
                  setProblem(undefined)
                }}
                chips={CHECK_IN_PURPOSES.map(p => ({ value: p, label: p }))}
                className="mx-0 flex-wrap px-0"
              />
            </div>
            <TextField
              label={choice === 'Other' ? 'What is the visit for?' : 'Details (optional)'}
              required={choice === 'Other'}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="e.g. 2nd-year galley practical"
              error={problem}
            />
            <Button icon={LogIn} loading={busy} onClick={() => void checkIn()}>
              Confirm check-in
            </Button>
          </Card>
        )}

        <Card className="gap-2">
          <CardTitle icon={MessageSquareWarning}>Something wrong in this room?</CardTitle>
          <Button variant="secondary" size="md" onClick={() => onReport(room.id)}>
            Report a problem here
          </Button>
        </Card>

        {equipment.length ? (
          <Card className="gap-0 py-2">
            <CardTitle as="h3" aside={<span className="text-sm text-fa-text-2">{equipment.length}</span>}>
              Equipment here
            </CardTitle>
            <ul className="m-0 mt-1 flex list-none flex-col p-0">
              {equipment.slice(0, 20).map(a => (
                <li key={a.id} className="border-b border-fa-border last:border-b-0">
                  <button type="button" onClick={() => onAsset(a.id)} className="flex min-h-14 w-full items-center gap-2 py-2 text-left">
                    <span className="flex-1 text-base">
                      {a.name} <IdText>{a.assetId}</IdText>
                    </span>
                    <ChevronRight className="h-5 w-5 text-fa-text-2" strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </main>

      {confirmOut ? (
        <ConfirmSheet
          title={`Check out of ${room.name}?`}
          body="The room shows as free again once everyone has checked out."
          icon={LogOut}
          confirmLabel="Check out"
          busy={busy}
          onConfirm={() => void checkOut(room.id, room.name)}
          onCancel={() => setConfirmOut(false)}
        />
      ) : null}
    </>
  )
}
