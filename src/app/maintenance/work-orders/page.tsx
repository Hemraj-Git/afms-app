'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { canBeAssigned, workOrderSchema, type WorkOrderForm } from '@/lib/validation/forms'
import { FieldError, INVALID, focusFirstError, invalidProps } from '@/components/ui/FormField'
import { showToast } from '@/lib/toast'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { getLocalDateStr, formatDateDisplay } from '@/lib/dateUtils'
import { isWorkOrderOverdue } from '@/lib/isWorkOrderOverdue'
import { isWithVendor } from '@/lib/workOrderState'
import { VendorHandoverCard } from '@/components/VendorHandoverCard'
import { WorkOrderRecord } from '@/components/workOrders/WorkOrderRecord'
import { OutsideRepairPanel, OutsideRepairTag } from '@/components/outsideRepair/OutsideRepairPanel'
import {
  ClipboardList,
  Wrench,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  Plus,
  User,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  Eye,
  Lock,
} from 'lucide-react'
import { WorkOrder } from '@/types/afms'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { getNextSequence, formatYearlyId, isPendingWorkOrder } from '@/lib/idGenerator'
import { useSearchPrefill } from '@/lib/useSearchPrefill'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, PRIORITY_ORDER, WO_STATUS_ORDER, sortByOrder, timeOf } from '@/components/ui/DataTable'

