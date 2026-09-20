'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { useDefaultSelection } from '@/lib/useDefaultSelection'
import { getNextSequence, formatYearlyId } from '@/lib/idGenerator'
import { getLocalDateStr, formatDateDisplay } from '@/lib/dateUtils'
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
import { WorkOrder } from '@/types/afms'

export default function HousekeepingPage() {
  const { workOrders, rooms, users, addWorkOrder, updateWorkOrderStatus } = useAFMS()

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Eligible assignees for a Housekeeping work order, shared by the create
  // form and the assign/reassign modal below.
  const housekeepingStaff = users.filter(u => u.role === 'Housekeeping' || u.role === 'Admin')

  // Form fields for new Housekeeping Schedule
  const [title, setTitle] = useState('')
  const [roomId, setRoomId] = useState(rooms[0]?.id || '')
  useDefaultSelection(roomId, setRoomId, rooms[0]?.id)
  const [assignedTechnicianId, setAssignedTechnicianId] = useState(
    users.find(u => u.role === 'Housekeeping')?.id || users.find(u => u.role === 'Admin')?.id || ''
  )
  useDefaultSelection(
    assignedTechnicianId,
    setAssignedTechnicianId,
    users.find(u => u.role === 'Housekeeping')?.id || users.find(u => u.role === 'Admin')?.id
  )
  const [dueDate, setDueDate] = useState(getLocalDateStr())
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Low')
  const [notes, setNotes] = useState('')

  // Assign / Reassign Staff modal state -- for a work order that already
  // exists (e.g. auto-created unassigned from a Service Request), separate
  // from the "Schedule Housekeeping" create form above.
  const [selectedWoForAssign, setSelectedWoForAssign] = useState<WorkOrder | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [assignRemarks, setAssignRemarks] = useState('')

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

  // Assign a staff member to an already-existing work order (e.g. one
  // auto-created unassigned from a Service Request) -- keeps whatever
  // status it's currently in, only changing the assignee.
  const handleAssignStaff = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWoForAssign) return
    const staff = users.find(u => u.id === selectedStaffId) || housekeepingStaff[0]
    if (!staff) return

    updateWorkOrderStatus(
      selectedWoForAssign.id,
      selectedWoForAssign.status,
      assignRemarks || `Assigned to ${staff.fullName}`,
      {
        assignedTechnicianId: staff.id,
        assignedTechnicianName: staff.fullName,
      }
    )

    setSelectedWoForAssign(null)
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

        {/* Work Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                  <th className="py-3.5 px-6">WO Number</th>
                  <th className="py-3.5 px-4">Task</th>
                  <th className="py-3.5 px-4">Room / Area</th>
                  <th className="py-3.5 px-4">Assigned Staff</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Sparkles className="w-8 h-8 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">No Housekeeping Tasks Scheduled</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          Schedule routine sanitization, room deep-cleaning, or facility hygiene checks to assign housekeeping staff.
                        </p>
                        <button
                          onClick={() => setShowModal(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition mt-1"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Schedule First Task</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(wo => {
                    const room = rooms.find(r => r.id === wo.roomId)

                    return (
                      <tr key={wo.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-4 px-6 font-mono font-bold text-purple-700">{wo.woNumber}</td>
                        <td className="py-4 px-4">
                          <p className="font-bold text-slate-900">{wo.title}</p>
                          {wo.issueLogged && (
                            <p className="text-[11px] text-slate-400 max-w-xs truncate">{wo.issueLogged}</p>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-slate-600">
                            <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                            <span>{room?.name || 'Classroom / Area'} ({room?.roomNumber || wo.roomId})</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {wo.assignedTechnicianName ? (
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <User className="w-3.5 h-3.5 text-purple-600" />
                              <span>{wo.assignedTechnicianName}</span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-slate-500 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDateDisplay(wo.dueDate)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
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
                        </td>
                        <td className="py-4 px-6 text-right">
                          {wo.status !== 'Completed' && (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setSelectedWoForAssign(wo)
                                  setSelectedStaffId(wo.assignedTechnicianId || housekeepingStaff[0]?.id || '')
                                  setAssignRemarks('')
                                }}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                              >
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span>{wo.assignedTechnicianName ? 'Reassign' : 'Assign'}</span>
                              </button>

                              {wo.status === 'Scheduled' || (wo.status as string) === 'Assigned' ? (
                                <button
                                  onClick={() => updateWorkOrderStatus(wo.id, 'In Progress')}
                                  className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                                >
                                  Start Cleaning
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateWorkOrderStatus(wo.id, 'Completed', 'Sanitization completed.')}
                                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Complete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Assign / Reassign Staff */}
        {selectedWoForAssign && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-purple-700">{selectedWoForAssign.woNumber}</span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedWoForAssign.assignedTechnicianName ? 'Reassign Staff' : 'Assign Staff'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedWoForAssign.assignedTechnicianName
                      ? `Currently assigned to: ${selectedWoForAssign.assignedTechnicianName}`
                      : 'Assign housekeeping staff to activate this task'}
                  </p>
                </div>
                <button onClick={() => setSelectedWoForAssign(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignStaff} className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                  <p className="text-slate-500 font-medium">Task:</p>
                  <p className="font-semibold text-slate-900">{selectedWoForAssign.title}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Housekeeping Staff *</label>
                  <select
                    value={selectedStaffId}
                    onChange={e => setSelectedStaffId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    {housekeepingStaff.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName} ({staff.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                  <textarea
                    rows={2}
                    value={assignRemarks}
                    onChange={e => setAssignRemarks(e.target.value)}
                    placeholder="Optional instructions for the assigned staff..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedWoForAssign(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Confirm Assignment
                  </button>
                </div>
              </form>
            </div>
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
                    {housekeepingStaff.map(u => (
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
