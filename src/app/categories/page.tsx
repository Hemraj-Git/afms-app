'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
} from 'lucide-react'
import { Category } from '@/types/afms'
import { formatCategoryId } from '@/lib/idGenerator'

export default function CategoriesPage() {
  const { categories, subCategories, assets, addCategory, updateCategory, deleteCategory } = useAFMS()
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // Form fields (No status)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const previewCategoryId = formatCategoryId(name || 'CATEGORY')

  const openCreateModal = () => {
    setEditingCategory(null)
    setName('')
    setDescription('')
    setShowModal(true)
  }

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat)
    setName(cat.name)
    setDescription(cat.description || '')
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Please enter a Category Name.')
      return
    }

    if (editingCategory) {
      updateCategory(editingCategory.id, {
        name: name.trim(),
        description: description.trim(),
      })
    } else {
      addCategory({
        name: name.trim(),
        description: description.trim(),
      })
    }
    setShowModal(false)
  }

  const handleDelete = (cat: Category) => {
    const subs = subCategories.filter(s => s.categoryId === cat.id)
    if (subs.length > 0) {
      alert(`Deletion not permitted: Category "${cat.name}" (${cat.id}) has ${subs.length} linked Sub-Categories (${subs.map(s => s.name).join(', ')}). Please delete or reassign those subcategories first.`)
      return
    }
    if (confirm(`Are you sure you want to delete category "${cat.name}" (${cat.id})?`)) {
      deleteCategory(cat.id)
    }
  }

  const filteredCategories = categories.filter(
    c =>
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Asset Management' }, { label: 'Categories' }]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Asset Categories</h1>
            <p className="text-xs text-slate-500 mt-0.5">Top-level asset taxonomy with automatic 4-letter Category IDs (e.g. ELEC, HVAC, MECH)</p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ELEC, MECH or category name..."
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Category Cards (Clean card design without redundant status or immutable labels) */}
        {filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <FolderTree className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Asset Categories Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Define your top-level taxonomy groups (e.g. Electrical, HVAC, Mechanical, Marine Equipment) to categorize your assets.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Category</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredCategories.map(c => {
              const count = subCategories.filter(s => s.categoryId === c.id).length

              return (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3 hover:border-slate-300 transition group flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <FolderTree className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                          title="Edit Category"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {c.id}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 mt-2">{c.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{c.description || 'No description provided.'}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-medium text-slate-500">Sub-Categories</span>
                    <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{count} linked</span>
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
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCategory ? `ID: ${editingCategory.id}` : `Auto-assigned 4-Letter ID: ${previewCategoryId}`}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Electrical, HVAC, Marine"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {!editingCategory && (
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Generated Category Code:</span>
                    <span className="font-mono font-bold text-purple-700">{previewCategoryId}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Scope of equipment classified under this category..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    {editingCategory ? 'Save Changes' : `Create Category (${previewCategoryId})`}
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
