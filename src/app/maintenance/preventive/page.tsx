'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { formatDateDisplay } from '@/lib/dateUtils'
import { isWorkOrderOverdue } from '@/lib/isWorkOrderOverdue'
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  User,
  UserCheck,
  Filter,
  X,
  ArrowRight,
  Calendar,
  Eye,
  Lock,
} from 'lucide-react'
import { WorkOrder } from '@/types/afms'
import { ScheduleGapsBanner } from '@/components/maintenance/ScheduleGapsPanel'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, WO_STATUS_ORDER, sortByOrder, timeOf } from '@/components/ui/DataTable'

import { Modal, DRAWER_OVERLAY, STACKED_OVERLAY } from '@/components/ui/Modal'
import { WorkOrderRecord } from '@/components/workOrders/WorkOrderRecord'
import { useAccountStatuses } from '@/lib/queries/accountStatus'
import { firstAssignableId, orderForAssignment, PENDING_SUFFIX } from '@/lib/accountState'
// A not-yet-assigned Preventive record has a 'PENDING-<uuid>' placeholder
// woNumber (see makePendingWoNumber) -- show something readable instead of
// that raw internal string until it's minted into a real WO-PM-#### number.
const displayWoNumber = (woNumber: string) => (isPendingWorkOrder(woNumber) ? 'Pending Assignment' : woNumber)

