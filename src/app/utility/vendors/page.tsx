'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  Truck,
  Phone,
  Mail,
  MapPin,
  User,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  X,
  Boxes,
  ExternalLink,
} from 'lucide-react'
import { Vendor } from '@/types/afms'
import Link from 'next/link'

export default function VendorsPage() {
  const { vendors, addVendor, updateVendor, deleteVendor, assets } = useAFMS()

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)

  // Form Fields (Vendor Name, Address, Support Email Id, Support Contact No., Support Person Details)
  const [vendorName, setVendorName] = useState('')
  const [address, setAddress] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [supportPhone, setSupportPhone] = useState('')
  const [supportPerson, setSupportPerson] = useState('')

  // Delete Confirmation Modal State
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)

  // Filtered Vendors
  const filteredVendors = vendors.filter(v => {
    const q = searchQuery.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.phone?.toLowerCase().includes(q) ||
      v.contactPerson?.toLowerCase().includes(q) ||
      v.address?.toLowerCase().includes(q)
    )
  })

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingVendor(null)
    setVendorName('')
    setAddress('')
    setSupportEmail('')
    setSupportPhone('')
    setSupportPerson('')
    setShowModal(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v)
    setVendorName(v.name)
    setAddress(v.address || '')
    setSupportEmail(v.email || '')
    setSupportPhone(v.phone || '')
    setSupportPerson(v.contactPerson || '')
    setShowModal(true)
  }

  // Submit Handler for Add / Edit
  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendorName.trim()) {
      alert('Vendor Name is required.')
      return
    }

    if (editingVendor) {
      updateVendor(editingVendor.id, {
        name: vendorName.trim(),
        address: address.trim(),
        email: supportEmail.trim(),
        phone: supportPhone.trim(),
        contactPerson: supportPerson.trim(),
        categorySupplied: editingVendor.categorySupplied || 'Vendor / Supplier',
        hasAmc: editingVendor.hasAmc || false,
      })
    } else {
      addVendor({
        name: vendorName.trim(),
        address: address.trim(),
        email: supportEmail.trim(),
        phone: supportPhone.trim(),
        contactPerson: supportPerson.trim(),
        categorySupplied: 'Vendor / Supplier',
        hasAmc: false,
      })
    }

    setShowModal(false)
  }

  // Check if vendor is linked to any asset
  const getLinkedAssets = (vendorId: string) => {
    return assets.filter(
      a => a.purchaseVendorId === vendorId || a.maintenanceVendorId === vendorId
    )
  }

  // Open Delete Confirmation
  const handleOpenDelete = (v: Vendor) => {
    setDeleteErrorMessage(null)
    setVendorToDelete(v)
  }

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!vendorToDelete) return
    const result = deleteVendor(vendorToDelete.id)
    if (!result.success) {
      setDeleteErrorMessage(result.message || 'Cannot delete vendor because it is linked to active assets.')
    } else {
      setVendorToDelete(null)
    }
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Utility' }, { label: 'Vendor List' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header with Title & Add Vendor CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vendor Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage suppliers, equipment manufacturers, and support contact personnel
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by vendor name, contact person, email, address or VND ID..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium ml-auto">
            Showing <strong className="text-slate-800">{filteredVendors.length}</strong> of {vendors.length} vendors
          </span>
        </div>

        {/* Vendors Grid */}
        {vendors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Vendors Onboarded Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your first vendor with contact information and support details to link with equipment purchases and maintenance.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Vendor</span>
            </button>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">No matching vendors found</p>
            <p className="text-[11px] text-slate-400">Try adjusting your search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVendors.map(v => {
              const linkedAssets = getLinkedAssets(v.id)
              const isLinked = linkedAssets.length > 0

              return (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Vendor ID, Name, Action Icons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              {v.id}
                            </span>
                            {isLinked && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {linkedAssets.length} Linked Asset{linkedAssets.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-900 mt-1">{v.name}</h3>
                        </div>
                      </div>

                      {/* Action Menu (Edit, Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit Vendor"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(v)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title={isLinked ? 'Cannot delete: linked to assets' : 'Delete Vendor'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Support Details List */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      {v.contactPerson && (
                        <p className="flex items-center gap-2.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800">{v.contactPerson}</span>
                        </p>
                      )}

                      {v.phone && (
                        <p className="flex items-center gap-2.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-700">{v.phone}</span>
                        </p>
                      )}

                      {v.email && (
                        <p className="flex items-center gap-2.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-700 break-all">{v.email}</span>
                        </p>
                      )}

                      {v.address && (
                        <p className="flex items-start gap-2.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-slate-500 line-clamp-2">{v.address}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Linked Assets Footer */}
                  {isLinked && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-slate-400" />
                        <span>Associated with inventory</span>
                      </span>
                      <Link
                        href={`/assets?search=${v.name}`}
                        className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal 1: Add / Edit Vendor Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingVendor ? `Edit Vendor (${editingVendor.id})` : 'Add New Vendor'}
                    </h3>
                    <p className="text-xs text-slate-500">Configure vendor contact and support personnel</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVendor} className="space-y-4 text-xs">
                {/* 1. Vendor Name */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vendor / Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    placeholder="e.g. Voltas Marine Climate Ltd, Daikin India"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* 2. Support Person Details */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Support Person Details <span className="text-slate-400 font-normal">(Name, Designation)</span>
                  </label>
                  <input
                    type="text"
                    value={supportPerson}
                    onChange={e => setSupportPerson(e.target.value)}
                    placeholder="e.g. Sanjay Deshmukh (Lead Account Engineer)"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* 3. Support Contact No & Support Email Id */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Support Contact No.</label>
                    <input
                      type="text"
                      value={supportPhone}
                      onChange={e => setSupportPhone(e.target.value)}
                      placeholder="e.g. +91 98201 11223"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Support Email ID</label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={e => setSupportEmail(e.target.value)}
                      placeholder="e.g. support@voltasmarine.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* 4. Address */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Office / workshop address, city, state, pin code..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  ></textarea>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    {editingVendor ? 'Update Vendor Profile' : 'Add Vendor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Delete Confirmation Modal */}
        {vendorToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">Delete Vendor Profile?</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to remove <strong className="text-slate-800">{vendorToDelete.name}</strong> ({vendorToDelete.id})?
                </p>
              </div>

              {deleteErrorMessage && (
                <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Deletion Blocked</span>
                  </p>
                  <p>{deleteErrorMessage}</p>
                </div>
              )}

              {getLinkedAssets(vendorToDelete.id).length > 0 && !deleteErrorMessage && (
                <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Active Asset Association</span>
                  </p>
                  <p>
                    This vendor is currently linked to {getLinkedAssets(vendorToDelete.id).length} registered asset(s). You must reassign or remove the vendor from those assets before deleting.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setVendorToDelete(null)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
