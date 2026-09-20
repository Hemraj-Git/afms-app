'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { useAFMS } from '@/context/AFMSContext'

// Auth/role gating for every route this layout wraps happens server-side in
// proxy.ts (redirects unauthenticated requests to /login, non-Admin roles
// to /mobile, before any client code here ever runs) — this component does
// not re-check it. An earlier version did a client-only `isLoggedIn` check
// and returned a spinner in its place, which is exactly the anti-pattern
// Next's own auth guide warns against (a layout "return null" gate doesn't
// stop nested routes or Server Actions from executing) and, once proxy.ts
// existed, was also fully redundant with it.
//
// The skeleton below is NOT that: it only reflects whether the app's data has
// finished loading (isDataLoading) and says nothing about who may see what.
// It replaces the page content -- not the sidebar or header -- while the first
// load runs, so users see the shape of the page instead of "No data" messages
// and zero counts. Note it swaps out the content only: the page component
// itself (and any state it seeds from the data at mount) is already mounted.
export function AppLayout({
  children,
  breadcrumbs = [{ label: 'Home', href: '/dashboard' }],
  loadingFallback,
}: {
  children: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
  // A skeleton shaped like this page; falls back to a generic one.
  loadingFallback?: React.ReactNode
}) {
  const { isDataLoading, dataLoadError, reloadData } = useAFMS()
  // Sidebar collapsed state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('afms_sidebar_collapsed')
      if (saved !== null) {
        setSidebarCollapsed(JSON.parse(saved))
      }
    } catch {
      // Ignore local storage errors
    }
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('afms_sidebar_collapsed', JSON.stringify(next))
      } catch {
        // Ignore
      }
      return next
    })
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 print:h-auto print:w-auto print:overflow-visible print:bg-white">
      {/* Desktop Fixed Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Backdrop for Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden animate-in fade-in print:hidden"
        />
      )}

      {/* Main Content Area (Independent Full-Height Scrollable Viewport) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible">
        {/* Sticky / Fixed Header */}
        <Header
          breadcrumbs={breadcrumbs}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={toggleSidebar}
          onMenuToggle={toggleMobileMenu}
        />

        {/* Scrollable Right-Side Main Content (Only this pane scrolls) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin print:p-0 print:overflow-visible print:h-auto">
          {isDataLoading ? (
            loadingFallback ?? <PageSkeleton />
          ) : (
            <>
              {dataLoadError && (
                <div
                  role="alert"
                  className="mx-auto mb-5 flex max-w-7xl items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 print:hidden"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="flex-1">
                    {dataLoadError} Some lists below may look empty even though records exist.
                  </p>
                  <button
                    type="button"
                    onClick={() => void reloadData()}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Retry
                  </button>
                </div>
              )}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
