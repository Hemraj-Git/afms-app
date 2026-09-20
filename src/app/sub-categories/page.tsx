'use client'

import React, { useState } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { useDefaultSelection } from '@/lib/useDefaultSelection'
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Lock,
  PlusCircle,
  Clock,
  Check,
  ChevronRight,
  ArrowLeft,
  CheckSquare,
  ShieldCheck,
  Sparkles,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { SubCategory, MetadataFieldDef, ChecklistTemplate, ChecklistItemDef, SlaPriority } from '@/types/afms'
import { formatSubCategoryId } from '@/lib/idGenerator'

export default function SubCategoriesPage() {
  const {
    subCategories,
    categories,
    checklistTemplates,
    assets,
    addSubCategory,
    updateSubCategory,
    deleteSubCategory,
    addChecklistTemplate,
  } = useAFMS()

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingSub, setEditingSub] = useState<SubCategory | null>(null)

  // 5-Step Wizard State (1 to 5)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Step 1: Basic Information
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  useDefaultSelection(selectedCategoryId, setSelectedCategoryId, categories[0]?.id)
  const [subCategoryName, setSubCategoryName] = useState('')
  const [description, setDescription] = useState('')
  const [slaPriority, setSlaPriority] = useState<SlaPriority>('Medium')

  // Live auto-generated Sub-Category ID preview (e.g. ELEC-LIGH)
  const previewSubCategoryId = formatSubCategoryId(
    categories.find(c => c.id === selectedCategoryId)?.code || selectedCategoryId || 'GENR',
    subCategoryName || 'ITEM'
  )

  // Step 2: Dynamic Metadata Fields (Strictly Text, Number, Date)
  const [metadataFields, setMetadataFields] = useState<MetadataFieldDef[]>([
    { key: 'wattage_rating', label: 'Wattage Rating', type: 'Number', unit: 'W', required: true, order: 1 },
  ])

  // Step 3: Preventive Maintenance (PM) Templates (Multi-select)
  const [selectedPmTemplateIds, setSelectedPmTemplateIds] = useState<string[]>([])
  const [pmSearchQuery, setPmSearchQuery] = useState('')
  const [pmIntervalFilter, setPmIntervalFilter] = useState<string>('All')

  // Step 4: Inspection Templates (Multi-select)
  const [selectedInspTemplateIds, setSelectedInspTemplateIds] = useState<string[]>([])
  const [inspSearchQuery, setInspSearchQuery] = useState('')
  const [inspIntervalFilter, setInspIntervalFilter] = useState<string>('All')

  // Inline Template Creation Modal State (for both PM & Inspection)
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false)
  const [newTemplateType, setNewTemplateType] = useState<'Preventive Maintenance' | 'Inspection'>('Preventive Maintenance')
  const [newTemplateTitle, setNewTemplateTitle] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [newTemplateInterval, setNewTemplateInterval] = useState<NonNullable<ChecklistTemplate['interval']>>('Quarterly')
  const [newTemplateItems, setNewTemplateItems] = useState<ChecklistItemDef[]>([
    { id: 'item-1', order: 1, itemText: '', mandatory: true, photoRequired: false },
  ])

  // Available PM Templates
  const allPmTemplates = checklistTemplates.filter(t => t.type === 'Preventive Maintenance')
  const filteredPmTemplates = allPmTemplates.filter(t => {
    const matchesSearch =
      t.title.toLowerCase().includes(pmSearchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(pmSearchQuery.toLowerCase())
    const matchesInterval = pmIntervalFilter === 'All' || t.interval === pmIntervalFilter
    return matchesSearch && matchesInterval
  })

  // Available Inspection Templates
  const allInspTemplates = checklistTemplates.filter(t => t.type === 'Inspection')
  const filteredInspTemplates = allInspTemplates.filter(t => {
    const matchesSearch =
      t.title.toLowerCase().includes(inspSearchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(inspSearchQuery.toLowerCase())
    const matchesInterval = inspIntervalFilter === 'All' || t.interval === inspIntervalFilter
    return matchesSearch && matchesInterval
  })

  const openCreateModal = () => {
    setEditingSub(null)
    setCurrentStep(1)
    setSelectedCategoryId(categories[0]?.id || 'ELEC')
    setSubCategoryName('')
    setDescription('')
    setSlaPriority('Medium')
    setMetadataFields([
      { key: 'power_rating', label: 'Power Rating', type: 'Number', unit: 'kW', required: true, order: 1 },
    ])
    setSelectedPmTemplateIds([])
    setSelectedInspTemplateIds([])
    setShowModal(true)
  }

  const openEditModal = (sub: SubCategory) => {
    setEditingSub(sub)
    setCurrentStep(1)
    setSelectedCategoryId(sub.categoryId)
    setSubCategoryName(sub.name)
    setDescription(sub.description || '')
    setSlaPriority(sub.slaPriority || 'Medium')
    setMetadataFields(
      sub.metadataFields?.map(f => ({
        ...f,
        type: (f.type === 'Number' || f.type === 'Date') ? f.type : 'Text',
      })) || []
    )
    const initialPm = sub.pmTemplateIds && sub.pmTemplateIds.length > 0 ? sub.pmTemplateIds : (sub.pmTemplateId ? [sub.pmTemplateId] : [])
    const initialInsp = sub.inspectionTemplateIds && sub.inspectionTemplateIds.length > 0 ? sub.inspectionTemplateIds : (sub.inspectionTemplateId ? [sub.inspectionTemplateId] : [])
    setSelectedPmTemplateIds(Array.from(new Set(initialPm)))
    setSelectedInspTemplateIds(Array.from(new Set(initialInsp)))
    setShowModal(true)
  }

  // Metadata Field Operations
  const handleAddMetadataField = () => {
    const newFld: MetadataFieldDef = {
      key: `field_${Date.now()}`,
      label: '',
      type: 'Text',
      required: false,
      order: metadataFields.length + 1,
    }
    setMetadataFields([...metadataFields, newFld])
  }

  const handleRemoveMetadataField = (idx: number) => {
    setMetadataFields(metadataFields.filter((_, i) => i !== idx))
  }

  const handleUpdateMetadataField = (idx: number, updated: Partial<MetadataFieldDef>) => {
    setMetadataFields(metadataFields.map((f, i) => (i === idx ? { ...f, ...updated } : f)))
  }

  // Inline New Template Builder Handlers
  const handleOpenNewTemplate = (type: 'Preventive Maintenance' | 'Inspection') => {
    setNewTemplateType(type)
    setNewTemplateTitle('')
    setNewTemplateDescription('')
    setNewTemplateInterval('Quarterly')
    setNewTemplateItems([
      { id: `ci-${Date.now()}-1`, order: 1, itemText: '', mandatory: true, photoRequired: false },
    ])
    setShowNewTemplateModal(true)
  }

  const handleSaveInlineTemplate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplateTitle.trim()) {
      alert('Please enter a Template Title.')
      return
    }

    const cleanItems = newTemplateItems.map((it, i) => ({
      ...it,
      order: i + 1,
      itemText: it.itemText.trim() || `Task #${i + 1}`,
      responseType: newTemplateType === 'Preventive Maintenance' ? ('Checkbox' as const) : ('Pass-Fail' as const),
    }))

    const created = addChecklistTemplate({
      title: newTemplateTitle.trim(),
      type: newTemplateType,
      description: newTemplateDescription,
      interval: newTemplateInterval,
      items: cleanItems,
    })

    const targetId = created?.id || `tmpl-${Date.now()}`
    if (newTemplateType === 'Preventive Maintenance') {
      setSelectedPmTemplateIds(prev => Array.from(new Set([...prev, targetId])))
    } else {
      setSelectedInspTemplateIds(prev => Array.from(new Set([...prev, targetId])))
    }

    setShowNewTemplateModal(false)
  }

  // Step Validation
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!selectedCategoryId) {
        alert('Please select a Parent Category.')
        return false
      }
      if (!subCategoryName.trim()) {
        alert('Please enter a Sub-Category Name.')
        return false
      }
    }
    if (step === 2) {
      for (let i = 0; i < metadataFields.length; i++) {
        if (!metadataFields[i].label.trim()) {
          alert(`Please provide a label for Field #${i + 1} or remove it.`)
          return false
        }
      }
    }
    return true
  }

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) setCurrentStep((currentStep + 1) as any)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as any)
  }

  // Final Publish Handler
  const handleFinalPublish = async () => {
    const cleanFields = metadataFields.map((f, i) => ({
      ...f,
      key: f.key || `field_${f.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      label: f.label.trim(),
      order: i + 1,
    }))

    const uniquePmIds = Array.from(new Set(selectedPmTemplateIds.filter(Boolean)))
    const uniqueInspIds = Array.from(new Set(selectedInspTemplateIds.filter(Boolean)))

    if (editingSub) {
      updateSubCategory(editingSub.id, {
        categoryId: selectedCategoryId,
        name: subCategoryName.trim(),
        description: description.trim(),
        slaPriority,
        metadataFields: cleanFields,
        pmTemplateIds: uniquePmIds,
        pmTemplateId: uniquePmIds[0] || undefined,
        inspectionTemplateIds: uniqueInspIds,
        inspectionTemplateId: uniqueInspIds[0] || undefined,
      })
    } else {
      try {
        await addSubCategory({
          categoryId: selectedCategoryId,
          name: subCategoryName.trim(),
          description: description.trim(),
          slaPriority,
          metadataFields: cleanFields,
          pmTemplateIds: uniquePmIds,
          pmTemplateId: uniquePmIds[0] || undefined,
          inspectionTemplateIds: uniqueInspIds,
          inspectionTemplateId: uniqueInspIds[0] || undefined,
        })
      } catch {
        // Not saved (a toast already says why). Keep the form open so nothing typed is lost.
        return
      }
    }

    setShowModal(false)
  }

  const handleDelete = (sub: SubCategory) => {
    const linkedAssets = assets.filter(a => a.subCategoryId === sub.id)
    if (linkedAssets.length > 0) {
      alert(
        `Deletion Not Permitted: Sub-Category "${sub.name}" (${sub.code}) cannot be deleted because it has ${linkedAssets.length} active asset(s) linked to it. Please reassign or delete those assets first.`
      )
      return
    }

    if (confirm(`Are you sure you want to delete Sub-Category "${sub.name}" (${sub.code})?`)) {
      deleteSubCategory(sub.id)
    }
  }

  const filteredSubs = subCategories.filter(s => {
    const cat = categories.find(c => c.id === s.categoryId)
    return (
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const wizardSteps = [
    { number: 1, title: 'Basic Info' },
    { number: 2, title: 'Metadata (Fields)' },
    { number: 3, title: 'PM Templates' },
    { number: 4, title: 'Inspection Templates' },
    { number: 5, title: 'Review & Publish' },
  ]

  const selectedCategoryObj = categories.find(c => c.id === selectedCategoryId)

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Asset Management' }, { label: 'Sub-Categories' }]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sub-Categories Taxonomy</h1>
            <p className="text-xs text-slate-500 mt-0.5">Asset classification with automatic hierarchical IDs (e.g. ELEC-LIGH), custom metadata, and compliance templates</p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sub-Category</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ELEC-LIGH or sub-category..."
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Sub-Category Cards Grid */}
        {filteredSubs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Tags className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Sub-Categories Configured Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Use the 5-step wizard to configure sub-categories, custom metadata schemas, preventive maintenance checklists, and inspection templates.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Launch Sub-Category Wizard</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredSubs.map(sub => {
            const cat = categories.find(c => c.id === sub.categoryId)
            const linkedAssetsCount = assets.filter(a => a.subCategoryId === sub.id).length
            const pmCount = sub.pmTemplateIds?.length || (sub.pmTemplateId ? 1 : 0)
            const inspCount = sub.inspectionTemplateIds?.length || (sub.inspectionTemplateId ? 1 : 0)

            return (
              <div key={sub.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition group flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Tags className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                        title="Edit Sub-Category"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(sub)}
                        className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                        title="Delete Sub-Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {sub.code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {cat?.name || sub.categoryId}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 mt-1">{sub.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{sub.description || 'No description provided.'}</p>
                  </div>

                  {/* Metadata fields badges */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Metadata Fields ({sub.metadataFields?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {sub.metadataFields?.slice(0, 3).map(f => (
                        <span key={f.key} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {f.label} ({f.type})
                        </span>
                      ))}
                      {(sub.metadataFields?.length || 0) > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-400 font-semibold">
                          +{(sub.metadataFields?.length || 0) - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Template Counters */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded">
                      {pmCount} PM SOP(s)
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded">
                      {inspCount} Inspection(s)
                    </span>
                  </div>
                  <span className="font-bold text-slate-800">{linkedAssetsCount} Assets</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

        {/* 5-STEP SUB-CATEGORY WIZARD MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-6 space-y-6 max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingSub ? 'Edit Sub-Category' : 'Add Sub-Category Wizard'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Step {currentStep} of 5: {wizardSteps[currentStep - 1].title}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stepper Wizard Bar */}
              <div className="flex items-center justify-between px-2 shrink-0">
                {wizardSteps.map(st => {
                  const isDone = currentStep > st.number
                  const isCurrent = currentStep === st.number

                  return (
                    <div key={st.number} className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                          isCurrent
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                            : isDone
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : st.number}
                      </div>
                      <span className={`text-xs font-medium hidden sm:inline ${isCurrent ? 'font-bold text-slate-900' : 'text-slate-400'}`}>
                        {st.title}
                      </span>
                      {st.number < 5 && <div className="w-6 h-0.5 bg-slate-200 hidden md:block"></div>}
                    </div>
                  )
                })}
              </div>

              {/* Wizard Content Body */}
              <div className="flex-1 overflow-y-auto pr-1 text-xs space-y-5">
                {/* STEP 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 font-medium">Auto-generated Sub-Category ID:</span>
                        <p className="text-sm font-bold font-mono text-blue-700 mt-0.5">{previewSubCategoryId}</p>
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold bg-white px-2.5 py-1 rounded-md border border-blue-200">
                        Hierarchical Code
                      </span>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">1. Select Parent Category *</label>
                      <select
                        value={selectedCategoryId}
                        onChange={e => setSelectedCategoryId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500/20"
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code || c.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">2. Sub-Category Name *</label>
                        <input
                          type="text"
                          required
                          value={subCategoryName}
                          onChange={e => setSubCategoryName(e.target.value)}
                          placeholder="e.g. Ceiling Light, Split AC"
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">3. SLA Priority Level *</label>
                        <select
                          value={slaPriority}
                          onChange={e => setSlaPriority(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="Critical">Critical (e.g. 4 Hours)</option>
                          <option value="High">High (e.g. 12 Hours)</option>
                          <option value="Medium">Medium (e.g. 24 Hours)</option>
                          <option value="Low">Low (e.g. 48 Hours)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">4. Scope / Description</label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Define operational scope, applicable asset types, and technical specs..."
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                      ></textarea>
                    </div>
                  </div>
                )}

                {/* STEP 2: Metadata Configuration (Strictly Text, Number, Date) */}
                {currentStep === 2 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Custom Dynamic Metadata Specifications</h4>
                        <p className="text-slate-500 text-[11px]">Configure custom technical parameters for assets under this subcategory (Number, Text, Date).</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddMetadataField}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-semibold transition"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Add Field</span>
                      </button>
                    </div>

                    {metadataFields.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Layers className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                        <p className="font-semibold text-slate-700">No custom metadata fields configured</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">Click "Add Field" above to add specs like Wattage, Screen Size, or Refrigerant Gas.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {metadataFields.map((field, idx) => (
                          <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="grid grid-cols-12 gap-3 items-center">
                              <div className="col-span-5">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Field Label *</label>
                                <input
                                  type="text"
                                  required
                                  value={field.label}
                                  onChange={e => handleUpdateMetadataField(idx, { label: e.target.value })}
                                  placeholder="e.g. Wattage, Compressor Type"
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                />
                              </div>

                              <div className="col-span-3">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Type *</label>
                                <select
                                  value={field.type}
                                  onChange={e => handleUpdateMetadataField(idx, { type: e.target.value as any })}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                >
                                  <option value="Number">Number</option>
                                  <option value="Text">Text</option>
                                  <option value="Date">Date</option>
                                </select>
                              </div>

                              <div className="col-span-3">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Unit (Optional)</label>
                                <input
                                  type="text"
                                  value={field.unit || ''}
                                  onChange={e => handleUpdateMetadataField(idx, { unit: e.target.value })}
                                  placeholder="e.g. kW, TR, inches"
                                  disabled={field.type !== 'Number'}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </div>

                              <div className="col-span-1 flex justify-end pt-4">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMetadataField(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                  title="Remove field"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={e => handleUpdateMetadataField(idx, { required: e.target.checked })}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>Mandatory asset specification field</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: Preventive Maintenance Templates Selection (Multi-select + Inline Add) */}
                {currentStep === 3 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Select Preventive Maintenance (PM) Templates</h4>
                        <p className="text-slate-500 text-[11px]">Select multiple recurring SOP templates (e.g. Monthly & Annually).</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenNewTemplate('Preventive Maintenance')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New PM Template</span>
                      </button>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-8 relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={pmSearchQuery}
                          onChange={e => setPmSearchQuery(e.target.value)}
                          placeholder="Search PM templates..."
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <select
                          value={pmIntervalFilter}
                          onChange={e => setPmIntervalFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          <option value="All">All Intervals</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Half-Yearly">Half-Yearly</option>
                          <option value="Annually">Annually</option>
                        </select>
                      </div>
                    </div>

                    {/* Template Selection List */}
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {filteredPmTemplates.length === 0 ? (
                        <p className="text-center py-6 text-slate-400 italic">No PM templates matching filter.</p>
                      ) : (
                        filteredPmTemplates.map(tmpl => {
                          const isSelected = selectedPmTemplateIds.includes(tmpl.id)
                          return (
                            <div
                              key={tmpl.id}
                              onClick={() => {
                                setSelectedPmTemplateIds(prev =>
                                  isSelected ? prev.filter(id => id !== tmpl.id) : [...prev, tmpl.id]
                                )
                              }}
                              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900">{tmpl.title}</p>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{tmpl.interval || 'Quarterly'}</span>
                                  </span>
                                </div>
                                <p className="text-slate-500 text-[11px] mt-0.5">{tmpl.description || `${tmpl.items.length} SOP check tasks`}</p>
                              </div>

                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 4: Inspection Templates Selection (Multi-select + Inline Add) */}
                {currentStep === 4 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Select Statutory Inspection Templates</h4>
                        <p className="text-slate-500 text-[11px]">Select Pass/Fail compliance checklists for this subcategory.</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenNewTemplate('Inspection')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Inspection Template</span>
                      </button>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-8 relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={inspSearchQuery}
                          onChange={e => setInspSearchQuery(e.target.value)}
                          placeholder="Search Inspection templates..."
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <select
                          value={inspIntervalFilter}
                          onChange={e => setInspIntervalFilter(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        >
                          <option value="All">All Intervals</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Half-Yearly">Half-Yearly</option>
                          <option value="Annually">Annually</option>
                        </select>
                      </div>
                    </div>

                    {/* Template Selection List */}
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {filteredInspTemplates.length === 0 ? (
                        <p className="text-center py-6 text-slate-400 italic">No inspection templates matching filter.</p>
                      ) : (
                        filteredInspTemplates.map(tmpl => {
                          const isSelected = selectedInspTemplateIds.includes(tmpl.id)
                          return (
                            <div
                              key={tmpl.id}
                              onClick={() => {
                                setSelectedInspTemplateIds(prev =>
                                  isSelected ? prev.filter(id => id !== tmpl.id) : [...prev, tmpl.id]
                                )
                              }}
                              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900">{tmpl.title}</p>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{tmpl.interval || 'Quarterly'}</span>
                                  </span>
                                </div>
                                <p className="text-slate-500 text-[11px] mt-0.5">{tmpl.description || `${tmpl.items.length} Pass/Fail checkpoints`}</p>
                              </div>

                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 5: Review & Confirmation */}
                {currentStep === 5 && (
                  <div className="space-y-4 animate-in fade-in">
                    <h4 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">Review & Publish Sub-Category</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <p className="font-bold text-slate-900 text-xs">General Information</p>
                        <p><span className="text-slate-500">Parent Category:</span> <strong>{selectedCategoryObj?.name} ({selectedCategoryObj?.code || selectedCategoryObj?.id})</strong></p>
                        <p><span className="text-slate-500">Sub-Category Name:</span> <strong>{subCategoryName}</strong></p>
                        <p><span className="text-slate-500">Generated Sub ID:</span> <span className="font-mono font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">{previewSubCategoryId}</span></p>
                        <p><span className="text-slate-500">SLA Priority:</span> <span className="font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{slaPriority}</span></p>
                        <p><span className="text-slate-500">Description:</span> {description || 'N/A'}</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <p className="font-bold text-slate-900 text-xs">Dynamic Metadata Fields ({metadataFields.length})</p>
                        <ul className="list-disc list-inside space-y-1 text-slate-700">
                          {metadataFields.map(f => (
                            <li key={f.key}>
                              <strong>{f.label}</strong> — <span className="font-mono text-[11px] text-slate-500">{f.type}{f.unit ? ` (${f.unit})` : ''}</span> {f.required && <span className="text-rose-600 font-bold">*Required</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                        <p className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span>Attached PM SOPs ({selectedPmTemplateIds.length})</span>
                        </p>
                        <div className="space-y-1">
                          {selectedPmTemplateIds.length === 0 ? (
                            <p className="text-slate-400 italic">No PM SOP templates selected</p>
                          ) : (
                            selectedPmTemplateIds.map(id => {
                              const tmpl = checklistTemplates.find(t => t.id === id)
                              return (
                                <p key={id} className="text-slate-700 font-medium">
                                  • {tmpl?.title || id} <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.5 rounded">({tmpl?.interval})</span>
                                </p>
                              )
                            })
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-2">
                        <p className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Attached Inspections ({selectedInspTemplateIds.length})</span>
                        </p>
                        <div className="space-y-1">
                          {selectedInspTemplateIds.length === 0 ? (
                            <p className="text-slate-400 italic">No Inspection templates selected</p>
                          ) : (
                            selectedInspTemplateIds.map(id => {
                              const tmpl = checklistTemplates.find(t => t.id === id)
                              return (
                                <p key={id} className="text-slate-700 font-medium">
                                  • {tmpl?.title || id} <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">({tmpl?.interval})</span>
                                </p>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Footer Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStep === 1}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>

                  {currentStep < 5 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinalPublish}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/25 transition"
                    >
                      {editingSub ? 'Update Sub-Category' : `Publish Sub-Category (${previewSubCategoryId})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INLINE NEW TEMPLATE CREATION MODAL */}
        {showNewTemplateModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Create New {newTemplateType === 'Preventive Maintenance' ? 'PM SOP' : 'Inspection'} Template
                  </h3>
                  <p className="text-xs text-slate-500">Will be saved and auto-selected for this subcategory</p>
                </div>
                <button onClick={() => setShowNewTemplateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveInlineTemplate} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Template Title *</label>
                  <input
                    type="text"
                    required
                    value={newTemplateTitle}
                    onChange={e => setNewTemplateTitle(e.target.value)}
                    placeholder={`e.g. ${subCategoryName || 'Asset'} — ${newTemplateInterval} Checklist`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Interval / Frequency *</label>
                    <select
                      value={newTemplateInterval}
                      onChange={e => setNewTemplateInterval(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Standard Response</label>
                    <input
                      type="text"
                      disabled
                      value={newTemplateType === 'Preventive Maintenance' ? 'Checkbox (Checked/Not)' : 'Pass / Fail'}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={newTemplateDescription}
                    onChange={e => setNewTemplateDescription(e.target.value)}
                    placeholder="Provide SOP scope details..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                {/* Checklist Task items */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-800">Tasks ({newTemplateItems.length})</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewTemplateItems([
                          ...newTemplateItems,
                          { id: `ci-${Date.now()}`, order: newTemplateItems.length + 1, itemText: '', mandatory: true, photoRequired: false },
                        ])
                      }}
                      className="text-blue-600 font-semibold flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Task</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {newTemplateItems.map((it, idx) => (
                      <div key={it.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                        <span className="font-mono font-bold text-[10px] text-slate-400">#{idx + 1}</span>
                        <input
                          type="text"
                          required
                          value={it.itemText}
                          onChange={e => {
                            const val = e.target.value
                            setNewTemplateItems(newTemplateItems.map((item, i) => (i === idx ? { ...item, itemText: val } : item)))
                          }}
                          placeholder="Task description..."
                          className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        {newTemplateItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewTemplateItems(newTemplateItems.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewTemplateModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    Save & Select
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