export default function PreventiveMaintenancePage() {
  const router = useRouter()
  const { workOrders, updateWorkOrderStatus, assets, rooms, checklistTemplates, users, currentUser } = useAFMS()
  // Invited people who have not signed in yet cannot be given work (see accountState.ts).
  const { isPending } = useAccountStatuses(currentUser.id, currentUser.role === 'Admin')
  
  const [selectedWoForAssign, setSelectedWoForAssign] = useState<WorkOrder | null>(null)
  const [selectedWoForDetails, setSelectedWoForDetails] = useState<WorkOrder | null>(null)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [assignRemarks, setAssignRemarks] = useState('')

  // Sorted soonest-due-first -- the fetch only orders by created_at.
  const pmOrders = workOrders
    .filter(w => w.type === 'Preventive')
    .slice()
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
  const technicians = users.filter(u => u.role === 'Technician' || u.role === 'Admin')
  const availableTechs = technicians.length > 0 ? technicians : users

  // Technician Assignment -> Assigns technician and activates Work Order
  const handleAssignTechnician = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWoForAssign) return
    const tech = users.find(u => u.id === selectedTechnicianId) || availableTechs[0] || currentUser
    const techName = tech?.fullName || 'Technician'
    const techId = tech?.id || selectedTechnicianId || 'usr-tech-1'

    updateWorkOrderStatus(
      selectedWoForAssign.id,
      'Scheduled',
      // The instructions go to the field in their own field; the technician's
      // notes are left for the technician.
      undefined,
      {
        instructions: assignRemarks.trim() || undefined,
        assignedTechnicianId: techId,
        assignedTechnicianName: techName,
      }
    )

    setSelectedWoForAssign(null)
  }

  const pmColumns: ColumnDef<WorkOrder>[] = [
    {
      id: 'woNumber',
      header: 'WO Number',
      accessorFn: wo => displayWoNumber(wo.woNumber),
      meta: { thClassName: 'py-3.5 px-6', tdClassName: 'py-4 px-6 font-mono font-bold text-blue-600' },
    },
    {
      id: 'asset',
      header: 'Asset Under Maintenance',
      accessorFn: wo => assets.find(a => a.id === wo.assetId || a.assetId === wo.assetId)?.name || 'Asset',
      meta: { tdClassName: 'py-4 px-4 font-semibold text-slate-800' },
    },
    {
      id: 'frequency',
      header: 'Frequency',
      accessorFn: wo => wo.frequency || 'Quarterly',
      sortingFn: sortByOrder(['Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annually']),
      cell: ({ getValue }) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'dueDate',
      header: 'Due Date',
      accessorFn: wo => timeOf(wo.dueDate),
      sortUndefined: 'last',
      cell: ({ row: { original: wo } }) => {
        const windowStatus = getAttemptWindowStatus(wo.dueDate, wo.frequency)
        return (
          <>
            <div className="text-slate-700 font-semibold">{formatDateDisplay(wo.dueDate)}</div>
            {wo.status !== 'Completed' && (
              <div className="mt-1">
                {windowStatus.canAttempt ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Window Open ({windowStatus.windowDescription})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title={`Attempt allowed ${windowStatus.windowDescription} before due date`}>
                    <Lock className="w-2.5 h-2.5 text-amber-600" />
                    Opens {windowStatus.unlockDate}
                  </span>
                )}
              </div>
            )}
          </>
        )
      },
    },
    {
      id: 'technician',
      header: 'Assigned Technician',
      // Unassigned rows sort last.
      accessorFn: wo => wo.assignedTechnicianName || undefined,
      sortUndefined: 'last',
      cell: ({ row: { original: wo } }) =>
        wo.assignedTechnicianName ? (
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>{wo.assignedTechnicianName}</span>
          </div>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending Assignment
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
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
              wo.status === 'Completed'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : wo.status === 'In Progress'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-sky-50 text-sky-700 border border-sky-200'
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
      ),
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      meta: { thClassName: 'py-3.5 px-6 text-right', tdClassName: 'py-4 px-6 text-right' },
      cell: ({ row: { original: wo } }) =>
        !wo.assignedTechnicianName ? (
          <button
            onClick={() => {
              setSelectedWoForAssign(wo)
              setSelectedTechnicianId(firstAssignableId(availableTechs, isPending))
              setAssignRemarks('')
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5"
          >
            <User className="w-3.5 h-3.5" />
            <span>Assign Technician</span>
          </button>
        ) : (
          <button
            onClick={() => setSelectedWoForDetails(wo)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>View Details</span>
          </button>
        ),
    },
  ]

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Maintenance' }, { label: 'Preventive' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Preventive Maintenance (PM) Schedule</h1>
            <p className="text-xs text-slate-500 mt-0.5">Each asset&apos;s PM schedules — the next job of each. Assign a technician to make it an official Work Order.</p>
          </div>
        </div>

        <ScheduleGapsBanner kind="pm" />

        {/* Work Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Scheduled PM Tasks ({pmOrders.length})</h2>
          </div>

          <DataTable
            tableId="preventive"
            data={pmOrders}
            columns={pmColumns}
            getRowId={wo => wo.id}
            emptyState={
              <div className="flex flex-col items-center justify-center space-y-2">
                <Wrench className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">No Scheduled Preventive Maintenance</p>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  PM jobs appear here once a schedule is started — when adding an asset, on the asset&apos;s page, or from &ldquo;Not scheduled&rdquo; above.
                </p>
              </div>
            }
          />
        </div>

        {/* Modal 1: Assign Technician (Generates / Activates Work Order) */}
        {selectedWoForAssign && (
            <Modal title={selectedWoForAssign.assignedTechnicianName ? 'Reassign Technician' : 'Assign Technician'} onClose={() => setSelectedWoForAssign(null)} overlayClassName={STACKED_OVERLAY} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-blue-600">{displayWoNumber(selectedWoForAssign.woNumber)}</span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedWoForAssign.assignedTechnicianName ? 'Reassign Technician' : 'Assign Technician'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedWoForAssign.assignedTechnicianName 
                      ? `Currently assigned to: ${selectedWoForAssign.assignedTechnicianName}`
                      : 'Assign technician to activate work order'}
                  </p>
                </div>
                <button onClick={() => setSelectedWoForAssign(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignTechnician} className="space-y-4 text-xs">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
                  <p className="text-blue-900 font-bold">{selectedWoForAssign.title}</p>
                  <p className="text-blue-700 text-[11px]">Due Date: {formatDateDisplay(selectedWoForAssign.dueDate)} ({selectedWoForAssign.frequency || 'Quarterly'})</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Technician *</label>
                  <select
                    value={selectedTechnicianId}
                    onChange={e => setSelectedTechnicianId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    {orderForAssignment(availableTechs, isPending).map(tech => (
                      <option key={tech.id} value={tech.id} disabled={isPending(tech.id)}>
                        {tech.fullName} ({tech.role} - {tech.department || 'Maintenance'}){isPending(tech.id) ? PENDING_SUFFIX : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Instructions for the field (shown on their phone)</label>
                  <textarea
                    rows={2}
                    value={assignRemarks}
                    onChange={e => setAssignRemarks(e.target.value)}
                    placeholder="e.g. Ensure all SOP checklist items and filters are inspected..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedWoForAssign(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    {selectedWoForAssign.assignedTechnicianName ? 'Confirm Reassignment' : 'Assign & Activate Work Order'}
                  </button>
                </div>
              </form>
            </Modal>
        )}

        {/* Modal 3: PM Work Order Details Side Drawer */}
        {selectedWoForDetails && (() => {
          const wo = workOrders.find(w => w.id === selectedWoForDetails.id || w.woNumber === selectedWoForDetails.woNumber) || selectedWoForDetails
          const asset = assets.find(a => a.id === wo.assetId || a.assetId === wo.assetId)
          const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId) || r.roomNumber === (wo.roomId || asset?.roomId))
          const isCompleted = wo.status === 'Completed'

          // The checklist the job was given (or its template's); none is invented.
          const checklistItems = (Array.isArray(wo.checklistSnapshot) && wo.checklistSnapshot.length > 0)
            ? wo.checklistSnapshot
            : (checklistTemplates.find(t => t.id === wo.checklistTemplateId)?.items ?? [])

          return (
              <Modal title="Work order details" onClose={() => setSelectedWoForDetails(null)} overlayClassName={DRAWER_OVERLAY} className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {displayWoNumber(wo.woNumber)}
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {wo.frequency || 'Quarterly'}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">
                        {wo.title || 'Preventive Maintenance Service'}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-slate-400 font-semibold text-[10px] uppercase">Assigned Technician</p>
                        <p className="mt-1 font-bold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span>{wo.assignedTechnicianName || 'Unassigned'}</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-slate-400 font-semibold text-[10px] uppercase">Execution Mode</p>
                        <p className="mt-1 font-bold text-slate-800">
                          In House
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Asset:</span>
                        <span className="font-semibold text-slate-800">{asset?.name || 'Equipment Unit'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Location / Room:</span>
                        <span className="font-semibold text-slate-800">{room?.name || 'General Facility Area'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cycle Frequency:</span>
                        <span className="font-semibold text-slate-800">{wo.frequency || 'Quarterly'} Cycle</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Scheduled Due Date:</span>
                        <span className="font-semibold text-slate-800">{formatDateDisplay(wo.dueDate)}</span>
                      </div>
                      {(() => {
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
                      {wo.completedAt && (
                        <div className="flex justify-between pt-1 border-t border-slate-200/60">
                          <span className="text-emerald-700 font-medium">Completed Date:</span>
                          <span className="font-bold text-emerald-800">{formatDateDisplay(wo.completedAt)}</span>
                        </div>
                      )}
                    </div>

                    <WorkOrderRecord wo={wo} checklistItems={checklistItems} />

                    {/* Reassign Technician Button */}
                    {!isCompleted ? (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWoForAssign(wo)
                          setSelectedTechnicianId(wo.assignedTechnicianId || firstAssignableId(technicians, isPending))
                          setAssignRemarks('')
                        }}
                        className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-2xs"
                      >
                        <UserCheck className="w-4 h-4 text-slate-500" />
                        <span>Reassign Technician</span>
                      </button>
                    </div>
                    ) : null}
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
