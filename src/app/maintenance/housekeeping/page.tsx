'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { getNextSequence, formatYearlyId } from '@/lib/idGenerator'
import {
  Sparkles,
  Search,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  DoorOpen,
  X,
  AlertCircle,
} from 'lucide-react'

export default function HousekeepingPage() {
  const { workOrders, rooms, users, addWorkOrder, updateWorkOrderStatus } = useAFMS()

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Form fields for new Housekeeping Schedule
  const [title, setTitle] = useState('')
  const [roomId, setRoomId] = useState(rooms[0]?.id || '')
  const [assignedTechnicianId, setAssignedTechnicianId] = useState(
    users.find(u => u.role === 'Housekeeping')?.id || users[0]?.id || ''
  )
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0])
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Low')
  const [notes, setNotes] = useState('')

  const housekeepingOrders = workOrders.filter(w => w.type === 'Housekeeping')

  const filteredOrders = housekeepingOrders.filter(wo => {
    const room = rooms.find(r => r.id === wo.roomId)
    const tech = users.find(u => u.id === wo.assignedTechnicianId)

    return (
      wo.woNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wo.title && wo.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (room && room.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tech && tech.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tech = users.find(u => u.id === assignedTechnicianId)
    const woNum = formatYearlyId('WO-HK', getNextSequence(workOrders.map(w => w.woNumber), 'WO-HK'))

    addWorkOrder({
      woNumber: woNum,
      type: 'Housekeeping',
      title: title || 'Routine Room Sanitization',
      roomId,
      priority,
      source: 'Routine',
      dueDate,
      assignedTechnicianId,
      assignedTechnicianName: tech?.fullName || 'Housekeeping Staff',
      status: 'Scheduled',
      issueLogged: notes || 'Facility cleanliness & sanitization schedule',
    })

    setShowModal(false)
    setTitle('')
    setNotes('')
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Maintenance' }, { label: 'Housekeeping' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Housekeeping & Facility Sanitation</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Schedules for classroom cleaning, simulator cockpit dusting, and public area hygiene
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Housekeeping</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search WO-HK, room, staff..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Cards Grid */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Housekeeping Tasks Scheduled</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Schedule routine sanitization, room deep-cleaning, or facility hygiene checks to assign housekeeping staff.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule First Task</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(wo => {
              const room = rooms.find(r => r.id === wo.roomId)

              return (
                <div key={wo.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        wo.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : wo.status === 'In Progress'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {wo.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      {wo.woNumber}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 mt-1">{wo.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>{room?.name || 'Classroom / Area'} ({room?.roomNumber || wo.roomId})</span>
                    </p>
                    {wo.issueLogged && (
                      <p className="text-xs text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg">{wo.issueLogged}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{wo.assignedTechnicianName || 'Barry Allen'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{wo.dueDate}</span>
                    </div>
                  </div>

                  {wo.status !== 'Completed' && (
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      {wo.status === 'Scheduled' || (wo.status as string) === 'Assigned' ? (
                        <button
                          onClick={() => updateWorkOrderStatus(wo.id, 'In Progress')}
                          className="w-full py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold transition"
                        >
                          Start Cleaning
                        </button>
                      ) : (
                        <button
                          onClick={() => updateWorkOrderStatus(wo.id, 'Completed', 'Sanitization completed.')}
                          className="w-full py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete Task</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal: Schedule Housekeeping */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Schedule Housekeeping</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Deep Cleaning of Simulator Bridge"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Room / Area *</label>
                  <select
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomNumber || r.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign Staff</label>
                  <select
                    value={assignedTechnicianId}
                    onChange={e => setAssignedTechnicianId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Schedule Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Special Cleaning Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Floor mopping, whiteboard cleaning, trash clearing..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Schedule Task
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
