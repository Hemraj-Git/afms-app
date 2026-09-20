'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { useDefaultSelection } from '@/lib/useDefaultSelection'
import {
  Layers,
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { Building } from '@/types/afms'

export default function BuildingPage() {
  const { buildings, campuses, rooms, addBuilding, updateBuilding, deleteBuilding } = useAFMS()
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingBld, setEditingBld] = useState<Building | null>(null)

  // Form fields
  const [campusId, setCampusId] = useState(campuses[0]?.id || '')
  useDefaultSelection(campusId, setCampusId, campuses[0]?.id)
  const [name, setName] = useState('')
  const [totalFloors, setTotalFloors] = useState('3')

  const openCreateModal = () => {
    setEditingBld(null)
    setCampusId(campuses[0]?.id || '')
    setName('')
    setTotalFloors('3')
    setShowModal(true)
  }

  const openEditModal = (b: Building) => {
    setEditingBld(b)
    setCampusId(b.campusId)
    setName(b.name)
    setTotalFloors(String(b.totalFloors))
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingBld) {
      updateBuilding(editingBld.id, {
        campusId,
        name,
        totalFloors: parseInt(totalFloors) || 1,
      })
    } else {
      try {
        await addBuilding({
          campusId,
          name,
          totalFloors: parseInt(totalFloors) || 1,
        })
      } catch {
        // Not saved (a toast already says why). Keep the form open so nothing typed is lost.
        return
      }
    }
    setShowModal(false)
  }

  const handleDelete = (id: string, bldName: string) => {
    const linkedRooms = rooms.filter(r => r.buildingId === id)
    if (linkedRooms.length > 0) {
      alert(
        `Deletion Not Permitted: Building "${bldName}" (${id}) cannot be deleted because it contains ${linkedRooms.length} room(s)/area(s) (${linkedRooms.map(r => r.name).join(', ')}). Please delete or reassign those rooms first.`
      )
      return
    }

    if (confirm(`Are you sure you want to delete building "${bldName}" (${id})?`)) {
      deleteBuilding(id)
    }
  }

  const filteredBuildings = buildings.filter(b => {
    const campus = campuses.find(c => c.id === b.campusId)
    return (
      (b.code && b.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campus?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Organization' }, { label: 'Building/Block' }]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Buildings & Blocks</h1>
            <p className="text-xs text-slate-500 mt-0.5">Academic wings, simulator blocks, and workshops with Building IDs (BLD-####)</p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Building/Block</span>
          </button>
        </div>

        {/* Filter */}
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search BLD-#### or building name..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Building Cards */}
        {filteredBuildings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Buildings Configured Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create buildings and blocks under your campuses to structure floors and map facility rooms.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Building</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredBuildings.map(b => {
            const campus = campuses.find(c => c.id === b.campusId)
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition group">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                      onClick={() => openEditModal(b)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                      title="Edit Building"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(b.id, b.name)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                      title="Delete Building"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded">
                    {b.code || b.id}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 mt-1">{b.name}</h3>
                  <p className="text-xs font-semibold text-slate-500">{b.totalFloors} Floors</p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{campus?.name || 'Main Campus'} ({campus?.code || campus?.id})</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingBld ? 'Edit Building' : 'Add New Building'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingBld ? `ID: ${editingBld.id}` : 'System will automatically assign next BLD-#### ID'}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parent Campus *</label>
                  <select
                    value={campusId}
                    onChange={e => setCampusId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    {campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code || c.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Building Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Simulator Block"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Floors</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={totalFloors}
                    onChange={e => setTotalFloors(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    {editingBld ? 'Save Changes' : 'Create Building'}
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
