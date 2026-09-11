'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  X,
  User,
  MapPin,
  Calendar,
  Building,
  Check,
  Wrench,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Lock,
} from 'lucide-react'
import { ServiceRequest, SlaPriority } from '@/types/afms'

export default function ServiceRequestsPage() {
  const router = useRouter()
  const {
    serviceRequests,
    addServiceRequest,
    updateServiceRequestStatus,
    rooms,
    assets,
    subCategories,
    users,
    currentUser,
    slaConfig,
    addWorkOrder,
    workOrders,
  } = useAFMS()

  const [activeTab, setActiveTab] = useState<'All' | 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Overdue'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<ServiceRequest | null>(null)
  const [showDismissModal, setShowDismissModal] = useState(false)
  const [dismissReason, setDismissReason] = useState('')

  // New Request Form State
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState<'Maintenance' | 'Cleaning' | 'IT Support' | 'General'>('Maintenance')
  const [newRoomId, setNewRoomId] = useState(rooms[0]?.id || '')
  const [newAssetId, setNewAssetId] = useState(assets[0]?.id || '')
  const [newPriority, setNewPriority] = useState<SlaPriority>('Medium')

  // Auto-calculate SLA Priority when target asset changes
  const handleAssetSelect = (assetId: string) => {
    setNewAssetId(assetId)
    const selectedAsset = assets.find(a => a.id === assetId)
    if (selectedAsset) {
      const sub = subCategories.find(s => s.id === selectedAsset.subCategoryId)
      if (sub?.slaPriority) {
        setNewPriority(sub.slaPriority)
      }
    }
  }

  // Dynamic SLA Overdue Check (Time-based, doesn't break lifecycle status)
  const isTicketOverdue = (req: ServiceRequest) => {
    if (req.status === 'Resolved' || req.status === 'Closed') return false
    if (!req.slaDueDate) return false
    return new Date(req.slaDueDate).getTime() < Date.now()
  }

  // Filter calculation
  const openCount = serviceRequests.filter(s => s.status === 'Open').length
  const inProgressCount = serviceRequests.filter(s => s.status === 'In Progress').length
  const resolveCount = serviceRequests.filter(s => s.status === 'Resolved' || s.status === 'Closed').length
  const overdueCount = serviceRequests.filter(isTicketOverdue).length

  const filteredRequests = serviceRequests.filter(req => {
    let matchesTab = true
    if (activeTab === 'Overdue') {
      matchesTab = isTicketOverdue(req)
    } else if (activeTab === 'Resolved') {
      matchesTab = req.status === 'Resolved' || req.status === 'Closed'
    } else if (activeTab !== 'All') {
      matchesTab = req.status === activeTab
    }

    const matchesSearch =
      req.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requestedBy.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targetAsset = assets.find(a => a.id === newAssetId)
    const sub = targetAsset ? subCategories.find(s => s.id === targetAsset.subCategoryId) : undefined
    const finalPriority: SlaPriority = sub?.slaPriority || newPriority

    // Calculate SLA Due Time using SLA Configuration
    const slaHours = slaConfig[finalPriority] || 24
    const dueTimeMs = Date.now() + slaHours * 60 * 60 * 1000
    const slaDueDate = new Date(dueTimeMs).toISOString()

    addServiceRequest({
      title: newTitle,
      description: newDesc,
      requestType: newType,
      roomId: newRoomId,
      assetId: newType === 'Maintenance' || newType === 'IT Support' ? newAssetId : undefined,
      requestedBy: currentUser.fullName,
      requestedByRole: currentUser.role,
      status: 'Open',
      priority: finalPriority,
      slaDueDate,
    })

    setShowCreateModal(false)
    setNewTitle('')
    setNewDesc('')
  }

  // Convert Service Request to Corrective Maintenance
  const handleCreateCorrective = (ticket: ServiceRequest) => {
    const targetAsset = assets.find(a => a.id === ticket.assetId)
    const woNum = `WO-CR-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(4, '0')}`

    addWorkOrder({
      woNumber: woNum,
      type: 'Corrective',
      title: ticket.title || 'Corrective Breakdown Repair',
      assetId: ticket.assetId,
      roomId: ticket.roomId,
      priority: ticket.priority,
      source: 'Service Request',
      sourceRefId: ticket.ticketId,
      dueDate: ticket.slaDueDate.split('T')[0] || new Date().toISOString().split('T')[0],
      status: 'Scheduled', // Pending technician assignment
      issueLogged: `${ticket.title} — ${ticket.description || 'Reported via Service Desk'}`,
    })

    updateServiceRequestStatus(ticket.id, 'In Progress', {
      workOrderNumber: woNum,
      workOrderType: 'Corrective',
    })
    setSelectedTicket(prev => prev && prev.id === ticket.id ? {
      ...prev,
      status: 'In Progress',
      workOrderNumber: woNum,
      workOrderType: 'Corrective',
    } : null)
  }

  // Convert Service Request to Housekeeping Work Order directly
  const handleAssignHousekeeping = (ticket: ServiceRequest) => {
    const woNum = `WO-HK-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(4, '0')}`

    addWorkOrder({
      woNumber: woNum,
      type: 'Housekeeping',
      title: ticket.title || 'Housekeeping Cleaning & Sanitization Request',
      roomId: ticket.roomId,
      priority: ticket.priority,
      source: 'Service Request',
      sourceRefId: ticket.ticketId,
      dueDate: ticket.slaDueDate.split('T')[0] || new Date().toISOString().split('T')[0],
      status: 'Scheduled', // Pending staff assignment
      issueLogged: `${ticket.title} — ${ticket.description || 'Reported via Service Desk'}`,
    })

    updateServiceRequestStatus(ticket.id, 'In Progress', {
      workOrderNumber: woNum,
      workOrderType: 'Housekeeping',
    })
    setSelectedTicket(prev => prev && prev.id === ticket.id ? {
      ...prev,
      status: 'In Progress',
      workOrderNumber: woNum,
      workOrderType: 'Housekeeping',
    } : null)
  }

  // Confirm Dismissal of Service Request with Mandatory Note
  const handleConfirmDismiss = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket || !dismissReason.trim()) return

    const today = new Date().toISOString().split('T')[0]

    updateServiceRequestStatus(selectedTicket.id, 'Closed', {
      dismissalReason: dismissReason.trim(),
      dismissedAt: today,
      dismissedBy: currentUser?.fullName || 'Administrator',
    })

    setSelectedTicket(prev => prev ? {
      ...prev,
      status: 'Closed',
      dismissalReason: dismissReason.trim(),
      dismissedAt: today,
      dismissedBy: currentUser?.fullName || 'Administrator',
    } : null)

    setShowDismissModal(false)
    setDismissReason('')
  }

  const getStatusBadge = (status: ServiceRequest['status']) => {
    switch (status) {
      case 'Open':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">Open</span>
      case 'In Progress':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">In Progress</span>
      case 'Resolved':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>
      case 'Closed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">Closed</span>
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">{status}</span>
    }
  }

  const currentTicket = selectedTicket
    ? serviceRequests.find(s => s.id === selectedTicket.id) || selectedTicket
    : null

  const linkedWo = currentTicket
    ? workOrders.find(w => w.sourceRefId === currentTicket.ticketId || w.sourceRefId === currentTicket.id) ||
      (currentTicket.workOrderNumber ? workOrders.find(w => w.woNumber === currentTicket.workOrderNumber) : undefined)
    : undefined

  const isActionTaken = currentTicket
    ? currentTicket.status !== 'Open' ||
      Boolean(currentTicket.workOrderNumber) ||
      Boolean(linkedWo) ||
      Boolean(currentTicket.dismissalReason)
    : false

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Service Request' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Request Desk</h1>
            <p className="text-xs text-slate-500 mt-0.5">SLA-monitored incident intake & dispatch to Corrective Maintenance or Housekeeping</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Service Request</span>
            </button>
            <Link
              href="/maintenance/work-orders"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span>Configure SLA Rules</span>
            </Link>
          </div>
        </div>

        {/* Top 4 KPI metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab(activeTab === 'Open' ? 'All' : 'Open')}
            className={`cursor-pointer bg-white rounded-2xl p-5 border shadow-2xs flex items-center gap-4 transition ${
              activeTab === 'Open' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{openCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Open</p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab(activeTab === 'In Progress' ? 'All' : 'In Progress')}
            className={`cursor-pointer bg-white rounded-2xl p-5 border shadow-2xs flex items-center gap-4 transition ${
              activeTab === 'In Progress' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{inProgressCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">In Progress</p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab(activeTab === 'Resolved' ? 'All' : 'Resolved')}
            className={`cursor-pointer bg-white rounded-2xl p-5 border shadow-2xs flex items-center gap-4 transition ${
              activeTab === 'Resolved' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{resolveCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Resolved</p>
            </div>
          </div>

          <div
            onClick={() => setActiveTab(activeTab === 'Overdue' ? 'All' : 'Overdue')}
            className={`cursor-pointer bg-white rounded-2xl p-5 border shadow-2xs flex items-center gap-4 transition ${
              activeTab === 'Overdue' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{overdueCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Overdue SLA</p>
            </div>
          </div>
        </div>

        {/* Service Request List Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Service Request Desk</h2>
              {activeTab !== 'All' && (
                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-md font-semibold">
                  Filtered: {activeTab}
                  <button onClick={() => setActiveTab('All')} className="ml-1 text-slate-400 hover:text-slate-700">×</button>
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter tickets..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                  <th className="py-3.5 px-6">Service Request ID</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Subject & Target Asset</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Requested By</th>
                  <th className="py-3.5 px-4">SLA Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <MessageSquare className="w-8 h-8 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">No Service Requests Found</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          Create a service request to report an asset breakdown, room maintenance requirement, or cleaning ticket.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map(req => {
                  const room = rooms.find(r => r.id === req.roomId)
                  const asset = assets.find(a => a.id === req.assetId)
                  const sub = asset ? subCategories.find(s => s.id === asset.subCategoryId) : undefined

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-4 px-6 font-mono font-bold text-blue-600">
                        {req.ticketId}
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-medium">
                        {req.createdAt.split(' ')[0]}
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-900">{req.title}</p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {asset?.name ? `${asset.name} (${asset.id})` : req.requestType}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-semibold text-slate-800">{room?.name || 'General Area'}</p>
                        <p className="text-[11px] text-slate-400">Room {room?.roomNumber}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-semibold text-slate-800">{req.requestedBy}</p>
                        <p className="text-[11px] text-slate-400">{req.requestedByRole}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.priority === 'Critical'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : req.priority === 'High'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {req.priority} ({slaConfig[req.priority as SlaPriority] || 24}h SLA)
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getStatusBadge(req.status)}
                          {isTicketOverdue(req) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedTicket(req)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-500 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition inline-flex items-center gap-1 font-semibold text-xs shadow-2xs"
                        >
                          <span>Action</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TICKET DETAIL & ACTION MODAL / DRAWER */}
        {currentTicket && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
            <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600">{currentTicket.ticketId}</span>
                    <h3 className="text-lg font-extrabold text-slate-900">{currentTicket.title}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* SLA Countdown Warning */}
                  <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-bold text-rose-900">SLA Priority: {currentTicket.priority}</p>
                        <p className="text-[11px] text-rose-700">Must be resolved within {slaConfig[currentTicket.priority as SlaPriority] || 24} hours</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-white text-rose-700 px-2 py-1 rounded border border-rose-200">
                      Due: {currentTicket.slaDueDate ? new Date(currentTicket.slaDueDate).toLocaleDateString() : 'Active'}
                    </span>
                  </div>

                  <div>
                    <p className="text-slate-400 uppercase font-bold text-[10px]">Description</p>
                    <p className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                      {currentTicket.description || 'No additional remarks provided.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-slate-400 font-semibold text-[10px]">Status</p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {getStatusBadge(currentTicket.status)}
                        {isTicketOverdue(currentTicket) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-slate-400 font-semibold text-[10px]">Request Type</p>
                      <p className="mt-1 font-bold text-slate-800">{currentTicket.requestType}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Asset:</span>
                      <span className="font-semibold text-slate-800">
                        {assets.find(a => a.id === currentTicket.assetId)?.name || 'N/A (Area-Level)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="font-semibold text-slate-800">
                        {rooms.find(r => r.id === currentTicket.roomId)?.name || 'General Area'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Requested By:</span>
                      <span className="font-semibold text-slate-800">{currentTicket.requestedBy} ({currentTicket.requestedByRole})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Reported Date:</span>
                      <span className="font-semibold text-slate-800">{currentTicket.createdAt}</span>
                    </div>
                  </div>

                  {/* Work Order Details Card (If Created) */}
                  {(linkedWo || currentTicket.workOrderNumber) && (
                    <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          {linkedWo?.type === 'Housekeeping' || currentTicket.workOrderType === 'Housekeeping' ? (
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          ) : (
                            <Wrench className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          {linkedWo?.type === 'Housekeeping' || currentTicket.workOrderType === 'Housekeeping'
                            ? 'Housekeeping Work Order Dispatched'
                            : 'Corrective Maintenance Dispatched'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          linkedWo?.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          linkedWo?.status === 'In Progress' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {linkedWo?.status || 'Scheduled'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Work Order Number:</p>
                          <p className="font-mono font-bold text-sm text-blue-700">
                            {linkedWo?.woNumber || currentTicket.workOrderNumber}
                          </p>
                          {linkedWo?.assignedTechnicianName && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Assigned: <span className="text-slate-700 font-semibold">{linkedWo.assignedTechnicianName}</span>
                            </p>
                          )}
                        </div>
                        <Link
                          href={linkedWo?.type === 'Housekeeping' || currentTicket.workOrderType === 'Housekeeping'
                            ? '/maintenance/housekeeping'
                            : '/maintenance/corrective'
                          }
                          className="px-3 py-1.5 bg-white hover:bg-blue-100/60 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 shadow-2xs transition inline-flex items-center gap-1"
                        >
                          <span>View Work Order</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Dismissal Details Card (If Dismissed) */}
                  {currentTicket.dismissalReason && (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                          Request Dismissed & Closed
                        </span>
                        {currentTicket.dismissedAt && (
                          <span className="text-[10px] text-amber-700 font-medium">
                            {currentTicket.dismissedAt}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        <strong className="text-amber-950 font-semibold">Note / Reason:</strong> {currentTicket.dismissalReason}
                      </p>
                      {currentTicket.dismissedBy && (
                        <p className="text-[11px] text-amber-700">
                          Dismissed by: <span className="font-semibold">{currentTicket.dismissedBy}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Primary Actions: Only 2 Buttons */}
                <div className="space-y-2.5 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-700 uppercase">Operational Actions</p>
                    {isActionTaken && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Action Completed (Locked)
                      </span>
                    )}
                  </div>

                  {/* Button 1: Create Corrective Maintenance / Housekeeping Work Order */}
                  {currentTicket.requestType === 'Cleaning' ? (
                    <button
                      type="button"
                      disabled={isActionTaken}
                      onClick={() => !isActionTaken && handleAssignHousekeeping(currentTicket)}
                      className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition text-xs ${
                        isActionTaken
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white'
                      }`}
                      title={isActionTaken ? `Housekeeping order ${linkedWo?.woNumber || currentTicket.workOrderNumber || ''} already processed` : 'Create Housekeeping Work Order'}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {isActionTaken && (linkedWo || currentTicket.workOrderNumber)
                          ? `Housekeeping Work Order Created (${linkedWo?.woNumber || currentTicket.workOrderNumber})`
                          : 'Create Housekeeping Work Order'}
                      </span>
                      {!isActionTaken && <ArrowRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isActionTaken}
                      onClick={() => !isActionTaken && handleCreateCorrective(currentTicket)}
                      className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs transition text-xs ${
                        isActionTaken
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white'
                      }`}
                      title={isActionTaken ? `Corrective order ${linkedWo?.woNumber || currentTicket.workOrderNumber || ''} already processed` : 'Create Corrective Maintenance'}
                    >
                      <Wrench className="w-4 h-4" />
                      <span>
                        {isActionTaken && (linkedWo || currentTicket.workOrderNumber)
                          ? `Corrective Maintenance Created (${linkedWo?.woNumber || currentTicket.workOrderNumber})`
                          : 'Create Corrective Maintenance'}
                      </span>
                      {!isActionTaken && <ArrowRight className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Button 2: Dismiss */}
                  <button
                    type="button"
                    disabled={isActionTaken}
                    onClick={() => {
                      if (!isActionTaken) {
                        setDismissReason('')
                        setShowDismissModal(true)
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition text-xs border ${
                      isActionTaken
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300'
                    }`}
                    title={isActionTaken ? 'Request already concluded / locked' : 'Dismiss this request with an administrative note'}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>
                      {currentTicket.dismissalReason ? 'Dismissed & Closed' : 'Dismiss'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dismiss Service Request Modal */}
        {showDismissModal && currentTicket && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Dismiss Service Request</h3>
                    <p className="text-[11px] font-mono text-slate-400">{currentTicket.ticketId} • {currentTicket.title}</p>
                  </div>
                </div>
                <button onClick={() => setShowDismissModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmDismiss} className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-amber-900 space-y-1">
                  <p className="font-semibold">Confirm Request Dismissal</p>
                  <p className="text-[11px] text-amber-800">
                    Dismissing this request will permanently close it as invalid or duplicate. No maintenance work order will be created.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reason for Dismissal / Admin Note <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={dismissReason}
                    onChange={e => setDismissReason(e.target.value)}
                    placeholder="e.g. Duplicate of ticket SCT002, false alarm, or resolved via direct assistance..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDismissModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    Confirm & Dismiss
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Service Request Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Create Service Request</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Issue Title / Subject *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Compressor trip in Bridge Simulator"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Request Type</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Maintenance">Maintenance</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="IT Support">IT Support</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SLA Priority Level</label>
                    <select
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 font-semibold"
                    >
                      <option value="Critical">Critical ({slaConfig.Critical}h SLA)</option>
                      <option value="High">High ({slaConfig.High}h SLA)</option>
                      <option value="Medium">Medium ({slaConfig.Medium}h SLA)</option>
                      <option value="Low">Low ({slaConfig.Low}h SLA)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room / Operational Area *</label>
                  <select
                    value={newRoomId}
                    onChange={e => setNewRoomId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {(newType === 'Maintenance' || newType === 'IT Support') && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Asset</label>
                    <select
                      value={newAssetId}
                      onChange={e => handleAssetSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.assetId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description / Observations</label>
                  <textarea
                    rows={3}
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Provide details about symptoms, sound, error codes..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    Submit Service Request
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
