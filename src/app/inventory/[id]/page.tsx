'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  Package,
  ArrowLeft,
  Pencil,
  Trash2,
  ArrowUpRight,
  Boxes,
  Building,
  Calendar,
  DollarSign,
  Truck,
  Layers,
  SlidersHorizontal,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react'

export default function InventoryItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string

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
    documents,
    users,
  } = useAFMS()

  // Find item by ID
  const item = inventoryItems.find(i => i.id === itemId || i.inventoryNumber === itemId)

  // Deploy Modal State
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [deployCampusId, setDeployCampusId] = useState(campuses[0]?.id || '')
  const [deployBuildingId, setDeployBuildingId] = useState('')
  const [deployRoomId, setDeployRoomId] = useState('')
  const [deployInstallDate, setDeployInstallDate] = useState(new Date().toISOString().split('T')[0])
  const [deployUserId, setDeployUserId] = useState('')

  // Quick Adjust Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustQty, setAdjustQty] = useState<number>(item?.quantity || 1)

  if (!item) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Inventory Hub / Spares', href: '/inventory' }, { label: 'Item Not Found' }]}>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Spare Item Not Found</h2>
          <p className="text-xs text-slate-500">The requested inventory item could not be found or has been deleted.</p>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Inventory Hub</span>
          </Link>
        </div>
      </AppLayout>
    )
  }

  const sub = subCategories.find(s => s.id === item.subCategoryId)
  const cat = categories.find(c => c.id === sub?.categoryId)
  const vendor = vendors.find(v => v.id === item.purchaseVendorId)
  const room = rooms.find(r => r.id === item.roomId)

  const deployBuildings = buildings.filter(b => b.campusId === deployCampusId)
  const deployRooms = rooms.filter(r => r.buildingId === deployBuildingId)

  const minThresh = item.minStockThreshold || 2
  const isOutOfStock = item.quantity === 0
  const isLowStock = item.quantity > 0 && item.quantity <= minThresh

  const handleConfirmDeploy = (e: React.FormEvent) => {
    e.preventDefault()
    if (!deployRoomId) {
      alert('Please select a target Room / Area for deployment.')
      return
    }

    const created = convertInventoryToAsset(
      item.id,
      deployRoomId,
      deployInstallDate,
      deployUserId || undefined
    )
    if (created) {
      setShowDeployModal(false)
      setDeployUserId('')
      router.push(`/assets/${created.id}`)
    }
  }

  const handleSaveStockAdjust = (e: React.FormEvent) => {
    e.preventDefault()
    updateInventoryItem(item.id, { quantity: Math.max(0, adjustQty) })
    setShowAdjustModal(false)
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Inventory Hub / Spares', href: '/inventory' },
        { label: `${item.inventoryNumber || item.id} - ${item.name}` },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/inventory" className="text-slate-400 hover:text-slate-600 transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {item.inventoryNumber || item.id} - {item.name}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1 pl-7">
              {cat?.name || 'General'} • {sub?.name || 'Sub-Category'} • Added on {item.createdAt}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowDeployModal(true)
                setDeployCampusId(campuses[0]?.id || '')
                setDeployBuildingId('')
                setDeployRoomId('')
                setDeployUserId('')
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Deploy as Active Asset</span>
            </button>

            <Link
              href={`/inventory/create?edit=${item.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </Link>

            <button
              onClick={() => {
                if (confirm(`Are you sure you want to delete spare ${item.name} (${item.id})?`)) {
                  deleteInventoryItem(item.id)
                  router.push('/inventory')
                }
              }}
              className="p-2 border border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition"
              title="Delete Spare Record"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top 3 KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <p className="text-xs font-medium text-slate-500">Stock Availability</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">
                {item.quantity} <span className="text-sm font-normal text-slate-500">{item.unit || 'Units'}</span>
              </h3>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  isOutOfStock
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : isLowStock
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
              </span>
            </div>
            <button
              onClick={() => {
                setAdjustQty(item.quantity)
                setShowAdjustModal(true)
              }}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              Adjust Quantity
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <p className="text-xs font-medium text-slate-500">Storage Location</p>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{item.storageLocation}</h3>
            </div>
            <p className="text-xs text-slate-400">
              {room ? `Linked Room: ${room.name} (${room.roomNumber})` : 'Central Warehouse Depot'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <p className="text-xs font-medium text-slate-500">Total Assessed Stock Value</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">
                ₹{((item.unitPrice || 0) * item.quantity).toLocaleString('en-IN')}
              </h3>
              <span className="text-xs font-medium text-slate-500">
                ₹{(item.unitPrice || 0).toLocaleString('en-IN')} / {item.unit || 'unit'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Min. buffer threshold: {minThresh} {item.unit || 'units'}</p>
          </div>
        </div>

        {/* Master Details Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Basic Information & Dynamic Sub-Category Specifications */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Spec Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Spare Equipment Specifications</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400 text-[11px]">Spare Asset Name</p>
                  <p className="font-bold text-slate-900 mt-0.5">{item.name}</p>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400 text-[11px]">Inventory Tracking Number</p>
                  <p className="font-mono font-bold text-blue-600 mt-0.5">{item.inventoryNumber || item.id}</p>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400 text-[11px]">Manufacturer</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{item.manufacturer || 'Not Specified'}</p>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400 text-[11px]">Model Number</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{item.modelNumber || 'Not Specified'}</p>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400 text-[11px]">Serial Number</p>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">{item.serialNumber || 'Not Logged'}</p>
                </div>

                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <p className="text-slate-400 text-[11px]">Category / Sub-Category</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{cat?.name} / {sub?.name}</p>
                </div>
              </div>
            </div>

            {/* Custom Metadata Specifications Inherited from Sub-Category Schema */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-purple-600" />
                  <span>Sub-Category Custom Specifications ({sub?.name || 'Category Schema'})</span>
                </h3>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {Object.keys(item.dynamicSpecifications || {}).length} Fields
                </span>
              </div>

              {!item.dynamicSpecifications || Object.keys(item.dynamicSpecifications).length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                  No custom specification metadata logged for this spare item.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {Object.entries(item.dynamicSpecifications).map(([key, val]) => {
                    const schemaField = sub?.metadataFields?.find(f => f.key === key)
                    const label = schemaField?.label || key
                    const unitStr = schemaField?.unit ? ` ${schemaField.unit}` : ''

                    return (
                      <div key={key} className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</p>
                        <p className="font-bold text-slate-900 text-sm">{String(val)}{unitStr}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Image Preview & Handling Notes */}
            {item.imageUrl && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Equipment Photo</h3>
                <div className="w-full max-w-sm h-48 rounded-xl overflow-hidden border border-slate-200">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Attached Compliance & Purchase Documents */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Attached Compliance &amp; Purchase Documents</span>
                </h3>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {documents.filter(d => d.linkedAssetIds?.includes(item.id) || d.linkedAssetIds?.includes(item.inventoryNumber)).length} Documents
                </span>
              </div>

              {documents.filter(d => d.linkedAssetIds?.includes(item.id) || d.linkedAssetIds?.includes(item.inventoryNumber)).length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                  No documents linked to this spare item.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents
                    .filter(d => d.linkedAssetIds?.includes(item.id) || d.linkedAssetIds?.includes(item.inventoryNumber))
                    .map(doc => (
                      <div
                        key={doc.id}
                        className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{doc.title}</p>
                            <p className="text-[11px] text-slate-400">{doc.id} • {doc.fileType} • {doc.fileSizeKb} KB</p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Active Document
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Handling & Storage Notes */}
            {item.notes && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Storage &amp; Handling Notes</h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {item.notes}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Procurement, Vendor & Quick Actions */}
          <div className="space-y-6">
            {/* Procurement & Vendor Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Supplier &amp; Purchase Info</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Supplier Vendor:</span>
                  <span className="font-semibold text-slate-800">{vendor?.name || 'General Supply'}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Vendor Contact:</span>
                  <span className="font-semibold text-slate-800">{vendor?.contactPerson || 'N/A'}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Purchase Date:</span>
                  <span className="font-semibold text-slate-800">{item.purchaseDate || 'N/A'}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Warranty Expiry:</span>
                  <span className="font-semibold text-slate-800">{item.warrantyTill || 'No Warranty'}</span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Unit Price:</span>
                  <span className="font-bold text-slate-900">{item.unitPrice ? `₹${item.unitPrice.toLocaleString('en-IN')}` : '—'}</span>
                </div>
              </div>
            </div>

            {/* Deploy Quick Banner Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <ArrowUpRight className="w-4 h-4" />
                <span>Need to Put This Spare in Service?</span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                Deploying this spare promotes it into an active operational asset with automatic quality compliance preventive schedules and routine inspections.
              </p>
              <button
                onClick={() => {
                  setShowDeployModal(true)
                  setDeployCampusId(campuses[0]?.id || '')
                  setDeployBuildingId('')
                  setDeployRoomId('')
                  setDeployUserId('')
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                Deploy into a Room
              </button>
            </div>
          </div>
        </div>

        {/* Modal 1: Deploy Spare to Active Operational Asset */}
        {showDeployModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-600">{item.inventoryNumber}</span>
                    <h3 className="text-base font-bold text-slate-900">Deploy Spare as Active Asset</h3>
                    <p className="text-[11px] text-slate-500">Promote standby spare to an operational room (auto-schedules PM/Inspections)</p>
                  </div>
                </div>
                <button onClick={() => setShowDeployModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmDeploy} className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-slate-500">
                    Stock available: <strong className="text-slate-700">{item.quantity} {item.unit}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Campus *</label>
                    <select
                      value={deployCampusId}
                      onChange={e => {
                        setDeployCampusId(e.target.value)
                        setDeployBuildingId('')
                        setDeployRoomId('')
                      }}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Campus</option>
                      {campuses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Building / Block *</label>
                    <select
                      value={deployBuildingId}
                      onChange={e => {
                        setDeployBuildingId(e.target.value)
                        setDeployRoomId('')
                      }}
                      required
                      disabled={!deployCampusId}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                    >
                      <option value="">Select Building</option>
                      {deployBuildings.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Room / Area *</label>
                  <select
                    value={deployRoomId}
                    onChange={e => setDeployRoomId(e.target.value)}
                    required
                    disabled={!deployBuildingId}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    <option value="">Select Room</option>
                    {deployRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Installation / In-Service Date *</label>
                  <input
                    type="date"
                    required
                    value={deployInstallDate}
                    onChange={e => setDeployInstallDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
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
                    onClick={() => setShowDeployModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    Confirm & Deploy Asset
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Quick Adjust Stock */}
        {showAdjustModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Adjust Stock Quantity</h3>
                <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStockAdjust} className="space-y-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <p className="text-[11px] text-slate-400">{item.inventoryNumber} • {item.storageLocation}</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Current Stock Quantity ({item.unit || 'Units'})
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
                    onClick={() => setShowAdjustModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    Update Quantity
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
