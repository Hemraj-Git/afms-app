'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  ClipboardList,
  Wrench,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  Plus,
  Clock,
  User,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ArrowUpDown,
  FileText,
  SlidersHorizontal,
  X,
  Eye,
  Package,
  CheckSquare,
  Image as ImageIcon,
  Lock,
} from 'lucide-react'
import { WorkOrder } from '@/types/afms'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'

export default function WorkOrdersHubPage() {
  const {
    workOrders,
    assets,
    rooms,
    users,
    checklistTemplates,
    addWorkOrder,
    updateWorkOrderStatus,
    slaConfig,
    updateSlaConfig,
  } = useAFMS()

  const [activeTab, setActiveTab] = useState<'All' | 'Preventive' | 'Corrective' | 'Housekeeping'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSlaModal, setShowSlaModal] = useState(false)
  const [selectedWoForDetails, setSelectedWoForDetails] = useState<WorkOrder | null>(null)

  // SLA Form State
  const [tempSla, setTempSla] = useState(slaConfig)

  // Form State for creating a new Work Order
  const [type, setType] = useState<'Preventive' | 'Corrective' | 'Housekeeping'>('Preventive')
  const [title, setTitle] = useState('')
  const [assetId, setAssetId] = useState(assets[0]?.id || '')
  const [roomId, setRoomId] = useState(rooms[0]?.id || '')
  const [assignedTechnicianId, setAssignedTechnicianId] = useState(users.find(u => u.role === 'Technician' || u.role === 'Housekeeping')?.id || users[0]?.id || '')
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium')
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0])
  const [issueLogged, setIssueLogged] = useState('')

  // KPI Calculations
  const totalCount = workOrders.length
  const pmCount = workOrders.filter(w => w.type === 'Preventive').length
  const crCount = workOrders.filter(w => w.type === 'Corrective').length
  const hkCount = workOrders.filter(w => w.type === 'Housekeeping').length
  const inProgressCount = workOrders.filter(w => w.status === 'In Progress').length

  // Dynamic Work Order Overdue Check (Time-based on dueDate)
  const isWorkOrderOverdue = (wo: WorkOrder) => {
    if (wo.status === 'Completed' || wo.status === 'Cancelled') return false
    if (!wo.dueDate) return false
    const todayStr = new Date().toISOString().split('T')[0]
    return wo.dueDate < todayStr
  }
  const overdueWoCount = workOrders.filter(isWorkOrderOverdue).length

  // Filtered List
  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesTab = activeTab === 'All' || wo.type === activeTab
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Overdue'
        ? isWorkOrderOverdue(wo)
        : wo.status === statusFilter

    const asset = assets.find(a => a.id === wo.assetId)
    const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId))
    const tech = users.find(u => u.id === wo.assignedTechnicianId)

    const matchesSearch =
      wo.woNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wo.title && wo.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset && asset.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (room && room.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tech && tech.fullName.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesTab && matchesStatus && matchesSearch
  })

  const handleSaveSla = (e: React.FormEvent) => {
    e.preventDefault()
    updateSlaConfig(tempSla)
    setShowSlaModal(false)
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tech = users.find(u => u.id === assignedTechnicianId)
    const prefix = type === 'Preventive' ? 'WO-PM' : type === 'Corrective' ? 'WO-CR' : 'WO-HK'
    const woNum = `${prefix}-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(4, '0')}`

    addWorkOrder({
      woNumber: woNum,
      type,
      title: title || `${type} Work Order`,
      assetId: type !== 'Housekeeping' ? assetId : undefined,
      roomId: roomId || undefined,
      priority,
      source: type === 'Preventive' ? 'Scheduled' : type === 'Corrective' ? 'Service Request' : 'Routine',
      dueDate,
      assignedTechnicianId,
      assignedTechnicianName: tech?.fullName,
      status: 'Scheduled',
      issueLogged: issueLogged || undefined,
    })

    setShowCreateModal(false)
    setTitle('')
    setIssueLogged('')
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Maintenance' }, { label: 'Work Orders' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Work Orders Central Hub</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Unified management for Preventive Maintenance, Corrective Repairs & Housekeeping operations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTempSla(slaConfig)
                setShowSlaModal(true)
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>Configure SLA Rules</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Work Order</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div
            onClick={() => setActiveTab('All')}
            className={`p-5 rounded-2xl border transition cursor-pointer shadow-2xs ${
              activeTab === 'All' ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center font-bold">
                <ClipboardList className="w-5 h-5" />
              </div>
              {overdueWoCount > 0 ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setStatusFilter(statusFilter === 'Overdue' ? 'All' : 'Overdue')
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer hover:bg-rose-200 transition"
                  title="Click to filter overdue work orders"
                >
                  {overdueWoCount} Overdue
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-400">All WOs</span>
              )}
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-3">{totalCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{inProgressCount} active / in progress</p>
          </div>

          {/* Preventive */}
          <div
            onClick={() => setActiveTab('Preventive')}
            className={`p-5 rounded-2xl border transition cursor-pointer shadow-2xs ${
              activeTab === 'Preventive' ? 'bg-amber-50/60 border-amber-500 ring-2 ring-amber-500/20' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Preventive (PM)</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-3">{pmCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Scheduled SOP maintenance</p>
          </div>

          {/* Corrective */}
          <div
            onClick={() => setActiveTab('Corrective')}
            className={`p-5 rounded-2xl border transition cursor-pointer shadow-2xs ${
              activeTab === 'Corrective' ? 'bg-rose-50/60 border-rose-500 ring-2 ring-rose-500/20' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Corrective (Breakdown)</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-3">{crCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Inspection failures &amp; breakdown fixes</p>
          </div>

          {/* Housekeeping */}
          <div
            onClick={() => setActiveTab('Housekeeping')}
            className={`p-5 rounded-2xl border transition cursor-pointer shadow-2xs ${
              activeTab === 'Housekeeping' ? 'bg-purple-50/60 border-purple-500 ring-2 ring-purple-500/20' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Housekeeping</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-3">{hkCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Facility cleaning & sanitization</p>
          </div>
        </div>

        {/* Filter Toolbar & Tabs Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Segmented Tab Filter */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            {(['All', 'Preventive', 'Corrective', 'Housekeeping'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search and Status filters */}
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search WO#, asset, room, tech..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Overdue">Overdue (Past SLA)</option>
            </select>
          </div>
        </div>

        {/* Work Orders Master Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                  <th className="py-3.5 px-4">WO Number</th>
                  <th className="py-3.5 px-4">Type & Title</th>
                  <th className="py-3.5 px-4">Target (Asset / Room)</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <ClipboardList className="w-8 h-8 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">No Work Orders Found</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          Work orders will be populated automatically when preventive schedules trigger, service requests are escalated to corrective repairs, or created manually.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredWorkOrders.map(wo => {
                    const asset = assets.find(a => a.id === wo.assetId)
                    const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId))

                    return (
                      <tr key={wo.id} className="hover:bg-slate-50/60 transition group">
                        {/* WO Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                          {wo.woNumber}
                        </td>

                        {/* Type & Title */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                wo.type === 'Preventive'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : wo.type === 'Corrective'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {wo.type}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">• {wo.source}</span>
                          </div>
                          <p className="font-bold text-slate-900">{wo.title || `${wo.type} Work Order`}</p>
                          {wo.issueLogged && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{wo.issueLogged}</p>
                          )}
                        </td>

                        {/* Target */}
                        <td className="py-3.5 px-4">
                          {asset ? (
                            <div>
                              <p className="font-bold text-slate-900">{asset.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{asset.id} • {room?.name || 'Main Campus'}</p>
                            </div>
                          ) : room ? (
                            <div>
                              <p className="font-bold text-slate-900">{room.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{room.id}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">General Facility</span>
                          )}
                        </td>

                        {/* Assigned To */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                              {wo.assignedTechnicianName ? wo.assignedTechnicianName[0] : 'U'}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{wo.assignedTechnicianName || 'Unassigned'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{wo.dueDate}</span>
                          </div>
                          {wo.type === 'Preventive' && wo.status !== 'Completed' && (() => {
                            const win = getAttemptWindowStatus(wo.dueDate, wo.frequency)
                            return (
                              <div className="mt-1">
                                {win.canAttempt ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Window Open
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={`Attempt window opens ${win.unlockDate}`}>
                                    <Lock className="w-2.5 h-2.5 text-amber-600" />
                                    Opens {win.unlockDate}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              wo.priority === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : wo.priority === 'High'
                                ? 'bg-amber-100 text-amber-800'
                                : wo.priority === 'Medium'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {wo.priority || 'Medium'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                wo.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : wo.status === 'In Progress'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : wo.status === 'Cancelled'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {wo.status}
                            </span>
                            {isWorkOrderOverdue(wo) && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedWoForDetails(wo)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                              title="View complete work order telemetry and records"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>View Details</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Create Work Order */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Create Work Order</h3>
                  <p className="text-xs text-slate-500">Auto-assigns WO-PM, WO-CR, or WO-HK ID format</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Order Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Preventive', 'Corrective', 'Housekeeping'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                          type === t
                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Order Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Split AC Coil Cleaning or Deep Room Sanitization"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                {type !== 'Housekeeping' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Target Asset *</label>
                    <select
                      value={assetId}
                      onChange={e => setAssetId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Room / Area *</label>
                  <select
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Technician/Staff *</label>
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
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SLA Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Scope / Issue Details</label>
                  <textarea
                    rows={2}
                    value={issueLogged}
                    onChange={e => setIssueLogged(e.target.value)}
                    placeholder="Instructions or specific fault notes..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Create Work Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal 2: Configure SLA Rules Modal */}
        {showSlaModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Configure SLA Resolution Hours</h3>
                  <p className="text-xs text-slate-500">Define maximum allowable resolution time for Service Requests by priority tier</p>
                </div>
                <button onClick={() => setShowSlaModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSla} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Critical Tier Resolution (Hours) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      required
                      value={tempSla.Critical}
                      onChange={e => setTempSla({ ...tempSla, Critical: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 pr-14 border border-rose-200 bg-rose-50/40 rounded-xl focus:ring-2 focus:ring-rose-500/20 font-bold text-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[11px]">
                      Hours
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-amber-700 mb-1">High Tier Resolution (Hours) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      required
                      value={tempSla.High}
                      onChange={e => setTempSla({ ...tempSla, High: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 pr-14 border border-amber-200 bg-amber-50/40 rounded-xl focus:ring-2 focus:ring-amber-500/20 font-bold text-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[11px]">
                      Hours
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-blue-700 mb-1">Medium Tier Resolution (Hours) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      required
                      value={tempSla.Medium}
                      onChange={e => setTempSla({ ...tempSla, Medium: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 pr-14 border border-blue-200 bg-blue-50/40 rounded-xl focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[11px]">
                      Hours
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Low Tier Resolution (Hours) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      required
                      value={tempSla.Low}
                      onChange={e => setTempSla({ ...tempSla, Low: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 pr-14 border border-slate-200 bg-slate-50/60 rounded-xl focus:ring-2 focus:ring-slate-500/20 font-bold text-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[11px]">
                      Hours
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSlaModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Save SLA Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal: Work Order Details Side Drawer */}
        {selectedWoForDetails && (() => {
          const wo = workOrders.find(w => w.id === selectedWoForDetails.id) || selectedWoForDetails
          const asset = assets.find(a => a.id === wo.assetId)
          const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId))
          const tech = users.find(u => u.id === wo.assignedTechnicianId)
          const isCompleted = wo.status === 'Completed'

          // Checklist snapshot or template or standard fallback for Preventive
          const checklistItems = (wo.checklistSnapshot && wo.checklistSnapshot.length > 0)
            ? wo.checklistSnapshot
            : (checklistTemplates.find(t => t.id === wo.checklistTemplateId)?.items || [
                { id: 'pm-item-1', order: 1, itemText: 'Inspect motor bearings and lubricate per manufacturer specifications', mandatory: true, photoRequired: false },
                { id: 'pm-item-2', order: 2, itemText: 'Clean air filters, condenser coils, and check air flow ducts', mandatory: true, photoRequired: false },
                { id: 'pm-item-3', order: 3, itemText: 'Check electrical terminations, earthing continuity, and voltage levels', mandatory: true, photoRequired: false },
                { id: 'pm-item-4', order: 4, itemText: 'Verify operating pressure, refrigerant levels, and temperature differential', mandatory: true, photoRequired: false },
                { id: 'pm-item-5', order: 5, itemText: 'Test safety interlocks, circuit breaker trip settings, and emergency stops', mandatory: true, photoRequired: false },
              ])

          return (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
              <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                          wo.type === 'Preventive'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : wo.type === 'Corrective'
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-purple-700 bg-purple-50 border-purple-200'
                        }`}>
                          {wo.woNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : wo.status === 'In Progress'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}>
                          {wo.status === 'Completed' ? 'Completed & Verified' : wo.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {wo.type}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">
                        {wo.title || `${wo.type} Work Order`}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedWoForDetails(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary Details Grid */}
                  <div className="space-y-4 text-xs">
                    {/* Assigned Technician Profile Card */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Assigned Technician Details</p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {tech?.role || 'Staff'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          {wo.assignedTechnicianName ? wo.assignedTechnicianName[0] : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {wo.assignedTechnicianName || 'Pending Assignment'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tech?.department || 'Operations & Engineering'} {tech?.phone ? `• ${tech.phone}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Operational Details */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Asset:</span>
                        <span className="font-semibold text-slate-800">{asset?.name || 'Facility Area'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Location / Room:</span>
                        <span className="font-semibold text-slate-800">{room?.name || 'General Facility'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Source Trigger:</span>
                        <span className="font-semibold text-slate-800">{wo.source} {wo.sourceRefId ? `(${wo.sourceRefId})` : ''}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Priority Tier:</span>
                        <span className="font-semibold text-slate-800">{wo.priority || 'Medium'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Due Date / SLA:</span>
                        <span className="font-semibold text-slate-800">{wo.dueDate}</span>
                      </div>
                      {wo.type === 'Preventive' && (() => {
                        const win = getAttemptWindowStatus(wo.dueDate, wo.frequency)
                        return (
                          <div className="flex justify-between pt-1 border-t border-slate-200/60">
                            <span className="text-slate-500 font-medium">Attempt Window:</span>
                            {win.canAttempt ? (
                              <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Unlocked ({win.windowDescription})
                              </span>
                            ) : (
                              <span className="font-bold text-amber-700 inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 text-amber-600" />
                                Opens on {win.unlockDate} ({win.windowDescription})
                              </span>
                            )}
                          </div>
                        )
                      })()}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Execution Mode:</span>
                        <span className="font-semibold text-slate-800">{wo.type === 'Corrective' ? (wo.executedBy || 'In House') : 'In House'}</span>
                      </div>
                      {wo.completedAt && (
                        <div className="flex justify-between pt-1 border-t border-slate-200/60">
                          <span className="text-emerald-700 font-medium">Completed Date:</span>
                          <span className="font-bold text-emerald-800">{wo.completedAt}</span>
                        </div>
                      )}
                    </div>

                    {/* Start of Work Evidence Photo (Proof of Presence) */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                          Start of Work Evidence (Proof of Presence)
                        </p>
                        {wo.startPhotoUrl ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            ✓ Verified On-Site
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            {wo.status === 'Completed' ? 'Not Logged' : 'Pending On-Site Arrival'}
                          </span>
                        )}
                      </div>
                      {wo.startPhotoUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                          <img
                            src={wo.startPhotoUrl}
                            alt="Start of Work Evidence"
                            className="w-full h-44 object-cover"
                          />
                          <div className="p-2 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
                            <span>Captured at job commencement by technician</span>
                            <span className="font-mono text-blue-600 font-bold">Proof of Presence</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-dashed border-slate-200 text-slate-400">
                          <ImageIcon className="w-5 h-5 text-slate-300 shrink-0" />
                          <span className="text-[11px]">
                            {wo.status === 'Completed'
                              ? 'No start-of-work proof photo was logged for this work order.'
                              : 'Technician will capture a proof-of-presence photo upon commencing work on-site.'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* COMPLETED DETAILS: Per Maintenance Type */}
                    {isCompleted ? (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        {/* TYPE 1: CORRECTIVE MAINTENANCE */}
                        {wo.type === 'Corrective' && (
                          <div className="space-y-3.5">
                            {/* Problem found */}
                            <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-1">
                              <p className="font-bold text-[11px] text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                Problem Found by Technician
                              </p>
                              <p className="text-slate-800 text-xs leading-relaxed">
                                {wo.issueLogged || 'Breakdown defect diagnosed during on-site inspection.'}
                              </p>
                            </div>

                            {/* Action taken */}
                            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
                              <p className="font-bold text-[11px] text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Action Taken by Technician
                              </p>
                              <p className="text-slate-800 text-xs leading-relaxed">
                                {wo.solutionTaken || wo.technicianRemarks || 'Defect rectified, tested, and restored to operational service.'}
                              </p>
                            </div>

                            {/* Spare parts replaced */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                              <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                Spare Parts Required / Replaced
                              </p>
                              {wo.partsReplaced && wo.partsReplaced.length > 0 ? (
                                <div className="divide-y divide-slate-200/60 bg-white rounded-lg border border-slate-200/60 overflow-hidden">
                                  {wo.partsReplaced.map((part, idx) => (
                                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                                      <div>
                                        <p className="font-semibold text-slate-800">{part.partName}</p>
                                        {part.notes && <p className="text-[10px] text-slate-400">{part.notes}</p>}
                                      </div>
                                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                        Qty: {part.quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 italic text-[11px]">
                                  No spare parts replaced (Labor and calibration only).
                                </p>
                              )}
                            </div>

                            {/* Completion photo */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                              <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                                Completion Photo Evidence
                              </p>
                              {wo.completionPhotoUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                                  <img
                                    src={wo.completionPhotoUrl}
                                    alt="Corrective Completion Evidence"
                                    className="w-full h-44 object-cover"
                                  />
                                  <div className="p-2 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
                                    <span>Verified Work Site Evidence</span>
                                    <span className="font-mono text-emerald-700 font-bold">✓ Verified</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-dashed border-slate-200 text-slate-400">
                                  <ImageIcon className="w-5 h-5 text-slate-300" />
                                  <span>No completion photo attached to this completed record.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* TYPE 2: PREVENTIVE MAINTENANCE */}
                        {wo.type === 'Preventive' && (
                          <div className="space-y-4">
                            {/* Checklist checked */}
                            <div className="space-y-2">
                              <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                Preventive Maintenance Checklist Checked
                              </p>

                              <div className="divide-y divide-slate-100 bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden">
                                {checklistItems.map((item, idx) => {
                                  const response = wo.checklistResponses?.[item.id]
                                  const isChecked = response?.value !== undefined ? !!response.value : true
                                  const itemRemarks = response?.remarks

                                  return (
                                    <div key={item.id || idx} className="p-3 bg-white space-y-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2">
                                          <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                          </span>
                                          <span className="font-medium text-slate-800 text-xs leading-snug">
                                            {item.itemText}
                                          </span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                          {isChecked ? 'Passed / Done' : 'Inspected'}
                                        </span>
                                      </div>
                                      {itemRemarks && (
                                        <p className="text-[11px] text-slate-500 pl-6 italic">
                                          Notes: {itemRemarks}
                                        </p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Technician remarks */}
                            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1">
                              <p className="font-bold text-[11px] text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                Technician Servicing Notes
                              </p>
                              <p className="text-slate-800 text-xs leading-relaxed">
                                {wo.technicianRemarks || wo.solutionTaken || 'All scheduled preventive maintenance tasks performed according to standard equipment procedures.'}
                              </p>
                            </div>

                            {/* Completion photo */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                              <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                                Completion Photo Evidence
                              </p>
                              {wo.completionPhotoUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                                  <img
                                    src={wo.completionPhotoUrl}
                                    alt="PM Servicing Photo Evidence"
                                    className="w-full h-44 object-cover"
                                  />
                                  <div className="p-2 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
                                    <span>Technician On-Site Photo Verification</span>
                                    <span className="font-mono text-emerald-700 font-bold">✓ Attached</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-dashed border-slate-200 text-slate-400">
                                  <ImageIcon className="w-5 h-5 text-slate-300" />
                                  <span>No digital photo attached to this completed servicing record.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* TYPE 3: HOUSEKEEPING */}
                        {wo.type === 'Housekeeping' && (
                          <div className="space-y-4">
                            {/* Sanitization notes */}
                            <div className="p-3.5 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-1">
                              <p className="font-bold text-[11px] text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                Sanitation &amp; Hygiene Servicing Notes
                              </p>
                              <p className="text-slate-800 text-xs leading-relaxed">
                                {wo.technicianRemarks || wo.solutionTaken || wo.issueLogged || 'Area thoroughly sanitized, waste disposed, and hygiene protocol verified.'}
                              </p>
                            </div>

                            {/* Completion photo */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                              <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                                Completion Photo Evidence
                              </p>
                              {wo.completionPhotoUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                                  <img
                                    src={wo.completionPhotoUrl}
                                    alt="Housekeeping Photo Evidence"
                                    className="w-full h-44 object-cover"
                                  />
                                  <div className="p-2 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
                                    <span>Sanitization Verified</span>
                                    <span className="font-mono text-emerald-700 font-bold">✓ Cleaned</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-dashed border-slate-200 text-slate-400">
                                  <ImageIcon className="w-5 h-5 text-slate-300" />
                                  <span>No digital photo attached to this housekeeping record.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* SCHEDULED / IN-PROGRESS WORK ORDER DETAILS */
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              Current Status: {wo.status}
                            </span>
                            <span className="text-[10px] text-blue-700 font-bold">
                              Due: {wo.dueDate}
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs">
                            {wo.status === 'Scheduled'
                              ? `Assigned to ${wo.assignedTechnicianName || 'technician'}. Awaiting on-site technician arrival and proof-of-presence photo capture.`
                              : `Currently in progress with ${wo.assignedTechnicianName || 'technician'}.`}
                          </p>
                          {wo.issueLogged && (
                            <p className="text-slate-600 text-xs pt-1 border-t border-blue-100/60">
                              <strong>Reported Issue / Notes:</strong> {wo.issueLogged}
                            </p>
                          )}
                        </div>

                        {/* Planned Checklist Preview for PM */}
                        {wo.type === 'Preventive' && (
                          <div className="space-y-2">
                            <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                              Planned Checklist Scope ({checklistItems.length} items)
                            </p>
                            <div className="divide-y divide-slate-100 bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden">
                              {checklistItems.map((item, idx) => (
                                <div key={item.id || idx} className="p-2.5 bg-white flex items-center gap-2 text-xs">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-slate-700 flex-1">{item.itemText}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Technician Execution Protocol Notice */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>On-Site Technician Execution</span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Work orders are initiated on-site directly by the assigned technician ({wo.assignedTechnicianName || 'Technician'}) with proof-of-presence photo verification.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Close Drawer Button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedWoForDetails(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </AppLayout>
  )
}
