'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { getLocalDateStr } from '@/lib/dateUtils'
import {
  Package,
  Plus,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  ArrowUpRight,
  AlertTriangle,
  Boxes,
  Layers,
  Building,
  CheckCircle2,
  Truck,
  RotateCcw,
  Sparkles,
  X,
  ArrowRight,
} from 'lucide-react'
import { InventoryItem } from '@/types/afms'
import { useSearchPrefill } from '@/lib/useSearchPrefill'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/DataTable'

import { Modal } from '@/components/ui/Modal'
import { showToast } from '@/lib/toast'
import { useFormCheck } from '@/lib/useFormCheck'
import { deploySchema } from '@/lib/validation/forms'
import { INVALID } from '@/components/ui/FormField'
import { confirmAction } from '@/lib/confirm'
export default function InventoryDashboardPage() {
  const router = useRouter()
  const {
    inventoryItems,
    deleteInventoryItem,
    updateInventoryItem,
    convertInventoryToAsset,
    categories,
    subCategories,
    rooms,
    buildings,
    campuses,
    vendors,
    users,
  } = useAFMS()

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL')
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('ALL')
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL')
  const [showFilters, setShowFilters] = useState(false)

  // Opened from the header search: clear the filters so the item shows.
  useSearchPrefill(q => {
    setSelectedCategoryId('ALL')
    setSelectedSubCategoryId('ALL')
    setStockFilter('ALL')
    setSearchQuery(q)
  })

  // Deploy / Allocate to Room Modal State
  const [deployItem, setDeployItem] = useState<InventoryItem | null>(null)
  const [deployCampusId, setDeployCampusId] = useState('')
  const [deployBuildingId, setDeployBuildingId] = useState('')
  const [deployRoomId, setDeployRoomId] = useState('')
  const [deployInstallDate, setDeployInstallDate] = useState(getLocalDateStr())
  const vDeploy = useFormCheck(deploySchema, { campusId: deployCampusId, buildingId: deployBuildingId, roomId: deployRoomId, installDate: deployInstallDate }, 'deploy')
  const [deployUserId, setDeployUserId] = useState('')

  // Quick Stock Adjustment Modal State
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [adjustQty, setAdjustQty] = useState<number>(1)

  // SubCategories filtered by category filter
  const availableSubCategories =
    selectedCategoryId === 'ALL'
      ? subCategories
      : subCategories.filter(s => s.categoryId === selectedCategoryId)

  // Buildings and Rooms for deployment modal
  const deployBuildings = buildings.filter(b => b.campusId === deployCampusId)
  const deployRooms = rooms.filter(r => r.buildingId === deployBuildingId)

  // Filtered inventory list
  const filteredItems = inventoryItems.filter(item => {
    const sub = subCategories.find(s => s.id === item.subCategoryId)
    const catId = sub?.categoryId || ''

    if (selectedCategoryId !== 'ALL' && catId !== selectedCategoryId) return false
    if (selectedSubCategoryId !== 'ALL' && item.subCategoryId !== selectedSubCategoryId) return false

    const minThresh = item.minStockThreshold || 2
    if (stockFilter === 'OUT_OF_STOCK' && item.quantity > 0) return false
    if (stockFilter === 'LOW_STOCK' && (item.quantity === 0 || item.quantity > minThresh)) return false
    if (stockFilter === 'IN_STOCK' && item.quantity <= minThresh) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesId = item.id.toLowerCase().includes(q) || item.inventoryNumber.toLowerCase().includes(q)
      const matchesName = item.name.toLowerCase().includes(q)
      const matchesMfr = item.manufacturer?.toLowerCase().includes(q) || false
      const matchesModel = item.modelNumber?.toLowerCase().includes(q) || false
      const matchesSerial = item.serialNumber?.toLowerCase().includes(q) || false
      const matchesLocation = item.storageLocation?.toLowerCase().includes(q) || false
      if (!matchesId && !matchesName && !matchesMfr && !matchesModel && !matchesSerial && !matchesLocation) {
        return false
      }
    }

    return true
  })

  // KPIs
  const totalItemsCount = inventoryItems.length
  const totalUnits = inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0)
  const lowStockCount = inventoryItems.filter(i => i.quantity > 0 && i.quantity <= (i.minStockThreshold || 2)).length
  const outOfStockCount = inventoryItems.filter(i => i.quantity === 0).length
  const totalStockValue = inventoryItems.reduce((acc, curr) => acc + (curr.unitPrice || 0) * curr.quantity, 0)

  const activeFilterCount =
    (selectedCategoryId !== 'ALL' ? 1 : 0) +
    (selectedSubCategoryId !== 'ALL' ? 1 : 0) +
    (stockFilter !== 'ALL' ? 1 : 0)

  const handleResetFilters = () => {
    setSelectedCategoryId('ALL')
    setSelectedSubCategoryId('ALL')
    setStockFilter('ALL')
    setSearchQuery('')
  }

  // Handle Deploy to Active Asset
  const handleConfirmDeploy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deployItem || !vDeploy.check()) return

    const created = await convertInventoryToAsset(
      deployItem.id,
      deployRoomId,
      deployInstallDate,
      deployUserId || undefined
    )
    if (created) {
      setDeployItem(null)
      setDeployUserId('')
      router.push(`/assets/${created.assetId}`)
    }
  }

  // Handle Stock Quantity Adjustment
  const handleSaveStockAdjust = (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustItem) return
    updateInventoryItem(adjustItem.id, { quantity: Math.max(0, adjustQty) })
    setAdjustItem(null)
  }

  // Out of stock first, then low, then healthy -- the rows that need action.
  const stockRank = (item: InventoryItem) =>
    item.quantity === 0 ? 0 : item.quantity <= (item.minStockThreshold || 2) ? 1 : 2

  const inventoryColumns: ColumnDef<InventoryItem>[] = [
    {
      id: 'inventoryNumber',
      header: 'INV Number',
      accessorFn: item => item.inventoryNumber || item.id,
      meta: { thClassName: 'py-3.5 px-6', tdClassName: 'py-4 px-6 font-mono font-bold text-blue-600' },
      cell: ({ row: { original: item } }) => (
        <Link href={`/inventory/${item.id}`} className="hover:underline">
          {item.inventoryNumber || item.id}
        </Link>
      ),
    },
    {
      id: 'name',
      header: 'Item & Specifications',
      accessorFn: item => item.name,
      meta: { tdClassName: 'py-4 px-4 max-w-xs' },
      cell: ({ row: { original: item } }) => {
        const sub = subCategories.find(s => s.id === item.subCategoryId)
        // Extract custom metadata keys for quick preview
        const specEntries = Object.entries(item.dynamicSpecifications || {}).filter(
          ([, val]) => val !== undefined && val !== ''
        )
        return (
          <>
            <Link href={`/inventory/${item.id}`} className="block">
              <p className="font-bold text-slate-900 hover:text-blue-600 transition">
                {item.name}
              </p>
            </Link>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {item.manufacturer || 'General Mfr'} {item.modelNumber ? `• ${item.modelNumber}` : ''}
              {item.serialNumber ? ` (S/N: ${item.serialNumber})` : ''}
            </p>

            {/* Dynamic Specification Badges from Sub-Category Schema */}
            {specEntries.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {specEntries.slice(0, 3).map(([key, val]) => {
                  const schemaField = sub?.metadataFields?.find(f => f.key === key)
                  const label = schemaField?.label || key
                  const unit = schemaField?.unit ? ` ${schemaField.unit}` : ''
                  return (
                    <span
                      key={key}
                      className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/80 rounded text-[10px] text-slate-600 font-medium"
                    >
                      <strong className="font-semibold text-slate-700">{label}:</strong> {String(val)}{unit}
                    </span>
                  )
                })}
                {specEntries.length > 3 && (
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-400">
                    +{specEntries.length - 3} more
                  </span>
                )}
              </div>
            )}
          </>
        )
      },
    },
    {
      id: 'taxonomy',
      header: 'Taxonomy',
      accessorFn: item => {
        const sub = subCategories.find(s => s.id === item.subCategoryId)
        return `${categories.find(c => c.id === sub?.categoryId)?.name || 'General'} ${sub?.name || 'Standard'}`
      },
      cell: ({ row: { original: item } }) => {
        const sub = subCategories.find(s => s.id === item.subCategoryId)
        const cat = categories.find(c => c.id === sub?.categoryId)
        return (
          <>
            <p className="font-semibold text-slate-800">{cat?.name || 'General'}</p>
            <p className="text-[11px] text-slate-400">{sub?.name || 'Standard'}</p>
          </>
        )
      },
    },
    {
      id: 'storageLocation',
      header: 'Storage Location',
      accessorFn: item => item.storageLocation || 'Central Warehouse',
      meta: { tdClassName: 'py-4 px-4 text-slate-600 font-medium' },
    },
    {
      id: 'stock',
      header: 'Stock Level',
      accessorFn: item => item.quantity,
      sortingFn: (a, b) =>
        stockRank(a.original) - stockRank(b.original) || a.original.quantity - b.original.quantity,
      cell: ({ row: { original: item } }) => {
        const rank = stockRank(item)
        return (
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                rank === 0
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : rank === 1
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {item.quantity} {item.unit || 'Units'}
            </span>
            <button
              onClick={() => {
                setAdjustItem(item)
                setAdjustQty(item.quantity)
              }}
              className="text-[10px] text-blue-600 hover:underline font-semibold"
            >
              Adjust
            </button>
          </div>
        )
      },
    },
    {
      id: 'unitPrice',
      header: 'Unit Price',
      accessorFn: item => item.unitPrice || undefined,
      sortUndefined: 'last',
      meta: { tdClassName: 'py-4 px-4 font-semibold text-slate-800' },
      cell: ({ row: { original: item } }) => (item.unitPrice ? `₹${item.unitPrice.toLocaleString('en-IN')}` : '—'),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { thClassName: 'py-3.5 px-6 text-right', tdClassName: 'py-4 px-6 text-right' },
      cell: ({ row: { original: item } }) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              vDeploy.reset()
              setDeployItem(item)
              setDeployCampusId(campuses[0]?.id || '')
              setDeployBuildingId('')
              setDeployRoomId('')
              setDeployUserId('')
            }}
            className="btn btn-soft btn-sm"
            title="Deploy this spare item as an active operational asset"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Deploy as Asset</span>
          </button>

          <Link
            href={`/inventory/${item.id}`}
            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition"
            title="View Spares Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>

          <Link
            href={`/inventory/create?edit=${item.id}`}
            className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition"
            title="Edit Spare Record"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={async () => {
              if (await confirmAction(`Are you sure you want to delete spare ${item.name} (${item.id})?`)) {
                deleteInventoryItem(item.id)
              }
            }}
            className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition"
            title="Delete Spare Item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Asset Management' },
        { label: 'Inventory Hub / Spares' },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Hub / Spares</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Standby equipment, buffer stock, and replacement spares catalog with sub-category metadata (No automatic PM/Inspections)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/inventory/create"
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Spare Asset</span>
            </Link>
          </div>
        </div>

        {/* Top KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{totalItemsCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Unique Spare Items</p>
              <span className="text-[11px] font-semibold text-blue-600">{totalUnits} total units in stock</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{lowStockCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Low Stock Warning</p>
              <span className="text-[11px] font-semibold text-amber-600">Below minimum buffer</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 font-bold">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{outOfStockCount}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Out of Stock</p>
              <span className="text-[11px] font-semibold text-rose-600">Replenishment required</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-none">
                ₹{totalStockValue.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Total Spares Value</p>
              <span className="text-[11px] font-semibold text-emerald-600">Assessed inventory value</span>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by INV ID, spare name, model, serial, rack..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="btn btn-ghost"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Expandable Filter Matrix */}
          {showFilters && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={e => {
                    setSelectedCategoryId(e.target.value)
                    setSelectedSubCategoryId('ALL')
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sub-Category</label>
                <select
                  value={selectedSubCategoryId}
                  onChange={e => setSelectedSubCategoryId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="ALL">All Sub-Categories</option>
                  {availableSubCategories.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stock Availability</label>
                <select
                  value={stockFilter}
                  onChange={e => setStockFilter(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="ALL">All Stock Levels</option>
                  <option value="IN_STOCK">Healthy Stock</option>
                  <option value="LOW_STOCK">Low Stock (≤ Threshold)</option>
                  <option value="OUT_OF_STOCK">Out of Stock (0)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Spares Inventory Master Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <DataTable
            tableId="inventory"
            data={filteredItems}
            columns={inventoryColumns}
            getRowId={item => item.id}
            resetKey={`${searchQuery}|${selectedCategoryId}|${selectedSubCategoryId}|${stockFilter}`}
            rowClassName="hover:bg-slate-50/60 transition group"
            emptyState={
              <div className="flex flex-col items-center justify-center space-y-2">
                <Package className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-xs font-semibold text-slate-600">No Spares in Inventory Hub</p>
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Register standby equipment, replacement parts, or emergency buffer assets without generating automatic maintenance schedules.
                </p>
                <Link
                  href="/inventory/create"
                  className="btn btn-primary btn-sm mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Spare</span>
                </Link>
              </div>
            }
          />
        </div>

        {/* Modal 1: Deploy Spare to Active Operational Asset */}
        {deployItem && (
            <Modal title="Deploy Spare as Active Asset" onClose={() => setDeployItem(null)} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-600">{deployItem.inventoryNumber}</span>
                    <h3 className="text-base font-bold text-slate-900">Deploy Spare as Active Asset</h3>
                    <p className="text-[11px] text-slate-500">Promote standby spare to an operational room (auto-schedules PM/Inspections)</p>
                  </div>
                </div>
                <button onClick={() => setDeployItem(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmDeploy} className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                  <p className="font-bold text-slate-900">{deployItem.name}</p>
                  <p className="text-slate-500">
                    Stock available: <strong className="text-slate-700">{deployItem.quantity} {deployItem.unit}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Campus *</label>
                    <select
                      {...vDeploy.props('campusId')}
                      value={deployCampusId}
                      onChange={e => {
                        setDeployCampusId(e.target.value)
                        setDeployBuildingId('')
                        setDeployRoomId('')
                      }}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 ${INVALID}`}
                    >
                      <option value="">Select Campus</option>
                      {campuses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {vDeploy.error('campusId')}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Building / Block *</label>
                    <select
                      {...vDeploy.props('buildingId')}
                      value={deployBuildingId}
                      onChange={e => {
                        setDeployBuildingId(e.target.value)
                        setDeployRoomId('')
                      }}
                      disabled={!deployCampusId}
                      className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 ${INVALID}`}
                    >
                      <option value="">Select Building</option>
                      {deployBuildings.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    {vDeploy.error('buildingId')}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Room / Area *</label>
                  <select
                    {...vDeploy.props('roomId')}
                    value={deployRoomId}
                    onChange={e => setDeployRoomId(e.target.value)}
                    disabled={!deployBuildingId}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 ${INVALID}`}
                  >
                    <option value="">Select Room</option>
                    {deployRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomNumber})
                      </option>
                    ))}
                  </select>
                  {vDeploy.error('roomId')}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Installation / In-Service Date *</label>
                  <input
                    type="date"
                    {...vDeploy.props('installDate')}
                    value={deployInstallDate}
                    onChange={e => setDeployInstallDate(e.target.value)}
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl ${INVALID}`}
                  />
                  {vDeploy.error('installDate')}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assign To User / Custodian (Optional)</label>
                  <select
                    value={deployUserId}
                    onChange={e => setDeployUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Unassigned (Facility Shared)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role} • {u.department || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeployItem(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Confirm & Deploy Asset
                  </button>
                </div>
              </form>
            </Modal>
        )}

        {/* Modal 2: Quick Adjust Stock */}
        {adjustItem && (
            <Modal title="Adjust Stock Quantity" onClose={() => setAdjustItem(null)} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Adjust Stock Quantity</h3>
                <button onClick={() => setAdjustItem(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStockAdjust} className="space-y-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{adjustItem.name}</p>
                  <p className="text-[11px] text-slate-400">{adjustItem.inventoryNumber} • {adjustItem.storageLocation}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Current Stock Quantity ({adjustItem.unit || 'Units'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adjustQty}
                    onChange={e => setAdjustQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-base text-slate-900"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAdjustItem(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Update Quantity
                  </button>
                </div>
              </form>
            </Modal>
        )}
      </div>
    </AppLayout>
  )
}
