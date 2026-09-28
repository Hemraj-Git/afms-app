'use client'

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Boxes,
  ClipboardCheck,
  CornerDownLeft,
  DoorOpen,
  MessageSquare,
  Package,
  Search,
  Truck,
  User,
  Wrench,
  Building2,
} from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { flattenHits, globalSearch, type SearchHit, type SearchKind } from '@/lib/globalSearch'
import { announceSearchPrefill } from '@/lib/useSearchPrefill'

// Header search box + Ctrl+K / ⌘K palette. Searches the lists already loaded
// for this user (see src/lib/globalSearch.ts) and opens the record's page, or
// its list page with the search box filled in.

const KIND_ICONS: Record<SearchKind, React.ReactNode> = {
  asset: <Boxes className="w-4 h-4" />,
  workOrder: <Wrench className="w-4 h-4" />,
  request: <MessageSquare className="w-4 h-4" />,
  inspection: <ClipboardCheck className="w-4 h-4" />,
  outsideRepair: <Truck className="w-4 h-4" />,
  room: <DoorOpen className="w-4 h-4" />,
  inventory: <Package className="w-4 h-4" />,
  vendor: <Building2 className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
}

// The platform never changes while the page is open.
const noSubscribe = () => () => {}

export function GlobalSearch() {
  const router = useRouter()
  const { assets, workOrders, serviceRequests, inspections, outsideRepairs, rooms, inventoryItems, vendors, users } = useAFMS()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // "Ctrl K" on the server and in the first render, so hydration matches.
  const shortcut = useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'),
    () => 'Ctrl K'
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const groups = useMemo(
    () => globalSearch(query, { assets, workOrders, serviceRequests, inspections, outsideRepairs, rooms, inventoryItems, vendors, users }),
    [query, assets, workOrders, serviceRequests, inspections, outsideRepairs, rooms, inventoryItems, vendors, users]
  )
  const flat = useMemo(() => flattenHits(groups), [groups])
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1))

  useEffect(() => {
    if (!open) return
    document.getElementById(`gs-hit-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setQuery('')
      setActive(0)
    }
  }

  const go = (hit: SearchHit) => {
    onOpenChange(false)
    const url = new URL(hit.href, window.location.origin)
    const samePage = url.pathname === window.location.pathname
    router.push(hit.href)
    if (samePage) announceSearchPrefill(url.pathname, url.searchParams.get('q') ?? '')
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (flat.length ? (Math.min(i, flat.length - 1) + 1) % flat.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (flat.length ? (Math.min(i, flat.length - 1) - 1 + flat.length) % flat.length : 0))
    } else if (e.key === 'Enter' && flat[activeIndex]) {
      e.preventDefault()
      go(flat[activeIndex])
    }
  }

  let index = -1
  const trimmed = query.trim()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="group flex items-center gap-2 w-9 sm:w-full sm:max-w-sm h-9 px-2.5 sm:px-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs text-slate-400 transition"
          aria-label="Search"
          title={`Search (${shortcut})`}
        >
          <Search className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
          <span className="hidden sm:inline flex-1 text-left truncate">Search assets, work orders, tickets…</span>
          <kbd className="hidden sm:inline px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-[10px] font-semibold text-slate-500">
            {shortcut}
          </kbd>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-[10vh] -translate-x-1/2 w-[calc(100vw-2rem)] max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2 px-4 border-b border-slate-100">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onInputKey}
              placeholder="Asset tag or serial, WO / ticket / inspection no., room, spare, vendor, person…"
              className="flex-1 h-12 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls="gs-results"
              aria-activedescendant={flat.length ? `gs-hit-${activeIndex}` : undefined}
            />
            <kbd className="px-1.5 py-0.5 rounded-md border border-slate-200 text-[10px] font-semibold text-slate-400">Esc</kbd>
          </div>

          <div id="gs-results" role="listbox" aria-label="Search results" className="max-h-[60vh] overflow-y-auto py-2">
            {!trimmed ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">
                Type to search assets, work orders, service requests, inspections, outside repairs, rooms, inventory, vendors and users.
              </p>
            ) : groups.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">
                No matches for <span className="font-semibold text-slate-700">“{trimmed}”</span>.
              </p>
            ) : (
              groups.map(group => (
                <div key={group.kind} role="group" aria-label={group.label} className="pb-1">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                    {group.total > group.hits.length && (
                      <span className="normal-case font-medium tracking-normal"> · top {group.hits.length} of {group.total}</span>
                    )}
                  </p>
                  {group.hits.map(hit => {
                    index += 1
                    const i = index
                    const isActive = i === activeIndex
                    return (
                      <button
                        key={`${hit.kind}-${hit.id}`}
                        id={`gs-hit-${i}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(hit)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${
                          isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{KIND_ICONS[hit.kind]}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-slate-900 truncate">{hit.title}</span>
                          {hit.subtitle && <span className="block text-[11px] text-slate-500 truncate">{hit.subtitle}</span>}
                        </span>
                        {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">
            <span><kbd className="font-semibold">↑↓</kbd> to move</span>
            <span><kbd className="font-semibold">Enter</kbd> to open</span>
            <span><kbd className="font-semibold">Esc</kbd> to close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
