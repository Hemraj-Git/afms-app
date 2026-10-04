'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { serviceRequestSchemaFor, type ServiceRequestForm } from '@/lib/validation/forms'
import { requestTitle } from '@/lib/fieldRequests'
import { generateUUID } from '@/lib/uuid'
import { CameraCaptureButton } from '@/components/ui/CameraCaptureButton'
import { FieldError, INVALID, focusFirstError, invalidProps } from '@/components/ui/FormField'
import { showToast } from '@/lib/toast'
import { lockedSlaPriority } from '@/lib/assetSlaPriority'
import { PageSkeleton } from '@/components/ui/Skeleton'
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
import { getNextSequence, formatYearlyId } from '@/lib/idGenerator'
import { getLocalDateStr, formatDateDisplay, formatDateTimeDisplay } from '@/lib/dateUtils'
import { useSearchPrefill } from '@/lib/useSearchPrefill'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, PRIORITY_ORDER, sortByOrder, timeOf } from '@/components/ui/DataTable'

import { Modal, DRAWER_OVERLAY } from '@/components/ui/Modal'
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

  // New Request Form: checked by serviceRequestSchema, errors shown under the fields.
  const blankRequest = (): ServiceRequestForm => ({
    title: '',
    description: '',
    type: 'Maintenance',
    roomId: '',
    assetId: '',
    priority: 'Medium',
  })
  // Whether a room has equipment to choose from -- read when the form is
  // checked, so it always uses the asset list as it is then.
  const assetsRef = useRef(assets)
  useEffect(() => {
    assetsRef.current = assets
  }, [assets])
  const [requestSchema] = useState(() =>
    serviceRequestSchemaFor(roomId => assetsRef.current.some(a => a.roomId === roomId && a.status !== 'Retired')),
  )
  // The optional photo: uploaded as soon as it is taken or chosen.
  const [requestPhoto, setRequestPhoto] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ServiceRequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: blankRequest(),
    mode: 'onTouched',
  })
  const newType = watch('type')
  const newAssetId = watch('assetId')
  const newPriority = watch('priority')
  const newRoomId = watch('roomId')
  const equipmentInRoom = assets.filter(a => a.roomId === newRoomId && a.status !== 'Retired').sort((a, b) => a.name.localeCompare(b.name))
  const createFormRef = useRef<HTMLFormElement>(null)

  // Fresh form each time, with the lists as they are now (they may have
  // finished loading after the page opened).
  const openCreateModal = () => {
    reset(blankRequest())
    setRequestPhoto('')
    // One id for this draft, reused if Submit is pressed again after a lost reply.
    requestIdRef.current = generateUUID()
    setShowCreateModal(true)
  }

  // The asset and its sub-category, and the SLA priority they lock a
  // Maintenance request to -- the asset's own priority, or (for one created
  // before that field existed) its sub-category's. When neither has one,
  // the user picks manually (see the Priority field below).
  const selectedAsset = assets.find(a => a.id === newAssetId)
  const selectedAssetSub = subCategories.find(s => s.id === selectedAsset?.subCategoryId)
  const priorityLock = newType === 'Maintenance' ? lockedSlaPriority(selectedAsset, selectedAssetSub) : undefined
  const isPriorityAutoSet = Boolean(priorityLock)

  // Applies the lock whenever the target asset (or request type) changes --
  // previously this only ran on the asset dropdown's onChange, so the
  // default-selected asset's priority was never reflected until the user
  // touched the dropdown (the submit-time recompute masked this, but the
  // displayed value was wrong until then).
  useEffect(() => {
    if (priorityLock) setValue('priority', priorityLock.priority)
  }, [priorityLock?.priority, setValue])

  // Opened from the header search: show that ticket whatever its status.
  useSearchPrefill(q => {
    setActiveTab('All')
    setSearchQuery(q)
  })

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

  // The ref blocks a second click that lands before React re-renders with the
  // disabled button; the state is what disables it and shows "Submitting…".
  const isSubmittingRef = useRef(false)
  const requestIdRef = useRef('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)

  // Runs only once the form is valid; otherwise the errors show under the
  // fields and focus moves to the first one.
  const handleCreateSubmit = handleSubmit(
    async values => {
      if (isSubmittingRef.current) return
      if (photoUploading) {
        showToast('error', 'Wait for the photo to finish uploading.')
        return
      }
      isSubmittingRef.current = true
      setIsSubmittingRequest(true)
      const finalPriority: SlaPriority = priorityLock?.priority || values.priority

      // Calculate SLA Due Time using SLA Configuration
      const slaHours = slaConfig[finalPriority] || 24
      const dueTimeMs = Date.now() + slaHours * 60 * 60 * 1000
      const slaDueDate = new Date(dueTimeMs).toISOString()

      try {
        const asset = assets.find(a => a.id === values.assetId)
        const room = rooms.find(r => r.id === values.roomId)
        await addServiceRequest({
          title: requestTitle(values.title, values.type, values.type === 'Maintenance' ? asset?.name : undefined, room?.name, values.description),
          description: values.description,
          requestType: values.type,
          roomId: values.roomId,
          assetId: values.type === 'Maintenance' ? values.assetId || undefined : undefined,
          photoUrls: requestPhoto ? [requestPhoto] : [],
          requestedBy: currentUser.fullName,
          requestedByRole: currentUser.role,
          status: 'Open',
          priority: finalPriority,
          slaDueDate,
        }, requestIdRef.current || undefined)

        setShowCreateModal(false)
        reset(blankRequest())
      } catch (err) {
        showToast('error', err instanceof Error ? err.message : 'Failed to create service request. Please try again.')
      } finally {
        isSubmittingRef.current = false
        setIsSubmittingRequest(false)
      }
    },
    () => focusFirstError(createFormRef.current)
  )

  // Convert Service Request to Corrective Maintenance. This no longer mints
  // a real WO-CR-#### number here -- it creates a "PENDING" placeholder
  // work order (still visible in the Corrective Maintenance queue as
  // "Pending Assignment", still driving due-date tracking) and only
  // becomes a real, numbered Work Order once a technician is actually
  // assigned (see updateWorkOrderStatus in AFMSContext.tsx).
  const handleCreateCorrective = (ticket: ServiceRequest) => {
    const targetAsset = assets.find(a => a.id === ticket.assetId)

    addWorkOrder({
      woNumber: 'PENDING',
      type: 'Corrective',
      title: ticket.title || 'Corrective Breakdown Repair',
      assetId: ticket.assetId,
      roomId: ticket.roomId,
      priority: ticket.priority,
      source: 'Service Request',
      sourceRefId: ticket.ticketId,
      // Not .split('T')[0] -- that truncates to the UTC calendar date,
      // which can land on the wrong IST day for deadlines falling in
      // 18:30-23:59 UTC (00:00-05:29 IST).
      dueDate: ticket.slaDueDate ? getLocalDateStr(new Date(ticket.slaDueDate)) : getLocalDateStr(),
      status: 'Scheduled', // Pending technician assignment
      issueLogged: `${ticket.title} — ${ticket.description || 'Reported via Service Desk'}`,
    })

    updateServiceRequestStatus(ticket.id, 'In Progress', {
      workOrderNumber: 'PENDING',
      workOrderType: 'Corrective',
    })
    setSelectedTicket(prev => prev && prev.id === ticket.id ? {
      ...prev,
      status: 'In Progress',
      workOrderNumber: 'PENDING',
      workOrderType: 'Corrective',
    } : null)
  }

  // Convert Service Request to Housekeeping Work Order directly
  const handleAssignHousekeeping = (ticket: ServiceRequest) => {
    const woNum = formatYearlyId('WO-HK', getNextSequence(workOrders.map(w => w.woNumber), 'WO-HK'))

    addWorkOrder({
      woNumber: woNum,
      type: 'Housekeeping',
      title: ticket.title || 'Housekeeping Cleaning & Sanitization Request',
      roomId: ticket.roomId,
      priority: ticket.priority,
      source: 'Service Request',
      sourceRefId: ticket.ticketId,
      // Not .split('T')[0] -- that truncates to the UTC calendar date,
      // which can land on the wrong IST day for deadlines falling in
      // 18:30-23:59 UTC (00:00-05:29 IST).
      dueDate: ticket.slaDueDate ? getLocalDateStr(new Date(ticket.slaDueDate)) : getLocalDateStr(),
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

    // Full ISO instant, not just a date -- dismissed_at is now a
    // timestamptz column (previously text, date-only, which dropped
    // time-of-day that its sibling columns on the same table all keep).
    const dismissedAtIso = new Date().toISOString()

    updateServiceRequestStatus(selectedTicket.id, 'Closed', {
      dismissalReason: dismissReason.trim(),
      dismissedAt: dismissedAtIso,
      dismissedBy: currentUser?.fullName || 'Administrator',
    })

    setSelectedTicket(prev => prev ? {
      ...prev,
      status: 'Closed',
      dismissalReason: dismissReason.trim(),
      dismissedAt: dismissedAtIso,
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

  const requestColumns: ColumnDef<ServiceRequest>[] = [
    {
      id: 'ticketId',
      header: 'Service Request ID',
      accessorFn: r => r.ticketId,
      meta: { thClassName: 'py-3.5 px-6', tdClassName: 'py-4 px-6 font-mono font-bold text-blue-600' },
    },
    {
      id: 'createdAt',
      header: 'Date',
      accessorFn: r => timeOf(r.createdAt),
      sortUndefined: 'last',
      meta: { tdClassName: 'py-4 px-4 text-slate-500 font-medium whitespace-nowrap' },
      cell: ({ row: { original: req } }) => formatDateDisplay(req.createdAt),
    },
    {
      id: 'title',
      header: 'Subject & Target Asset',
      accessorFn: r => r.title,
      cell: ({ row: { original: req } }) => {
        const asset = assets.find(a => a.id === req.assetId)
        return (
          <>
            <p className="font-bold text-slate-900">{req.title}</p>
            <p className="text-[11px] text-slate-500 font-medium">
              {asset?.name ? `${asset.name} (${asset.assetId || asset.id})` : req.requestType}
            </p>
          </>
        )
      },
    },
    {
      id: 'location',
      header: 'Location',
      accessorFn: r => rooms.find(rm => rm.id === r.roomId)?.name || 'General Area',
      cell: ({ row: { original: req } }) => {
        const room = rooms.find(r => r.id === req.roomId)
        return (
          <>
            <p className="font-semibold text-slate-800">{room?.name || 'General Area'}</p>
            <p className="text-[11px] text-slate-400 whitespace-nowrap">Room {room?.roomNumber}</p>
          </>
        )
      },
    },
    {
      id: 'requestedBy',
      header: 'Requested By',
      accessorFn: r => r.requestedBy,
      cell: ({ row: { original: req } }) => (
        <>
          <p className="font-semibold text-slate-800">{req.requestedBy}</p>
          <p className="text-[11px] text-slate-400">{req.requestedByRole}</p>
        </>
      ),
    },
    {
      id: 'priority',
      header: 'SLA Priority',
      accessorFn: r => r.priority,
      sortingFn: sortByOrder(PRIORITY_ORDER),
      // The priority as a badge; its resolution time beneath.
      cell: ({ row: { original: req } }) => (
        <div className="space-y-1">
          <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold ${
            req.priority === 'Critical'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : req.priority === 'High'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {req.priority}
          </span>
          <p className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{slaConfig[req.priority as SlaPriority] || 24}h SLA</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: r => r.status,
      sortingFn: sortByOrder(['Open', 'In Progress', 'Resolved', 'Closed']),
      cell: ({ row: { original: req } }) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {getStatusBadge(req.status)}
          {isTicketOverdue(req) && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
              Overdue
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      meta: { thClassName: 'py-3.5 px-6 text-right', tdClassName: 'py-4 px-6 text-right' },
      cell: ({ row: { original: req } }) => (
        <button
          onClick={() => setSelectedTicket(req)}
          className="btn btn-secondary btn-sm"
        >
          <span>Action</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ]

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
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Service Request' }]} loadingFallback={<PageSkeleton tiles={4} rows={8} cols={6} />}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Service Request Desk</h1>
            <p className="text-xs text-slate-500 mt-0.5">SLA-monitored incident intake & dispatch to Corrective Maintenance or Housekeeping</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Create Service Request</span>
            </button>
            <Link
              href="/maintenance/work-orders"
              className="btn btn-secondary"
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

          <DataTable
            tableId="service-requests"
            data={filteredRequests}
            columns={requestColumns}
            getRowId={r => r.id}
            resetKey={`${activeTab}|${searchQuery}`}
            rowClassName="hover:bg-slate-50/60 transition group"
            emptyState={
              <div className="flex flex-col items-center justify-center space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">No Service Requests Found</p>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Create a service request to report an asset breakdown, room maintenance requirement, or cleaning ticket.
                </p>
              </div>
            }
          />
        </div>

        {/* TICKET DETAIL & ACTION MODAL / DRAWER */}
        {currentTicket && (
            <Modal title="Service request details" onClose={() => setSelectedTicket(null)} overlayClassName={DRAWER_OVERLAY} className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
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
                      Due: {currentTicket.slaDueDate ? formatDateDisplay(currentTicket.slaDueDate) : 'Active'}
                    </span>
                  </div>

                  <div>
                    <p className="text-slate-400 uppercase font-bold text-[10px]">Description</p>
                    <p className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                      {currentTicket.description || 'No additional remarks provided.'}
                    </p>
                  </div>

                  {currentTicket.photoUrls && currentTicket.photoUrls.length > 0 && (
                    <div>
                      <p className="text-slate-400 uppercase font-bold text-[10px]">Photo Evidence</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {currentTicket.photoUrls.map((url, idx) => (
                          <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                            <img src={url} alt={`Request evidence ${idx + 1}`} className="h-32 w-auto object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      <span className="font-semibold text-slate-800">{formatDateDisplay(currentTicket.createdAt)}</span>
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
                            {(linkedWo?.woNumber || currentTicket.workOrderNumber) === 'PENDING'
                              ? 'Pending Assignment'
                              : (linkedWo?.woNumber || currentTicket.workOrderNumber)}
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
                          className="btn btn-secondary btn-sm"
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
                            {formatDateTimeDisplay(currentTicket.dismissedAt)}
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

                  {/* Button 1: Create Corrective Maintenance / Housekeeping Work Order —
                      routed by requestType. Previously this only special-cased 'Cleaning',
                      so a 'Housekeeping' request fell into the Corrective-Maintenance
                      branch by accident. 'IT Support'/'General' have no natural fit in
                      either bucket, so neither action is shown for them. */}
                  {(currentTicket.requestType === 'Cleaning' || currentTicket.requestType === 'Housekeeping') ? (
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
                  ) : currentTicket.requestType === 'Maintenance' ? (
                    <button
                      type="button"
                      disabled={isActionTaken}
                      onClick={() => !isActionTaken && handleCreateCorrective(currentTicket)}
                      className="btn btn-primary w-full"
                      title={isActionTaken ? (
                        (linkedWo?.woNumber || currentTicket.workOrderNumber) === 'PENDING'
                          ? 'Corrective maintenance raised — pending technician assignment'
                          : `Corrective order ${linkedWo?.woNumber || currentTicket.workOrderNumber || ''} already processed`
                      ) : 'Create Corrective Maintenance'}
                    >
                      <Wrench className="w-4 h-4" />
                      <span>
                        {isActionTaken && (linkedWo || currentTicket.workOrderNumber)
                          ? ((linkedWo?.woNumber || currentTicket.workOrderNumber) === 'PENDING'
                              ? 'Corrective Maintenance Raised (Pending Assignment)'
                              : `Corrective Maintenance Created (${linkedWo?.woNumber || currentTicket.workOrderNumber})`)
                          : 'Create Corrective Maintenance'}
                      </span>
                      {!isActionTaken && <ArrowRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <p className="text-[11px] text-slate-400 text-center py-1.5">
                      No maintenance or housekeeping action applies to this request type — use the status controls below.
                    </p>
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
            </Modal>
        )}

        {/* Dismiss Service Request Modal */}
        {showDismissModal && currentTicket && (
            <Modal title="Dismiss Service Request" onClose={() => setShowDismissModal(false)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
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
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                  >
                    Confirm & Dismiss
                  </button>
                </div>
              </form>
            </Modal>
        )}

        {/* Create Service Request Modal */}
        {showCreateModal && (
            <Modal title="Create Service Request" onClose={() => setShowCreateModal(false)} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Create Service Request</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form ref={createFormRef} onSubmit={handleCreateSubmit} noValidate className="space-y-4 text-xs">
                <div>
                  <label htmlFor="sr-title" className="block font-semibold text-slate-700 mb-1">Title <span className="font-normal text-slate-400">(optional — the start of the description is used if blank)</span></label>
                  <input
                    id="sr-title"
                    type="text"
                    {...register('title')}
                    {...invalidProps('sr-title', errors.title?.message)}
                    placeholder="e.g. Compressor trip in Bridge Simulator"
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${INVALID}`}
                  />
                  <FieldError id="sr-title-error" message={errors.title?.message} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sr-type" className="block font-semibold text-slate-700 mb-1">Request Type</label>
                    <select
                      id="sr-type"
                      {...register('type')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Maintenance">Maintenance</option>
                      <option value="Housekeeping">Housekeeping</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SLA Priority Level</label>
                    {isPriorityAutoSet ? (
                      <div className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700 flex items-center justify-between">
                        <span>{newPriority} ({slaConfig[newPriority]}h SLA)</span>
                        <span className="text-[10px] font-medium text-slate-400 normal-case">
                          {priorityLock?.source === 'asset'
                            ? "Auto-set from this asset's SLA priority"
                            : `Auto-set from ${selectedAssetSub?.name}'s SLA policy`}
                        </span>
                      </div>
                    ) : (
                      <select
                        {...register('priority')}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 font-semibold"
                      >
                        <option value="Critical">Critical ({slaConfig.Critical}h SLA)</option>
                        <option value="High">High ({slaConfig.High}h SLA)</option>
                        <option value="Medium">Medium ({slaConfig.Medium}h SLA)</option>
                        <option value="Low">Low ({slaConfig.Low}h SLA)</option>
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="sr-room" className="block font-semibold text-slate-700 mb-1">Room / Operational Area *</label>
                  <select
                    id="sr-room"
                    {...register('roomId', { onChange: () => setValue('assetId', '') })}
                    {...invalidProps('sr-room', errors.roomId?.message)}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 ${INVALID}`}
                  >
                    <option value="" disabled>Choose a room / area…</option>
                    {[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomNumber})
                      </option>
                    ))}
                  </select>
                  <FieldError id="sr-room-error" message={errors.roomId?.message} />
                </div>

                {newType === 'Maintenance' && newRoomId ? (
                  equipmentInRoom.length ? (
                    <div>
                      <label htmlFor="sr-asset" className="block font-semibold text-slate-700 mb-1">Equipment *</label>
                      <select
                        id="sr-asset"
                        {...register('assetId')}
                        {...invalidProps('sr-asset', errors.assetId?.message)}
                        className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 ${INVALID}`}
                      >
                        <option value="" disabled>Choose the equipment…</option>
                        {equipmentInRoom.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.assetId})
                          </option>
                        ))}
                      </select>
                      <FieldError id="sr-asset-error" message={errors.assetId?.message} />
                    </div>
                  ) : (
                    <p className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
                      No equipment is listed for this room, so the request is for the room itself.
                    </p>
                  )
                ) : null}

                <div>
                  <label htmlFor="sr-desc" className="block font-semibold text-slate-700 mb-1">Description *</label>
                  <textarea
                    id="sr-desc"
                    rows={3}
                    {...register('description')}
                    {...invalidProps('sr-desc', errors.description?.message)}
                    placeholder="Provide details about symptoms, sound, error codes..."
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${INVALID}`}
                  ></textarea>
                  <FieldError id="sr-desc-error" message={errors.description?.message} />
                </div>

                <div>
                  <p className="block font-semibold text-slate-700 mb-1">Photo <span className="font-normal text-slate-400">(optional)</span></p>
                  <div className="flex items-center gap-3">
                    <CameraCaptureButton
                      onCapture={setRequestPhoto}
                      onUploadingChange={setPhotoUploading}
                      label={requestPhoto ? 'Change photo' : 'Add a photo'}
                      className="btn btn-secondary"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded photo */}
                    {requestPhoto ? <img src={requestPhoto} alt="Attached" className="h-12 w-12 rounded-lg object-cover border border-slate-200" /> : null}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest || photoUploading}
                    className="btn btn-primary"
                  >
                    {isSubmittingRequest ? 'Submitting…' : 'Submit Service Request'}
                  </button>
                </div>
              </form>
            </Modal>
        )}
      </div>
    </AppLayout>
  )
}
