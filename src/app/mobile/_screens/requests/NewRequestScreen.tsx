'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DoorOpen, Send, Sparkles, Wrench } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { ServiceRequest } from '@/types/afms'
import { lockedSlaPriority } from '@/lib/assetSlaPriority'
import { newRequestProblems, requestTitle, slaDueFromNow, slaHours, type NewRequestField } from '@/lib/fieldRequests'
import { generateUUID } from '@/lib/uuid'
import {
  Button, Card, PhotoCapture, PriorityPill, ScreenHeader, SegmentedControl, SelectField, StickyActionBar, TextAreaField, TextButton, TextField,
} from '@/components/field'
import { usePhotoSlots } from '../usePhotoSlots'
import { StepError } from '../workOrder/Sections'

type Priority = ServiceRequest['priority']

// Report a problem (redesign canvas, "Request-New"): what kind, where, which
// equipment, how urgent (an asset's own SLA decides that for a breakdown),
// what is wrong, and a photo. Opened from a scan, the room is already filled in.
export function NewRequestScreen({
  roomId: fromScanRoom,
  assetId: fromScanAsset,
  onBack,
  onSubmitted,
  onToast,
  onDirtyChange,
}: {
  roomId?: string
  assetId?: string
  onBack: () => void
  onSubmitted: (requestId: string) => void
  onToast: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const { rooms, assets, subCategories, slaConfig, currentUser, addServiceRequest } = useAFMS()
  const [type, setType] = useState<'Maintenance' | 'Housekeeping'>('Maintenance')
  const [roomId, setRoomId] = useState(fromScanRoom ?? '')
  const [roomLocked, setRoomLocked] = useState(!!fromScanRoom)
  const [assetId, setAssetId] = useState(fromScanAsset ?? '')
  const [chosenPriority, setChosenPriority] = useState<Priority>('Medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const photos = usePhotoSlots({}, onToast)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)
  // One id for this draft, reused on every retry (see useAddServiceRequest).
  const [requestId] = useState(generateUUID)
  const [failure, setFailure] = useState<string | null>(null)

  const room = rooms.find(r => r.id === roomId)
  const inRoom = useMemo(() => assets.filter(a => a.roomId === roomId && a.status !== 'Retired').sort((a, b) => a.name.localeCompare(b.name)), [assets, roomId])
  const asset = assets.find(a => a.id === assetId)
  const lock = type === 'Maintenance' ? lockedSlaPriority(asset, subCategories.find(s => s.id === asset?.subCategoryId)) : undefined
  const priority: Priority = lock?.priority ?? chosenPriority

  const dirty = !busy && (title.trim() !== '' || description.trim() !== '' || photos.has('photo'))
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const draft = { type, roomId, roomHasEquipment: inRoom.length > 0, assetId, description, uploading: photos.uploading, failed: photos.failed }
  const problems = tried ? newRequestProblems(draft) : []
  const err = (f: NewRequestField) => problems.find(p => p.field === f)?.message

  const submit = async () => {
    // A ref, not state: a second tap in the same frame must see the lock.
    if (submittingRef.current) return
    setTried(true)
    setFailure(null)
    const found = newRequestProblems(draft)
    if (found.length) {
      document.getElementById(`req-${found[0].field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    submittingRef.current = true
    setBusy(true)
    try {
      const saved = await addServiceRequest({
        title: requestTitle(title, type, asset?.name, room?.name, description),
        description: description.trim(),
        requestType: type,
        roomId,
        assetId: type === 'Maintenance' ? assetId || undefined : undefined,
        requestedBy: currentUser.fullName,
        requestedByRole: currentUser.role,
        status: 'Open',
        priority,
        slaDueDate: slaDueFromNow(priority, slaConfig),
        photoUrls: photos.urlOf('photo') ? [photos.urlOf('photo')] : [],
      }, requestId)
      onDirtyChange(false)
      onSubmitted(saved.id)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The request could not be sent. Try again.')
      setBusy(false)
      submittingRef.current = false
    }
  }

  return (
    <>
      {photos.input}
      <ScreenHeader kicker="New request" title="Report a problem" onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] font-semibold">Type</span>
          <SegmentedControl
            label="Type"
            value={type}
            onChange={v => setType(v)}
            options={[
              { value: 'Maintenance', label: 'Maintenance', icon: Wrench },
              { value: 'Housekeeping', label: 'Housekeeping', icon: Sparkles },
            ]}
          />
        </div>

        <div id="req-roomId" className="scroll-mt-4">
          {roomLocked && room ? (
            <Card className="gap-1">
              <span className="text-[15px] font-semibold">Location</span>
              <div className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5 shrink-0 text-fa-text-2" strokeWidth={2} aria-hidden />
                <span className="flex-1 text-[17px] font-medium">
                  {room.name}
                  {room.roomNumber ? ` (${room.roomNumber})` : ''}
                </span>
                <TextButton onClick={() => setRoomLocked(false)}>Change</TextButton>
              </div>
              <span className="text-sm text-fa-text-2">Filled in from your scan.</span>
            </Card>
          ) : (
            <SelectField
              label="Location"
              required
              placeholder="Choose the room"
              value={roomId}
              onChange={e => {
                setRoomId(e.target.value)
                setAssetId('')
              }}
              error={err('roomId')}
              options={[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map(r => ({ value: r.id, label: `${r.name}${r.roomNumber ? ` (${r.roomNumber})` : ''}` }))}
            />
          )}
        </div>

        {type === 'Maintenance' && roomId ? (
          <div id="req-assetId" className="scroll-mt-4">
            {inRoom.length ? (
              <SelectField
                label="Equipment"
                required
                placeholder="Choose the equipment"
                value={assetId}
                onChange={e => setAssetId(e.target.value)}
                error={err('assetId')}
                options={inRoom.map(a => ({ value: a.id, label: `${a.name} · ${a.assetId}` }))}
              />
            ) : (
              <p className="m-0 rounded-lg bg-fa-sunken px-3 py-2.5 text-[15px] text-fa-text-2">No equipment is listed for this room, so the request is for the room itself.</p>
            )}
          </div>
        ) : null}

        {lock ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] font-semibold">Priority</span>
            <div className="flex items-center gap-2">
              <PriorityPill value={lock.priority} />
            </div>
            <span className="text-sm text-fa-text-2">Set by this {lock.source === 'asset' ? 'asset’s' : 'equipment type’s'} SLA. A breakdown on an asset always uses its SLA priority.</span>
          </div>
        ) : (
          <SelectField
            label="Priority"
            value={chosenPriority}
            onChange={e => setChosenPriority(e.target.value as Priority)}
            options={[
              { value: 'Low', label: 'Low — routine' },
              { value: 'Medium', label: 'Medium — standard' },
              { value: 'High', label: 'High — needs attention soon' },
              { value: 'Critical', label: 'Critical — unsafe or stopped' },
            ]}
            hint={`Fixed within ${slaHours(chosenPriority, slaConfig)} h at this priority.`}
          />
        )}

        <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Ceiling fan making grinding noise" hint="Optional — we use the start of the description if it’s blank." />
        <div id="req-description" className="scroll-mt-4">
          <TextAreaField
            label="Description"
            required
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is wrong, where exactly, since when"
            error={err('description')}
          />
        </div>
        <div id="req-photo" className="flex scroll-mt-4 flex-col gap-1.5">
          <span className="text-[15px] font-semibold">Photo</span>
          <PhotoCapture label="Add a photo" state={photos.stateOf('photo')} onTake={() => photos.take('photo')} onRetry={() => photos.retry('photo')} />
          <StepError>{err('photo')}</StepError>
        </div>
      </main>

      <StickyActionBar>
        {failure ? (
          <p role="alert" className="m-0 text-[15px] font-medium text-fa-danger">
            {failure}
          </p>
        ) : problems.length ? (
          <p role="alert" className="m-0 text-[15px] font-medium text-fa-danger">
            {problems.length === 1 ? problems[0].message : `${problems.length} things to fix first — shown in red above.`}
          </p>
        ) : null}
        <Button icon={Send} loading={busy} onClick={() => void submit()}>
          Submit request
        </Button>
      </StickyActionBar>
    </>
  )
}
