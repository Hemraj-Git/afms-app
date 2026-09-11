'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  DoorOpen,
  Boxes,
  Wrench,
  MessageSquare,
  Plus,
  Pencil,
  Download,
  Printer,
  ChevronRight,
  Clock,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  Building2,
  MapPin,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  QrCode,
} from 'lucide-react'

export default function RoomDetailPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = (params?.id as string) || 'ROM-0001'

  const {
    rooms,
    buildings,
    campuses,
    assets,
    serviceRequests,
    roomAccessLogs,
    reservations,
    categories,
    subCategories,
  } = useAFMS()

  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'access_log'>('overview')

  // Find room safely
  const room = rooms.find(r => r.id === roomId)
  const building = room ? buildings.find(b => b.id === room.buildingId) : undefined
  const campus = building ? campuses.find(c => c.id === building.campusId) : undefined

  // Assets inside this room
  const roomAssets = room ? assets.filter(a => a.roomId === room.id) : []
  const roomAssetIds = roomAssets.map(a => a.id)
  const activeAssetsCount = roomAssets.filter(a => a.status === 'Operational').length
  const underMaintCount = roomAssets.filter(a => a.status === 'Under Maintenance').length

  // Open Service Requests linked to this room and its assets only (excluding Resolved/Closed)
  const roomRequests = room
    ? serviceRequests.filter(s => {
        const isRoomMatch = s.roomId === room.id
        const isAssetInRoom = s.assetId ? roomAssetIds.includes(s.assetId) : false
        const isOpen = s.status !== 'Closed' && s.status !== 'Resolved'
        return (isRoomMatch || isAssetInRoom) && isOpen
      })
    : []
  const openRequestsCount = roomRequests.length

  // Access Logs for this room
  const roomLogs = room ? roomAccessLogs.filter(l => l.roomId === room.id) : []
  const mockExtendedLogs = [
    { id: 'EVT020', date: '03.08.2026', time: '02:30 PM', user: 'Capt. John Snow', role: 'Instructor', purpose: 'Training - Radar Simulator', type: 'Check Out' },
    { id: 'EVT021', date: '03.08.2026', time: '10:30 AM', user: 'Capt. John Snow', role: 'Instructor', purpose: 'Training - Navigation Charting', type: 'Check In' },
    { id: 'EVT023', date: '02.08.2026', time: '03:30 PM', user: 'Capt. Peter Parker', role: 'Instructor', purpose: 'Training - Bridge Sim Batch 42', type: 'Check Out' },
    { id: 'EVT024', date: '02.08.2026', time: '11:00 AM', user: 'Capt. Peter Parker', role: 'Instructor', purpose: 'Training - ECDIS Setup', type: 'Check In' },
    { id: 'EVT025', date: '01.08.2026', time: '06:00 PM', user: 'Tom Holland', role: 'Technician', purpose: 'Maintenance - AC and Monitor testing', type: 'Check Out' },
    { id: 'EVT026', date: '01.08.2026', time: '04:00 PM', user: 'Tom Holland', role: 'Technician', purpose: 'Maintenance - Display calibration', type: 'Check In' },
  ]

  // Dynamic Reservations for today (from centralized reservation state)
  const todayStr = new Date().toISOString().split('T')[0]
  const standardHours = [
    { hour: 9, label: '09:00 AM - 10:00 AM' },
    { hour: 10, label: '10:00 AM - 11:00 AM' },
    { hour: 11, label: '11:00 AM - 12:00 PM' },
    { hour: 12, label: '12:00 PM - 01:00 PM' },
    { hour: 13, label: '01:00 PM - 02:00 PM' },
    { hour: 14, label: '02:00 PM - 03:00 PM' },
    { hour: 15, label: '03:00 PM - 04:00 PM' },
    { hour: 16, label: '04:00 PM - 05:00 PM' },
  ]

  const reservationSlots = standardHours.map(slot => {
    const booked = room ? reservations.find(
      r =>
        r.roomId === room.id &&
        r.date === todayStr &&
        r.slotHour === slot.hour &&
        r.status === 'Confirmed'
    ) : undefined

    return {
      time: slot.label,
      status: booked ? ('Booked' as const) : ('Available' as const),
      by: booked ? `${booked.userName} (${booked.departmentName || 'Faculty'})` : undefined,
      purpose: booked?.purpose,
    }
  })

  const bookedHours = reservationSlots.filter(s => s.status === 'Booked').length
  const totalHours = reservationSlots.length

  if (!room) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Rooms/Areas', href: '/organization/rooms' }, { label: 'Room Not Found' }]}>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <DoorOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Room / Space Not Found</h2>
          <p className="text-xs text-slate-500">The requested room could not be loaded or does not exist.</p>
          <Link
            href="/organization/rooms"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <span>Return to Rooms Directory</span>
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Rooms/Areas', href: '/organization/rooms' }, { label: `${room.id} - ${room.name}` }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Room Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {room.id}
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{room.name}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {building?.name || 'Simulator Block'} • {campus?.name || 'Main Campus'} • Room Tag: {room.qrCodeKey || room.id}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/assets/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </Link>
            <button
              onClick={() => router.push('/organization/rooms')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Room</span>
            </button>
          </div>
        </div>

        {/* 3 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Active Assets */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{activeAssetsCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Active Assets</p>
            </div>
          </div>

          {/* Card 2: Assets Under Maintenance */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{underMaintCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Assets Under Maintenance</p>
            </div>
          </div>

          {/* Card 3: Open Service Requests */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{openRequestsCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Open Service Requests</p>
            </div>
          </div>
        </div>

        {/* Main Content Layout (Left: Tabs & Content, Right: QR & Reservations) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Tabs Container */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
              {/* Tab Navigation Headers */}
              <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`text-xs font-bold pb-2 relative transition ${
                    activeTab === 'overview'
                      ? 'text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Overview
                  {activeTab === 'overview' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('assets')}
                  className={`text-xs font-bold pb-2 relative transition ${
                    activeTab === 'assets'
                      ? 'text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Assets
                  {activeTab === 'assets' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('access_log')}
                  className={`text-xs font-bold pb-2 relative transition ${
                    activeTab === 'access_log'
                      ? 'text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Access Log
                  {activeTab === 'access_log' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in">
                  <h3 className="text-sm font-bold text-slate-900">Room Information</h3>

                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold text-[11px]">Room/Area ID</p>
                      <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">{room.id}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold text-[11px]">Room/Area Type</p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {room.type}
                      </span>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold text-[11px]">Floor</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{room.floor || 'Ground Floor'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold text-[11px]">Building/Block</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{building?.name || 'Simulator Block'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold text-[11px]">Campus</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{campus?.name || 'Main Campus'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-semibold text-[11px]">Room Size</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{room.roomSizeSqft || 400} Sqft</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ASSETS LIST */}
              {activeTab === 'assets' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Assets in this Space ({roomAssets.length})</h3>
                    <Link
                      href="/assets/create"
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Asset</span>
                    </Link>
                  </div>

                  {roomAssets.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-slate-200 rounded-xl">
                      <Boxes className="w-8 h-8 text-slate-300 stroke-1" />
                      <p className="text-xs font-semibold text-slate-600">No assets assigned to this room</p>
                      <p className="text-[11px] text-slate-400">Attach existing or newly created assets to this operational space.</p>
                      <Link
                        href="/assets/create"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create &amp; Assign Asset</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                            <th className="py-3 px-4">Asset</th>
                            <th className="py-3 px-4">Subcategory</th>
                            <th className="py-3 px-4">Manufacturer</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {roomAssets.map(ast => {
                            const sub = subCategories.find(s => s.id === ast.subCategoryId)
                            return (
                              <tr key={ast.id} className="hover:bg-slate-50/60 transition group">
                                <td className="py-3 px-4">
                                  <Link href={`/assets/${ast.id}`} className="flex items-center gap-3">
                                     <img
                                       src={ast.imageUrl || '/images/asset-placeholder.png'}
                                       alt={ast.name}
                                       className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                                     />
                                    <div>
                                      <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">{ast.name}</p>
                                      <p className="text-[10px] font-mono text-blue-600 font-semibold">{ast.assetId}</p>
                                    </div>
                                  </Link>
                                </td>
                                <td className="py-3 px-4 text-slate-600 font-medium">{sub?.name || 'Standard'}</td>
                                <td className="py-3 px-4 text-slate-600 font-medium">{ast.manufacturer || '—'}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    ast.status === 'Operational'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {ast.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Link
                                    href={`/assets/${ast.id}`}
                                    className="p-1.5 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition inline-flex items-center gap-1 text-[11px] font-semibold"
                                    title="Open Asset Hub"
                                  >
                                    <span>View Asset</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </Link>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ACCESS LOG */}
              {activeTab === 'access_log' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Access Log (Tamper-Evident QR Check-In / Out)</h3>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Verified Logs
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                          <th className="py-3 px-4">Activity ID</th>
                          <th className="py-3 px-4">Date &amp; Time</th>
                          <th className="py-3 px-4">Access By</th>
                          <th className="py-3 px-4">Purpose</th>
                          <th className="py-3 px-4 text-right">Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {roomLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No access logs recorded for this space yet.
                            </td>
                          </tr>
                        ) : (
                          roomLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/60 transition">
                              <td className="py-3 px-4 font-mono font-semibold text-slate-700">{log.id}</td>
                              <td className="py-3 px-4 text-slate-500 font-medium">{log.checkInTime}</td>
                              <td className="py-3 px-4">
                                <p className="font-bold text-slate-900">{log.userName}</p>
                                <p className="text-[10px] text-slate-400">{log.userRole}</p>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{log.purpose}</td>
                              <td className="py-3 px-4 text-right">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  !log.checkOutTime
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  {!log.checkOutTime ? 'Active In Room' : 'Checked Out'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 cols): QR Tag Card & Today's Reservation Schedule */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card 1: QR Code Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">QR Code</h3>

              <div className="bg-blue-50/40 rounded-2xl p-6 flex flex-col items-center justify-center border border-blue-100 space-y-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=AFMS-${room.qrCodeKey}`}
                    alt="Room QR"
                    className="w-36 h-36 object-contain"
                  />
                </div>
                <p className="font-extrabold text-xs text-slate-900 tracking-tight">
                  {room.id} - {room.name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => alert(`Downloading high-resolution QR vector for ${room.name}...`)}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs flex items-center justify-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print Label</span>
                </button>
              </div>
            </div>

            {/* Card 2: Today's Reservation Timeline (Figma Right Panel) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Today's Reservation</h3>
                <span className="text-xs font-bold text-slate-600">{bookedHours}h / {totalHours}h</span>
              </div>

              {/* Capacity Progress Bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${(bookedHours / totalHours) * 100}%` }}
                ></div>
              </div>

              {/* Slot Items */}
              <div className="space-y-3 pt-2">
                {reservationSlots.map((slot, index) => {
                  const isBooked = slot.status === 'Booked'
                  return (
                    <div key={index} className="flex items-start gap-2.5 text-xs">
                      <Clock className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isBooked ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{slot.time}</span>
                          <span className={`text-[10px] font-semibold ${isBooked ? 'text-slate-600' : 'text-emerald-600'}`}>
                            {isBooked ? slot.by : '• Available'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
