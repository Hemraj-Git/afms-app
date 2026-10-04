'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { useDefaultSelection } from '@/lib/useDefaultSelection'
import {
  DoorOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  User,
  ChevronRight,
  ChevronDown,
  PlusCircle,
  Tag,
  Check,
} from 'lucide-react'
import { Room } from '@/types/afms'

import { Modal } from '@/components/ui/Modal'
import { showToast } from '@/lib/toast'
import { confirmAction } from '@/lib/confirm'
import { useFormCheck } from '@/lib/useFormCheck'
import { nameSchema, roomSchema } from '@/lib/validation/forms'
import { INVALID } from '@/components/ui/FormField'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/DataTable'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
export default function RoomsPage() {
  const {
    rooms,
    buildings,
    campuses,
    assets,
    roomTypes,
    addRoomType,
    removeRoomType,
    addRoom,
    updateRoom,
    deleteRoom,
  } = useAFMS()
  // One save at a time: a double click or a slow network can't save twice.
  const { guard: submitOnce } = useSubmitGuard()

  const [searchQuery, setSearchQuery] = useState('')
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [newRoomTypeName, setNewRoomTypeName] = useState('')
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  // Cascading Form fields: Campus -> Building -> Floor & Room Size
  const [campusId, setCampusId] = useState(campuses[0]?.id || '')
  useDefaultSelection(campusId, setCampusId, campuses[0]?.id)
  const [buildingId, setBuildingId] = useState(
    buildings.find(b => b.campusId === (campuses[0]?.id || ''))?.id || buildings[0]?.id || ''
  )
  const [name, setName] = useState('')
  const [type, setType] = useState(roomTypes[0] || 'Classroom')
  const [floor, setFloor] = useState('Ground Floor')
  const [roomSizeSqft, setRoomSizeSqft] = useState('400')
  const [isReservable, setIsReservable] = useState(true)

  // Buildings filtered by selected Campus
  const availableBuildings = buildings.filter(b => b.campusId === campusId)
  const selectedBuildingObj = buildings.find(b => b.id === buildingId)

  // Helper to generate dynamic floor options based on building totalFloors
  const getFloorOptions = (totalFloors: number = 1) => {
    const options: string[] = []
    for (let i = 0; i < totalFloors; i++) {
      if (i === 0) options.push('Ground Floor')
      else if (i === 1) options.push('1st Floor')
      else if (i === 2) options.push('2nd Floor')
      else if (i === 3) options.push('3rd Floor')
      else options.push(`${i}th Floor`)
    }
    return options.length > 0 ? options : ['Ground Floor']
  }

  const floorOptions = getFloorOptions(selectedBuildingObj?.totalFloors || 1)

  const handleCampusChange = (newCampusId: string) => {
    setCampusId(newCampusId)
    const matchingBuildings = buildings.filter(b => b.campusId === newCampusId)
    const nextBld = matchingBuildings[0]
    setBuildingId(nextBld?.id || '')
    const nextFloors = getFloorOptions(nextBld?.totalFloors || 1)
    setFloor(nextFloors[0] || 'Ground Floor')
  }

  const handleBuildingChange = (newBldId: string) => {
    setBuildingId(newBldId)
    const bld = buildings.find(b => b.id === newBldId)
    const nextFloors = getFloorOptions(bld?.totalFloors || 1)
    setFloor(nextFloors[0] || 'Ground Floor')
  }

  const vRoom = useFormCheck(roomSchema, { buildingId, name, roomSizeSqft }, 'room')
  const vType = useFormCheck(nameSchema('Room type name'), { name: newRoomTypeName }, 'rtype')

  const openCreateModal = () => {
    setEditingRoom(null)
    const defaultCampus = campuses[0]?.id || ''
    setCampusId(defaultCampus)
    const defaultBuilding = buildings.find(b => b.campusId === defaultCampus)
    setBuildingId(defaultBuilding?.id || buildings[0]?.id || '')
    const floors = getFloorOptions(defaultBuilding?.totalFloors || 1)
    setFloor(floors[0] || 'Ground Floor')
    setName('')
    setType(roomTypes[0] || 'Classroom')
    setRoomSizeSqft('400')
    setIsReservable(true)
    vRoom.reset()
    setShowModal(true)
  }

  const openEditModal = (r: Room) => {
    setEditingRoom(r)
    const bld = buildings.find(b => b.id === r.buildingId)
    const parentCampusId = bld?.campusId || campuses[0]?.id || ''
    setCampusId(parentCampusId)
    setBuildingId(r.buildingId)
    setFloor(r.floor || 'Ground Floor')
    setRoomSizeSqft(r.roomSizeSqft ? String(r.roomSizeSqft) : '400')
    setName(r.name)
    setType(r.type || roomTypes[0] || 'Classroom')
    setIsReservable(r.isReservable)
    vRoom.reset()
    setShowModal(true)
  }

  const handleRoomTypeSelectChange = (value: string) => {
    if (value === '__ADD_NEW_TYPE__') {
      setNewRoomTypeName('')
      vType.reset()
      setShowTypeModal(true)
    } else {
      setType(value)
    }
  }

  const handleSaveNewRoomType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vType.check()) return
    const trimmed = newRoomTypeName.trim()
    // Saved for everyone; stays open (with a message) if it couldn't be.
    if (!(await addRoomType(trimmed))) return
    setType(trimmed)
    setShowTypeModal(false)
    setNewRoomTypeName('')
  }

  // Only a type no room uses can be removed (the database checks too).
  const handleRemoveRoomType = async (rt: string) => {
    if (!(await confirmAction(`Remove the room type "${rt}"? No room uses it.`, { confirmLabel: 'Remove' }))) return
    if (await removeRoomType(rt)) showToast('success', `"${rt}" removed.`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vRoom.check()) return
    const sizeNum = parseFloat(roomSizeSqft) || 0

    if (editingRoom) {
      updateRoom(editingRoom.id, {
        buildingId,
        name,
        type,
        floor,
        roomSizeSqft: sizeNum,
        isReservable,
      })
    } else {
      try {
        await addRoom({
          buildingId,
          name,
          type,
          floor,
          roomSizeSqft: sizeNum,
          isReservable,
          status: 'Available',
        })
      } catch {
        // Not saved (a toast already says why). Keep the form open so nothing typed is lost.
        return
      }
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string, roomName: string, roomNumber: string) => {
    const linkedAssets = assets.filter(a => a.roomId === id)
    if (linkedAssets.length > 0) {
      showToast('error', 
        `Deletion Not Permitted: Room "${roomName}" (${roomNumber}) cannot be deleted because it has ${linkedAssets.length} asset(s) installed (${linkedAssets.map(a => a.name).join(', ')}). Please reassign or delete those assets first.`
      )
      return
    }

    if (await confirmAction(`Are you sure you want to delete room "${roomName}" (${roomNumber})?`)) {
      deleteRoom(id)
    }
  }

  const filteredRooms = rooms.filter(r => {
    const bld = buildings.find(b => b.id === r.buildingId)
    const matchesSearch =
      !searchQuery.trim() ||
      (r.roomNumber && r.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bld?.name && bld.name.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType = roomTypeFilter === 'ALL' || r.type === roomTypeFilter

    return matchesSearch && matchesType
  })

  // A table, not cards: an institute has hundreds of rooms.
  const roomHref = (r: Room) => `/organization/rooms/${r.roomNumber || r.id}`
  const roomColumns: ColumnDef<Room>[] = [
    {
      id: 'roomNumber',
      header: 'Room ID',
      accessorFn: r => r.roomNumber || r.id,
      meta: { thClassName: 'py-3.5 px-6', tdClassName: 'py-3.5 px-6' },
      cell: ({ row: { original: r } }) => (
        <Link href={roomHref(r)} className="font-mono font-bold text-blue-700 hover:underline whitespace-nowrap">
          {r.roomNumber || r.id}
        </Link>
      ),
    },
    {
      id: 'name',
      header: 'Room / Area',
      accessorFn: r => r.name,
      cell: ({ row: { original: r } }) => (
        <>
          <Link href={roomHref(r)} className="font-bold text-slate-900 hover:text-blue-600">
            {r.name}
          </Link>
          <p className="text-[11px] text-slate-400">{r.type}</p>
        </>
      ),
    },
    {
      id: 'building',
      header: 'Building / Campus',
      accessorFn: r => buildings.find(b => b.id === r.buildingId)?.name || '',
      cell: ({ row: { original: r } }) => {
        const building = buildings.find(b => b.id === r.buildingId)
        const campus = campuses.find(c => c.id === building?.campusId)
        return (
          <>
            <p className="font-medium text-slate-700">{building?.name || '—'}</p>
            <p className="text-[11px] text-slate-400">{campus?.name || ''}</p>
          </>
        )
      },
    },
    {
      id: 'floor',
      header: 'Floor',
      accessorFn: r => r.floor || 'Ground Floor',
      meta: { tdClassName: 'py-3.5 px-4 text-slate-600 whitespace-nowrap' },
    },
    {
      id: 'size',
      header: 'Size',
      accessorFn: r => Number(r.roomSizeSqft) || 0,
      meta: { tdClassName: 'py-3.5 px-4 text-slate-600 whitespace-nowrap tabular-nums' },
      cell: ({ row: { original: r } }) => (r.roomSizeSqft ? `${r.roomSizeSqft} sq ft` : '—'),
    },
    {
      id: 'assets',
      header: 'Assets',
      accessorFn: r => assets.filter(a => a.roomId === r.id && a.status !== 'Retired').length,
      meta: { tdClassName: 'py-3.5 px-4 font-semibold text-slate-700 tabular-nums' },
    },
    {
      id: 'reservable',
      header: 'Reservable',
      accessorFn: r => (r.isReservable ? 'Yes' : 'No'),
      meta: { tdClassName: 'py-3.5 px-4 text-slate-600' },
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: r => r.status,
      cell: ({ row: { original: r } }) => (
        <div className="space-y-1">
          <span
            className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              r.status === 'Occupied'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : r.status === 'Under Maintenance'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {r.status}
          </span>
          {r.currentOccupant ? (
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <User className="w-3 h-3 text-amber-600" />
              {r.currentOccupant}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { thClassName: 'py-3.5 px-6', tdClassName: 'py-3.5 px-6' },
      cell: ({ row: { original: r } }) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={roomHref(r)}
            className="btn btn-ghost btn-sm"
          >
            Room Hub
            <ChevronRight className="w-3 h-3" />
          </Link>
          <button
            type="button"
            onClick={() => openEditModal(r)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
            title="Edit Room"
            aria-label={`Edit ${r.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(r.id, r.name, r.roomNumber)}
            className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
            title="Delete Room"
            aria-label={`Delete ${r.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Organization' }, { label: 'Rooms/Areas' }]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rooms & Operational Areas</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage operational spaces, customizable Room Types, and dynamic building floor allocations</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setNewRoomTypeName('')
                vType.reset()
                setShowTypeModal(true)
              }}
              className="btn btn-secondary"
            >
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>Manage Room Types</span>
            </button>

            <button
              onClick={openCreateModal}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Room/Area</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ROM-####, room name, building..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Room Type Dropdown Filter */}
            <div className="flex items-center gap-2">
              <div className="relative min-w-[220px]">
                <select
                  value={roomTypeFilter}
                  onChange={e => setRoomTypeFilter(e.target.value)}
                  className={`w-full appearance-none pl-3.5 pr-8 py-2 border rounded-xl text-xs font-medium cursor-pointer transition ${
                    roomTypeFilter !== 'ALL'
                      ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold ring-2 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  <option value="ALL">All Room Types ({rooms.length})</option>
                  {roomTypes.map(rt => {
                    const count = rooms.filter(r => r.type === rt).length
                    return (
                      <option key={rt} value={rt}>
                        {rt} ({count})
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {roomTypeFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setRoomTypeFilter('ALL')}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer shrink-0"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Records Counter */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              {filteredRooms.length} {filteredRooms.length === 1 ? 'Room' : 'Rooms'}
            </span>
          </div>
        </div>

        {/* Room Cards */}
        {filteredRooms.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <DoorOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Rooms / Operational Areas Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || roomTypeFilter !== 'ALL'
                ? 'No rooms match your active search and filter criteria.'
                : 'Add rooms, classrooms, laboratories, and simulator spaces to organize assets and schedule room reservations.'}
            </p>
            {searchQuery || roomTypeFilter !== 'ALL' ? (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setRoomTypeFilter('ALL')
                }}
                className="btn btn-secondary"
              >
                <span>Clear All Filters</span>
              </button>
            ) : (
              <button
                onClick={openCreateModal}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Room</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <DataTable
              tableId="rooms"
              data={filteredRooms}
              columns={roomColumns}
              getRowId={r => r.id}
              resetKey={`${searchQuery}|${roomTypeFilter}`}
              initialSorting={[{ id: 'roomNumber', desc: false }]}
            />
          </div>
        )}

        {/* Modal 1: Add/Edit Room Modal */}
        {showModal && (
            <Modal title={editingRoom ? 'Edit Room / Area' : 'Add New Room / Area'} onClose={() => setShowModal(false)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingRoom ? 'Edit Room / Area' : 'Add New Room / Area'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingRoom ? `ID: ${editingRoom.id}` : 'System will automatically assign next ROM-#### ID & QR Key'}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={submitOnce(handleSubmit)} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">1. Select Campus *</label>
                    <select
                      value={campusId}
                      onChange={e => handleCampusChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      {campuses.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code || c.id})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">2. Select Building *</label>
                    <select
                      {...vRoom.props('buildingId')}
                      value={buildingId}
                      onChange={e => handleBuildingChange(e.target.value)}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 ${INVALID}`}
                    >
                      {availableBuildings.length === 0 ? (
                        <option value="">No buildings in this campus</option>
                      ) : (
                        availableBuildings.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.code || b.id})</option>
                        ))
                      )}
                    </select>
                    {vRoom.error('buildingId')}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room / Area Name *</label>
                  <input
                    type="text"
                    {...vRoom.props('name')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Full Mission Bridge Simulator"
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl ${INVALID}`}
                  />
                  {vRoom.error('name')}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Floor * ({selectedBuildingObj?.totalFloors || 1} Floors)</label>
                    <select
                      value={floor}
                      onChange={e => setFloor(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      {floorOptions.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Room Size (Sqft) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        {...vRoom.props('roomSizeSqft')}
                        value={roomSizeSqft}
                        onChange={e => setRoomSizeSqft(e.target.value)}
                        placeholder="e.g. 600"
                        className={`w-full px-3 py-2 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 ${INVALID}`}
                      />
                      {vRoom.error('roomSizeSqft')}
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[11px]">
                        Sqft
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Room Type *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewRoomTypeName('')
                        vType.reset()
                        setShowTypeModal(true)
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Room Type</span>
                    </button>
                  </div>
                  <select
                    value={type}
                    onChange={e => handleRoomTypeSelectChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    {roomTypes.map(rt => (
                      <option key={rt} value={rt}>{rt}</option>
                    ))}
                    <option value="__ADD_NEW_TYPE__">+ Add New Room Type...</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="resCheck"
                    checked={isReservable}
                    onChange={e => setIsReservable(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="resCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Enable faculty reservations for this room (Section 15)
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editingRoom ? 'Save Changes' : 'Create Room'}
                  </button>
                </div>
              </form>
            </Modal>
        )}

        {/* Modal 2: Add / Manage Room Types Modal */}
        {showTypeModal && (
            <Modal title="Add Room Type" onClose={() => setShowTypeModal(false)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Room Type</h3>
                  <p className="text-xs text-slate-500">Define custom room & area classifications</p>
                </div>
                <button onClick={() => setShowTypeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Add Input Form */}
              <form onSubmit={submitOnce(handleSaveNewRoomType)} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">New Room Type Name *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      {...vType.props('name')}
                      value={newRoomTypeName}
                      onChange={e => setNewRoomTypeName(e.target.value)}
                      placeholder="e.g. Server Room, Auditorium, Infirmary"
                      className={`flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 ${INVALID}`}
                    />
                    {vType.error('name')}
                    <button
                      type="submit"
                      className="btn btn-primary shrink-0"
                    >
                      Add Type
                    </button>
                  </div>
                </div>
              </form>

              {/* Existing Room Types List */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700">Existing Configured Types ({roomTypes.length})</p>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {roomTypes.map(rt => {
                    const count = rooms.filter(r => r.type === rt).length
                    return (
                      <span
                        key={rt}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800"
                      >
                        <Tag className="w-3 h-3 text-blue-600" />
                        <span>{rt}</span>
                        <span className="text-[10px] text-slate-400 font-bold ml-0.5">({count})</span>
                        {count === 0 ? (
                          <button
                            type="button"
                            onClick={() => void handleRemoveRoomType(rt)}
                            className="ml-0.5 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            aria-label={`Remove room type ${rt}`}
                            title="Remove (no room uses it)"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        ) : null}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="btn btn-secondary"
                >
                  Done
                </button>
              </div>
            </Modal>
        )}
      </div>
    </AppLayout>
  )
}
