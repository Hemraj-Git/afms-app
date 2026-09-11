'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import {
  DoorOpen,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  LogOut,
  Camera,
  Upload,
  Clock,
  MapPin,
  Building,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Check,
  Plus,
  RefreshCw,
  QrCode,
  Tag,
  Layers,
} from 'lucide-react'
import { Room, Asset, ServiceRequest } from '@/types/afms'

function QrFlowContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const queryType = searchParams.get('type')?.toLowerCase()
  const queryId = searchParams.get('id')
  const queryCode = searchParams.get('code')

  const {
    currentUser,
    isLoggedIn,
    logout,
    rooms,
    assets,
    buildings,
    campuses,
    categories,
    checkInRoom,
    checkOutRoom,
    addServiceRequest,
  } = useAFMS()

  // Find target entity
  const targetRoom: Room | undefined = rooms.find(
    r =>
      (queryType === 'room' && (r.id === queryId || r.qrCodeKey === queryId)) ||
      r.id === queryId ||
      r.qrCodeKey === queryCode ||
      r.id === queryCode
  )

  const targetAsset: Asset | undefined = assets.find(
    a =>
      (queryType === 'asset' && (a.id === queryId || a.assetId === queryId)) ||
      a.id === queryId ||
      a.assetId === queryCode ||
      a.id === queryCode
  )

  const isRoom = Boolean(targetRoom && (queryType === 'room' || !targetAsset))
  const isAsset = Boolean(targetAsset && !isRoom)

  // Auth Guard
  useEffect(() => {
    if (!isLoggedIn) {
      const fullQuery = searchParams.toString()
      const destination = `/qr${fullQuery ? `?${fullQuery}` : ''}`
      router.replace(`/login?redirect=${encodeURIComponent(destination)}`)
    }
  }, [isLoggedIn, searchParams, router])

  // UI States for Room flow
  const [roomAction, setRoomAction] = useState<'none' | 'checkin' | 'service_request'>('none')
  const [checkInPurpose, setCheckInPurpose] = useState('Maritime Training Session')
  const [checkInSuccess, setCheckInSuccess] = useState(false)

  // Service Request Mode inside Room: 'maintenance' | 'housekeeping' | null
  const [roomServiceType, setRoomServiceType] = useState<'Maintenance' | 'Housekeeping' | null>(null)
  const [selectedAssetForMaintenance, setSelectedAssetForMaintenance] = useState<Asset | null>(null)

  // Form Fields for Service Request
  const [srTitle, setSrTitle] = useState('')
  const [srDescription, setSrDescription] = useState('')
  const [srPriority, setSrPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium')
  const [srPhotoAttached, setSrPhotoAttached] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState<ServiceRequest | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when changing type
  const resetForm = () => {
    setSrTitle('')
    setSrDescription('')
    setSrPriority('Medium')
    setSrPhotoAttached(false)
    setSubmittedTicket(null)
  }

  // Handle Check In
  const handleCheckIn = () => {
    if (!targetRoom) return
    checkInRoom(targetRoom.id, checkInPurpose)
    setCheckInSuccess(true)
    setTimeout(() => setCheckInSuccess(false), 3000)
    setRoomAction('none')
  }

  // Handle Check Out
  const handleCheckOut = () => {
    if (!targetRoom) return
    checkOutRoom(targetRoom.id)
    setCheckInSuccess(true)
    setTimeout(() => setCheckInSuccess(false), 3000)
  }

  // Handle Submit Service Request
  const handleSubmitServiceRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!srTitle.trim() || !srDescription.trim()) return

    setIsSubmitting(true)

    const reqType = isAsset ? 'Maintenance' : roomServiceType || 'Maintenance'
    const assignedRoomId = isAsset ? (targetAsset?.roomId || 'ROM-0001') : targetRoom?.id || 'ROM-0001'
    const assignedAssetId = isAsset ? targetAsset?.id : selectedAssetForMaintenance?.id

    const created = addServiceRequest({
      title: srTitle.trim(),
      description: srDescription.trim(),
      requestType: reqType,
      roomId: assignedRoomId,
      assetId: assignedAssetId,
      priority: srPriority,
      requestedBy: currentUser.fullName,
      requestedByRole: currentUser.role,
      status: 'Open',
      slaDueDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      photoUrls: srPhotoAttached
        ? ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=60']
        : undefined,
    })

    setSubmittedTicket(created)
    setIsSubmitting(false)
  }

  // If redirecting to login
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center space-y-4 border border-slate-200">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Authenticating Access</h3>
            <p className="text-xs text-slate-500">Checking credentials... Redirecting to login page.</p>
          </div>
          <Link
            href={`/login?redirect=${encodeURIComponent(
              `/qr?${searchParams.toString()}`
            )}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 underline"
          >
            <span>Click here if not redirected automatically</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  // If neither room nor asset matched (fallback or direct navigation)
  if (!targetRoom && !targetAsset) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">AFMS Unified QR Scanner Hub</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Point your camera at an AFMS room tag or asset QR label, or choose an entity below to test the workflow.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Test Sample Rooms:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rooms.slice(0, 4).map(r => (
                <Link
                  key={r.id}
                  href={`/qr?type=room&id=${r.id}`}
                  className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition text-left space-y-0.5"
                >
                  <p className="text-xs font-bold text-slate-800 truncate">{r.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Room {r.roomNumber} • {r.status}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Test Sample Assets:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {assets.slice(0, 4).map(a => (
                <Link
                  key={a.id}
                  href={`/qr?type=asset&id=${a.id}`}
                  className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition text-left space-y-0.5"
                >
                  <p className="text-xs font-bold text-slate-800 truncate">{a.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{a.assetId} • {a.status}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
            <span>Logged in: <strong className="text-slate-800">{currentUser.fullName}</strong> ({currentUser.role})</span>
            <button
              onClick={() => logout()}
              className="text-rose-600 hover:text-rose-800 font-semibold"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  const building = isRoom && targetRoom ? buildings.find(b => b.id === targetRoom.buildingId) : undefined
  const campus = building ? campuses.find(c => c.id === building.campusId) : undefined
  const roomAssets = isRoom && targetRoom ? assets.filter(a => a.roomId === targetRoom.id) : []

  const assetRoom = isAsset && targetAsset ? rooms.find(r => r.id === targetAsset.roomId) : undefined

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16">
      {/* Top Mobile-Friendly Action Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              User: <strong className="text-slate-800">{currentUser.fullName}</strong>
            </span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
              {currentUser.role}
            </span>
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Success toast after check in / check out */}
        {checkInSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Occupancy status updated successfully!</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SCENARIO 1: SCANNED QR IS OF A ROOM                          */}
        {/* ------------------------------------------------------------- */}
        {isRoom && targetRoom && (
          <div className="space-y-5 animate-in fade-in">
            {/* Room Info Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <DoorOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                        {targetRoom.name}
                      </h1>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          targetRoom.status === 'Occupied'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {targetRoom.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Room {targetRoom.roomNumber} • {targetRoom.floor || 'Floor 1'} • {building?.name || 'Main Building'}
                    </p>
                  </div>
                </div>

                <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                  {targetRoom.qrCodeKey || targetRoom.id}
                </span>
              </div>

              {/* Occupancy Indicator */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Current Occupant:</span>
                  <strong className="text-slate-900 font-semibold">
                    {targetRoom.currentOccupant || 'None (Vacant)'}
                  </strong>
                </div>
                <div className="text-[11px] text-slate-400">
                  Size: {targetRoom.roomSizeSqft || 450} sq.ft
                </div>
              </div>

              {/* Check In / Check Out Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {targetRoom.status === 'Available' ? (
                  <button
                    onClick={() => {
                      setRoomAction(roomAction === 'checkin' ? 'none' : 'checkin')
                      resetForm()
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-xs transition text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Check In to This Room</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-xs transition text-xs flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Check Out (Release Room)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setRoomAction(roomAction === 'service_request' ? 'none' : 'service_request')
                    setRoomServiceType(null)
                    setSelectedAssetForMaintenance(null)
                    resetForm()
                  }}
                  className={`w-full py-3 px-4 rounded-2xl font-bold transition text-xs flex items-center justify-center gap-2 border ${
                    roomAction === 'service_request'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-blue-700 border-blue-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Raise Service Request</span>
                </button>
              </div>

              {/* Check In Purpose Drawer */}
              {roomAction === 'checkin' && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-emerald-950">Confirm Room Check-in</h3>
                    <p className="text-[11px] text-emerald-800">
                      Checking in will assign this room as occupied by <strong className="font-semibold">{currentUser.fullName}</strong>.
                    </p>
                    <p className="text-[10px] text-emerald-700 font-medium bg-emerald-100/70 px-2 py-1 rounded-lg">
                      ⏰ <strong>Daily auto-checkout:</strong> Rooms automatically check out at 11:59 PM if not checked out manually before end-of-day.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                      Session / Training Purpose
                    </label>
                    <input
                      type="text"
                      value={checkInPurpose}
                      onChange={e => setCheckInPurpose(e.target.value)}
                      placeholder="e.g. Navigation Bridge Simulation Batch 12"
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCheckIn}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
                    >
                      Confirm Check-In
                    </button>
                    <button
                      onClick={() => setRoomAction('none')}
                      className="px-3 py-2 bg-white text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl border border-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SERVICE REQUEST SECTION FOR ROOM */}
            {roomAction === 'service_request' && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">Select Service Request Type</h2>
                  <p className="text-xs text-slate-500">
                    What kind of service is needed for {targetRoom.name}?
                  </p>
                </div>

                {/* Service Type Selection: Maintenance vs Housekeeping */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRoomServiceType('Maintenance')
                      setSelectedAssetForMaintenance(null)
                      resetForm()
                    }}
                    className={`p-4 rounded-2xl border text-left space-y-2 transition ${
                      roomServiceType === 'Maintenance'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Maintenance</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Equipment, simulators, AC, electrical or fixture issues
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoomServiceType('Housekeeping')
                      setSelectedAssetForMaintenance(null)
                      resetForm()
                    }}
                    className={`p-4 rounded-2xl border text-left space-y-2 transition ${
                      roomServiceType === 'Housekeeping'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Housekeeping</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Cleaning, spills, sanitization, trash or room supplies
                      </p>
                    </div>
                  </button>
                </div>

                {/* SUB-FLOW 1: MAINTENANCE -> ASSETS IN THIS ROOM */}
                {roomServiceType === 'Maintenance' && (
                  <div className="space-y-4 pt-2 animate-in fade-in">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Select Asset Present in this Room:
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Select which equipment requires repair or servicing
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {roomAssets.length === 0 ? (
                        <div className="col-span-2 p-4 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
                          No registered equipment assets in this room. You can report a general room maintenance issue.
                        </div>
                      ) : (
                        roomAssets.map(assetItem => (
                          <div
                            key={assetItem.id}
                            onClick={() => setSelectedAssetForMaintenance(assetItem)}
                            className={`p-3 rounded-2xl border cursor-pointer transition space-y-1 ${
                              selectedAssetForMaintenance?.id === assetItem.id
                                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                                : 'bg-slate-50/60 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-bold text-blue-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {assetItem.assetId}
                              </span>
                              <span className="text-[9px] font-semibold text-slate-500">
                                {assetItem.status}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 line-clamp-1">{assetItem.name}</p>
                            <p className="text-[10px] text-slate-400">Model: {assetItem.modelNumber || 'Standard'}</p>
                          </div>
                        ))
                      )}

                      {/* General Room Fixture Option */}
                      <div
                        onClick={() => setSelectedAssetForMaintenance(null)}
                        className={`p-3 rounded-2xl border cursor-pointer transition space-y-1 ${
                          selectedAssetForMaintenance === null && roomAssets.length > 0
                            ? 'bg-slate-100 border-slate-400'
                            : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600">General Fixture</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">General Room Fixture</p>
                        <p className="text-[10px] text-slate-400">Lighting, power sockets, doors, desks, etc.</p>
                      </div>
                    </div>

                    {/* Maintenance Request Form */}
                    <form onSubmit={handleSubmitServiceRequest} className="space-y-4 pt-3 border-t border-slate-100">
                      <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900">
                        Reporting Maintenance For:{' '}
                        <strong>
                          {selectedAssetForMaintenance
                            ? `${selectedAssetForMaintenance.name} (${selectedAssetForMaintenance.assetId})`
                            : `General Fixture in ${targetRoom.name}`}
                        </strong>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Problem Summary / Issue Title<span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={srTitle}
                          onChange={e => setSrTitle(e.target.value)}
                          placeholder="e.g. Radar screen flickering or AC cooling failure"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Detailed Description of Symptoms<span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={srDescription}
                          onChange={e => setSrDescription(e.target.value)}
                          placeholder="Describe the issue, unusual noises, error codes or when the breakdown occurred..."
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700">Priority Level</label>
                          <select
                            value={srPriority}
                            onChange={e => setSrPriority(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                          >
                            <option value="Low">Low - Minor issue</option>
                            <option value="Medium">Medium - Normal priority</option>
                            <option value="High">High - Impairing training session</option>
                            <option value="Critical">Critical - Safety risk / Full stop</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700">Photo Evidence</label>
                          <button
                            type="button"
                            onClick={() => setSrPhotoAttached(!srPhotoAttached)}
                            className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                              srPhotoAttached
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Camera className="w-4 h-4" />
                            <span>{srPhotoAttached ? 'Photo Attached ✓' : 'Attach Camera Photo'}</span>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xs transition text-xs sm:text-sm flex items-center justify-center gap-2"
                      >
                        <Wrench className="w-4 h-4" />
                        <span>Submit Maintenance Ticket</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* SUB-FLOW 2: HOUSEKEEPING FOR ROOM */}
                {roomServiceType === 'Housekeeping' && (
                  <form onSubmit={handleSubmitServiceRequest} className="space-y-4 pt-2 animate-in fade-in">
                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900">
                      Housekeeping Ticket for <strong>{targetRoom.name}</strong> (Room {targetRoom.roomNumber})
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Housekeeping Type / Summary<span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={srTitle}
                        onChange={e => setSrTitle(e.target.value)}
                        placeholder="e.g. Floor spill cleanup, dust cleaning or waste disposal"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Cleaning Details & Location within Room<span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={srDescription}
                        onChange={e => setSrDescription(e.target.value)}
                        placeholder="Provide details (e.g. water spill near simulator console, trash cans full, needs floor vacuum)..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">Urgency</label>
                        <select
                          value={srPriority}
                          onChange={e => setSrPriority(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          <option value="Low">Low - Routine cleaning</option>
                          <option value="Medium">Medium - Prompt cleanup needed</option>
                          <option value="High">High - Spillage causing disruption</option>
                          <option value="Critical">Critical - Slip hazard / biohazard</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">Photo Evidence</label>
                        <button
                          type="button"
                          onClick={() => setSrPhotoAttached(!srPhotoAttached)}
                          className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                            srPhotoAttached
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <Camera className="w-4 h-4" />
                          <span>{srPhotoAttached ? 'Photo Attached ✓' : 'Attach Camera Photo'}</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl shadow-xs transition text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Submit Housekeeping Request</span>
                    </button>
                  </form>
                )}

                {/* Submitted Confirmation Modal / Alert */}
                {submittedTicket && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Ticket Created Successfully!</span>
                    </div>
                    <div className="text-xs text-emerald-800 space-y-1">
                      <p>
                        Ticket ID: <strong className="font-mono font-bold">{submittedTicket.ticketId}</strong>
                      </p>
                      <p>Type: {submittedTicket.requestType} • Priority: {submittedTicket.priority}</p>
                      <p>Status: <span className="font-semibold text-emerald-700">Open (Pending Admin Assignment)</span></p>
                    </div>
                    <div className="pt-2 flex gap-2">
                      <Link
                        href="/service-requests"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
                      >
                        View in Service Requests Hub
                      </Link>
                      <button
                        onClick={() => {
                          setSubmittedTicket(null)
                          setRoomAction('none')
                        }}
                        className="px-3 py-2 bg-white text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl border border-slate-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SCENARIO 2: SCANNED QR IS OF AN ASSET                        */}
        {/* ------------------------------------------------------------- */}
        {isAsset && targetAsset && (
          <div className="space-y-5 animate-in fade-in">
            {/* Asset Info Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                        {targetAsset.name}
                      </h1>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          targetAsset.status === 'Operational'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : targetAsset.status === 'Under Maintenance'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {targetAsset.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      Asset Tag: <strong className="text-blue-600 font-bold">{targetAsset.assetId}</strong> • Model: {targetAsset.modelNumber || 'Standard'}
                    </p>
                  </div>
                </div>

                <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                  {targetAsset.id}
                </span>
              </div>

              {/* Location indicator */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Location:</span>
                  <strong className="text-slate-900 font-semibold">
                    {assetRoom ? `${assetRoom.name} (Room ${assetRoom.roomNumber})` : 'Main Facility'}
                  </strong>
                </div>
                <Link
                  href={`/assets/${targetAsset.id}`}
                  className="text-blue-600 hover:text-blue-800 font-semibold underline text-[11px]"
                >
                  Full Asset Dossier →
                </Link>
              </div>
            </div>

            {/* DIRECT MAINTENANCE SERVICE REQUEST OPTION FOR ASSET */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <span>Raise Maintenance Service Request</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Report equipment malfunction, breakdown, or request inspection
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
                  Direct Asset Dispatch
                </span>
              </div>

              <form onSubmit={handleSubmitServiceRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Issue Title / Defect Summary<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={srTitle}
                    onChange={e => setSrTitle(e.target.value)}
                    placeholder="e.g. Unit fails to power on, error code E4 displayed"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Detailed Symptoms & Observations<span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={srDescription}
                    onChange={e => setSrDescription(e.target.value)}
                    placeholder="Describe problem details, operational impact, error logs or observed hardware symptoms..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Priority Level</label>
                    <select
                      value={srPriority}
                      onChange={e => setSrPriority(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      <option value="Low">Low - Cosmetic / Routine check</option>
                      <option value="Medium">Medium - Standard maintenance</option>
                      <option value="High">High - Degraded performance</option>
                      <option value="Critical">Critical - Full breakdown / Safety risk</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Photo Evidence</label>
                    <button
                      type="button"
                      onClick={() => setSrPhotoAttached(!srPhotoAttached)}
                      className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                        srPhotoAttached
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      <span>{srPhotoAttached ? 'Photo Attached ✓' : 'Attach Camera Photo'}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xs transition text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Submit Maintenance Ticket</span>
                </button>
              </form>

              {/* Submitted Confirmation Modal / Alert */}
              {submittedTicket && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Maintenance Service Request Created!</span>
                  </div>
                  <div className="text-xs text-emerald-800 space-y-1">
                    <p>
                      Ticket ID: <strong className="font-mono font-bold">{submittedTicket.ticketId}</strong>
                    </p>
                    <p>Asset: {targetAsset.name} ({targetAsset.assetId})</p>
                    <p>Status: <span className="font-semibold text-emerald-700">Open (Pending Dispatch)</span></p>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <Link
                      href="/service-requests"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
                    >
                      View in Service Requests Hub
                    </Link>
                    <button
                      onClick={() => {
                        setSubmittedTicket(null)
                        resetForm()
                      }}
                      className="px-3 py-2 bg-white text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl border border-slate-200"
                    >
                      Create Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function QrFlowPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading AFMS QR Module...</span>
          </div>
        </div>
      }
    >
      <QrFlowContent />
    </Suspense>
  )
}
