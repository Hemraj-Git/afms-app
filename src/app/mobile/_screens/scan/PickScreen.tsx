'use client'

import React, { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { floorText, placeText } from '@/lib/fieldTasks'
import { FilterChips, IdText, RoomPill, ScreenHeader, SegmentedControl, TextField } from '@/components/field'

const SHOWN = 60

// Scan · Choose manually (redesign canvas, "Scan-Manual"): every room, by
// building, or every asset, narrowed by typing.
export function PickScreen({
  initial,
  onBack,
  onRoom,
  onAsset,
}: {
  initial: 'room' | 'asset'
  onBack: () => void
  onRoom: (id: string) => void
  onAsset: (id: string) => void
}) {
  const { rooms, assets, buildings } = useAFMS()
  const [what, setWhat] = useState(initial)
  const [query, setQuery] = useState('')
  const [building, setBuilding] = useState('all')
  const q = query.trim().toLowerCase()

  const roomList = useMemo(
    () =>
      rooms
        .filter(r => (building === 'all' || r.buildingId === building) && (!q || `${r.name} ${r.roomNumber} ${r.type}`.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rooms, building, q],
  )
  const assetList = useMemo(
    () =>
      assets
        .filter(a => a.status !== 'Retired' && (!q || `${a.name} ${a.assetId} ${a.modelNumber ?? ''} ${a.serialNumber ?? ''}`.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [assets, q],
  )
  const usedBuildings = buildings.filter(b => rooms.some(r => r.buildingId === b.id))
  const list = what === 'room' ? roomList : assetList

  return (
    <>
      <ScreenHeader kicker="Scan · Choose manually" title={what === 'room' ? 'Pick a room' : 'Pick an asset'} onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 gap-3.5 overflow-y-auto p-4">
        <SegmentedControl
          label="What to find"
          value={what}
          onChange={v => {
            setWhat(v)
            setQuery('')
          }}
          options={[
            { value: 'room', label: 'Rooms' },
            { value: 'asset', label: 'Assets' },
          ]}
        />
        <TextField
          label={what === 'room' ? 'Search rooms' : 'Search assets'}
          icon={Search}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={what === 'room' ? 'Name or number, e.g. R-0214' : 'Name, code or serial, e.g. AST-0312'}
        />
        {what === 'room' && usedBuildings.length > 1 ? (
          <FilterChips
            label="Building"
            value={building}
            onChange={setBuilding}
            chips={[{ value: 'all', label: 'All buildings' }, ...usedBuildings.map(b => ({ value: b.id, label: b.name }))]}
          />
        ) : null}

        {list.length === 0 ? (
          <p className="m-0 py-6 text-center text-base text-fa-text-2">Nothing matches “{query}”.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border border-fa-border bg-fa-surface p-0 shadow-fa-e1">
            {what === 'room'
              ? roomList.slice(0, SHOWN).map(r => (
                  <li key={r.id} className="border-b border-fa-border last:border-b-0">
                    <button type="button" onClick={() => onRoom(r.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-fa-sunken">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[17px] font-semibold">
                          {r.name} <IdText>{r.roomNumber}</IdText>
                        </span>
                        <span className="text-sm text-fa-text-2">
                          {[buildings.find(b => b.id === r.buildingId)?.name, floorText(r.floor)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <RoomPill value={r.status === 'Occupied' ? 'Occupied' : 'Available'} />
                      <ChevronRight className="h-5 w-5 shrink-0 text-fa-text-2" strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                ))
              : assetList.slice(0, SHOWN).map(a => (
                  <li key={a.id} className="border-b border-fa-border last:border-b-0">
                    <button type="button" onClick={() => onAsset(a.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-fa-sunken">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[17px] font-semibold">
                          {a.name} <IdText>{a.assetId}</IdText>
                        </span>
                        <span className="text-sm text-fa-text-2">{placeText(rooms.find(r => r.id === a.roomId), buildings) || 'No room set'}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-fa-text-2" strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                ))}
          </ul>
        )}
        {list.length > SHOWN ? <p className="m-0 text-center text-sm text-fa-text-2">Showing {SHOWN} of {list.length}. Type to narrow the list.</p> : null}
      </main>
    </>
  )
}
