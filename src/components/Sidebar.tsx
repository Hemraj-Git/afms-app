'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Layers,
  DoorOpen,
  Boxes,
  FolderTree,
  Tags,
  Headset,
  CalendarCheck2,
  ShieldCheck,
  Users,
  Wrench,
  AlertTriangle,
  BarChart3,
  QrCode,
  FileText,
  Truck,
  ClipboardList,
  CheckSquare,
  Sparkles,
  ChevronRight,
  Package,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  section: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    section: 'MAIN',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'ORGANIZATION',
    items: [
      { title: 'Campus', href: '/organization/campus', icon: Building2 },
      { title: 'Building/Block', href: '/organization/building', icon: Layers },
      { title: 'Rooms/Areas', href: '/organization/rooms', icon: DoorOpen },
    ],
  },
  {
    section: 'ASSET MANAGEMENT',
    items: [
      { title: 'Assets', href: '/assets', icon: Boxes },
      { title: 'Inventory Hub / Spares', href: '/inventory', icon: Package },
      { title: 'Categories', href: '/categories', icon: FolderTree },
      { title: 'Sub-Categories', href: '/sub-categories', icon: Tags },
    ],
  },
  {
    section: 'OPERATION',
    items: [
      { title: 'Service Requests', href: '/service-requests', icon: Headset },
      { title: 'Reservations', href: '/reservations', icon: CalendarCheck2 },
      { title: 'Inspection', href: '/inspections', icon: ShieldCheck },
    ],
  },
  {
    section: 'MAINTENANCE',
    items: [
      { title: 'Work Orders', href: '/maintenance/work-orders', icon: ClipboardList },
      { title: 'Preventive', href: '/maintenance/preventive', icon: Wrench },
      { title: 'Corrective', href: '/maintenance/corrective', icon: AlertTriangle },
    ],
  },
  {
    section: 'REPORTS',
    items: [
      { title: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    section: 'UTILITY',
    items: [
      { title: 'QR Codes', href: '/utility/qr-codes', icon: QrCode },
      { title: 'Document Library', href: '/utility/documents', icon: FileText },
      { title: 'Vendor List', href: '/utility/vendors', icon: Truck },
      { title: 'Maintenance Templates', href: '/utility/maintenance-templates', icon: ClipboardList },
      { title: 'Inspection Templates', href: '/utility/inspection-templates', icon: CheckSquare },
    ],
  },
  {
    section: 'ADMIN',
    items: [
      { title: 'Users', href: '/admin/users', icon: Users },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'bg-white border-r border-slate-200 flex flex-col h-screen select-none transition-all duration-300 ease-in-out shrink-0 z-50 print:hidden',
        // Desktop collapsed vs expanded widths
        collapsed ? 'w-20' : 'w-64',
        // Mobile fixed overlay drawer vs Desktop static flex child
        'fixed inset-y-0 left-0 lg:static',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Brand Header */}
      <div className={cn(
        'h-16 flex items-center border-b border-slate-100 transition-all px-4 shrink-0',
        collapsed ? 'justify-center' : 'justify-between px-6'
      )}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <div className="flex gap-0.5 items-end h-4">
              <span className="w-1 h-2 bg-white rounded-full"></span>
              <span className="w-1 h-4 bg-white rounded-full"></span>
              <span className="w-1 h-3 bg-white rounded-full"></span>
            </div>
          </div>
          {!collapsed && (
            <div className="flex items-center">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">AFMS</span>
            </div>
          )}
        </Link>

        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List - Scrolls internally if menu exceeds screen height */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {navSections.map(group => (
          <div key={group.section} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {group.section}
              </h3>
            )}
            <div className="space-y-0.5 pt-1">
              {group.items.map(item => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (onMobileClose) onMobileClose()
                    }}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      'flex items-center rounded-xl transition-all',
                      collapsed
                        ? 'justify-center p-2.5 my-0.5'
                        : 'gap-3 px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-blue-600' : 'text-slate-400')} />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Branding / Collapsed Toggle Banner */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
        {!collapsed ? (
          <div className="bg-slate-100/80 rounded-xl p-3.5 text-center space-y-2 border border-slate-200/60">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">A Product of</p>
              <p className="text-xs font-bold text-slate-800">HMS - Digital Solutions</p>
            </div>
            <button
              onClick={() => alert('Support line: support@hemrajmarines.com | Tel: +91 22 6600 4400')}
              className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition text-white text-xs font-medium rounded-lg shadow-sm"
            >
              Contact for Support
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <button
              onClick={onToggle}
              className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 transition"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
