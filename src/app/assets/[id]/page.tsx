'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  Boxes,
  Wrench,
  ShieldCheck,
  FileText,
  Clock,
  Pencil,
  Download,
  Printer,
  ChevronRight,
  User,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Tag,
  ArrowLeft,
  DollarSign,
  Layers,
  Building,
  Check,
  Activity,
  FileDown,
  Plus,
} from 'lucide-react'
import { Asset } from '@/types/afms'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { getAssetQrUrl } from '@/lib/qrUrls'

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const assetIdParam = (params?.id as string) || 'AST-0001'

  const {
    assets,
    categories,
    subCategories,
    workOrders,
    inspections,
    documents,
    assetActivityLogs,
    vendors,
  } = useAFMS()

  const [activeTab, setActiveTab] = useState<'basic' | 'maintenance' | 'inspection' | 'documents' | 'activity'>('basic')

  // Needed to build the real, scannable QR URL (matches the QR Codes
  // dashboard) -- window.location.origin isn't available during SSR.
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Find target asset safely
  const asset = assets.find(a => a.id === assetIdParam || a.assetId === assetIdParam)
  const subCategory = asset ? subCategories.find(s => s.id === asset.subCategoryId) : undefined
  const category = subCategory ? categories.find(c => c.id === subCategory.categoryId) : undefined
  const purchaseVendor = asset ? vendors.find(v => v.id === asset.purchaseVendorId) : undefined
  const maintVendor = asset ? vendors.find(v => v.id === asset.maintenanceVendorId) : undefined

  // Associated Work Orders (Maintenance History)
  const assetWorkOrders = asset
    ? workOrders.filter(w => w.assetId === asset.id || w.assetId === asset.assetId)
    : []

  // Associated Inspections (Inspection Log)
  const assetInspections = asset
    ? inspections.filter(i => i.assetId === asset.id || i.assetId === asset.assetId)
    : []

  // Associated Activity Timeline
  const assetTimeline = asset
    ? assetActivityLogs.filter(l => l.assetId === asset.id || l.assetId === asset.assetId)
    : []

  // Calculate Next Scheduled Maintenance Date & Days Remaining
  const nextScheduledWo = assetWorkOrders
    .filter(w => w.type === 'Preventive' && (w.status === 'Scheduled' || w.status === 'In Progress'))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  const nextMaintenanceDate = nextScheduledWo ? nextScheduledWo.dueDate : 'Not Scheduled'

  const calculateDaysRemaining = (dueDateStr?: string) => {
    if (!dueDateStr || dueDateStr === 'Not Scheduled') {
      return { label: 'No Schedule', variant: 'neutral' }
    }
    const due = new Date(dueDateStr)
    const today = new Date()
    // Reset time components for accurate date difference calculation
    due.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)

    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 1) {
      return { label: `In ${diffDays} Days`, variant: diffDays <= 7 ? 'warning' : 'info' }
    } else if (diffDays === 1) {
      return { label: 'In 1 Day', variant: 'warning' }
    } else if (diffDays === 0) {
      return { label: 'Due Today', variant: 'warning' }
    } else {
      const overdueDays = Math.abs(diffDays)
      return { label: `${overdueDays} Day${overdueDays === 1 ? '' : 's'} Overdue`, variant: 'danger' }
    }
  }

  const nextMaintenancePill = calculateDaysRemaining(nextScheduledWo?.dueDate)
  
  // Completed Inspections (sorted newest completed date first)
  const completedInspections = assetInspections
    .filter(i => i.status === 'Completed' || Boolean(i.completedAt))
    .sort((a, b) => new Date(b.completedAt || b.dueDate).getTime() - new Date(a.completedAt || a.dueDate).getTime())
  const lastCompletedInspection = completedInspections[0]

  // Upcoming / Scheduled Inspections (sorted earliest due first)
  const upcomingInspections = assetInspections
    .filter(i => i.status === 'Scheduled' || i.status === 'In Progress')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  const nextScheduledInspection = upcomingInspections[0]

  // Calculate Asset Age
  const calculateAge = (installDateStr?: string) => {
    if (!installDateStr) return 'N/A'
    const installDate = new Date(installDateStr)
    const now = new Date()
    let months = (now.getFullYear() - installDate.getFullYear()) * 12 + (now.getMonth() - installDate.getMonth())
    if (months < 0) months = 0
    const years = Math.floor(months / 12)
    const remMonths = months % 12
    if (years === 0) return `${remMonths} Month${remMonths === 1 ? '' : 's'}`
    return `${years} Year${years === 1 ? '' : 's'} ${remMonths} Month${remMonths === 1 ? '' : 's'}`
  }

  const assetAge = asset ? calculateAge(asset.installationDate) : 'N/A'

  // Dynamic Documents linked to this asset in the AFMS Document Library
  const linkedDocuments = asset
    ? documents.filter(
        d => d.linkedAssetIds?.includes(asset.id) || d.linkedAssetIds?.includes(asset.assetId)
      )
    : []

  if (!asset) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Assets', href: '/assets' }, { label: 'Asset Not Found' }]}>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Boxes className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Asset Not Found</h2>
          <p className="text-xs text-slate-500">The requested asset could not be loaded or does not exist.</p>
          <Link
            href="/assets"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <span>Return to Asset Register</span>
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Assets', href: '/assets' }, { label: `${asset.assetId} - ${asset.name}` }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header with Asset ID, Name, Datetime, and Edit Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/assets" className="text-slate-400 hover:text-slate-600 transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {asset.assetId} - {asset.name}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 pl-7">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/assets/create?edit=${asset.assetId}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* Top Metric KPI Cards (Next Scheduled Maintenance, Last Inspection, Asset Age) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Next Scheduled Maintenance */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <p className="text-xs font-medium text-slate-500">Next Scheduled Maintenance</p>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{nextMaintenanceDate}</h3>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  nextMaintenancePill.variant === 'warning'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : nextMaintenancePill.variant === 'danger'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : nextMaintenancePill.variant === 'info'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {nextMaintenancePill.label}
              </span>
            </div>
          </div>

          {/* Card 2: Last Inspection */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Last Inspection</p>
              {!lastCompletedInspection && nextScheduledInspection && (
                <span className="text-[10px] text-slate-400 font-medium">
                  First Due: {nextScheduledInspection.dueDate}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {lastCompletedInspection
                  ? lastCompletedInspection.completedAt || lastCompletedInspection.dueDate
                  : 'Not Yet Inspected'}
              </h3>
              {lastCompletedInspection ? (
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    lastCompletedInspection.result === 'Pass'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : lastCompletedInspection.result === 'Fail'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {lastCompletedInspection.result || lastCompletedInspection.status}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Pending First Inspection
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Asset Age */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <p className="text-xs font-medium text-slate-500">Asset Age</p>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{assetAge}</h3>
            </div>
          </div>
        </div>

        {/* Main Content Layout: Left Tabs & Tables (8 cols) + Right Sidebars (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Tab Panels with Scrollable Content */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col overflow-hidden max-h-[750px]">
            {/* Tabs Navigation Header (Sticky inside panel) */}
            <div className="p-6 pb-0 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-6 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`text-xs font-bold pb-3 relative transition whitespace-nowrap ${
                    activeTab === 'basic' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Basic Information
                  {activeTab === 'basic' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                  )}
                </button>

              <button
                onClick={() => setActiveTab('maintenance')}
                className={`text-xs font-bold pb-3 relative transition whitespace-nowrap ${
                  activeTab === 'maintenance' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Maintenance History
                {activeTab === 'maintenance' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('inspection')}
                className={`text-xs font-bold pb-3 relative transition whitespace-nowrap ${
                  activeTab === 'inspection' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Inspection Log
                {activeTab === 'inspection' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('documents')}
                className={`text-xs font-bold pb-3 relative transition whitespace-nowrap ${
                  activeTab === 'documents' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Documents
                {activeTab === 'documents' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('activity')}
                className={`text-xs font-bold pb-3 relative transition whitespace-nowrap ${
                  activeTab === 'activity' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Activity Timeline
                {activeTab === 'activity' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
                )}
              </button>
            </div>
          </div>

          {/* Scrollable Tab Panels Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-thin">
            {/* TAB 1: BASIC INFORMATION */}
            {activeTab === 'basic' && (
              <div className="space-y-6 animate-in fade-in">
                {/* Asset Details Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Asset Details</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-y-4 gap-x-8 text-xs">
                    <div>
                      <p className="text-slate-400 font-medium">Asset Id</p>
                      <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">{asset.assetId}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Asset Name</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{asset.name}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Category</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{category?.name || 'Electrical'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Subcategory</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{subCategory?.name || 'AC'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Assigned Custodian / User</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                        {asset.assignedToUserName || asset.assignedToUserId ? (
                          <span className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-semibold">
                            {asset.assignedToUserName || asset.assignedToUserId}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">Unassigned (Facility Shared)</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Manufacturer</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{asset.manufacturer || 'Mitsubishi'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Serial Number</p>
                      <p className="text-sm font-mono font-semibold text-slate-800 mt-0.5">{asset.serialNumber || 'RN2135677'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Model Number</p>
                      <p className="text-sm font-mono font-semibold text-slate-800 mt-0.5">{asset.modelNumber || 'DXC18YAMDA-W'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Asset Price</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {asset.price ? `₹${asset.price.toLocaleString('en-IN')}` : '50,000'}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Purchase Date</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{asset.purchaseDate || '28/10/2026'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Installation Date</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{asset.installationDate || '28/10/2026'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Warranty Till</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{asset.warrantyTill || '28/10/2027'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Maintenance By</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{asset.maintenanceBy || 'In House'}</p>
                    </div>
                  </div>
                </div>

                {/* Dynamic Specifications Section */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Specification</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-y-4 gap-x-8 text-xs">
                    {asset.dynamicSpecifications && Object.keys(asset.dynamicSpecifications).length > 0 ? (
                      Object.entries(asset.dynamicSpecifications).map(([key, value]) => {
                        // Lookup configured field definition from SubCategory metadata schema
                        const fieldDef = subCategory?.metadataFields?.find(f => f.key === key)
                        const labelText = fieldDef?.label || key.replace(/^(field_)+/i, '').replace(/_/g, ' ')
                        const unitText = fieldDef?.unit ? ` (${fieldDef.unit})` : ''

                        return (
                          <div key={key}>
                            <p className="text-slate-400 font-medium capitalize">
                              {labelText}
                              {unitText}
                            </p>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">
                              {String(value)}
                              {fieldDef?.unit && !String(value).endsWith(fieldDef.unit) ? ` ${fieldDef.unit}` : ''}
                            </p>
                          </div>
                        )
                      })
                    ) : subCategory?.metadataFields && subCategory.metadataFields.length > 0 ? (
                      subCategory.metadataFields.map(f => (
                        <div key={f.key}>
                          <p className="text-slate-400 font-medium capitalize">
                            {f.label} {f.unit ? `(${f.unit})` : ''}
                          </p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">—</p>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-slate-400 italic text-xs">
                        No custom technical specifications specified for this asset.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MAINTENANCE HISTORY */}
            {activeTab === 'maintenance' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Maintenance History</h3>
                    <p className="text-xs text-slate-500">Scheduled preventive services and corrective breakdown repairs for this equipment</p>
                  </div>
                  <Link
                    href={`/reports?report=pm_maintenance&assetId=${asset.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200/80 transition shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open in Reports Hub</span>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 font-medium">
                        <th className="pb-3 pr-4">WO ID</th>
                        <th className="pb-3 px-3">Description</th>
                        <th className="pb-3 px-3">Type</th>
                        <th className="pb-3 px-3">Assigned to</th>
                        <th className="pb-3 px-3">Reported / Planned On</th>
                        <th className="pb-3 px-3">Resolve On</th>
                        <th className="pb-3 pl-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assetWorkOrders.length > 0 ? (
                        assetWorkOrders.map((wo, idx) => (
                          <tr key={wo.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 pr-4 font-mono font-bold text-slate-800">{isPendingWorkOrder(wo.woNumber) ? 'Pending Assignment' : (wo.woNumber || wo.id)}</td>
                            <td className="py-3 px-3 text-slate-700 font-medium">{wo.title || 'Preventive Maintenance'}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${wo.type === 'Preventive' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                {wo.type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium">{wo.assignedTechnicianName || 'Unassigned'}</td>
                            <td className="py-3 px-3 text-slate-500">{wo.dueDate || 'NA'}</td>
                            <td className="py-3 px-3 text-slate-500">{wo.completedAt || 'NA'}</td>
                            <td className="py-3 pl-3 text-right">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${wo.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                {wo.status === 'Completed' ? 'Completed' : 'Upcoming'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400">
                            <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                            <p className="text-xs font-semibold text-slate-600">No maintenance history recorded for this asset yet.</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Scheduled preventive maintenance and corrective work orders will appear here.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: INSPECTION LOG */}
            {activeTab === 'inspection' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Inspection Log</h3>
                    <p className="text-xs text-slate-500">Quality, statutory safety, and periodic checklists recorded for this equipment</p>
                  </div>
                  <Link
                    href={`/reports?report=inspections&assetId=${asset.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200/80 transition shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open in Reports Hub</span>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 font-medium">
                        <th className="pb-3 pr-4">INS ID</th>
                        <th className="pb-3 px-3">Description</th>
                        <th className="pb-3 px-3">Inspected By</th>
                        <th className="pb-3 px-3">Planned On</th>
                        <th className="pb-3 px-3">Resolve On</th>
                        <th className="pb-3 px-3">Result</th>
                        <th className="pb-3 pl-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assetInspections.length > 0 ? (
                        assetInspections.map((ins, idx) => (
                          <tr key={ins.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 pr-4 font-mono font-bold text-slate-800">{ins.inspectionNumber || ins.id}</td>
                            <td className="py-3 px-3 text-slate-700 font-medium">Periodic Safety Inspection</td>
                            <td className="py-3 px-3 text-slate-700 font-medium">{ins.assignedInspectorName || 'Unassigned'}</td>
                            <td className="py-3 px-3 text-slate-500">{ins.dueDate}</td>
                            <td className="py-3 px-3 text-slate-500">{ins.completedAt || 'NA'}</td>
                            <td className="py-3 px-3">
                              {ins.result ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ins.result === 'Pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {ins.result}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">NA</span>
                              )}
                            </td>
                            <td className="py-3 pl-3 text-right">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${ins.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                {ins.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400">
                            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                            <p className="text-xs font-semibold text-slate-600">No inspection records found for this asset yet.</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Scheduled checklist inspections and condition evaluations will appear here.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Linked Documents &amp; Invoices</h3>
                    <p className="text-xs text-slate-500">Official compliance certificates, user manuals, and warranty contracts linked to this asset</p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    {linkedDocuments.length} Linked File(s)
                  </span>
                </div>

                {linkedDocuments.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <FileText className="w-8 h-8 text-slate-300 stroke-1" />
                    <p className="text-xs font-semibold text-slate-600">No documents linked to this asset yet</p>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      Upload and attach invoices, user guides, or warranty documents from the Document Library to link them to this asset.
                    </p>
                    <Link
                      href="/utility/documents"
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Open Document Library</span>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {linkedDocuments.map(doc => (
                      <div
                        key={doc.id}
                        className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col items-center justify-between text-center space-y-4 hover:border-blue-300 hover:bg-white transition group shadow-2xs"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-rose-500 font-bold group-hover:scale-105 transition">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-xs text-slate-900 line-clamp-1">{doc.title}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {doc.fileType} • {doc.fileSizeKb} KB
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Uploaded {doc.uploadedAt}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            // Generate mock downloadable file blob
                            const element = document.createElement('a')
                            const fileContent = `AFMS Official Compliance Document\nDocument ID: ${doc.id}\nTitle: ${doc.title}\nType: ${doc.fileType}\nAsset: ${asset.assetId} - ${asset.name}\nUploaded By: ${doc.uploadedBy}\nDate: ${doc.uploadedAt}`
                            const file = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
                            element.href = URL.createObjectURL(file)
                            element.download = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.txt`
                            document.body.appendChild(element)
                            element.click()
                            document.body.removeChild(element)
                          }}
                          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download File</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: ACTIVITY TIMELINE (Event History Timeline UI Format) */}
            {activeTab === 'activity' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Activity &amp; History Timeline</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Tamper-evident lifecycle event trail and change history</p>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                    Immutable Activity Log
                  </span>
                </div>

                {assetTimeline.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-2xl my-4">
                    <p className="text-xs font-semibold text-slate-500">No activity recorded yet for this asset</p>
                    <p className="text-[11px] text-slate-400 mt-1">Lifecycle events (installation, maintenance, inspections) will appear here as they occur.</p>
                  </div>
                ) : (
                  <div className="space-y-6 pl-4 sm:pl-6 border-l-2 border-blue-200 my-4">
                    {assetTimeline.map((item, idx) => (
                      <div key={item.id || idx} className="relative pl-6 group">
                        <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 group-hover:scale-110 transition"></div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1.5 hover:border-blue-300 transition shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900">{item.action}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-medium">
                              Ref: #{item.referenceId || `EVT-${idx + 101}`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {item.remarks || item.newValue || 'Lifecycle event recorded on asset.'}
                          </p>
                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">By {item.byUser || 'Authorized Staff'}</span>
                            <span>{item.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Asset Image Card & High-Resolution QR Card (Fixed / Sticky) */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          {/* Card 1: Asset Image */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900">Asset Image</h3>
              <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 h-52 flex items-center justify-center">
                <img
                  src={asset.imageUrl || '/images/asset-placeholder.png'}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Card 2: QR Code Label Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-900">QR Code</h3>

              <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col items-center justify-center space-y-3">
                <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getAssetQrUrl(origin, asset.id))}`}
                    alt={`QR Code for ${asset.assetId}`}
                    className="w-40 h-40 object-contain"
                  />
                </div>
                <p className="font-bold text-xs text-slate-900 tracking-tight font-mono">{asset.assetId} - {asset.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getAssetQrUrl(origin, asset.id))}`}
                  target="_blank"
                  rel="noreferrer"
                  download={`QR-${asset.assetId}.png`}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR</span>
                </a>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Label</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
