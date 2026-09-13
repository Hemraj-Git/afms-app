'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  CheckSquare,
  ShieldCheck,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  PlusCircle,
  Clock,
  Camera,
  Check,
} from 'lucide-react'
import { ChecklistTemplate, ChecklistItemDef } from '@/types/afms'

export default function InspectionTemplatesPage() {
  const {
    checklistTemplates,
    subCategories,
    assets,
    addChecklistTemplate,
    updateChecklistTemplate,
    deleteChecklistTemplate,
  } = useAFMS()

  const inspTemplates = checklistTemplates.filter(t => t.type === 'Inspection')

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTmpl, setEditingTmpl] = useState<ChecklistTemplate | null>(null)

  // Form fields (No version, no status, strictly Pass/Fail responseType, configurable interval)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [interval, setInterval] = useState<NonNullable<ChecklistTemplate['interval']>>('Quarterly')
  const [items, setItems] = useState<ChecklistItemDef[]>([
    {
      id: 'ci-1',
      order: 1,
      itemText: 'Visual physical integrity and mounting security check',
      responseType: 'Pass-Fail',
      mandatory: true,
      photoRequired: false,
    },
  ])

  const openCreateModal = () => {
    setEditingTmpl(null)
    setTitle('')
    setDescription('')
    setInterval('Quarterly')
    setItems([
      {
        id: `ci-${Date.now()}-1`,
        order: 1,
        itemText: 'Visual physical integrity and mounting check',
        responseType: 'Pass-Fail',
        mandatory: true,
        photoRequired: false,
      },
    ])
    setShowModal(true)
  }

  const openEditModal = (tmpl: ChecklistTemplate) => {
    setEditingTmpl(tmpl)
    setTitle(tmpl.title)
    setDescription(tmpl.description || '')
    setInterval(tmpl.interval || 'Quarterly')
    setItems(
      (tmpl.items || []).map(it => ({
        ...it,
        responseType: 'Pass-Fail',
      }))
    )
    setShowModal(true)
  }

  const handleAddItem = () => {
    const newItem: ChecklistItemDef = {
      id: `ci-${Date.now()}`,
      order: items.length + 1,
      itemText: '',
      responseType: 'Pass-Fail',
      mandatory: true,
      photoRequired: false,
    }
    setItems([...items, newItem])
  }

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const handleUpdateItem = (idx: number, updated: Partial<ChecklistItemDef>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...updated } : it)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      alert('Please enter a Template Title.')
      return
    }

    if (items.length === 0) {
      alert('Please add at least one inspection checkpoint.')
      return
    }

    const cleanItems = items.map((it, i) => ({
      ...it,
      order: i + 1,
      itemText: it.itemText.trim() || `Inspection Checkpoint #${i + 1}`,
      responseType: 'Pass-Fail' as const,
    }))

    if (editingTmpl) {
      updateChecklistTemplate(editingTmpl.id, {
        title,
        description,
        interval,
        items: cleanItems,
      })
    } else {
      addChecklistTemplate({
        title,
        type: 'Inspection',
        description,
        interval,
        items: cleanItems,
      })
    }
    setShowModal(false)
  }

  // Deletion Protection: Check if linked to any SubCategory or active Assets
  const handleDelete = (id: string, name: string) => {
    const linkedSubCategories = subCategories.filter(
      s => s.inspectionTemplateId === id || (s.inspectionTemplateIds && s.inspectionTemplateIds.includes(id))
    )
    const linkedAssets = assets.filter(a => {
      const sub = subCategories.find(s => s.id === a.subCategoryId)
      return Boolean(sub && (sub.inspectionTemplateId === id || (sub.inspectionTemplateIds && sub.inspectionTemplateIds.includes(id))))
    })

    if (linkedSubCategories.length > 0 || linkedAssets.length > 0) {
      const subNames = linkedSubCategories.map(s => s.name).join(', ')
      alert(
        `Deletion Not Permitted: Template "${name}" (${id}) cannot be deleted because it is currently linked to ${linkedSubCategories.length} Sub-Category(s) (${subNames}) and used by ${linkedAssets.length} active asset(s). Please unlink it first.`
      )
      return
    }

    if (confirm(`Are you sure you want to delete inspection template "${name}"?`)) {
      deleteChecklistTemplate(id)
    }
  }

  const filtered = inspTemplates.filter(
    t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Utility' }, { label: 'Inspection Templates' }]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inspection Checklist Templates</h1>
            <p className="text-xs text-slate-500 mt-0.5">Quality &amp; compliance inspection checklists with Pass/Fail standards, recurring intervals, and photo evidence requirements</p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Inspection Template</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Templates Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Inspection Templates Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Define statutory and quality compliance inspection templates with Pass/Fail checkpoints and recurring intervals.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Inspection Template</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(tmpl => {
            const linkedSubCount = subCategories.filter(s => s.inspectionTemplateId === tmpl.id).length

            return (
              <div key={tmpl.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4 hover:border-slate-300 transition group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900">{tmpl.title}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{tmpl.description || 'No description provided.'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{tmpl.interval || 'Quarterly'}</span>
                    </span>
                    <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition ml-1">
                      <button
                        onClick={() => openEditModal(tmpl)}
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                        title="Edit Template"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tmpl.id, tmpl.title)}
                        className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Inspection Checkpoints ({tmpl.items?.length || 0})
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {tmpl.items?.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                            Pass/Fail
                          </span>
                          <span className="font-medium text-slate-800">{item.itemText}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.mandatory && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
                              Mandatory
                            </span>
                          )}
                          {item.photoRequired && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 flex items-center gap-0.5">
                              <Camera className="w-2.5 h-2.5" />
                              Photo
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {linkedSubCount > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Used by <strong>{linkedSubCount}</strong> sub-category taxonomy link(s)</span>
                    <span className="text-emerald-600 font-semibold">Active in Inspections</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingTmpl ? 'Edit Inspection Template' : 'Create Inspection Template'}
                  </h3>
                  <p className="text-xs text-slate-500">Define Pass/Fail checkpoints, inspection intervals, and photo evidence requirements</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Template Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Split AC — Statutory Safety & Electrical Inspection"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Interval / Frequency *</label>
                    <select
                      value={interval}
                      onChange={e => setInterval(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Response Type Standard</label>
                    <input
                      type="text"
                      disabled
                      value="Pass / Fail"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Provide statutory standards or inspection scope notes..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                {/* Items Builder */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-800">Inspection Checkpoints ({items.length})</label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Checkpoint</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[11px] text-slate-500 shrink-0">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            required
                            value={item.itemText}
                            onChange={e => handleUpdateItem(idx, { itemText: e.target.value })}
                            placeholder="e.g. Ensure emergency shutoff switch and isolation breaker operate freely"
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                            className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-4 pt-1 text-slate-600">
                          <span className="text-[11px] text-slate-400">Response: <strong>Pass / Fail</strong></span>

                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium">
                              <input
                                type="checkbox"
                                checked={item.mandatory}
                                onChange={e => handleUpdateItem(idx, { mandatory: e.target.checked })}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span>Mandatory Check</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium">
                              <input
                                type="checkbox"
                                checked={item.photoRequired}
                                onChange={e => handleUpdateItem(idx, { photoRequired: e.target.checked })}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span>Photo Evidence Required</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    {editingTmpl ? 'Save Changes' : 'Create Inspection Template'}
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
