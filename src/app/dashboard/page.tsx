'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  Boxes,
  MessageSquare,
  CalendarClock,
  ShieldAlert,
  Calendar,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ChevronRight,
  Inbox,
  ShieldCheck,
  Bell,
  X,
} from 'lucide-react'

export default function DashboardPage() {
  const { assets, serviceRequests, workOrders, inspections, rooms, currentUser } = useAFMS()
  const [showNotificationBanner, setShowNotificationBanner] = useState(true)
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([])

  // Filter new service requests with status 'Open'
  const newServiceRequests = serviceRequests.filter(s => s.status === 'Open')
  const activeAdminNotifications = newServiceRequests.filter(s => !dismissedAlertIds.includes(s.id))

  // Calculate live dynamic KPI metrics directly from state
  const totalAssets = assets.length
  const operationalCount = assets.filter(a => a.status === 'Operational').length
  const underMaintenanceCount = assets.filter(a => a.status === 'Under Maintenance').length
  const retiredCount = assets.filter(a => a.status === 'Retired').length

  const openSRs = serviceRequests.filter(s => s.status === 'Open' || s.status === 'In Progress')
  const openSRCount = openSRs.length
  const pendingSRCount = serviceRequests.filter(s => s.status === 'Open').length
  const overdueSRCount = serviceRequests.filter(
    s => (s.status === 'Open' || s.status === 'In Progress') && s.slaDueDate && new Date(s.slaDueDate).getTime() < Date.now()
  ).length

  const upcomingPMs = workOrders.filter(w => w.type === 'Preventive' && w.status !== 'Completed')
  const pmDueCount = upcomingPMs.length

  const pendingInspections = inspections.filter(i => i.status !== 'Completed')
  const inspectionPendingCount = pendingInspections.length

  const reservedRooms = rooms.filter(r => r.status === 'Occupied')
  const roomReservedCount = reservedRooms.length

  // Quality Compliance Rate calculation
  const completedInspections = inspections.filter(i => i.status === 'Completed')
  const passedInspections = completedInspections.filter(i => i.result === 'Pass')
  const complianceRate = completedInspections.length > 0 
    ? Math.round((passedInspections.length / completedInspections.length) * 100) 
    : 100

  // Asset distribution percentages
  const operationalPct = totalAssets > 0 ? Math.round((operationalCount / totalAssets) * 100) : 100
  const underMaintPct = totalAssets > 0 ? Math.round((underMaintenanceCount / totalAssets) * 100) : 0
  const retiredPct = totalAssets > 0 ? Math.round((retiredCount / totalAssets) * 100) : 0

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Dashboard' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Facility Intelligence Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">Real-time asset telemetry, quality inspections & service dispatch</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Notification Option Button */}
            <button
              onClick={() => setShowNotificationBanner(!showNotificationBanner)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                activeAdminNotifications.length > 0
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Toggle Admin Service Request Notifications"
            >
              <Bell className={`w-4 h-4 ${activeAdminNotifications.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>Admin Notifications</span>
              {activeAdminNotifications.length > 0 ? (
                <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                  {activeAdminNotifications.length} New
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="All caught up"></span>
              )}
            </button>

            <Link
              href="/assets/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </Link>
            <Link
              href="/service-requests"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              <span>Create Service Request</span>
            </Link>
          </div>
        </div>

        {/* Admin Notification Alert Banner for New Service Requests */}
        {showNotificationBanner && activeAdminNotifications.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 border border-amber-200/90 rounded-2xl p-5 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-amber-950">
                      Admin Alert: {activeAdminNotifications.length} New Service Request{activeAdminNotifications.length > 1 ? 's' : ''} Received
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-200 text-amber-900 rounded-full border border-amber-300 uppercase tracking-wide">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    Incoming requests require review to assign a technician or dispatch a work order.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Link
                  href="/service-requests"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <span>Review All Requests</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => setDismissedAlertIds(newServiceRequests.map(s => s.id))}
                  className="px-2.5 py-1.5 text-amber-800 hover:text-amber-950 hover:bg-amber-200/60 rounded-xl text-xs font-medium transition"
                  title="Acknowledge all alerts"
                >
                  Dismiss All
                </button>
                <button
                  onClick={() => setShowNotificationBanner(false)}
                  className="p-1.5 text-amber-600 hover:text-amber-900 hover:bg-amber-200/50 rounded-xl transition"
                  title="Hide banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Service Request Cards Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeAdminNotifications.slice(0, 3).map(sr => (
                <div
                  key={sr.id}
                  className="bg-white/95 rounded-xl p-3.5 border border-amber-200/80 shadow-2xs hover:border-amber-400 transition flex flex-col justify-between space-y-2.5 group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                        {sr.ticketId}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          sr.priority === 'Critical'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : sr.priority === 'High'
                            ? 'bg-orange-100 text-orange-700 border border-orange-200'
                            : sr.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {sr.priority}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-amber-700 transition">
                      {sr.title}
                    </h3>

                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {sr.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="space-y-0.5">
                      <p className="font-medium text-slate-700 truncate max-w-[140px]">
                        {sr.requestedBy} ({sr.requestedByRole})
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Room: {sr.roomId} • {new Date(sr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <Link
                      href="/service-requests"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                    >
                      <span>Assign</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {activeAdminNotifications.length > 3 && (
              <div className="text-center pt-1">
                <Link
                  href="/service-requests"
                  className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2"
                >
                  + {activeAdminNotifications.length - 3} more new service requests awaiting review
                </Link>
              </div>
            )}
          </div>
        )}

        {/* All caught up notification banner if opened when count is 0 */}
        {showNotificationBanner && activeAdminNotifications.length === 0 && newServiceRequests.length > 0 && dismissedAlertIds.length > 0 && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="font-bold">All caught up!</span>
                <span className="ml-1 text-emerald-700">All new service request notifications have been acknowledged.</span>
              </div>
            </div>
            <button
              onClick={() => setShowNotificationBanner(false)}
              className="p-1 text-emerald-600 hover:text-emerald-900 rounded-lg hover:bg-emerald-100 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 5 Dynamic KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Assets */}
          <Link
            href="/assets"
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:border-blue-400 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Assets</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {totalAssets}
              </h3>
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span>{operationalCount} Operational</span>
            </div>
          </Link>

          {/* Card 2: Service Request */}
          <Link
            href="/service-requests"
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:border-blue-400 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Service Requests</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{openSRCount}</h3>
            </div>
            {overdueSRCount > 0 ? (
              <div className="inline-flex items-center text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                {overdueSRCount} Overdue SLA
              </div>
            ) : (
              <div className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                {pendingSRCount} Open Tickets
              </div>
            )}
          </Link>

          {/* Card 3: Maintenance Due */}
          <Link
            href="/maintenance/preventive"
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:border-blue-400 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Preventive Due</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{pmDueCount}</h3>
            </div>
            <div className="inline-flex items-center text-[11px] font-semibold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full">
              Scheduled PMs
            </div>
          </Link>

          {/* Card 4: Inspection Pending */}
          <Link
            href="/inspections"
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:border-blue-400 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Pending Inspections</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{inspectionPendingCount}</h3>
            </div>
            <div className="inline-flex items-center text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full">
              Inspections
            </div>
          </Link>

          {/* Card 5: Room Reserved */}
          <Link
            href="/organization/rooms"
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3 hover:border-blue-400 transition"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Calendar className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Occupied Rooms</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{roomReservedCount}</h3>
            </div>
            <div className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              Active Use
            </div>
          </Link>
        </div>

        {/* Middle Charts Row (Assets Status Donut & Compliance Semi-Gauge) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Assets Status Distribution */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Assets Status Distribution</h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-4 pb-2">
              {/* SVG Donut Chart */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                  {totalAssets > 0 && (
                    <>
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#3b82f6"
                        strokeWidth="12"
                        strokeDasharray={`${(operationalPct / 100) * 238} 240`}
                        strokeDashoffset="0"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#f59e0b"
                        strokeWidth="12"
                        strokeDasharray={`${(underMaintPct / 100) * 238} 240`}
                        strokeDashoffset={`-${(operationalPct / 100) * 238}`}
                        fill="transparent"
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 leading-none">{totalAssets}</span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">Total Assets</span>
                </div>
              </div>

              {/* Legend with live counts */}
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-0.5"></span>
                  <div>
                    <p className="font-semibold text-slate-800">Operational</p>
                    <p className="text-slate-500 text-[11px]">{operationalPct}% • {operationalCount} Assets</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-0.5"></span>
                  <div>
                    <p className="font-semibold text-slate-800">Under Maintenance</p>
                    <p className="text-slate-500 text-[11px]">{underMaintPct}% • {underMaintenanceCount} Assets</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 mt-0.5"></span>
                  <div>
                    <p className="font-semibold text-slate-800">Retired</p>
                    <p className="text-slate-500 text-[11px]">{retiredPct}% • {retiredCount} Assets</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Overall Compliance Score (Quality Gauge matching Reference UI) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-2 flex flex-col justify-between">
            <h2 className="text-base font-bold text-slate-900">Overall Compliance Score</h2>

            <div className="flex flex-col items-center justify-center pt-2">
              {/* Semi-Circle SVG Gauge */}
              <div className="relative w-72 h-40 flex items-center justify-center">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 200 115">
                  {/* Background Track Arc (Radius 75, stroke width 18, rounded linecap) */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#eef4ff"
                    strokeWidth="18"
                    strokeLinecap="round"
                  />
                  {/* Value Arc (Blue filled progress) */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#3b5bfd"
                    strokeWidth="18"
                    strokeLinecap="round"
                    strokeDasharray={251.3}
                    strokeDashoffset={251.3 * (1 - complianceRate / 100)}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                {/* Center Content: 96% and Outstanding Pill */}
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 text-center">
                  <span className="text-4xl font-extrabold text-slate-800 tracking-tight leading-none mb-2">
                    {complianceRate}%
                  </span>
                  <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    {completedInspections.length === 0 ? 'No Data Yet' : complianceRate >= 90 ? 'Outstanding' : complianceRate >= 75 ? 'Good' : 'Needs Action'}
                  </span>
                </div>
              </div>

              {/* Bottom text */}
              <p className="text-xs text-slate-500 font-medium mt-3">
                Based on {completedInspections.length} completed inspection{completedInspections.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Two Tables: Upcoming Preventive Maintenance & Open Service Requests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Preventive Maintenance */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Upcoming Preventive Maintenance</h2>
              <Link
                href="/maintenance/preventive"
                className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                View all
              </Link>
            </div>

            {upcomingPMs.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Inbox className="w-8 h-8 stroke-1 text-slate-300" />
                <p className="text-xs font-medium">No scheduled preventive maintenance tasks pending</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 font-medium">
                      <th className="pb-3">WO Number</th>
                      <th className="pb-3">Due Date</th>
                      <th className="pb-3">Frequency</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingPMs.slice(0, 5).map(wo => {
                      const asset = assets.find(a => a.id === wo.assetId)
                      return (
                        <tr key={wo.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3">
                            <p className="font-bold text-slate-900 font-mono text-blue-600">{wo.woNumber}</p>
                            <p className="text-[11px] text-slate-400">{asset?.name || 'Asset'}</p>
                          </td>
                          <td className="py-3 text-slate-600 font-medium">{wo.dueDate}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                              {wo.frequency || 'Quarterly'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-600 text-white">
                              {wo.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Open Service Requests */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Open Service Requests</h2>
              <Link
                href="/service-requests"
                className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                View all
              </Link>
            </div>

            {openSRs.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Inbox className="w-8 h-8 stroke-1 text-slate-300" />
                <p className="text-xs font-medium">All service requests are clear and resolved</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openSRs.slice(0, 5).map(sr => (
                  <div key={sr.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        <span className="font-mono text-blue-600">{sr.ticketId}</span> • {sr.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Reported by {sr.requestedBy}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                      {sr.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
