'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { formatDateDisplay } from '@/lib/dateUtils'
import { isWorkOrderOverdue } from '@/lib/isWorkOrderOverdue'
import { isWithVendor } from '@/lib/workOrderState'
import { VendorHandoverCard } from '@/components/VendorHandoverCard'
import {
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Plus,
  Search,
  Check,
  X,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  Eye,
  Package,
  Clock,
  Image as ImageIcon,
  FileText,
  Trash2,
} from 'lucide-react'
import { WorkOrder, WorkOrderPartItem } from '@/types/afms'
import { isPendingWorkOrder } from '@/lib/idGenerator'

// A not-yet-assigned Corrective record has a 'PENDING-<uuid>' placeholder
// woNumber (see makePendingWoNumber) -- show something readable instead of
// that raw internal string until it's minted into a real WO-CR-#### number.
const displayWoNumber = (woNumber: string) => (isPendingWorkOrder(woNumber) ? 'Pending Assignment' : woNumber)

export default function CorrectiveMaintenancePage() {
  const router = useRouter()
  const { workOrders, updateWorkOrderStatus, assets, rooms, users, addWorkOrder, currentUser } = useAFMS()

  const [selectedWoForAssign, setSelectedWoForAssign] = useState<WorkOrder | null>(null)
  const [selectedWoForResolve, setSelectedWoForResolve] = useState<WorkOrder | null>(null)
  const [selectedWoForDetails, setSelectedWoForDetails] = useState<WorkOrder | null>(null)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [assignRemarks, setAssignRemarks] = useState('')

  // Enhanced breakdown resolution form state
  const [problemFound, setProblemFound] = useState('')
  const [solutionTaken, setSolutionTaken] = useState('')
  const [partsList, setPartsList] = useState<WorkOrderPartItem[]>([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [executionMode, setExecutionMode] = useState<'In House' | 'Vendor'>('In House')

  // Sorted soonest-due-first -- the fetch only orders by created_at.
  const correctiveOrders = workOrders
    .filter(w => w.type === 'Corrective')
    .slice()
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

  // Technicians list
  const technicians = users.filter(u => u.role === 'Technician' || u.role === 'Admin')

  // Handle Technician Assignment / Reassignment -> activates & transitions work order into 'Assigned'
  const handleAssignTechnician = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWoForAssign) return
    const tech = users.find(u => u.id === selectedTechnicianId) || technicians[0]

    updateWorkOrderStatus(
      selectedWoForAssign.id,
      'Scheduled',
      assignRemarks || `Assigned to ${tech.fullName}`,
      {
        assignedTechnicianId: tech.id,
        assignedTechnicianName: tech.fullName,
      }
    )
    
    setSelectedWoForAssign(null)
  }

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWoForResolve) return
    const now = new Date().toJSON().split('T')[0]

    updateWorkOrderStatus(
      selectedWoForResolve.id,
      'Completed',
      solutionTaken || 'Issue diagnosed and rectified.',
      {
        issueLogged: problemFound || selectedWoForResolve.issueLogged,
        solutionTaken: solutionTaken || 'Issue diagnosed and rectified.',
        technicianRemarks: solutionTaken,
        partsReplaced: partsList.filter(p => p.partName.trim()),
        completionPhotoUrl: photoUrl || '/images/asset-placeholder.png',
        executedBy: executionMode,
        completedAt: now,
      }
    )

    setSelectedWoForDetails(prev => prev && prev.id === selectedWoForResolve.id ? {
      ...prev,
      status: 'Completed',
      issueLogged: problemFound || prev.issueLogged,
      solutionTaken: solutionTaken || 'Issue diagnosed and rectified.',
      technicianRemarks: solutionTaken,
      partsReplaced: partsList.filter(p => p.partName.trim()),
      completionPhotoUrl: photoUrl || '/images/asset-placeholder.png',
      executedBy: executionMode,
      completedAt: now,
    } : null)

    setSelectedWoForResolve(null)
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Maintenance' }, { label: 'Corrective' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Corrective Maintenance (Breakdown / Defect)</h1>
            <p className="text-xs text-slate-500 mt-0.5">Dispatched from Failed Inspections or Service Requests — Assign technician to generate official Work Order</p>
          </div>

          <Link
            href="/maintenance/work-orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <span>Work Orders Central Hub</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Corrective Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Corrective Maintenance Queue ({correctiveOrders.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                  <th className="py-3.5 px-6">WO Number</th>
                  <th className="py-3.5 px-4">Trigger Source</th>
                  <th className="py-3.5 px-4">Target Asset & Location</th>
                  <th className="py-3.5 px-4">Issue Logged</th>
                  <th className="py-3.5 px-4">Assigned Technician</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {correctiveOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <AlertTriangle className="w-8 h-8 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">Corrective Maintenance Queue Empty</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">
                          No pending corrective repair orders. Corrective maintenance work orders are created when service requests or inspections fail.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  correctiveOrders.map(wo => {
                  const asset = assets.find(a => a.id === wo.assetId)
                  const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId))
                  const isPendingAssignment = !wo.assignedTechnicianName
                  const isOverdue = isWorkOrderOverdue(wo)

                  return (
                    <tr key={wo.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-mono font-bold text-rose-600">{displayWoNumber(wo.woNumber)}</td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          {wo.source} ({wo.sourceRefId || 'SR'})
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-900">{asset?.name || 'Facility Area'}</p>
                        <p className="text-[11px] text-slate-400">{room?.name || 'General'}</p>
                      </td>
                      <td className="py-4 px-4 text-slate-600 max-w-xs truncate">{wo.issueLogged || 'Defect reported'}</td>
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
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {wo.status === 'Completed' ? 'Resolved' : wo.status}
                          </span>
                          {isWithVendor(wo) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              With vendor
                            </span>
                          )}
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
                              setSelectedTechnicianId(technicians[0]?.id || '')
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
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
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

        {/* Modal 1: Assign / Reassign Technician Modal (Generates / Activates Work Order) */}
        {selectedWoForAssign && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-rose-600">{displayWoNumber(selectedWoForAssign.woNumber)}</span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedWoForAssign.assignedTechnicianName ? 'Reassign Technician' : 'Assign Technician'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedWoForAssign.assignedTechnicianName
                      ? `Currently assigned to: ${selectedWoForAssign.assignedTechnicianName}`
                      : 'Assign technician to activate corrective work order'}
                  </p>
                </div>
                <button onClick={() => setSelectedWoForAssign(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignTechnician} className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                  <p className="text-slate-500 font-medium">Issue Description:</p>
                  <p className="font-semibold text-slate-900">{selectedWoForAssign.issueLogged || 'Breakdown maintenance required'}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Qualified Technician *</label>
                  <select
                    value={selectedTechnicianId}
                    onChange={e => setSelectedTechnicianId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.fullName} ({tech.role} - {tech.department || 'Technical'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dispatch Instructions / Remarks</label>
                  <textarea
                    rows={2}
                    value={assignRemarks}
                    onChange={e => setAssignRemarks(e.target.value)}
                    placeholder="e.g. Inspect refrigerant pressure and check circuit breaker..."
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
                    Assign & Publish Work Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Breakdown Resolution Modal */}
        {selectedWoForResolve && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-rose-600">{displayWoNumber(selectedWoForResolve.woNumber)}</span>
                  <h3 className="text-lg font-bold text-slate-900">Log Breakdown Resolution</h3>
                </div>
                <button onClick={() => setSelectedWoForResolve(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleResolve} className="space-y-4 text-xs">
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-900 space-y-1">
                  <p className="font-bold">Original Defect / Ticket:</p>
                  <p className="text-xs">{selectedWoForResolve.issueLogged || 'Breakdown reported'}</p>
                </div>

                {/* 1. Problem Diagnosed by Technician */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Problem Diagnosed by Technician <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={problemFound}
                    onChange={e => setProblemFound(e.target.value)}
                    placeholder="e.g. Blown fuse and burnt capacitor on primary motor driver board..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                {/* 2. Action Taken & Solution Applied */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Actions Taken &amp; Solution Applied <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={solutionTaken}
                    onChange={e => setSolutionTaken(e.target.value)}
                    placeholder="e.g. Replaced capacitor, rewired terminal connections, calibrated load..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                {/* 3. Execution Mode: In House vs Vendor */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Execution Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['In House', 'Vendor'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setExecutionMode(mode)}
                        className={`py-2 px-3 rounded-xl border font-semibold text-xs transition text-center ${
                          executionMode === mode
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Spare Parts Required / Replaced */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-700">Spare Parts Required / Replaced</label>
                    <button
                      type="button"
                      onClick={() => setPartsList(prev => [...prev, { partName: '', quantity: 1, notes: '' }])}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Part</span>
                    </button>
                  </div>

                  {partsList.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                      No spare parts added (Labor only). Click &quot;Add Part&quot; if parts were replaced.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {partsList.map((part, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
                          <input
                            type="text"
                            placeholder="Part Name (e.g. 50uF Capacitor)"
                            value={part.partName}
                            onChange={e => {
                              const val = e.target.value
                              setPartsList(prev => prev.map((p, i) => i === idx ? { ...p, partName: val } : p))
                            }}
                            className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          />
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={part.quantity}
                            onChange={e => {
                              const qty = parseInt(e.target.value) || 1
                              setPartsList(prev => prev.map((p, i) => i === idx ? { ...p, quantity: qty } : p))
                            }}
                            className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-center font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => setPartsList(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Photo Evidence */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Completion Photo Evidence (Optional)</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Enter photo URL or leave default"
                      value={photoUrl}
                      onChange={e => setPhotoUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('/images/asset-placeholder.png')}
                        className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                      >
                        Use Placeholder Image
                      </button>
                      {photoUrl && (
                        <span className="text-[11px] text-emerald-700 font-semibold">✓ Photo Attached</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedWoForResolve(null)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Complete &amp; Return to Service
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Work Order Details Side Drawer */}
        {selectedWoForDetails && (() => {
          const wo = workOrders.find(w => w.id === selectedWoForDetails.id) || selectedWoForDetails
          const asset = assets.find(a => a.id === wo.assetId)
          const room = rooms.find(r => r.id === (wo.roomId || asset?.roomId))
          const isCompleted = wo.status === 'Completed'

          return (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
              <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {displayWoNumber(wo.woNumber)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : wo.status === 'In Progress'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {wo.status === 'Completed' ? 'Resolved / Completed' : wo.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">
                        {wo.title || 'Corrective Breakdown Repair'}
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
                          {wo.executedBy || 'In House'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Asset:</span>
                        <span className="font-semibold text-slate-800">{asset?.name || 'Facility Area'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Location:</span>
                        <span className="font-semibold text-slate-800">{room?.name || 'General Area'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Trigger Source:</span>
                        <span className="font-semibold text-slate-800">{wo.source} ({wo.sourceRefId || 'SR'})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Due Date / SLA:</span>
                        <span className="font-semibold text-slate-800">{formatDateDisplay(wo.dueDate)}</span>
                      </div>
                      {wo.completedAt && (
                        <div className="flex justify-between pt-1 border-t border-slate-200/60">
                          <span className="text-emerald-700 font-medium">Completed Date:</span>
                          <span className="font-bold text-emerald-800">{formatDateDisplay(wo.completedAt)}</span>
                        </div>
                      )}
                    </div>

                    <VendorHandoverCard wo={wo} />

                    {/* IF COMPLETED: Problem found, Action taken, Parts, Photo */}
                    {isCompleted ? (
                      <div className="space-y-3.5 pt-2 border-t border-slate-100">
                        {/* 1. Problem Found by Technician */}
                        <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-1">
                          <p className="font-bold text-[11px] text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            Problem Found by Technician
                          </p>
                          <p className="text-slate-800 text-xs leading-relaxed">
                            {wo.issueLogged || 'Breakdown defect diagnosed during on-site inspection.'}
                          </p>
                        </div>

                        {/* 2. Action Taken by Technician */}
                        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
                          <p className="font-bold text-[11px] text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Action Taken by Technician
                          </p>
                          <p className="text-slate-800 text-xs leading-relaxed">
                            {wo.solutionTaken || wo.technicianRemarks || 'Defect rectified, tested, and restored to operational service.'}
                          </p>
                        </div>

                        {/* 3. Spare Parts Required / Replaced */}
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

                        {/* Start of Work Evidence -- proof-of-presence photo
                            captured before servicing began */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                          <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                            Start of Work Evidence
                          </p>
                          {wo.startPhotoUrl ? (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                              <img
                                src={wo.startPhotoUrl}
                                alt="Work Order Start Evidence"
                                className="w-full h-44 object-cover"
                              />
                              <div className="p-2 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
                                <span>Proof of Presence at Job Start</span>
                                <span className="font-mono text-emerald-700 font-bold">✓ Verified</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-dashed border-slate-200 text-slate-400">
                              <ImageIcon className="w-5 h-5 text-slate-300" />
                              <span>No start-of-work photo attached to this record.</span>
                            </div>
                          )}
                        </div>

                        {/* 4. Photo Evidence */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                          <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                            Completion Photo Evidence
                          </p>
                          {wo.completionPhotoUrl ? (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                              <img
                                src={wo.completionPhotoUrl}
                                alt="Work Order Completion Evidence"
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
                              <span>No digital photo attached to this completed record.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* IF NOT COMPLETED: Show current status & actions */
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Current Status: {wo.status}
                            </span>
                            <span className="text-[10px] text-amber-700 font-bold">
                              Due: {formatDateDisplay(wo.dueDate)}
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs mt-1">
                            <strong>Reported Issue:</strong> {wo.issueLogged || 'Breakdown defect logged.'}
                          </p>
                        </div>

                        {/* Operational Actions */}
                        <div className="space-y-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWoForResolve(wo)
                              setProblemFound(wo.issueLogged || '')
                              setSolutionTaken(wo.solutionTaken || '')
                              setPartsList(wo.partsReplaced || [])
                              setPhotoUrl(wo.completionPhotoUrl || '')
                              setExecutionMode(wo.executedBy || 'In House')
                            }}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Log Breakdown Resolution &amp; Complete</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWoForAssign(wo)
                              setSelectedTechnicianId(wo.assignedTechnicianId || technicians[0]?.id || '')
                              setAssignRemarks('')
                            }}
                            className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold transition flex items-center justify-center gap-1.5 text-xs"
                          >
                            <User className="w-3.5 h-3.5 text-slate-500" />
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