import { Modal, DRAWER_OVERLAY } from '@/components/ui/Modal'
import { useAccountStatuses } from '@/lib/queries/accountStatus'
import { firstAssignableId, orderForAssignment, PENDING_SUFFIX } from '@/lib/accountState'
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
    currentUser,
  } = useAFMS()
  // Invited people who have not signed in yet cannot be given work (see accountState.ts).
  const { isPending } = useAccountStatuses(currentUser.id, currentUser.role === 'Admin')

  const [activeTab, setActiveTab] = useState<'All' | 'Preventive' | 'Corrective' | 'Housekeeping'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSlaModal, setShowSlaModal] = useState(false)
  const [selectedWoForDetails, setSelectedWoForDetails] = useState<WorkOrder | null>(null)

  // Opened from the header search: show that order whatever its type or status.
  useSearchPrefill(q => {
    setActiveTab('All')
    setStatusFilter('All')
    setSearchQuery(q)
  })

  // SLA Form State
  const [tempSla, setTempSla] = useState(slaConfig)

  // Create Work Order form: checked by workOrderSchema, errors under the fields.
  // The first eligible person for a type (a technician, or housekeeping staff).
  const firstAssignee = (t: WorkOrderForm['type']) =>
    firstAssignableId(users.filter(u => (t === 'Housekeeping' ? u.role === 'Housekeeping' : u.role === 'Technician')), isPending) ||
    firstAssignableId(users.filter(u => canBeAssigned(u.role, t)), isPending)
  const blankWorkOrder = (): WorkOrderForm => ({
    type: 'Preventive',
    title: '',
    assetId: assets[0]?.id || '',
    roomId: rooms[0]?.id || '',
    assignedTechnicianId: firstAssignee('Preventive'),
    priority: 'Medium',
    dueDate: getLocalDateStr(new Date(Date.now() + 86400000 * 3)),
    issueLogged: '',
  })
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: blankWorkOrder(),
    mode: 'onTouched',
  })
  const type = watch('type')
  const createFormRef = useRef<HTMLFormElement>(null)

  const openCreateModal = () => {
    reset(blankWorkOrder())
    setShowCreateModal(true)
  }

  // The assignee list depends on the type: switching type must not leave a
  // person selected who is no longer in the list.
  const chooseType = (t: WorkOrderForm['type']) => {
    setValue('type', t)
    const current = users.find(u => u.id === getValues('assignedTechnicianId'))
    if (!current || !canBeAssigned(current.role, t) || isPending(current.id)) setValue('assignedTechnicianId', firstAssignee(t))
  }

  // A Preventive/Corrective record with no technician assigned yet is a
  // PENDING placeholder (see makePendingWoNumber in idGenerator.ts) -- it
  // still exists for due-date tracking and shows up in the dedicated
  // Preventive/Corrective assignment queues, but it isn't a real, numbered
  // Work Order yet, so this hub (and its KPIs) excludes it until assigned.
  const realWorkOrders = workOrders.filter(w => !isPendingWorkOrder(w.woNumber))

  // KPI Calculations
  const totalCount = realWorkOrders.length
  const pmCount = realWorkOrders.filter(w => w.type === 'Preventive').length
  const crCount = realWorkOrders.filter(w => w.type === 'Corrective').length
  const hkCount = realWorkOrders.filter(w => w.type === 'Housekeeping').length
  const inProgressCount = realWorkOrders.filter(w => w.status === 'In Progress').length

  const overdueWoCount = realWorkOrders.filter(isWorkOrderOverdue).length

  // Filtered List
  const filteredWorkOrders = realWorkOrders.filter(wo => {
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

  const workOrderColumns: ColumnDef<WorkOrder>[] = [
    {
      id: 'woNumber',
      header: 'WO Number',
      accessorFn: wo => wo.woNumber,
      meta: { tdClassName: 'py-3.5 px-4 font-mono font-bold text-blue-600' },
    },
    {
      id: 'title',
      header: 'Type & Title',
      accessorFn: wo => wo.title || `${wo.type} Work Order`,
      cell: ({ row: { original: wo } }) => (
        <>
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
        </>
      ),
    },
    {
      id: 'target',
      header: 'Target (Asset / Room)',
      accessorFn: wo => {
        const asset = assets.find(a => a.id === wo.assetId)
        return asset?.name || rooms.find(r => r.id === wo.roomId)?.name || ''
      },
      sortUndefined: 'last',
      cell: ({ row: { original: wo } }) => {
        const asset = assets.find(a => a.id === wo.assetId)
        const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId))
        return asset ? (
          <div>
            <p className="font-bold text-slate-900">{asset.name}</p>
            <p className="text-[10px] text-slate-400 font-mono">{asset.assetId || asset.id} • {room?.name || 'Main Campus'}</p>
          </div>
        ) : room ? (
          <div>
            <p className="font-bold text-slate-900">{room.name}</p>
            <p className="text-[10px] text-slate-400 font-mono">{room.roomNumber || room.id}</p>
          </div>
        ) : (
          <span className="text-slate-400">General Facility</span>
        )
      },
    },
    {
      id: 'assignedTo',
      header: 'Assigned To',
      accessorFn: wo => wo.assignedTechnicianName || 'Unassigned',
      cell: ({ row: { original: wo } }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
            {wo.assignedTechnicianName ? wo.assignedTechnicianName[0] : 'U'}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{wo.assignedTechnicianName || 'Unassigned'}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'dueDate',
      header: 'Due Date',
      accessorFn: wo => timeOf(wo.dueDate),
      sortUndefined: 'last',
      meta: { tdClassName: 'py-3.5 px-4 font-medium text-slate-600' },
      cell: ({ row: { original: wo } }) => (
        <>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDateDisplay(wo.dueDate)}</span>
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
        </>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      accessorFn: wo => wo.priority || 'Medium',
      sortingFn: sortByOrder(PRIORITY_ORDER),
      cell: ({ row: { original: wo } }) => (
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
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: wo => wo.status,
      sortingFn: sortByOrder(WO_STATUS_ORDER),
      cell: ({ row: { original: wo } }) => (
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
          {isWithVendor(wo) && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              With vendor
            </span>
          )}
          <OutsideRepairTag workOrderId={wo.id} theme="light" />
          {isWorkOrderOverdue(wo) && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
              Overdue
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { thClassName: 'py-3.5 px-4 text-right', tdClassName: 'py-3.5 px-4 text-right' },
      cell: ({ row: { original: wo } }) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedWoForDetails(wo)}
            className="btn btn-secondary btn-sm"
            title="View complete work order telemetry and records"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>View Details</span>
          </button>
        </div>
      ),
    },
  ]

  const handleSaveSla = (e: React.FormEvent) => {
    e.preventDefault()
    updateSlaConfig(tempSla)
    setShowSlaModal(false)
  }

  const handleCreateSubmit = handleSubmit(
    v => {
      const tech = users.find(u => u.id === v.assignedTechnicianId)
      if (!tech || !canBeAssigned(tech.role, v.type)) {
        // Only possible if the user list changed while the form was open.
        setValue('assignedTechnicianId', firstAssignee(v.type))
        showToast('error', `Choose someone who can take a ${v.type.toLowerCase()} work order.`)
        return
      }
      const prefix = v.type === 'Preventive' ? 'WO-PM' : v.type === 'Corrective' ? 'WO-CR' : 'WO-HK'
      const woNum = formatYearlyId(prefix, getNextSequence(workOrders.map(w => w.woNumber), prefix))

      addWorkOrder({
        woNumber: woNum,
        type: v.type,
        title: v.title,
        assetId: v.type !== 'Housekeeping' ? v.assetId : undefined,
        roomId: v.roomId || undefined,
        priority: v.priority,
        source: v.type === 'Preventive' ? 'Scheduled' : v.type === 'Corrective' ? 'Service Request' : 'Routine',
        dueDate: v.dueDate,
        assignedTechnicianId: v.assignedTechnicianId,
        assignedTechnicianName: tech.fullName,
        status: 'Scheduled',
        issueLogged: v.issueLogged || undefined,
      })

      setShowCreateModal(false)
      reset(blankWorkOrder())
    },
    () => focusFirstError(createFormRef.current)
  )

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Maintenance' }, { label: 'Work Orders' }]} loadingFallback={<PageSkeleton tiles={4} rows={8} cols={6} />}>
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
              className="btn btn-secondary"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>Configure SLA Rules</span>
            </button>

            <button
              onClick={openCreateModal}
              className="btn btn-primary"
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
          <DataTable
            tableId="work-orders"
            data={filteredWorkOrders}
            columns={workOrderColumns}
            getRowId={wo => wo.id}
            resetKey={`${activeTab}|${statusFilter}|${searchQuery}`}
            rowClassName="hover:bg-slate-50/60 transition group"
            tdClassName="py-3.5 px-4"
            emptyState={
              <div className="flex flex-col items-center justify-center space-y-2">
                <ClipboardList className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">No Work Orders Found</p>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Work orders will be populated automatically when preventive schedules trigger, service requests are escalated to corrective repairs, or created manually.
                </p>
              </div>
            }
          />
        </div>

        {/* Modal: Create Work Order */}
        {showCreateModal && (
            <Modal title="Create Work Order" onClose={() => setShowCreateModal(false)} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Create Work Order</h3>
                  <p className="text-xs text-slate-500">Auto-assigns WO-PM, WO-CR, or WO-HK ID format</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form ref={createFormRef} onSubmit={handleCreateSubmit} noValidate className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Order Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Preventive', 'Corrective', 'Housekeeping'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={type === t}
                        onClick={() => chooseType(t)}
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
                  <label htmlFor="wo-title" className="block font-semibold text-slate-700 mb-1">Work Order Title *</label>
                  <input
                    id="wo-title"
                    type="text"
                    {...register('title')}
                    {...invalidProps('wo-title', errors.title?.message)}
                    placeholder="e.g. Split AC Coil Cleaning or Deep Room Sanitization"
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl ${INVALID}`}
                  />
                  <FieldError id="wo-title-error" message={errors.title?.message} />
                </div>

                {type !== 'Housekeeping' && (
                  <div>
                    <label htmlFor="wo-asset" className="block font-semibold text-slate-700 mb-1">Select Target Asset *</label>
                    <select
                      id="wo-asset"
                      {...register('assetId')}
                      {...invalidProps('wo-asset', errors.assetId?.message)}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white ${INVALID}`}
                    >
                      <option value="" disabled>Choose the asset…</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.assetId || a.id})
                        </option>
                      ))}
                    </select>
                    <FieldError id="wo-asset-error" message={errors.assetId?.message} />
                  </div>
                )}

                <div>
                  <label htmlFor="wo-room" className="block font-semibold text-slate-700 mb-1">Target Room / Area *</label>
                  <select
                    id="wo-room"
                    {...register('roomId')}
                    {...invalidProps('wo-room', errors.roomId?.message)}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white ${INVALID}`}
                  >
                    <option value="" disabled>Choose a room / area…</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomNumber || r.id})
                      </option>
                    ))}
                  </select>
                  <FieldError id="wo-room-error" message={errors.roomId?.message} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="wo-assignee" className="block font-semibold text-slate-700 mb-1">Assign Technician/Staff *</label>
                    <select
                      id="wo-assignee"
                      {...register('assignedTechnicianId')}
                      {...invalidProps('wo-assignee', errors.assignedTechnicianId?.message)}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white ${INVALID}`}
                    >
                      <option value="" disabled>Choose a person…</option>
                      {orderForAssignment(users.filter(u => canBeAssigned(u.role, type)), isPending).map(u => (
                        <option key={u.id} value={u.id} disabled={isPending(u.id)}>
                          {u.fullName} ({u.role}){isPending(u.id) ? PENDING_SUFFIX : ''}
                        </option>
                      ))}
                    </select>
                    <FieldError id="wo-assignee-error" message={errors.assignedTechnicianId?.message} />
                  </div>

                  <div>
                    <label htmlFor="wo-priority" className="block font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      id="wo-priority"
                      {...register('priority')}
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
                  <label htmlFor="wo-due" className="block font-semibold text-slate-700 mb-1">SLA Due Date *</label>
                  <input
                    id="wo-due"
                    type="date"
                    {...register('dueDate')}
                    {...invalidProps('wo-due', errors.dueDate?.message)}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl ${INVALID}`}
                  />
                  <FieldError id="wo-due-error" message={errors.dueDate?.message} />
                </div>

                <div>
                  <label htmlFor="wo-details" className="block font-semibold text-slate-700 mb-1">Scope / Issue Details</label>
                  <textarea
                    id="wo-details"
                    rows={2}
                    {...register('issueLogged')}
                    {...invalidProps('wo-details', errors.issueLogged?.message)}
                    placeholder="Instructions or specific fault notes..."
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl ${INVALID}`}
                  ></textarea>
                  <FieldError id="wo-details-error" message={errors.issueLogged?.message} />
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
                    className="btn btn-primary"
                  >
                    Create Work Order
                  </button>
                </div>
              </form>
            </Modal>
        )}
        {/* Modal 2: Configure SLA Rules Modal */}
        {showSlaModal && (
            <Modal title="Configure SLA Resolution Hours" onClose={() => setShowSlaModal(false)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-6">
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
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Save SLA Configuration
                  </button>
                </div>
              </form>
            </Modal>
        )}
        {/* Modal: Work Order Details Side Drawer */}
        {selectedWoForDetails && (() => {
          const wo = workOrders.find(w => w.id === selectedWoForDetails.id) || selectedWoForDetails
          const asset = assets.find(a => a.id === wo.assetId)
          const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId))
          const tech = users.find(u => u.id === wo.assignedTechnicianId)
          const isCompleted = wo.status === 'Completed'

          // The checklist the job was given (or its template's); none is invented.
          const checklistItems = (wo.checklistSnapshot && wo.checklistSnapshot.length > 0)
            ? wo.checklistSnapshot
            : (checklistTemplates.find(t => t.id === wo.checklistTemplateId)?.items ?? [])

          return (
              <Modal title="Work order details" onClose={() => setSelectedWoForDetails(null)} overlayClassName={DRAWER_OVERLAY} className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
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
                        <span className="font-semibold text-slate-800">{formatDateDisplay(wo.dueDate)}</span>
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
                          <span className="font-bold text-emerald-800">{formatDateDisplay(wo.completedAt)}</span>
                        </div>
                      )}
                    </div>

                    <VendorHandoverCard wo={wo} />
                    {wo.type === 'Corrective' && (
                      <OutsideRepairPanel workOrder={wo} theme="light" readOnly={wo.status === 'Completed' || wo.status === 'Cancelled'} />
                    )}

                    <WorkOrderRecord wo={wo} checklistItems={checklistItems} />
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
              </Modal>
          )
        })()}
      </div>
    </AppLayout>
  )
}
