'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import { formatDateDisplay } from '@/lib/dateUtils'
import {
  Menu,
  PanelLeftOpen,
  Smartphone,
  CheckCircle2,
  Bell,
  X,
  ArrowRight,
  Clock,
  LogOut,
} from 'lucide-react'
import Link from 'next/link'
import { UserRole } from '@/types/afms'

interface HeaderProps {
  breadcrumbs?: { label: string; href?: string }[]
  sidebarCollapsed?: boolean
  onSidebarToggle?: () => void
  onMenuToggle?: () => void
}

export function Header({
  breadcrumbs = [{ label: 'Home', href: '/dashboard' }],
  sidebarCollapsed = false,
  onSidebarToggle,
  onMenuToggle,
}: HeaderProps) {
  const router = useRouter()
  const { currentUser, activeCheckIn, checkOutRoom, serviceRequests, rooms, isLoggedIn, logout } = useAFMS()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotificationMenu, setShowNotificationMenu] = useState(false)
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([])

  // New service requests with status 'Open'
  const openServiceRequests = (serviceRequests || []).filter(sr => sr.status === 'Open')
  const unreadRequests = openServiceRequests.filter(sr => !dismissedNotificationIds.includes(sr.id))

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 transition-all duration-300 print:hidden">
      {/* Left: Hamburger / Collapse Sidebar Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 lg:hidden transition"
            title="Open Mobile Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Desktop Collapse / Expand Sidebar Button */}
        {onSidebarToggle && (
          <button
            onClick={onSidebarToggle}
            className="p-2 text-slate-500 hover:text-blue-600 rounded-xl hover:bg-blue-50/80 transition hidden lg:flex items-center justify-center"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-blue-600" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600" />
            )}
          </button>
        )}

        {/* Breadcrumb path */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-300">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-blue-600 font-medium transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-800 font-semibold">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* The quick-search bar that used to sit here was only a text box (no results, no shortcut),
          so it is hidden until a real global search exists. The spacer keeps the right-hand
          controls where they were. */}
      <div className="flex-1" />

      {/* Right: Role Switcher Demo Tool + Mobile QR Mode + Notifications + User Avatar */}
      <div className="flex items-center gap-3">
        {/* PWA Mobile Mode Link */}
        <Link
          href="/mobile"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition border border-blue-200/50"
          title="Open Field Mobile PWA experience"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">PWA Field Mode</span>
        </Link>

        {/* Active Room Check-in indicator */}
        {activeCheckIn && (
          <div className="hidden lg:flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Checked in: {activeCheckIn.roomName}</span>
            <button
              onClick={() => checkOutRoom(activeCheckIn.roomId)}
              className="text-xs font-bold underline hover:text-emerald-900 ml-1"
            >
              Check Out
            </button>
          </div>
        )}

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotificationMenu(!showNotificationMenu)
              setShowUserMenu(false)
            }}
            className={`relative p-2 rounded-xl transition border ${
              unreadRequests.length > 0
                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-transparent'
            }`}
            title="Service Request Notifications"
          >
            <Bell className={`w-4 h-4 ${unreadRequests.length > 0 ? 'animate-swing' : ''}`} />
            {unreadRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                {unreadRequests.length > 9 ? '9+' : unreadRequests.length}
              </span>
            )}
          </button>

          {showNotificationMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs animate-in fade-in space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Service Request Alerts</h3>
                    <p className="text-[10px] text-slate-400">
                      {unreadRequests.length > 0
                        ? `${unreadRequests.length} new request${unreadRequests.length > 1 ? 's' : ''} require attention`
                        : 'No unread notifications'}
                    </p>
                  </div>
                </div>

                {unreadRequests.length > 0 && (
                  <button
                    onClick={() => {
                      setDismissedNotificationIds(openServiceRequests.map(sr => sr.id))
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 divide-y divide-slate-50">
                {unreadRequests.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                    <p className="font-medium text-slate-600 text-xs">All Caught Up!</p>
                    <p className="text-[10px]">No pending new service requests</p>
                  </div>
                ) : (
                  unreadRequests.map(sr => (
                    <div
                      key={sr.id}
                      className="p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100/80 transition flex items-start justify-between gap-2 group"
                    >
                      <Link
                        href="/service-requests"
                        onClick={() => setShowNotificationMenu(false)}
                        className="flex-1 space-y-1"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {sr.ticketId}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                              sr.priority === 'Critical'
                                ? 'bg-rose-100 text-rose-700'
                                : sr.priority === 'High'
                                ? 'bg-orange-100 text-orange-700'
                                : sr.priority === 'Medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {sr.priority}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDateDisplay(sr.createdAt)}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition">
                          {sr.title}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          By <span className="font-medium text-slate-600">{sr.requestedBy}</span> ({sr.requestedByRole}) • Room {rooms.find(r => r.id === sr.roomId)?.roomNumber || sr.roomId}
                        </p>
                      </Link>

                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setDismissedNotificationIds(prev => [...prev, sr.id])
                        }}
                        className="p-1 text-slate-300 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                        title="Dismiss notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link
                  href="/service-requests"
                  onClick={() => setShowNotificationMenu(false)}
                  className="w-full text-center py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <span>Go to Service Requests Hub</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>Role: <strong className="text-slate-900">{currentUser.role}</strong></span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 text-xs animate-in fade-in space-y-1">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-bold text-slate-900">{currentUser.fullName}</p>
                <p className="text-[11px] text-slate-400">{currentUser.email}</p>
              </div>

              <div className="pt-2 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    setShowUserMenu(false)
                    router.push('/login')
                  }}
                  className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2 font-medium cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User profile avatar or Sign In */}
        {isLoggedIn ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm hover:ring-2 hover:ring-blue-400 transition cursor-pointer"
              title={`${currentUser.fullName} (${currentUser.role})`}
            >
              {currentUser.fullName ? currentUser.fullName.split(' ').map(n => n[0]).join('') : 'U'}
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}
