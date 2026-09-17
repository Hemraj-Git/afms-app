'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { getLocalDateStr, formatDateDisplay } from '@/lib/dateUtils'
import {
  CalendarCheck2,
  Clock,
  DoorOpen,
  Plus,
  Check,
  Search,
  SlidersHorizontal,
  Calendar,
  Layers,
  Building,
  User,
  Users,
  AlertCircle,
  Trash2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Info,
  CalendarRange,
} from 'lucide-react'
import { Reservation, UserProfile, Department } from '@/types/afms'

export default function ReservationsPage() {
  const {
    rooms,
    users,
    departments,
    reservations,
    addBulkReservations,
    updateReservationStatus,
    deleteReservation,
    currentUser,
  } = useAFMS()

  const reservableRooms = rooms.filter(r => r.isReservable)

  // View Mode: 'grid' (Timetable Schedule) or 'list' (Master Reservation Bookings)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Date selection for grid view (default today)
  const [selectedGridDate, setSelectedGridDate] = useState(getLocalDateStr())

  // Filter state for list view
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [listRoomFilter, setListRoomFilter] = useState('ALL')
  const [listStatusFilter, setListStatusFilter] = useState('ALL')
  const [listTimeframeFilter, setListTimeframeFilter] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL')

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  
  // Date Range Configuration
  const [startDate, setStartDate] = useState(getLocalDateStr())
  const [endDate, setEndDate] = useState(getLocalDateStr())
  
  // Day of week exclusion (0=Sun, 1=Mon, ..., 6=Sat)
  // Default: exclude Sat (6) and Sun (0) if date range spans multiple days
  const [excludedDays, setExcludedDays] = useState<number[]>([0, 6]) // 0=Sunday, 6=Saturday

  // Multiple Slot Selection (Hour numbers: 9 to 16)
  const [selectedSlotHours, setSelectedSlotHours] = useState<number[]>([9])

  // Dynamic User & Department Linking
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id || '')
  const [departmentName, setDepartmentName] = useState(currentUser.department || '')
  const [purpose, setPurpose] = useState('Faculty Training Session')

  // User searchable dropdown in modal
  const [userQuery, setUserQuery] = useState('')
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

  // Defined Time Slots (1-hour slots from 09:00 AM to 05:00 PM)
  const standardTimeSlots = [
    { hour: 9, label: '09:00 AM - 10:00 AM', shortLabel: '09:00 AM' },
    { hour: 10, label: '10:00 AM - 11:00 AM', shortLabel: '10:00 AM' },
    { hour: 11, label: '11:00 AM - 12:00 PM', shortLabel: '11:00 AM' },
    { hour: 12, label: '12:00 PM - 01:00 PM', shortLabel: '12:00 PM' },
    { hour: 13, label: '01:00 PM - 02:00 PM', shortLabel: '01:00 PM' },
    { hour: 14, label: '02:00 PM - 03:00 PM', shortLabel: '02:00 PM' },
    { hour: 15, label: '03:00 PM - 04:00 PM', shortLabel: '03:00 PM' },
    { hour: 16, label: '04:00 PM - 05:00 PM', shortLabel: '04:00 PM' },
  ]

  const daysOfWeek = [
    { id: 1, name: 'Monday', short: 'Mon' },
    { id: 2, name: 'Tuesday', short: 'Tue' },
    { id: 3, name: 'Wednesday', short: 'Wed' },
    { id: 4, name: 'Thursday', short: 'Thu' },
    { id: 5, name: 'Friday', short: 'Fri' },
    { id: 6, name: 'Saturday', short: 'Sat' },
    { id: 0, name: 'Sunday', short: 'Sun' },
  ]

  // Helper: check if a given date string is in the past
  // Not .toISOString().split('T')[0] -- that's the UTC calendar date,
  // which was being compared here against currentHour (already local), a
  // mixed-clock bug: right after local midnight, a UTC-lagged todayStr
  // could make yesterday's already-past slots look still bookable.
  const todayStr = getLocalDateStr()
  const currentHour = new Date().getHours()

  const isDateInPast = (dateStr: string) => {
    return dateStr < todayStr
  }

  // Helper: check if a specific slot on a specific date is in the past
  const isSlotInPast = (dateStr: string, slotHour: number) => {
    if (dateStr < todayStr) return true
    if (dateStr === todayStr && slotHour <= currentHour) return true
    return false
  }

  // Helper: get first available future hour for a date
  const getFirstAvailableFutureHour = (dateStr: string) => {
    if (dateStr > todayStr) return 9
    const futureSlot = standardTimeSlots.find(s => s.hour > currentHour)
    return futureSlot ? futureSlot.hour : 9
  }

  // Open booking modal
  const openCreateModal = (roomId?: string, date?: string, slotHour?: number) => {
    // If the date passed is in the past, default to today
    const validDate = date && !isDateInPast(date) ? date : (isDateInPast(selectedGridDate) ? todayStr : selectedGridDate)
    
    // Determine a valid slot hour that is not in the past
    let validSlotHour = slotHour
    if (validSlotHour === undefined || isSlotInPast(validDate, validSlotHour)) {
      validSlotHour = getFirstAvailableFutureHour(validDate)
    }

    setSelectedRoomId(roomId || (reservableRooms[0]?.id ?? ''))
    setStartDate(validDate)
    setEndDate(validDate)
    setSelectedSlotHours([validSlotHour])
    
    const initialUser = users.find(u => u.id === currentUser.id) || users[0]
    if (initialUser) {
      setSelectedUserId(initialUser.id)
      setDepartmentName(initialUser.department || 'Facility Operations')
    }
    
    setPurpose('Classroom Lecture & Simulator Training')
    setShowBookingModal(true)
  }

  // Handle user selection with dynamic department link
  const handleSelectUser = (u: UserProfile) => {
    setSelectedUserId(u.id)
    setDepartmentName(u.department || 'Academic Operations')
    setIsUserDropdownOpen(false)
    setUserQuery('')
  }

  // Toggle Day Exclusion
  const toggleExcludeDay = (dayId: number) => {
    setExcludedDays(prev =>
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    )
  }

  // Toggle Slot Selection (Prevent selecting past slots)
  const toggleSlotHour = (hour: number) => {
    // If all active booking dates have this slot in the past, block selection
    const isPastForAllActiveDates = activeBookingDates.length > 0 && activeBookingDates.every(d => isSlotInPast(d, hour))
    if (isPastForAllActiveDates) return

    setSelectedSlotHours(prev =>
      prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour]
    )
  }

  // Compute all target dates between startDate and endDate taking exclusions into account (Timezone-safe)
  const computeActiveDates = (startStr: string, endStr: string, excluded: number[]) => {
    if (!startStr || !endStr) return []

    const [startYear, startMonth, startDay] = startStr.split('-').map(Number)
    const [endYear, endMonth, endDay] = endStr.split('-').map(Number)

    const cur = new Date(startYear, startMonth - 1, startDay, 12, 0, 0)
    const end = new Date(endYear, endMonth - 1, endDay, 12, 0, 0)

    const dates: string[] = []

    while (cur <= end) {
      const dayOfWeek = cur.getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
      if (!excluded.includes(dayOfWeek)) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        const d = String(cur.getDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${d}`)
      }
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  }

  const activeBookingDates = computeActiveDates(startDate, endDate, excludedDays)
  const totalSlotsToGenerate = activeBookingDates.length * selectedSlotHours.length

  // Handle Submit Reservation
  const handleConfirmReservation = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRoomId) {
      alert('Please select a reservable facility room.')
      return
    }

    if (activeBookingDates.length === 0) {
      alert('No active dates selected in the date range. Please check your start/end dates and day exclusions.')
      return
    }

    if (selectedSlotHours.length === 0) {
      alert('Please select at least one time slot.')
      return
    }

    const room = rooms.find(r => r.id === selectedRoomId)
    const user = users.find(u => u.id === selectedUserId)
    const roomName = room ? `${room.name} (${room.roomNumber})` : 'Training Room'
    const userName = user ? user.fullName : 'Faculty Member'
    const userRole = user ? user.role : 'Faculty'

    const groupBookingId = `GRP-${Date.now().toString(36).toUpperCase()}`

    // Build payload array for all valid dates x chosen slots, excluding any past date/time slots
    const reservationsPayload: Array<Omit<Reservation, 'id' | 'reservationNumber' | 'createdAt'>> = []
    let pastSlotCount = 0

    activeBookingDates.forEach(dateStr => {
      selectedSlotHours.forEach(hour => {
        if (isSlotInPast(dateStr, hour)) {
          pastSlotCount++
          return
        }

        const slotDef = standardTimeSlots.find(s => s.hour === hour)
        const timeSlotLabel = slotDef?.label || `${hour}:00 - ${hour + 1}:00`

        reservationsPayload.push({
          roomId: selectedRoomId,
          roomName,
          userId: selectedUserId,
          userName,
          userRole,
          departmentName: departmentName || user?.department || 'General',
          date: dateStr,
          timeSlot: timeSlotLabel,
          slotHour: hour,
          purpose,
          status: 'Confirmed',
          groupBookingId: reservationsPayload.length > 1 || activeBookingDates.length > 1 ? groupBookingId : undefined,
        })
      })
    })

    if (reservationsPayload.length === 0) {
      alert('Cannot reserve past time slots. Selected slot(s) have already passed. Please select a future date or time slot.')
      return
    }

    const result = addBulkReservations(reservationsPayload)
    if (result.success) {
      setShowBookingModal(false)
      if (result.conflictCount > 0) {
        alert(result.message)
      }
    } else {
      alert(result.message || 'Could not complete reservation due to conflict.')
    }
  }

  // Filtered reservations for List View
  const filteredReservationsList = reservations.filter(r => {
    if (listRoomFilter !== 'ALL' && r.roomId !== listRoomFilter) return false
    if (listStatusFilter !== 'ALL' && r.status !== listStatusFilter) return false
    
    // Timeframe Filter: ALL, UPCOMING (future or today future slots), PAST (past dates or today passed slots)
    if (listTimeframeFilter === 'UPCOMING') {
      const isPast = isSlotInPast(r.date, r.slotHour)
      if (isPast) return false
    } else if (listTimeframeFilter === 'PAST') {
      const isPast = isSlotInPast(r.date, r.slotHour)
      if (!isPast) return false
    }

    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase()
      const matchRoom = r.roomName.toLowerCase().includes(q)
      const matchUser = r.userName.toLowerCase().includes(q)
      const matchDept = r.departmentName?.toLowerCase().includes(q) || false
      const matchPurpose = r.purpose.toLowerCase().includes(q)
      const matchId = r.reservationNumber.toLowerCase().includes(q)
      if (!matchRoom && !matchUser && !matchDept && !matchPurpose && !matchId) return false
    }
    return true
  })

  // Date Shift Helper for Grid View (permits navigating to past dates for inspection)
  const shiftGridDate = (offsetDays: number) => {
    const d = new Date(selectedGridDate)
    d.setDate(d.getDate() + offsetDays)
    setSelectedGridDate(getLocalDateStr(d))
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Operation' }, { label: 'Reservations' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room &amp; Space Reservations</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-date range scheduling, weekend/custom day exclusions, multi-slot booking, and dynamic faculty &amp; department linking
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Book Reservation</span>
            </button>
          </div>
        </div>

        {/* Control Bar: View Switcher & Date Controls */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Grid</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>All Bookings ({reservations.length})</span>
            </button>
          </div>

          {viewMode === 'grid' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftGridDate(-1)}
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <input
                type="date"
                value={selectedGridDate}
                onChange={e => setSelectedGridDate(e.target.value)}
                className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white"
              />

              <button
                onClick={() => shiftGridDate(1)}
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition"
                title="Next Day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setSelectedGridDate(todayStr)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Today
              </button>
            </div>
          )}
        </div>

        {/* VIEW 1: INTERACTIVE TIMETABLE GRID */}
        {viewMode === 'grid' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden animate-in fade-in">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Facility Schedule for {(() => {
                    const [y, m, d] = selectedGridDate.split('-').map(Number)
                    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  })()}
                </h2>
                <p className="text-xs text-slate-400">Click on any available slot to book or click booked slots to view details</p>
              </div>

              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                {reservableRooms.length} Reservable Rooms
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6 min-w-[200px]">Facility / Room</th>
                    {standardTimeSlots.map(t => (
                      <th key={t.hour} className="py-3.5 px-2 text-center min-w-[110px]">
                        {t.shortLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservableRooms.length === 0 ? (
                    <tr>
                      <td colSpan={standardTimeSlots.length + 1} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <DoorOpen className="w-8 h-8 text-slate-300 stroke-1" />
                          <p className="text-xs font-semibold text-slate-600">No reservable rooms found</p>
                          <p className="text-[11px] text-slate-400">
                            Configure rooms in Organization &gt; Rooms and toggle &quot;Allow Scheduling &amp; Reservations&quot;.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reservableRooms.map(room => (
                      <tr key={room.id} className="hover:bg-slate-50/50 transition">
                        {/* Room Info Cell */}
                        <td className="py-4 px-6 font-bold text-slate-900">
                          <Link href={`/organization/rooms/${room.roomNumber || room.id}`} className="hover:text-blue-600 transition">
                            <p>{room.name}</p>
                          </Link>
                          <p className="text-[11px] font-normal text-slate-400">Room {room.roomNumber} • {room.type}</p>
                        </td>

                        {/* Slot Buttons */}
                        {standardTimeSlots.map(t => {
                          const existingRes = reservations.find(
                            r =>
                              r.roomId === room.id &&
                              r.date === selectedGridDate &&
                              r.slotHour === t.hour &&
                              r.status === 'Confirmed'
                          )

                          const isPassedSlot = isSlotInPast(selectedGridDate, t.hour)

                          return (
                            <td key={t.hour} className="py-3 px-1.5 text-center">
                              {existingRes ? (
                                isPassedSlot ? (
                                  <div
                                    className="w-full py-2 px-1 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs cursor-default select-none"
                                    title={`Reserved by: ${existingRes.userName} (${existingRes.departmentName || 'Faculty'})\nPurpose: ${existingRes.purpose}\n(Past Completed Reservation)`}
                                  >
                                    <p className="truncate font-bold">{existingRes.userName.split(' ')[0]}</p>
                                    <p className="text-[9px] text-slate-500 truncate">{existingRes.departmentName || 'Completed'}</p>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => {
                                      if (confirm(`Cancel reservation for ${room.name} by ${existingRes.userName} (${existingRes.timeSlot})?`)) {
                                        deleteReservation(existingRes.id)
                                      }
                                    }}
                                    className="w-full py-2 px-1 rounded-xl text-[10px] font-bold bg-amber-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-amber-900 border border-amber-200 transition cursor-pointer shadow-2xs"
                                    title={`Reserved by: ${existingRes.userName} (${existingRes.departmentName || 'Faculty'})\nPurpose: ${existingRes.purpose}\nClick to Cancel`}
                                  >
                                    <p className="truncate font-bold">{existingRes.userName.split(' ')[0]}</p>
                                    <p className="text-[9px] text-amber-700 truncate">{existingRes.departmentName || 'Booked'}</p>
                                  </div>
                                )
                              ) : isPassedSlot ? (
                                <div
                                  className="w-full py-2 px-1 rounded-xl text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none"
                                  title={selectedGridDate < todayStr ? 'Past date cannot be booked' : 'This time slot has already passed'}
                                >
                                  {selectedGridDate < todayStr ? 'Closed' : 'Passed'}
                                </div>
                              ) : (
                                <button
                                  onClick={() => openCreateModal(room.id, selectedGridDate, t.hour)}
                                  className="w-full py-2 px-1 rounded-xl text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 transition shadow-2xs"
                                >
                                  Available
                                </button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 2: MASTER RESERVATIONS LIST TABLE */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden animate-in fade-in">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={e => setListSearchQuery(e.target.value)}
                  placeholder="Search by reservation ID, room, faculty, purpose..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={listTimeframeFilter}
                  onChange={e => setListTimeframeFilter(e.target.value as 'ALL' | 'UPCOMING' | 'PAST')}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">All Timeframes</option>
                  <option value="UPCOMING">Upcoming Bookings</option>
                  <option value="PAST">Past Bookings</option>
                </select>

                <select
                  value={listRoomFilter}
                  onChange={e => setListRoomFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="ALL">All Rooms</option>
                  {reservableRooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <select
                  value={listStatusFilter}
                  onChange={e => setListStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="ALL">All Status</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Reservation ID</th>
                    <th className="py-3.5 px-4">Date &amp; Time Slot</th>
                    <th className="py-3.5 px-4">Room / Space</th>
                    <th className="py-3.5 px-4">Reserved By</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Purpose</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReservationsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No reservations found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredReservationsList.map(res => (
                      <tr key={res.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-4 px-6 font-mono font-bold text-blue-600">{res.reservationNumber}</td>
                        <td className="py-4 px-4 font-semibold text-slate-900">
                          <p>{formatDateDisplay(res.date)}</p>
                          <p className="text-[11px] text-slate-400 font-normal">{res.timeSlot}</p>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-800">{res.roomName}</td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-slate-900">{res.userName}</p>
                          <p className="text-[10px] text-slate-400">{res.userRole || 'Staff'}</p>
                        </td>
                        <td className="py-4 px-4 text-slate-600 font-medium">{res.departmentName || '—'}</td>
                        <td className="py-4 px-4 text-slate-700 max-w-xs">{res.purpose}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              res.status === 'Confirmed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : res.status === 'Completed'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {res.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {isSlotInPast(res.date, res.slotHour) ? (
                            <span className="text-[11px] text-slate-400 italic">Past</span>
                          ) : (
                            <button
                              onClick={() => {
                                if (confirm(`Delete reservation ${res.reservationNumber}?`)) {
                                  deleteReservation(res.id)
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Delete Reservation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: MULTI-DATE RANGE & MULTI-SLOT RESERVATION CREATION */}
        {showBookingModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <CalendarCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Create Room Reservation</h3>
                    <p className="text-[11px] text-slate-500">
                      Book single dates or multi-date ranges with custom day exclusions and multi-slot booking
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowBookingModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmReservation} className="space-y-5 text-xs">
                {/* 1. Target Room Selection */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Reservable Room / Area <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={e => setSelectedRoomId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Room</option>
                    {reservableRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Room {r.roomNumber}) • {r.type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Date Range Selection (Start Date to End Date) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Start Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={startDate}
                      onChange={e => {
                        const val = e.target.value
                        if (val >= todayStr) {
                          setStartDate(val)
                          if (val > endDate) setEndDate(val)
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      End Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={startDate || todayStr}
                      value={endDate}
                      onChange={e => {
                        const val = e.target.value
                        if (val >= (startDate || todayStr)) {
                          setEndDate(val)
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900"
                    />
                  </div>

                  {/* Day of Week Exclusions */}
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-semibold text-slate-700">
                        Exclude Days from Range <span className="text-[11px] font-normal text-slate-400">(e.g. Weekends)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (excludedDays.includes(0) && excludedDays.includes(6)) {
                            setExcludedDays([])
                          } else {
                            setExcludedDays([0, 6])
                          }
                        }}
                        className="text-[11px] text-blue-600 font-semibold hover:underline"
                      >
                        {excludedDays.includes(0) && excludedDays.includes(6) ? 'Clear Exclusions' : 'Exclude All Weekends'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map(day => {
                        const isExcluded = excludedDays.includes(day.id)
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleExcludeDay(day.id)}
                            className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition border ${
                              isExcluded
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isExcluded ? `✕ Skip ${day.short}` : day.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Date computation preview banner */}
                  <div className="sm:col-span-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span>
                      Booking spans <strong className="text-blue-600">{activeBookingDates.length} Active Days</strong> (excludes {excludedDays.length} day types)
                    </span>
                    <span className="font-mono text-slate-400">
                      {activeBookingDates.slice(0, 2).join(', ')}
                      {activeBookingDates.length > 2 ? ` ... (+${activeBookingDates.length - 2} more)` : ''}
                    </span>
                  </div>
                </div>

                {/* 3. Multiple Time Slots Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-slate-700">
                      Select Time Slot(s) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const validFutureSlots = standardTimeSlots.filter(s =>
                          activeBookingDates.some(d => !isSlotInPast(d, s.hour))
                        )
                        if (selectedSlotHours.length === validFutureSlots.length) {
                          const fallbackHour = validFutureSlots[0]?.hour || 9
                          setSelectedSlotHours([fallbackHour])
                        } else {
                          setSelectedSlotHours(validFutureSlots.map(s => s.hour))
                        }
                      }}
                      className="text-[11px] text-blue-600 font-semibold hover:underline"
                    >
                      Select All Future Slots
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {standardTimeSlots.map(slot => {
                      const isSelected = selectedSlotHours.includes(slot.hour)
                      const isPastForAllDates = activeBookingDates.length > 0 && activeBookingDates.every(d => isSlotInPast(d, slot.hour))

                      return (
                        <button
                          key={slot.hour}
                          type="button"
                          disabled={isPastForAllDates}
                          onClick={() => toggleSlotHour(slot.hour)}
                          className={`p-2.5 rounded-xl border text-center font-bold text-xs transition ${
                            isPastForAllDates
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                              : isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                          title={isPastForAllDates ? 'This time slot has already passed for the selected date(s)' : slot.label}
                        >
                          <div>{slot.label}</div>
                          {isPastForAllDates && (
                            <div className="text-[10px] font-normal text-rose-500 mt-0.5">(Passed)</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 4. Dynamic User & Department Linking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* User Searchable Dropdown */}
                  <div className="relative">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Faculty / Reserving User <span className="text-rose-500">*</span>
                    </label>
                    <div
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-400"
                    >
                      <span className="font-bold text-slate-900">
                        {users.find(u => u.id === selectedUserId)?.fullName || 'Select Faculty / Staff'}
                      </span>
                      <span className="text-slate-400 text-[10px]">▼</span>
                    </div>

                    {isUserDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in">
                        <input
                          type="text"
                          value={userQuery}
                          onChange={e => setUserQuery(e.target.value)}
                          placeholder="Search faculty name or email..."
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          autoFocus
                        />
                        <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                          {users
                            .filter(
                              u =>
                                u.fullName.toLowerCase().includes(userQuery.toLowerCase()) ||
                                u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
                                (u.department && u.department.toLowerCase().includes(userQuery.toLowerCase()))
                            )
                            .map(u => (
                              <div
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                className={`p-2 rounded-lg cursor-pointer hover:bg-slate-50 flex items-center justify-between ${
                                  selectedUserId === u.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'
                                }`}
                              >
                                <div>
                                  <p className="font-bold">{u.fullName}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {u.role} • {u.department || 'Staff'}
                                  </p>
                                </div>
                                {selectedUserId === u.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dynamically Linked Department */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Department <span className="text-slate-400 font-normal">(Auto-linked)</span>
                    </label>
                    <input
                      type="text"
                      value={departmentName}
                      onChange={e => setDepartmentName(e.target.value)}
                      placeholder="e.g. Nautical Studies, Marine Engineering"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white"
                    />
                  </div>
                </div>

                {/* 5. Purpose of Reservation */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Purpose of Reservation <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder="e.g. Bridge Simulator Batch 42 Navigation Exam & Radar Charting"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  ></textarea>
                </div>

                {/* Summary Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-blue-900 text-xs">Total Slots to Reserve: {totalSlotsToGenerate}</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      {activeBookingDates.length} Days × {selectedSlotHours.length} Slots per day
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-white px-3 py-1 rounded-xl border border-blue-200">
                    Conflict-Checked
                  </span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/25 transition"
                  >
                    Confirm &amp; Book {totalSlotsToGenerate} Slots
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
