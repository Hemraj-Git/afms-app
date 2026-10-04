'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { getLocalDateStr, formatDateDisplay } from '@/lib/dateUtils'
import { answerOf, checkpointsFor } from '@/lib/fieldInspections'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  User,
  Calendar,
  TrendingUp,
  X,
  Plus,
  Eye,
  Lock,
  Search,
} from 'lucide-react'
import { Inspection } from '@/types/afms'
import { ScheduleGapsBanner } from '@/components/maintenance/ScheduleGapsPanel'
import { complianceRate } from '@/lib/compliance'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, sortByOrder, timeOf } from '@/components/ui/DataTable'
import { useSearchPrefill } from '@/lib/useSearchPrefill'

import { Modal } from '@/components/ui/Modal'
import { useAccountStatuses } from '@/lib/queries/accountStatus'
import { firstAssignableId, orderForAssignment, PENDING_SUFFIX } from '@/lib/accountState'
export default function InspectionsPage() {
  const router = useRouter()
  const { inspections, updateInspection, completeInspection, assets, checklistTemplates, users, currentUser } = useAFMS()
  // Invited people who have not signed in yet cannot be given work (see accountState.ts).
  const { isPending } = useAccountStatuses(currentUser.id, currentUser.role === 'Admin')
  
  const [selectedInspForAssign, setSelectedInspForAssign] = useState<Inspection | null>(null)
  const [selectedInspForPerform, setSelectedInspForPerform] = useState<Inspection | null>(null)
  const [selectedInspForView, setSelectedInspForView] = useState<Inspection | null>(null)
  const [selectedInspectorId, setSelectedInspectorId] = useState('')
  const [assignRemarks, setAssignRemarks] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [remarks, setRemarks] = useState('')

  const passedCount = inspections.filter(i => i.result === 'Pass').length
  const failedCount = inspections.filter(i => i.result === 'Fail').length
  const compliancePercentage = complianceRate(inspections)

  // Search box (also filled when opened from the header search).
  const [searchQuery, setSearchQuery] = useState('')
  useSearchPrefill(setSearchQuery)

  // Sorted soonest-due-first -- the fetch only orders by created_at.
  const sortedInspections = inspections
    .filter(insp => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      const asset = assets.find(a => a.id === insp.assetId)
      return [insp.inspectionNumber, asset?.name, asset?.assetId, insp.assignedInspectorName]
        .some(v => v?.toLowerCase().includes(q))
    })
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

  // Inspectors list (Staff from any registered role: Admin, Faculty, Technician, Housekeeping)
  const inspectors = users.filter(u => u.role !== 'Guest')

  // Inspector Assignment -> Persists to Supabase & sets inspector
  const handleAssignInspector = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInspForAssign) return
    const inspector = users.find(u => u.id === selectedInspectorId) || inspectors[0]

    updateInspection(selectedInspForAssign.id, {
      assignedInspectorId: inspector.id,
      assignedInspectorName: inspector.fullName,
      status: 'Scheduled',
      // Shown to the inspector on the phone (it used to be asked for and dropped).
      instructions: assignRemarks.trim() || undefined,
    })

    setSelectedInspForAssign(null)
  }

  const handleOpenInspection = (insp: Inspection) => {
    setSelectedInspForPerform(insp)
    const tmpl = checklistTemplates.find(t => t.id === insp.templateId)
    if (tmpl) {
      const initial: Record<string, string> = {}
      tmpl.items.forEach(item => {
        initial[item.id] = 'Pass'
      })
      setAnswers(initial)
    }
    setRemarks('')
  }

  const handleSubmitInspection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInspForPerform) return

    // Automated Pass/Fail evaluation
    const hasFail = Object.values(answers).some(val => val === 'Fail')
    const finalResult = hasFail ? 'Fail' : 'Pass'

    completeInspection(
      selectedInspForPerform.id,
      finalResult,
      remarks || (finalResult === 'Pass' ? 'Compliant with all parameters' : 'Defect identified during physical check'),
      answers
    )

    setSelectedInspForPerform(null)
  }

  const intervalOf = (insp: Inspection) => checklistTemplates.find(t => t.id === insp.templateId)?.interval

  const inspectionColumns: ColumnDef<Inspection>[] = [
    {
      id: 'inspectionNumber',
      header: 'Inspection No',
      accessorFn: i => i.inspectionNumber,
      meta: { thClassName: 'py-3.5 px-6', tdClassName: 'py-4 px-6 font-bold text-slate-800 font-mono' },
    },
    {
      id: 'asset',
      header: 'Asset Under Inspection',
      accessorFn: i => assets.find(a => a.id === i.assetId)?.name || 'Asset',
      cell: ({ row: { original: insp } }) => {
        const asset = assets.find(a => a.id === insp.assetId)
        return (
          <>
            <p className="font-bold text-slate-900">{asset?.name || 'Asset'}</p>
            <p className="text-[11px] text-blue-600 font-mono">{asset?.assetId}</p>
          </>
        )
      },
    },
    {
      id: 'interval',
      header: 'Interval',
      accessorFn: i => intervalOf(i) || 'Quarterly',
      sortingFn: sortByOrder(['Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annually']),
      cell: ({ getValue }) => (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'inspector',
      header: 'Assigned Inspector',
      // Unassigned rows sort last.
      accessorFn: i => i.assignedInspectorName || undefined,
      sortUndefined: 'last',
      cell: ({ row: { original: insp } }) =>
        insp.assignedInspectorName ? (
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>{insp.assignedInspectorName}</span>
            {insp.status !== 'Completed' && (
              <button
                onClick={() => {
                  setSelectedInspForAssign(insp)
                  setSelectedInspectorId(insp.assignedInspectorId || firstAssignableId(inspectors, isPending))
                  setAssignRemarks('')
                }}
                className="text-[10px] text-blue-600 hover:text-blue-800 ml-1 underline cursor-pointer font-medium"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending Assignment
          </span>
        ),
    },
    {
      id: 'dueDate',
      header: 'Due Date',
      accessorFn: i => timeOf(i.dueDate),
      sortUndefined: 'last',
      meta: { tdClassName: 'py-4 px-4 text-slate-500 font-medium' },
      cell: ({ row: { original: insp } }) => {
        const windowStatus = getAttemptWindowStatus(insp.dueDate, intervalOf(insp))
        const isLocked = insp.status !== 'Completed' && !windowStatus.canAttempt
        return (
          <>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatDateDisplay(insp.dueDate)}</span>
            </div>
            {insp.status !== 'Completed' && (
              <span className={`text-[10px] block mt-0.5 ${isLocked ? 'text-amber-600 font-semibold' : 'text-emerald-600'}`}>
                {isLocked ? `Opens ${windowStatus.unlockDate}` : `Window Open (${windowStatus.windowDescription})`}
              </span>
            )}
          </>
        )
      },
    },
    {
      id: 'result',
      header: 'Result',
      // Open inspections first, then failures, then passes.
      accessorFn: i => (i.status === 'Completed' ? i.result ?? 'Pass' : i.status),
      sortingFn: sortByOrder(['Scheduled', 'In Progress', 'Fail', 'Pass', 'Not Applicable']),
      cell: ({ row: { original: insp } }) => {
        const isOverdue = insp.status !== 'Completed' && insp.dueDate && insp.dueDate < getLocalDateStr()
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {insp.status === 'Completed' ? (
              insp.result === 'Pass' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  PASS
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  FAIL (Corrective Created)
                </span>
              )
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                {insp.status}
              </span>
            )}
            {isOverdue && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                Overdue
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      meta: { thClassName: 'py-3.5 px-6 text-right', tdClassName: 'py-4 px-6 text-right' },
      cell: ({ row: { original: insp } }) => {
        const windowStatus = getAttemptWindowStatus(insp.dueDate, intervalOf(insp))
        const isLocked = insp.status !== 'Completed' && !windowStatus.canAttempt
        return !insp.assignedInspectorName ? (
          <button
            onClick={() => {
              setSelectedInspForAssign(insp)
              setSelectedInspectorId(firstAssignableId(inspectors, isPending))
              setAssignRemarks('')
            }}
            className="btn btn-primary btn-sm"
          >
            <User className="w-3.5 h-3.5" />
            <span>Assign Inspector</span>
          </button>
        ) : insp.status !== 'Completed' ? (
          isLocked ? (
            <span
              className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 cursor-not-allowed"
              title={`Inspection execution window opens on ${windowStatus.unlockDate} (${windowStatus.windowDescription})`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Opens {windowStatus.unlockDate}</span>
            </span>
          ) : (
            <button
              onClick={() => handleOpenInspection(insp)}
              className="btn btn-primary btn-sm"
            >
              Perform Inspection
            </button>
          )
        ) : (
          <button
            onClick={() => setSelectedInspForView(insp)}
            className="btn btn-secondary btn-sm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Details</span>
          </button>
        )
      },
    },
  ]

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Operation' }, { label: 'Inspection' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Statutory &amp; Quality Inspections</h1>
            <p className="text-xs text-slate-500 mt-0.5">Each asset&apos;s inspection schedules: Pass/Fail checks &amp; inspector assignment</p>
          </div>
        </div>

        <ScheduleGapsBanner kind="inspection" />

        {/* Top Compliance Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Overall Compliance Rate</p>
            <h3 className={`text-3xl font-extrabold mt-1 ${compliancePercentage === null ? 'text-slate-300' : 'text-blue-600'}`}>
              {compliancePercentage === null ? '—' : `${compliancePercentage}%`}
            </h3>
            {compliancePercentage === null ? (
              <p className="text-[11px] text-slate-400 font-semibold mt-1">No completed inspections yet</p>
            ) : (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>(Passed Inspections ÷ Total Completed) × 100</span>
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Passed Inspections</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{passedCount}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Completed with every checkpoint passed</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Failed / Corrective Triggered</p>
            <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{failedCount}</h3>
            <p className="text-[11px] text-rose-500 font-semibold mt-1">Auto-created Corrective Work Orders</p>
          </div>
        </div>

        {/* Inspections Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">
              Scheduled &amp; Completed Inspections ({searchQuery.trim() ? `${sortedInspections.length} of ${inspections.length}` : inspections.length})
            </h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="INSP no, asset, inspector..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <DataTable
            tableId="inspections"
            data={sortedInspections}
            columns={inspectionColumns}
            resetKey={searchQuery}
            getRowId={i => i.id}
            emptyState={
              <div className="flex flex-col items-center justify-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">
                  {searchQuery.trim() ? 'No inspections match this search' : 'No inspections yet'}
                </p>
              </div>
            }
          />
        </div>

        {/* Modal 1: Assign Inspector (Generates / Activates Work Order) */}
        {selectedInspForAssign && (
            <Modal title="Assign Inspector" onClose={() => setSelectedInspForAssign(null)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-blue-600">{selectedInspForAssign.inspectionNumber}</span>
                  <h3 className="text-base font-bold text-slate-900">Assign Inspector</h3>
                </div>
                <button onClick={() => setSelectedInspForAssign(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignInspector} className="space-y-4 text-xs">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
                  <p className="text-blue-900 font-bold">
                    Target: {assets.find(a => a.id === selectedInspForAssign.assetId)?.name || 'Asset'}
                  </p>
                  <p className="text-blue-700 text-[11px]">Due Date: {formatDateDisplay(selectedInspForAssign.dueDate)}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Qualified Inspector / Staff *</label>
                  <select
                    value={selectedInspectorId}
                    onChange={e => setSelectedInspectorId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    {orderForAssignment(inspectors, isPending).map(insp => (
                      <option key={insp.id} value={insp.id} disabled={isPending(insp.id)}>
                        {insp.fullName} ({insp.role} • {insp.department || 'Staff'}){isPending(insp.id) ? PENDING_SUFFIX : ''}
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
                    placeholder="e.g. Verify safety certificates, electrical grounding, and emergency stop..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedInspForAssign(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Confirm Inspector Assignment
                  </button>
                </div>
              </form>
            </Modal>
        )}

        {/* Modal 2: Perform Inspection */}
        {selectedInspForPerform && (
            <Modal title="Conduct Inspection" onClose={() => setSelectedInspForPerform(null)} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-blue-600">{selectedInspForPerform.inspectionNumber}</span>
                  <h3 className="text-lg font-bold text-slate-900">Conduct Inspection</h3>
                </div>
                <button onClick={() => setSelectedInspForPerform(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleSubmitInspection} className="space-y-4 text-xs">
                {/* Checklist Pass/Fail Items */}
                <div className="space-y-3">
                  <label className="block font-bold text-slate-900 text-sm">Pass / Fail Verification Items</label>
                  {checklistTemplates.find(t => t.id === selectedInspForPerform.templateId)?.items.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="font-semibold text-slate-800">
                        {idx + 1}. {item.itemText} {item.mandatory && <span className="text-rose-500">*</span>}
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAnswers({ ...answers, [item.id]: 'Pass' })}
                          className={`flex-1 py-1.5 rounded-lg font-bold border transition ${
                            answers[item.id] === 'Pass'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswers({ ...answers, [item.id]: 'Fail' })}
                          className={`flex-1 py-1.5 rounded-lg font-bold border transition ${
                            answers[item.id] === 'Fail'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          Fail
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inspector Remarks</label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Provide non-conformance notes or certification compliance details..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedInspForPerform(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Submit Inspection & Complete
                  </button>
                </div>
              </form>
            </Modal>
        )}

        {/* Modal 3: View Completed Inspection Details */}
        {selectedInspForView && (
            <Modal title="Inspection report" onClose={() => setSelectedInspForView(null)} className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-600">{selectedInspForView.inspectionNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedInspForView.result === 'Pass'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {selectedInspForView.result === 'Pass' ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {checklistTemplates.find(t => t.id === selectedInspForView.templateId)?.title || 'Inspection Details'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInspForView(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-slate-400 text-[10px] font-semibold uppercase">Target Asset</p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {assets.find(a => a.id === selectedInspForView.assetId)?.name || 'Asset'}
                    </p>
                    <p className="font-mono text-[10px] text-blue-600">
                      {assets.find(a => a.id === selectedInspForView.assetId)?.assetId}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-400 text-[10px] font-semibold uppercase">Inspected By</p>
                    <div className="flex items-center gap-1 mt-0.5 font-bold text-slate-900">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>{selectedInspForView.assignedInspectorName || '—'}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-400 text-[10px] font-semibold uppercase">Completed Date</p>
                    <div className="flex items-center gap-1 mt-0.5 font-bold text-slate-900">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDateDisplay(selectedInspForView.completedAt || selectedInspForView.dueDate)}</span>
                    </div>
                  </div>
                </div>

                {/* What the office asked for */}
                {selectedInspForView.instructions ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Instructions to the inspector</p>
                    <p className="text-slate-700 mt-1 whitespace-pre-wrap">{selectedInspForView.instructions}</p>
                  </div>
                ) : null}

                {/* Remarks -- as written; nothing is filled in */}
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/80">
                  <p className="text-blue-900 font-bold uppercase text-[10px] tracking-wider">Inspector Remarks</p>
                  <p className="text-slate-700 mt-1 font-medium whitespace-pre-wrap">
                    {selectedInspForView.inspectorRemarks || <span className="italic font-normal text-slate-400">Not recorded</span>}
                  </p>
                </div>

                {/* Proof the inspector was there: at the start and at the end */}
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ['At the start', selectedInspForView.startPhotoUrl],
                    ['At the end', selectedInspForView.photoUrl],
                  ] as const).map(([label, url]) => (
                    <div key={label} className="space-y-1">
                      <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">{label}</p>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-slate-200 bg-white">
                          <img src={url} alt={`Inspection photo ${label.toLowerCase()}`} className="w-full h-32 object-cover" />
                        </a>
                      ) : (
                        <div className="h-32 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-400">Not taken</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Checklist Verification Results */}
                <div className="space-y-2 pt-2">
                  <p className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Checklist Verification Items & Results
                  </p>

                  <div className="space-y-2">
                    {checkpointsFor(selectedInspForView, checklistTemplates).map((item, idx) => {
                        // As answered: PASS, FAIL (with what was wrong), or not answered.
                        const { result, note } = answerOf(selectedInspForView.checklistResponses?.[item.id])
                        const isPass = result === 'Pass'

                        const itemPhoto = selectedInspForView.itemPhotos?.[item.id]

                        return (
                          <div
                            key={item.id}
                            className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-800">
                                {idx + 1}. {item.itemText}
                              </p>
                              {item.mandatory && (
                                <span className="text-[10px] text-slate-400 font-medium">Mandatory Verification</span>
                              )}
                              {note ? <p className="text-[11px] font-medium text-rose-700">What is wrong: {note}</p> : null}
                            </div>

                            {itemPhoto && (
                              <a href={itemPhoto} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <img src={itemPhoto} alt={`Photo for ${item.itemText}`} className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
                              </a>
                            )}

                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 ${
                                result === null
                                  ? 'bg-slate-50 text-slate-500 border border-slate-200'
                                  : isPass
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {result === null ? (
                                <span>Not answered</span>
                              ) : isPass ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>PASS</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>FAIL</span>
                                </>
                              )}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedInspForView(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </Modal>
        )}
      </div>
    </AppLayout>
  )
}
