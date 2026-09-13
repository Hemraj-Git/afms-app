'use client'

import React, { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

// Auth/role gating for every route this layout wraps happens server-side in
// proxy.ts (redirects unauthenticated requests to /login, non-Admin roles
// to /mobile, before any client code here ever runs) — this component does
// not re-check it. An earlier version did a client-only `isLoggedIn` check
// and returned a spinner in its place, which is exactly the anti-pattern
// Next's own auth guide warns against (a layout "return null" gate doesn't
// stop nested routes or Server Actions from executing) and, once proxy.ts
// existed, was also fully redundant with it.
export function AppLayout({
  children,
  breadcrumbs = [{ label: 'Home', href: '/dashboard' }],
}: {
  children: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}) {
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
          {children}
        </main>
      </div>
    </div>
  )
}
