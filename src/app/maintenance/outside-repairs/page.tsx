'use client'

import React, { useMemo, useState } from 'react'
import { Search, Truck } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { OutsideRepairStatusPill } from '@/components/outsideRepair/OutsideRepairPanel'
import { formatDateDisplay } from '@/lib/dateUtils'
import { daysOut, isOutForRepair, isOverdueReturn, repairItemLabel } from '@/lib/outsideRepairState'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, timeOf } from '@/components/ui/DataTable'
import type { OutsideRepair } from '@/types/afms'

// Every part or asset sent to an outside workshop: what is away, with whom, when
// it is due back, and what came back. Sending and returning are recorded on the
// work order itself (technician on mobile, Admin on the Corrective page).

type Tab = 'Out' | 'Overdue' | 'Returned' | 'All'

const inr = (n?: number) => (n === undefined ? '—' : `₹${n.toLocaleString('en-IN')}`)

export default function OutsideRepairsPage() {
  const { outsideRepairs, workOrders, assets, vendors } = useAFMS()
  const [tab, setTab] = useState<Tab>('Out')
  const [vendorFilter, setVendorFilter] = useState('All')
  const [query, setQuery] = useState('')

  const counts = {
    Out: outsideRepairs.filter(isOutForRepair).length,
    Overdue: outsideRepairs.filter(r => isOverdueReturn(r)).length,
    Returned: outsideRepairs.filter(r => r.status === 'Returned').length,
    All: outsideRepairs.length,
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return outsideRepairs
      .filter(r => {
        if (tab === 'Out' && !isOutForRepair(r)) return false
        if (tab === 'Overdue' && !isOverdueReturn(r)) return false
        if (tab === 'Returned' && r.status !== 'Returned') return false
        if (vendorFilter !== 'All' && r.vendorId !== vendorFilter) return false
        if (!q) return true
        const asset = assets.find(a => a.id === r.assetId)
        const wo = workOrders.find(w => w.id === r.workOrderId)
        return [r.repairNumber, repairItemLabel(r), asset?.name, asset?.assetId, wo?.woNumber, r.dispatchRef, r.vendorRef]
          .some(v => v?.toLowerCase().includes(q))
      })
      // Still-out items by due date (soonest first); returned ones newest first.
      .sort((a, b) =>
        isOutForRepair(a) !== isOutForRepair(b)
          ? Number(isOutForRepair(b)) - Number(isOutForRepair(a))
          : isOutForRepair(a)
          ? a.expectedReturnDate.localeCompare(b.expectedReturnDate)
          : (b.returnedDate || '').localeCompare(a.returnedDate || '')
      )
  }, [outsideRepairs, tab, vendorFilter, query, assets, workOrders])

  const usedVendors = vendors.filter(v => outsideRepairs.some(r => r.vendorId === v.id))

  const columns = useMemo<ColumnDef<OutsideRepair>[]>(() => [
    {
      id: 'item',
      header: 'Repair',
      accessorFn: r => repairItemLabel(r),
      meta: { thClassName: 'py-3.5 px-5', tdClassName: 'py-3.5 px-5' },
      cell: ({ row: { original: r } }) => (
        <>
          <p className="font-bold text-slate-900">{repairItemLabel(r)}</p>
          <p className="font-mono text-[11px] text-blue-600 font-semibold">{r.repairNumber}</p>
          {r.faultDescription && <p className="text-[11px] text-slate-500 mt-0.5 max-w-56">{r.faultDescription}</p>}
        </>
      ),
    },
    {
      id: 'asset',
      header: 'Asset / Work order',
      accessorFn: r => assets.find(a => a.id === r.assetId)?.name ?? '',
      cell: ({ row: { original: r } }) => {
        const asset = assets.find(a => a.id === r.assetId)
        const wo = workOrders.find(w => w.id === r.workOrderId)
        return (
          <>
            <p className="font-semibold text-slate-800">{asset?.name || '—'}</p>
            <p className="text-[11px] text-slate-400 font-mono">
              {asset?.assetId || ''}{wo && !isPendingWorkOrder(wo.woNumber) ? ` · ${wo.woNumber}` : ''}
            </p>
          </>
        )
      },
    },
    {
      id: 'vendor',
      header: 'Vendor',
      accessorFn: r => vendors.find(v => v.id === r.vendorId)?.name ?? '',
      cell: ({ row: { original: r } }) => (
        <>
          <p className="font-semibold text-slate-800">{vendors.find(v => v.id === r.vendorId)?.name || '—'}</p>
          <p className="text-[11px] text-slate-400">
            Sent by {r.sentBy === 'Vendor' ? 'vendor' : 'technician'}
            {r.dispatchRef ? ` · GP/DC ${r.dispatchRef}` : ''}
          </p>
        </>
      ),
    },
    {
      id: 'sentDate',
      header: 'Sent',
      accessorFn: r => timeOf(r.sentDate),
      sortUndefined: 'last',
      meta: { tdClassName: 'py-3.5 px-4 text-slate-700' },
      cell: ({ row: { original: r } }) => formatDateDisplay(r.sentDate),
    },
    {
      id: 'expectedReturnDate',
      header: 'Expected back',
      accessorFn: r => timeOf(r.expectedReturnDate),
      sortUndefined: 'last',
      cell: ({ row: { original: r } }) => (
        <>
          <p className={isOverdueReturn(r) ? 'font-bold text-rose-600' : 'text-slate-700'}>{formatDateDisplay(r.expectedReturnDate)}</p>
          {r.returnedDate && <p className="text-[11px] text-emerald-700">Back {formatDateDisplay(r.returnedDate)}</p>}
        </>
      ),
    },
    {
      id: 'days',
      header: 'Days',
      accessorFn: r => daysOut(r),
      meta: { tdClassName: 'py-3.5 px-4 text-slate-700' },
    },
    {
      id: 'cost',
      header: 'Cost',
      // The actual cost once known, otherwise the estimate.
      accessorFn: r => r.actualCost ?? r.estimatedCost,
      sortUndefined: 'last',
      meta: { tdClassName: 'py-3.5 px-4 text-slate-700' },
      cell: ({ row: { original: r } }) =>
        r.actualCost !== undefined ? inr(r.actualCost) : (
          <span className="text-slate-400">{r.estimatedCost !== undefined ? `est. ${inr(r.estimatedCost)}` : '—'}</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: r => r.status,
      meta: { tdClassName: 'py-3.5 px-4 space-y-1' },
      cell: ({ row: { original: r } }) => (
        <>
          <OutsideRepairStatusPill repair={r} />
          {r.outcome && <p className="text-[11px] text-slate-500">{r.outcome}</p>}
        </>
      ),
    },
  ], [assets, workOrders, vendors])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'Out', label: 'Out for repair' },
    { id: 'Overdue', label: 'Overdue' },
    { id: 'Returned', label: 'Returned' },
    { id: 'All', label: 'All' },
  ]

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Maintenance' }, { label: 'Outside Repairs' }]}
      loadingFallback={<PageSkeleton tiles={0} rows={8} cols={8} />}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-600" /> Outside Repairs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Parts and assets sent to outside workshops during corrective maintenance. Record sending and returns on the work order.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  tab === t.id
                    ? t.id === 'Overdue' ? 'bg-rose-600 text-white border-rose-600' : 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label} <span className="opacity-75">({counts[t.id]})</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
            >
              <option value="All">All vendors</option>
              {usedVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="OSR no, asset, WO, part, gate pass…"
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-64"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <DataTable
            tableId="outside-repairs"
            data={rows}
            columns={columns}
            getRowId={r => r.id}
            resetKey={`${tab}|${vendorFilter}|${query}`}
            rowClassName="hover:bg-slate-50/60 align-top"
            tdClassName="py-3.5 px-4"
            emptyState={
              outsideRepairs.length === 0
                ? 'Nothing has been sent outside for repair yet.'
                : 'Nothing matches this filter.'
            }
          />
        </div>
      </div>
    </AppLayout>
  )
}
