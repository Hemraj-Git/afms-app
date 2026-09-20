'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { PageSkeleton } from '@/components/ui/Skeleton'
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Eye,
  History,
  X,
  RotateCcw,
  Building2,
  Layers,
  FolderTree,
  Tags,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Sparkles,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import { Asset } from '@/types/afms'
import { BulkAssetUploadModal } from '@/components/assets/BulkAssetUploadModal'
import { downloadAssetExcelTemplate } from '@/utils/assetExcelUtils'

export default function AssetsListPage() {
  const {
    assets,
    categories,
    subCategories,
    campuses,
    buildings,
    rooms,
    vendors,
    assetActivityLogs,
  } = useAFMS()

  // Search Query
  const [searchQuery, setSearchQuery] = useState('')
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All')
  const [selectedCampus, setSelectedCampus] = useState<string>('All')
  const [selectedBuilding, setSelectedBuilding] = useState<string>('All')
  const [selectedRoom, setSelectedRoom] = useState<string>('All')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')
  const [selectedMaintenanceBy, setSelectedMaintenanceBy] = useState<string>('All')
  
  // Show / Hide filter panel
  const [showFilters, setShowFilters] = useState(false)
  const [selectedAssetForModal, setSelectedAssetForModal] = useState<Asset | null>(null)

  // Derived filtered SubCategories based on selected Category
  const availableSubCategories = useMemo(() => {
    if (selectedCategory === 'All') return subCategories
    return subCategories.filter(s => s.categoryId === selectedCategory)
  }, [subCategories, selectedCategory])

  // Derived filtered Buildings based on selected Campus
  const availableBuildings = useMemo(() => {
    if (selectedCampus === 'All') return buildings
    return buildings.filter(b => b.campusId === selectedCampus)
  }, [buildings, selectedCampus])

  // Derived filtered Rooms based on selected Building
  const availableRooms = useMemo(() => {
    if (selectedBuilding === 'All') {
      if (selectedCampus === 'All') return rooms
      const bldgIds = buildings.filter(b => b.campusId === selectedCampus).map(b => b.id)
      return rooms.filter(r => bldgIds.includes(r.buildingId))
    }
    return rooms.filter(r => r.buildingId === selectedBuilding)
  }, [rooms, buildings, selectedCampus, selectedBuilding])

  // Cascading Handlers
  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId)
    setSelectedSubCategory('All')
  }

  const handleCampusChange = (campusId: string) => {
    setSelectedCampus(campusId)
    setSelectedBuilding('All')
    setSelectedRoom('All')
  }

  const handleBuildingChange = (bldgId: string) => {
    setSelectedBuilding(bldgId)
    setSelectedRoom('All')
  }

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCategory('All')
    setSelectedSubCategory('All')
    setSelectedCampus('All')
    setSelectedBuilding('All')
    setSelectedRoom('All')
    setSelectedStatus('All')
    setSelectedMaintenanceBy('All')
    setSearchQuery('')
  }

  // Active filter count
  const activeFilterCount = [
    selectedCategory !== 'All',
    selectedSubCategory !== 'All',
    selectedCampus !== 'All',
    selectedBuilding !== 'All',
    selectedRoom !== 'All',
    selectedStatus !== 'All',
    selectedMaintenanceBy !== 'All',
  ].filter(Boolean).length

  // Filtered Assets List
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // 1. Text Search (ID, name, manufacturer, model, serial)
      const q = searchQuery.toLowerCase().trim()
      if (q) {
        const matchesId = asset.id?.toLowerCase().includes(q) || asset.assetId?.toLowerCase().includes(q)
        const matchesName = asset.name?.toLowerCase().includes(q)
        const matchesMaker = asset.manufacturer?.toLowerCase().includes(q)
        const matchesModel = asset.modelNumber?.toLowerCase().includes(q)
        const matchesSerial = asset.serialNumber?.toLowerCase().includes(q)
        if (!matchesId && !matchesName && !matchesMaker && !matchesModel && !matchesSerial) {
          return false
        }
      }

      // 2. Category Filter
      if (selectedCategory !== 'All') {
        const sub = subCategories.find(s => s.id === asset.subCategoryId)
        if (sub?.categoryId !== selectedCategory) return false
      }

      // 3. Sub-Category Filter
      if (selectedSubCategory !== 'All' && asset.subCategoryId !== selectedSubCategory) {
        return false
      }

      // 4. Status Filter
      if (selectedStatus !== 'All' && asset.status !== selectedStatus) {
        return false
      }

      // 5. Maintenance By Filter
      if (selectedMaintenanceBy !== 'All' && asset.maintenanceBy !== selectedMaintenanceBy) {
        return false
      }

      // 6. Location Filter (Campus, Building, Room)
      const assetRoom = rooms.find(r => r.id === asset.roomId)
      const assetBuilding = buildings.find(b => b.id === assetRoom?.buildingId)

      if (selectedRoom !== 'All' && asset.roomId !== selectedRoom) {
        return false
      }
      if (selectedBuilding !== 'All' && assetBuilding?.id !== selectedBuilding) {
        return false
      }
      if (selectedCampus !== 'All' && assetBuilding?.campusId !== selectedCampus) {
        return false
      }

      return true
    })
  }, [
    assets,
    searchQuery,
    selectedCategory,
    selectedSubCategory,
    selectedStatus,
    selectedMaintenanceBy,
    selectedRoom,
    selectedBuilding,
    selectedCampus,
    subCategories,
    rooms,
    buildings,
  ])

  const getStatusPill = (status: Asset['status']) => {
    switch (status) {
      case 'Operational':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Operational
          </span>
        )
      case 'Under Maintenance':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Under Maintenance
          </span>
        )
      case 'In Storage':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            In Storage
          </span>
        )
      case 'Retired':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Retired
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        )
    }
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Asset Management' }, { label: 'Assets' }]} loadingFallback={<PageSkeleton tiles={0} rows={10} cols={6} />}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Physical Assets Directory</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage maritime equipment, QR tags, dynamic specifications, and maintenance lifecycles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                downloadAssetExcelTemplate({
                  categories,
                  subCategories,
                  campuses,
                  buildings,
                  rooms,
                  vendors,
                })
              }
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition active:scale-[0.98] cursor-pointer"
              title="Download formatted Excel template (.xlsx) with master reference data"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Download Template</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkUploadOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Bulk Upload</span>
            </button>

            <Link
              href="/assets/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Asset</span>
            </Link>
          </div>
        </div>

        {/* Filter & Search Card Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Asset ID, name, manufacturer, model, serial no..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Filter Toggle & Quick Status */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-100 transition"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Expandable Multi-Criteria Filter Matrix */}
          {showFilters && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in fade-in">
              {/* Filter 1: Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code || c.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 2: Sub-Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Sub-Category
                </label>
                <select
                  value={selectedSubCategory}
                  onChange={e => setSelectedSubCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="All">All Sub-Categories</option>
                  {availableSubCategories.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || s.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 3: Operational Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="All">All Statuses</option>
                  <option value="Operational">Operational</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="In Storage">In Storage</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>

              {/* Filter 4: Maintenance Provider */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Maintenance By
                </label>
                <select
                  value={selectedMaintenanceBy}
                  onChange={e => setSelectedMaintenanceBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="All">All Providers</option>
                  <option value="In House">In House</option>
                  <option value="Vendor">Vendor / AMC</option>
                </select>
              </div>

              {/* Filter 5: Campus */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Campus
                </label>
                <select
                  value={selectedCampus}
                  onChange={e => handleCampusChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="All">All Campuses</option>
                  {campuses.map(cp => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 6: Building */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Building / Block
                </label>
                <select
                  value={selectedBuilding}
                  onChange={e => handleBuildingChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="All">All Buildings</option>
                  {availableBuildings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code || b.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 7: Room / Area */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Room / Area
                </label>
                <select
                  value={selectedRoom}
                  onChange={e => setSelectedRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="All">All Rooms</option>
                  {availableRooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.roomNumber || r.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 8: Reset Button Tile */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition text-center"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Assets Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Registered Assets ({filteredAssets.length} of {assets.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                  <th className="py-3.5 px-6">Asset Item</th>
                  <th className="py-3.5 px-4">Sub-Category</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Manufacturer / Model</th>
                  <th className="py-3.5 px-4">Maintenance</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Boxes className="w-8 h-8 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">No matching assets found</p>
                        <p className="text-[11px] text-slate-400">
                          {activeFilterCount > 0 || searchQuery
                            ? 'Try modifying your filter parameters or search terms.'
                            : 'Click "Add New Asset" to onboard your first facility asset.'}
                        </p>
                        {(activeFilterCount > 0 || searchQuery) && (
                          <button
                            onClick={handleResetFilters}
                            className="mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100 transition"
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map(asset => {
                    const sub = subCategories.find(s => s.id === asset.subCategoryId)
                    const room = rooms.find(r => r.id === asset.roomId)
                    const building = buildings.find(b => b.id === room?.buildingId)

                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/60 transition group cursor-pointer">
                        <td className="py-4 px-6">
                          <Link href={`/assets/${asset.assetId || asset.id}`} className="flex items-center gap-3">
                            <img
                              src={asset.imageUrl || '/images/asset-placeholder.png'}
                              alt={asset.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                            />
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">{asset.name}</p>
                              <p className="text-[11px] font-mono text-blue-600 font-semibold">{asset.assetId || asset.id}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-slate-700 font-medium">
                          {sub?.name || 'Standard'}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-slate-800">{room?.name || 'General'}</p>
                          <p className="text-[11px] text-slate-400">{building?.name || 'Building'} • Room {room?.roomNumber || room?.id}</p>
                        </td>
                        <td className="py-4 px-4 text-slate-700">
                          <p className="font-medium text-slate-900">{asset.manufacturer || '—'}</p>
                          {asset.modelNumber && (
                            <p className="text-[11px] text-slate-400 font-mono">{asset.modelNumber}</p>
                          )}
                        </td>
                        <td className="py-4 px-4 text-slate-600 font-medium">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            asset.maintenanceBy === 'Vendor' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {asset.maintenanceBy || 'In House'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusPill(asset.status)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Link
                            href={`/assets/${asset.assetId || asset.id}`}
                            className="p-1.5 px-3 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BulkAssetUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
      />
    </AppLayout>
  )
}
