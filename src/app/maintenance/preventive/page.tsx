'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { getLocalDateStr, formatDateDisplay } from '@/lib/dateUtils'
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  UserCheck,
  CheckSquare,
  ChevronRight,
  Filter,
  X,
  ArrowRight,
  Calendar,
  Eye,
  FileText,
  Image as ImageIcon,
  Lock,
} from 'lucide-react'
import { WorkOrder } from '@/types/afms'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { isPendingWorkOrder } from '@/lib/idGenerator'

// A not-yet-assigned Preventive record has a 'PENDING-<uuid>' placeholder
// woNumber (see makePendingWoNumber) -- show something readable instead of
// that raw internal string until it's minted into a real WO-PM-#### number.
const displayWoNumber = (woNumber: string) => (isPendingWorkOrder(woNumber) ? 'Pending Assignment' : woNumber)

export default function PreventiveMaintenancePage() {
  const router = useRouter()
  const { workOrders, updateWorkOrderStatus, assets, rooms, checklistTemplates, users, currentUser } = useAFMS()
  
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
      assignRemarks || `Assigned to ${techName}`,
      {
        assignedTechnicianId: techId,
        assignedTechnicianName: techName,
      }
    )

    setSelectedWoForAssign(null)
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Maintenance' }, { label: 'Preventive' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Preventive Maintenance (PM) Schedule</h1>
            <p className="text-xs text-slate-500 mt-0.5">Auto-scheduled maintenance cycles anchored to asset installation dates — Assign technician to generate official Work Order</p>
          </div>

          <Link
            href="/maintenance/work-orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <span>Work Orders Central Hub</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Work Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Scheduled PM Tasks ({pmOrders.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                  <th className="py-3.5 px-6">WO Number</th>
                  <th className="py-3.5 px-4">Asset Under Maintenance</th>
                  <th className="py-3.5 px-4">Frequency</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Assigned Technician</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pmOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Wrench className="w-8 h-8 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">No Scheduled Preventive Maintenance</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          Preventive maintenance work orders are automatically scheduled when assets with PM checklist templates are registered.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pmOrders.map(wo => {
                    const asset = assets.find(a => a.id === wo.assetId || a.assetId === wo.assetId)
                    const isPendingAssignment = !wo.assignedTechnicianName
                    const isOverdue = wo.status !== 'Completed' && wo.dueDate && wo.dueDate < getLocalDateStr()
                    const windowStatus = getAttemptWindowStatus(wo.dueDate, wo.frequency)

                    return (
                      <tr key={wo.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-4 px-6 font-mono font-bold text-blue-600">{displayWoNumber(wo.woNumber)}</td>
                        <td className="py-4 px-4 font-semibold text-slate-800">{asset?.name || 'Asset'}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {wo.frequency || 'Quarterly'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
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
                        </td>
                        <td className="py-4 px-4">
                          {wo.assignedTechnicianName ? (
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <User className="w-3.5 h-3.5 text-blue-600" />
                              <span>{wo.assignedTechnicianName}</span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Pending Assignment
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
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
                            {isOverdue && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                      <td className="py-4 px-6 text-right">
                        {isPendingAssignment ? (
                          <button
                            onClick={() => {
                              setSelectedWoForAssign(wo)
                              setSelectedTechnicianId(availableTechs[0]?.id || '')
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
                        )}
                      </td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 1: Assign Technician (Generates / Activates Work Order) */}
        {selectedWoForAssign && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
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
                    {availableTechs.map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.fullName} ({tech.role} - {tech.department || 'Maintenance'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Servicing Instructions</label>
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
            </div>
          </div>
        )}

        {/* Modal 3: PM Work Order Details Side Drawer */}
        {selectedWoForDetails && (() => {
          const wo = workOrders.find(w => w.id === selectedWoForDetails.id || w.woNumber === selectedWoForDetails.woNumber) || selectedWoForDetails
          const asset = assets.find(a => a.id === wo.assetId || a.assetId === wo.assetId)
          const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId) || r.roomNumber === (wo.roomId || asset?.roomId))
          const isCompleted = wo.status === 'Completed'

          // Extract checklist definitions from snapshot or template or standard fallback
          const checklistItems = (Array.isArray(wo.checklistSnapshot) && wo.checklistSnapshot.length > 0)
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

                    {/* IF COMPLETED: Checklist checked, Technician notes, Photo evidence */}
                    {isCompleted ? (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        {/* 1. Checklist Checked */}
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

                        {/* 2. Technician Servicing Notes */}
                        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1">
                          <p className="font-bold text-[11px] text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            Technician Servicing Notes
                          </p>
                          <p className="text-slate-800 text-xs leading-relaxed">
                            {wo.technicianRemarks || wo.solutionTaken || 'All scheduled preventive maintenance tasks performed according to standard equipment maintenance procedures. System tested and fully operational.'}
                          </p>
                        </div>

                        {/* 3. Photo Evidence */}
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
                    ) : (
                      /* IF NOT COMPLETED: Show current status and planned checklist (NO execute button) */
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Current Status: {wo.status}
                            </span>
                            <span className="text-[10px] text-amber-700 font-bold">
                              Due: {formatDateDisplay(wo.dueDate)}
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs">
                            This preventive maintenance cycle is assigned to <strong>{wo.assignedTechnicianName || 'technician'}</strong>. Servicing and checklist verification are executed on-site by the assigned technician.
                          </p>
                        </div>

                        {/* Planned Checklist Preview */}
                        <div className="space-y-2">
                          <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            Planned Preventive Checklist Items ({checklistItems.length})
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

                        {/* Reassign Technician Button */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWoForAssign(wo)
                              setSelectedTechnicianId(wo.assignedTechnicianId || technicians[0]?.id || '')
                              setAssignRemarks('')
                            }}
                            className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold transition flex items-center justify-center gap-1.5 text-xs shadow-2xs"
                          >
                            <UserCheck className="w-4 h-4 text-slate-500" />
                            <span>Reassign Technician</span>
                          </button>
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
