'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  User,
  Calendar,
  ChevronRight,
  TrendingUp,
  X,
  Plus,
  Eye,
  Lock,
} from 'lucide-react'
import { Inspection } from '@/types/afms'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'

export default function InspectionsPage() {
  const router = useRouter()
  const { inspections, updateInspection, completeInspection, assets, checklistTemplates, users } = useAFMS()
  
  const [selectedInspForAssign, setSelectedInspForAssign] = useState<Inspection | null>(null)
  const [selectedInspForPerform, setSelectedInspForPerform] = useState<Inspection | null>(null)
  const [selectedInspForView, setSelectedInspForView] = useState<Inspection | null>(null)
  const [selectedInspectorId, setSelectedInspectorId] = useState('')
  const [assignRemarks, setAssignRemarks] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [remarks, setRemarks] = useState('')

  const passedCount = inspections.filter(i => i.result === 'Pass').length
  const failedCount = inspections.filter(i => i.result === 'Fail').length
  const completedTotal = inspections.filter(i => i.status === 'Completed').length
  const compliancePercentage = completedTotal > 0 ? Math.round((passedCount / completedTotal) * 100) : 100

  // Inspectors list (Staff from any registered role: Admin, Faculty, Technician, Housekeeping)
  const inspectors = users

  // Inspector Assignment -> Persists to Supabase & sets inspector
  const handleAssignInspector = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInspForAssign) return
    const inspector = users.find(u => u.id === selectedInspectorId) || inspectors[0]

    updateInspection(selectedInspForAssign.id, {
      assignedInspectorId: inspector.id,
      assignedInspectorName: inspector.fullName,
      status: 'Scheduled',
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

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Operation' }, { label: 'Inspection' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Statutory &amp; Quality Inspections</h1>
            <p className="text-xs text-slate-500 mt-0.5">Auto-scheduled Pass/Fail compliance checks &amp; inspector assignment</p>
          </div>

          <Link
            href="/maintenance/work-orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <span>Work Orders Central Hub</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Top Compliance Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Overall Compliance Rate</p>
            <h3 className="text-3xl font-extrabold text-blue-600 mt-1">{compliancePercentage}%</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>(Passed Inspections ÷ Total Completed) × 100</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Passed Inspections</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{passedCount}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Zero non-conformances</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">Failed / Corrective Triggered</p>
            <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{failedCount}</h3>
            <p className="text-[11px] text-rose-500 font-semibold mt-1">Auto-created Corrective Work Orders</p>
          </div>
        </div>

        {/* Inspections Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Scheduled &amp; Completed Inspections ({inspections.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                  <th className="py-3.5 px-6">Inspection No</th>
                  <th className="py-3.5 px-4">Asset Under Inspection</th>
                  <th className="py-3.5 px-4">Interval</th>
                  <th className="py-3.5 px-4">Assigned Inspector</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Result</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map(insp => {
                  const asset = assets.find(a => a.id === insp.assetId)
                  const tmpl = checklistTemplates.find(t => t.id === insp.templateId)
                  const isPendingAssignment = !insp.assignedInspectorName
                  const isOverdue = insp.status !== 'Completed' && insp.dueDate && insp.dueDate < new Date().toISOString().split('T')[0]
                  const windowStatus = getAttemptWindowStatus(insp.dueDate, tmpl?.interval)
                  const isLocked = insp.status !== 'Completed' && !windowStatus.canAttempt

                  return (
                    <tr key={insp.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-bold text-slate-800 font-mono">
                        {insp.inspectionNumber}
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-900">{asset?.name || 'Asset'}</p>
                        <p className="text-[11px] text-blue-600 font-mono">{asset?.assetId}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          {tmpl?.interval || 'Quarterly'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {insp.assignedInspectorName ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <span>{insp.assignedInspectorName}</span>
                            {insp.status !== 'Completed' && (
                              <button
                                onClick={() => {
                                  setSelectedInspForAssign(insp)
                                  setSelectedInspectorId(insp.assignedInspectorId || inspectors[0]?.id || '')
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
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{insp.dueDate}</span>
                        </div>
                        {insp.status !== 'Completed' && (
                          <span className={`text-[10px] block mt-0.5 ${isLocked ? 'text-amber-600 font-semibold' : 'text-emerald-600'}`}>
                            {isLocked ? `Opens ${windowStatus.unlockDate}` : `Window Open (${windowStatus.windowDescription})`}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
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
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isPendingAssignment ? (
                          <button
                            onClick={() => {
                              setSelectedInspForAssign(insp)
                              setSelectedInspectorId(inspectors[0]?.id || '')
                              setAssignRemarks('')
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1"
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
                              <span>Opens ${windowStatus.unlockDate}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenInspection(insp)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                            >
                              Perform Inspection
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => setSelectedInspForView(insp)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 1: Assign Inspector (Generates / Activates Work Order) */}
        {selectedInspForAssign && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
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
                  <p className="text-blue-700 text-[11px]">Due Date: {selectedInspForAssign.dueDate}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Qualified Inspector / Staff *</label>
                  <select
                    value={selectedInspectorId}
                    onChange={e => setSelectedInspectorId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    {inspectors.map(insp => (
                      <option key={insp.id} value={insp.id}>
                        {insp.fullName} ({insp.role} • {insp.department || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inspection Instructions / Remarks</label>
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
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    Confirm Inspector Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Perform Inspection */}
        {selectedInspForPerform && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
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
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Submit Inspection & Complete
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: View Completed Inspection Details */}
        {selectedInspForView && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] flex flex-col">
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
                      <span>{selectedInspForView.assignedInspectorName || 'Diana Prince'}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-400 text-[10px] font-semibold uppercase">Completed Date</p>
                    <div className="flex items-center gap-1 mt-0.5 font-bold text-slate-900">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{selectedInspForView.completedAt || selectedInspForView.dueDate}</span>
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/80">
                  <p className="text-blue-900 font-bold uppercase text-[10px] tracking-wider">Inspector Remarks</p>
                  <p className="text-slate-700 mt-1 font-medium">
                    {selectedInspForView.inspectorRemarks || 'Compliant with all parameters. Physical parameters checked.'}
                  </p>
                </div>

                {/* Checklist Verification Results */}
                <div className="space-y-2 pt-2">
                  <p className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Checklist Verification Items & Results
                  </p>

                  <div className="space-y-2">
                    {checklistTemplates
                      .find(t => t.id === selectedInspForView.templateId)
                      ?.items.map((item, idx) => {
                        const val = selectedInspForView.checklistResponses?.[item.id]?.value || 
                                    (typeof selectedInspForView.checklistResponses?.[item.id] === 'string' ? selectedInspForView.checklistResponses?.[item.id] : 'Pass')
                        const isPass = val === 'Pass' || !val || val === true

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
                            </div>

                            <span
                              className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 ${
                                isPass
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isPass ? (
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
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
