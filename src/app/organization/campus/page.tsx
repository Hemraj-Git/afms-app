'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { Campus } from '@/types/afms'

export default function CampusPage() {
  const { campuses, buildings, addCampus, updateCampus, deleteCampus } = useAFMS()
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const openCreateModal = () => {
    setEditingCampus(null)
    setName('')
    setAddress('')
    setShowModal(true)
  }

  const openEditModal = (c: Campus) => {
    setEditingCampus(c)
    setName(c.name)
    setAddress(c.address)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingCampus) {
      updateCampus(editingCampus.id, {
        name,
        address,
      })
    } else {
      try {
        await addCampus({
          name,
          address,
        })
      } catch {
        // Not saved (a toast already says why). Keep the form open so nothing typed is lost.
        return
      }
    }
    setShowModal(false)
  }

  const handleDelete = (id: string, campusName: string) => {
    const linkedBuildings = buildings.filter(b => b.campusId === id)
    if (linkedBuildings.length > 0) {
      alert(
        `Deletion Not Permitted: Campus "${campusName}" (${id}) cannot be deleted because it contains ${linkedBuildings.length} building(s) (${linkedBuildings.map(b => b.name).join(', ')}). Please delete or reassign those buildings first.`
      )
      return
    }

    if (confirm(`Are you sure you want to delete campus "${campusName}" (${id})?`)) {
      deleteCampus(id)
    }
  }

  const filteredCampuses = campuses.filter(
    c =>
      (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Organization' }, { label: 'Campus' }]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campuses</h1>
            <p className="text-xs text-slate-500 mt-0.5">Maritime training facilities with standardized Campus IDs (CAM-####)</p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Campus</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search CAM-#### or campus name..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Campus Grid */}
        {filteredCampuses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Campuses Configured Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add campus locations to establish your organizational topology and manage buildings, rooms, and facilities.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Campus</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredCampuses.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition group">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => openEditModal(c)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                    title="Edit Campus"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                    title="Delete Campus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  {c.code || c.id}
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-1">{c.name}</h3>
                <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                  <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                  <span>{c.address}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

        {/* Add / Edit Campus Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingCampus ? 'Edit Campus' : 'Add New Campus'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCampus ? `ID: ${editingCampus.id}` : 'System will automatically assign next CAM-#### ID'}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Campus Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Mumbai Maritime Academy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Physical Address *</label>
                  <textarea
                    rows={2}
                    required
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Plot / Harbor location, City, State..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    {editingCampus ? 'Save Changes' : 'Create Campus'}
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
