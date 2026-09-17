'use client'

import React, { useState } from 'react'
import { Bell, CheckCircle2, Wrench, ClipboardCheck, LogOut as LogOutIcon } from 'lucide-react'
import type { AppNotification } from '@/types/afms'
import { formatDateTimeDisplay } from '@/lib/dateUtils'

const ICONS: Record<AppNotification['type'], React.ReactNode> = {
  wo_assigned: <Wrench className="w-3.5 h-3.5" />,
  inspection_assigned: <ClipboardCheck className="w-3.5 h-3.5" />,
  auto_checkout: <LogOutIcon className="w-3.5 h-3.5" />,
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
}: {
  notifications: AppNotification[]
  unreadCount: number
  onMarkRead: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`relative p-1.5 rounded-lg border transition ${
          unreadCount > 0
            ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
            : 'text-slate-400 bg-slate-800 border-slate-700 hover:text-slate-200'
        }`}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 text-xs overflow-hidden animate-in fade-in">
            <div className="px-3 py-2.5 border-b border-slate-800 font-bold text-slate-200">
              Notifications
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-slate-500 space-y-1">
                  <CheckCircle2 className="w-6 h-6 mx-auto opacity-60" />
                  <p>Nothing yet.</p>
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.isRead && onMarkRead(n.id)}
                    className={`w-full text-left p-3 flex items-start gap-2 transition hover:bg-slate-800/60 ${
                      n.isRead ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-800 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      {ICONS[n.type]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100 line-clamp-2">{n.title}</p>
                      {n.body && <p className="text-slate-400 line-clamp-2 mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-slate-500 mt-1">
                        {formatDateTimeDisplay(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
