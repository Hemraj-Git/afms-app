'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { useAFMS } from '@/context/AFMSContext'

export function AppLayout({
  children,
  breadcrumbs = [{ label: 'Home', href: '/dashboard' }],
}: {
  children: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}) {
  const router = useRouter()
  const { isLoggedIn } = useAFMS()
  const [mounted, setMounted] = useState(false)

  // Sidebar collapsed state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isLoggedIn) {
      router.push('/login')
    }
  }, [isLoggedIn, router])

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

  if (mounted && !isLoggedIn) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Redirecting to login...</p>
        </div>
      </div>
    )
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
