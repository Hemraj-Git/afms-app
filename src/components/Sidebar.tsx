'use client'

import React, { useState } from 'react'
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
  PackageOpen,
  X,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AboutDialog } from '@/components/AboutDialog'
import {
  APP_VERSION,
  CLIENT_LOGO_MARK_URL,
  CLIENT_LOGO_URL,
  CLIENT_NAME,
  PRODUCT_LOGO_URL,
  PRODUCT_MARK_URL,
  PRODUCT_NAME,
  initialsOf,
} from '@/lib/brand'

// The square mark: the client's mark, else their initials, else AssetNXG's bars.
function BrandMark() {
  if (CLIENT_LOGO_MARK_URL) {
    // eslint-disable-next-line @next/next/no-img-element -- a logo set per deployment, of any size
    return <img src={CLIENT_LOGO_MARK_URL} alt={CLIENT_NAME || PRODUCT_NAME} className="w-10 h-10 object-contain shrink-0" />
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
      {CLIENT_NAME ? (
        <span className="text-[11px] font-bold tracking-wide">{initialsOf(CLIENT_NAME)}</span>
      ) : (
        <div className="flex gap-0.5 items-end h-4">
          <span className="w-1 h-2 bg-white rounded-full"></span>
          <span className="w-1 h-4 bg-white rounded-full"></span>
          <span className="w-1 h-3 bg-white rounded-full"></span>
        </div>
      )}
    </div>
  )
}

// Top of the sidebar: the client's logo (set per deployment, see lib/brand),
// else their name, else AssetNXG.
function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return <BrandMark />
  if (CLIENT_LOGO_URL) {
    // eslint-disable-next-line @next/next/no-img-element -- a logo set per deployment, of any size
    return <img src={CLIENT_LOGO_URL} alt={CLIENT_NAME || PRODUCT_NAME} className="h-12 w-auto max-w-[196px] object-contain object-left" />
  }
  return (
    <div className="flex items-center gap-3 min-w-0">
      <BrandMark />
      {CLIENT_NAME ? (
        <span className="text-sm font-bold leading-tight text-slate-900 line-clamp-2">{CLIENT_NAME}</span>
      ) : (
        <span className="font-extrabold text-xl tracking-tight text-slate-900">{PRODUCT_NAME}</span>
      )}
    </div>
  )
}

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
      { title: 'Housekeeping', href: '/maintenance/housekeeping', icon: Sparkles },
      { title: 'Outside Repairs', href: '/maintenance/outside-repairs', icon: PackageOpen },
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
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <>
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
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0" aria-label={`${CLIENT_NAME || PRODUCT_NAME} — Dashboard`}>
          <SidebarBrand collapsed={collapsed} />
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

      {/* Bottom: AssetNXG, its version and About (who makes it, support). */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a static brand file at a fixed height */}
            <img src={PRODUCT_LOGO_URL} alt={PRODUCT_NAME} className="h-5 w-auto" />
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              {APP_VERSION ? <span>v{APP_VERSION}</span> : null}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-blue-600 transition"
              >
                <Info className="w-3.5 h-3.5" />
                About
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <button type="button" onClick={() => setAboutOpen(true)} title={`About ${PRODUCT_NAME}`} aria-label={`About ${PRODUCT_NAME}`} className="p-1 rounded-lg hover:bg-slate-100 transition">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static brand file at a fixed height */}
              <img src={PRODUCT_MARK_URL} alt="" className="h-6 w-auto" />
            </button>
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
    {/* Outside the aside: its slide transform would trap a fixed overlay inside it. */}
    {aboutOpen ? <AboutDialog onClose={() => setAboutOpen(false)} /> : null}
    </>
  )
}
