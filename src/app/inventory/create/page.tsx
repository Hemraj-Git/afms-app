'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  Package,
  Plus,
  ArrowLeft,
  Check,
  Building,
  DollarSign,
  FileText,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Truck,
  Trash2,
  X,
  Boxes,
  UploadCloud,
  Search,
  Filter,
  Image as ImageIcon,
} from 'lucide-react'
import { formatId, getNextSequence } from '@/lib/idGenerator'
import { InventoryItem, DocumentItem } from '@/types/afms'

export default function AddInventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Loading Inventory Wizard...</div>}>
      <AddInventoryForm />
    </Suspense>
  )
}

function AddInventoryForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const docFileInputRef = useRef<HTMLInputElement | null>(null)

  const {
    inventoryItems,
    addInventoryItem,
    updateInventoryItem,
    categories,
    subCategories,
    rooms,
    vendors,
    addVendor,
    documents,
    addDocument,
    updateDocument,
    currentUser,
  } = useAFMS()

  const isEditMode = Boolean(editId)
  const existingItem = editId ? inventoryItems.find(i => i.id === editId || i.inventoryNumber === editId) : undefined

  const [currentStep, setCurrentStep] = useState(1)

  // Step 1 Form States: Item & Stock & Image
  // Starts empty and is computed once `inventoryItems` has actually loaded
  // (below) -- a useState initializer here would run before that fetch
  // resolves and always see an empty array, showing "INV-0001" for every
  // new spare regardless of how many already exist. Also uses
  // inventoryNumber (the real formatted id), not the raw UUID `id`.
  const [inventoryId, setInventoryId] = useState('')

  useEffect(() => {
    if (isEditMode) return
    setInventoryId(formatId('INV', getNextSequence(inventoryItems.map(i => i.inventoryNumber || i.id), 'INV')))
  }, [inventoryItems, isEditMode])
  const [name, setName] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [modelNumber, setModelNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [unit, setUnit] = useState('Units')
  const [minStockThreshold, setMinStockThreshold] = useState<number>(2)
  const [unitPrice, setUnitPrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [warrantyTill, setWarrantyTill] = useState('')
  const [purchasedFromId, setPurchasedFromId] = useState('')
  const [storageLocation, setStorageLocation] = useState('Main Warehouse - Bay 1')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [notes, setNotes] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  // Step 2: Custom Sub-Category Specification Metadata
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({})

  // Step 3: Document Attachments
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState<string>('All')
  const [showDocModal, setShowDocModal] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocType, setNewDocType] = useState<DocumentItem['fileType']>('Invoice')
  const [newDocFileName, setNewDocFileName] = useState('')

  // Inline Quick Vendor Modal State
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [newVendorName, setNewVendorName] = useState('')
  const [newVendorContact, setNewVendorContact] = useState('')
  const [newVendorEmail, setNewVendorEmail] = useState('')
  const [newVendorPhone, setNewVendorPhone] = useState('')
  const [newVendorAddress, setNewVendorAddress] = useState('')

  // Derived sub-categories
  const availableSubCategories = subCategories.filter(s => s.categoryId === selectedCategoryId)
  const activeSubCategory = subCategories.find(s => s.id === selectedSubCategoryId)
  const activeCategory = categories.find(c => c.id === selectedCategoryId)

  // Load existing item details for edit mode
  useEffect(() => {
    if (!existingItem) return

    setInventoryId(existingItem.inventoryNumber || existingItem.id)
    setName(existingItem.name || '')
    
    const sub = subCategories.find(s => s.id === existingItem.subCategoryId)
    if (sub) {
      setSelectedCategoryId(sub.categoryId)
      setSelectedSubCategoryId(sub.id)
    }

    setManufacturer(existingItem.manufacturer || '')
    setModelNumber(existingItem.modelNumber || '')
    setSerialNumber(existingItem.serialNumber || '')
    setQuantity(existingItem.quantity || 1)
    setUnit(existingItem.unit || 'Units')
    setMinStockThreshold(existingItem.minStockThreshold || 2)
    setUnitPrice(existingItem.unitPrice ? String(existingItem.unitPrice) : '')
    setPurchaseDate(existingItem.purchaseDate || '')
    setWarrantyTill(existingItem.warrantyTill || '')
    setPurchasedFromId(existingItem.purchaseVendorId || '')
    setStorageLocation(existingItem.storageLocation || 'Main Warehouse - Bay 1')
    setSelectedRoomId(existingItem.roomId || '')
    setNotes(existingItem.notes || '')
    setImageUrl(existingItem.imageUrl || '')

    if (existingItem.dynamicSpecifications) {
      setDynamicValues(existingItem.dynamicSpecifications)
    }

    // Find linked documents
    const linked = documents.filter(
      d => d.linkedAssetIds?.includes(existingItem.id) || d.linkedAssetIds?.includes(existingItem.inventoryNumber)
    )
    setSelectedDocIds(linked.map(d => d.id))
  }, [existingItem, subCategories, documents])

  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId)
    setSelectedSubCategoryId('')
    setDynamicValues({})
  }

  const handleSubCategoryChange = (subId: string) => {
    setSelectedSubCategoryId(subId)
    setDynamicValues({})
  }

  const handleDynamicChange = (key: string, value: any) => {
    setDynamicValues(prev => ({ ...prev, [key]: value }))
  }

  // Handle Photo / Image Upload (Base64)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImageUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle Quick Add Vendor
  const handleSaveNewVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVendorName.trim()) {
      alert('Vendor Name is required.')
      return
    }

    const createdVendor = await addVendor({
      name: newVendorName.trim(),
      categorySupplied: activeCategory?.name || 'General Spares',
      contactPerson: newVendorContact,
      email: newVendorEmail,
      phone: newVendorPhone,
      address: newVendorAddress,
      hasAmc: false,
    })

    setPurchasedFromId(createdVendor.id)
    setShowVendorModal(false)
  }

  // Handle In-Wizard Document Upload & Auto-link
  const handleSaveNewDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDocTitle.trim()) {
      alert('Please provide a document title.')
      return
    }

    const newDoc = await addDocument({
      title: newDocTitle.trim(),
      fileType: newDocType,
      fileUrl: '/mock-documents/spec-sheet.pdf',
      fileSizeKb: Math.floor(Math.random() * 800) + 120,
      uploadedBy: currentUser.fullName,
      linkedAssetIds: [inventoryId],
    })

    setSelectedDocIds(prev => [...prev, newDoc.id])
    setShowDocModal(false)
    setNewDocTitle('')
    setNewDocFileName('')
  }

  // Filtered documents list in Step 3
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.title.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
      doc.id.toLowerCase().includes(docSearchQuery.toLowerCase())
    const matchesType = docTypeFilter === 'All' || doc.fileType === docTypeFilter
    return matchesSearch && matchesType
  })

  // Step Validation
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!name.trim()) {
        alert('Please enter Spare / Item Name.')
        return false
      }
      if (!selectedCategoryId) {
        alert('Please select a Category.')
        return false
      }
      if (!selectedSubCategoryId) {
        alert('Please select a Sub-Category.')
        return false
      }
      if (quantity < 0) {
        alert('Quantity cannot be negative.')
        return false
      }
      if (!storageLocation.trim()) {
        alert('Please enter a Storage Location / Warehouse Rack.')
        return false
      }
    }
    return true
  }

  const steps = [
    { number: 1, title: 'Item & Stock' },
    { number: 2, title: 'Custom Specifications' },
    { number: 3, title: 'Documents & Attachments' },
    { number: 4, title: 'Review & Confirm' },
  ]

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleFinalSubmit = async () => {
    if (isEditMode && existingItem) {
      await updateInventoryItem(existingItem.id, {
        name,
        subCategoryId: selectedSubCategoryId,
        manufacturer,
        modelNumber,
        serialNumber: serialNumber || undefined,
        quantity: Math.max(0, quantity),
        unit,
        minStockThreshold: minStockThreshold || 2,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
        purchaseDate,
        warrantyTill,
        purchaseVendorId: purchasedFromId || undefined,
        storageLocation,
        roomId: selectedRoomId || undefined,
        dynamicSpecifications: dynamicValues,
        imageUrl: imageUrl || undefined,
        notes: notes || undefined,
      })

      // Update document links — actually persisted via updateDocument now,
      // rather than the old bare `doc.linkedAssetIds = [...]` mutation
      // which never reached the database and vanished on reload.
      await Promise.all(documents.map(doc => {
        const isLinkedNow = selectedDocIds.includes(doc.id)
        const hasId = doc.linkedAssetIds?.includes(existingItem.id) || doc.linkedAssetIds?.includes(existingItem.inventoryNumber)

        if (isLinkedNow && !hasId) {
          return updateDocument(doc.id, { inventoryItemId: existingItem.id })
        } else if (!isLinkedNow && hasId) {
          return updateDocument(doc.id, { inventoryItemId: null })
        }
        return Promise.resolve()
      }))

      router.push(`/inventory/${existingItem.id}`)
    } else {
      const createdItem = await addInventoryItem({
        name,
        subCategoryId: selectedSubCategoryId,
        manufacturer,
        modelNumber,
        serialNumber: serialNumber || undefined,
        quantity: Math.max(0, quantity),
        unit,
        minStockThreshold: minStockThreshold || 2,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
        purchaseDate,
        warrantyTill,
        purchaseVendorId: purchasedFromId || undefined,
        storageLocation,
        roomId: selectedRoomId || undefined,
        dynamicSpecifications: dynamicValues,
        imageUrl: imageUrl || undefined,
        notes: notes || undefined,
      })

      // Link selected documents to this newly created spare
      if (selectedDocIds.length > 0) {
        await Promise.all(selectedDocIds.map(docId => updateDocument(docId, { inventoryItemId: createdItem.id })))
      }

      router.push('/inventory')
    }
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Inventory Hub / Spares', href: '/inventory' },
        { label: isEditMode ? `Edit ${inventoryId}` : 'Add Spare Asset' },
      ]}
    >
      <div className="space-y-8 max-w-4xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isEditMode ? `Edit Spare: ${name || inventoryId}` : 'Add Spare Asset to Inventory'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Standby equipment & replacement spares catalog with custom sub-category specifications and document attachments
            </p>
          </div>

          <button
            onClick={() => router.push('/inventory')}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Inventory Hub</span>
          </button>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="relative flex items-center justify-between max-w-2xl mx-auto px-4">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0"></div>
          {steps.map(step => {
            const isCompleted = currentStep > step.number
            const isCurrent = currentStep === step.number

            return (
              <div key={step.number} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : isCompleted
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.number}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>

        {/* Step Container Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 sm:p-8 space-y-6">
          {/* STEP 1: ITEM & STOCK DETAILS */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 1: Item &amp; Stock Information</h2>
                  <p className="text-xs text-slate-500">Define spare taxonomy, model details, storage location, and procurement</p>
                </div>
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200">
                  {inventoryId}
                </span>
              </div>

              {/* Taxonomy Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub-Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedSubCategoryId}
                    onChange={e => handleSubCategoryChange(e.target.value)}
                    required
                    disabled={!selectedCategoryId}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    <option value="">Select Sub-Category</option>
                    {availableSubCategories.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Item Name & Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Spare Asset / Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Spare Inverter Compressor 2.0 TR, Replacement Circuit Board"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    placeholder="e.g. Daikin, Mitsubishi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model Number</label>
                  <input
                    type="text"
                    value={modelNumber}
                    onChange={e => setModelNumber(e.target.value)}
                    placeholder="e.g. FTKF50TV16U"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number (Optional)</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="e.g. SN-8839201"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Stock Quantity, Unit, & Min Buffer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Stock Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measurement</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="Units">Units</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Sets">Sets</option>
                    <option value="Meters">Meters</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Liters">Liters</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min. Buffer Alert Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={minStockThreshold}
                    onChange={e => setMinStockThreshold(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              </div>

              {/* Storage Location & Room Link (Existing location structure preserved) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Storage Location / Rack <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storageLocation}
                    onChange={e => setStorageLocation(e.target.value)}
                    placeholder="e.g. Central Warehouse A, Rack-B04, Shelf 2"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Storeroom / Facility Room (Optional)</label>
                  <select
                    value={selectedRoomId}
                    onChange={e => setSelectedRoomId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="">No specific room linked (Warehouse)</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Procurement & Vendor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (₹ INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={unitPrice}
                    onChange={e => setUnitPrice(e.target.value)}
                    placeholder="e.g. 18500"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Expiry Date</label>
                  <input
                    type="date"
                    value={warrantyTill}
                    onChange={e => setWarrantyTill(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              </div>

              {/* Vendor Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Supplied By Vendor</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewVendorName('')
                      setNewVendorContact('')
                      setNewVendorEmail('')
                      setNewVendorPhone('')
                      setNewVendorAddress('')
                      setShowVendorModal(true)
                    }}
                    className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add New Vendor</span>
                  </button>
                </div>
                <select
                  value={purchasedFromId}
                  onChange={e => setPurchasedFromId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                >
                  <option value="">Select Vendor (Optional)</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code || v.id}) {v.contactPerson ? `• ${v.contactPerson}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo / Image Upload (Matching Asset Wizard) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Spare Equipment Photo (Optional)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {imageUrl ? (
                  <div className="relative w-full max-w-xs h-40 rounded-2xl border border-slate-200 overflow-hidden group">
                    <img src={imageUrl} alt="Spare Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600 text-white shadow-md hover:bg-rose-700 transition"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition group"
                  >
                    <UploadCloud className="w-8 h-8 mx-auto text-slate-400 group-hover:text-blue-600 transition mb-2" />
                    <p className="text-xs font-semibold text-slate-700">Click to upload spare image</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Storage &amp; Handling Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Keep in anti-static packaging. Emergency replacement spare for Simulator Room 101."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                ></textarea>
              </div>
            </div>
          )}

          {/* STEP 2: DYNAMIC CUSTOM SPECIFICATIONS FROM SUB-CATEGORY */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 2: Custom Specifications</h2>
                  <p className="text-xs text-slate-500">
                    Dynamic specification fields configured for{' '}
                    <strong className="text-blue-600">{activeSubCategory?.name || 'Selected Sub-Category'}</strong>
                  </p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-semibold">
                  {activeSubCategory?.metadataFields?.length || 0} Custom Fields
                </span>
              </div>

              {!selectedSubCategoryId ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  Please select a Sub-Category in Step 1 to load custom specification fields.
                </div>
              ) : !activeSubCategory?.metadataFields || activeSubCategory.metadataFields.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                  <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto stroke-1" />
                  <p className="text-xs font-semibold text-slate-700">No Custom Metadata Fields</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    This sub-category does not have any custom metadata specification fields defined. You can proceed to the next step.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeSubCategory.metadataFields.map(field => {
                    const val = dynamicValues[field.key] ?? ''

                    return (
                      <div key={field.key} className="space-y-1 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                        <label className="block text-xs font-semibold text-slate-800">
                          {field.label} {field.unit ? `(${field.unit})` : ''}
                        </label>

                        {field.type === 'Number' ? (
                          <input
                            type="number"
                            value={val}
                            onChange={e => handleDynamicChange(field.key, e.target.value)}
                            placeholder={`Enter ${field.label}...`}
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        ) : field.type === 'Date' ? (
                          <input
                            type="date"
                            value={val}
                            onChange={e => handleDynamicChange(field.key, e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={e => handleDynamicChange(field.key, e.target.value)}
                            placeholder={`Enter ${field.label}...`}
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: DOCUMENT ATTACHMENTS (Matching Asset Wizard Step 4) */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 3: Attach Related Documents</h2>
                  <p className="text-xs text-slate-500">Link purchase invoices, warranty cards, or manuals from the Document Library.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDocModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Document</span>
                </button>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={docSearchQuery}
                    onChange={e => setDocSearchQuery(e.target.value)}
                    placeholder="Search documents by title or DOC-YYYY-#### ID..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={docTypeFilter}
                    onChange={e => setDocTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white"
                  >
                    <option value="All">All Document Types</option>
                    <option value="Invoice">Invoice</option>
                    <option value="Warranty">Warranty</option>
                    <option value="AMC Contract">AMC Contract</option>
                    <option value="User Guide">User Guide / Manual</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Documents Selectable List */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {filteredDocuments.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <p className="text-xs font-semibold text-slate-700">No matching documents found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Add New Document&quot; above to upload an invoice or warranty card.</p>
                  </div>
                ) : (
                  filteredDocuments.map(doc => {
                    const isSelected = selectedDocIds.includes(doc.id)
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDocIds(prev =>
                            isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                          )
                        }}
                        className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{doc.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                {doc.id}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                Type: {doc.fileType}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {doc.fileSizeKb} KB
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {selectedDocIds.length > 0 && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                  <span className="text-blue-800 font-semibold">
                    {selectedDocIds.length} document(s) attached to this spare
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds([])}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-900">Step 4: Review &amp; Confirm</h2>
                <p className="text-xs text-slate-500">Verify spare item details before saving to Inventory Hub</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                  <p className="font-bold text-slate-900 text-sm">{name || 'Unnamed Spare'}</p>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Inventory ID:</span>
                    <span className="font-mono font-bold text-blue-600">{inventoryId}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Category / Sub-Category:</span>
                    <span className="font-semibold text-slate-800">{activeCategory?.name} / {activeSubCategory?.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Manufacturer &amp; Model:</span>
                    <span className="font-semibold text-slate-800">{manufacturer || '—'} {modelNumber ? `(${modelNumber})` : ''}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Serial Number:</span>
                    <span className="font-mono text-slate-800">{serialNumber || '—'}</span>
                  </div>
                  {imageUrl && (
                    <div className="pt-2">
                      <span className="text-slate-400 block mb-1">Attached Photo:</span>
                      <img src={imageUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Stock Quantity:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {quantity} {unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Min. Alert Threshold:</span>
                    <span className="font-semibold text-slate-800">{minStockThreshold} {unit}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Storage Location:</span>
                    <span className="font-semibold text-slate-800">{storageLocation}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Unit Price:</span>
                    <span className="font-bold text-slate-900">{unitPrice ? `₹${parseFloat(unitPrice).toLocaleString('en-IN')}` : '—'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Attached Documents:</span>
                    <span className="font-bold text-blue-600">{selectedDocIds.length} Linked</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Specifications Summary */}
              {Object.keys(dynamicValues).length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase">Sub-Category Specifications</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(dynamicValues).map(([key, val]) => {
                      const schemaField = activeSubCategory?.metadataFields?.find(f => f.key === key)
                      const label = schemaField?.label || key
                      const unitStr = schemaField?.unit ? ` ${schemaField.unit}` : ''

                      return (
                        <div key={key} className="bg-white p-2.5 rounded-lg border border-slate-200/70 text-xs">
                          <p className="text-slate-400 text-[10px] uppercase font-semibold">{label}</p>
                          <p className="font-bold text-slate-900 mt-0.5">{String(val)}{unitStr}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/inventory')}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/25 transition"
                >
                  {isEditMode ? `Save & Update Spare (${inventoryId})` : `Confirm & Save to Inventory (${inventoryId})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal 1: Quick Add Vendor */}
        {showVendorModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add New Supplier / Vendor</h3>
                    <p className="text-xs text-slate-500">Quick-create vendor without leaving spare asset wizard</p>
                  </div>
                </div>
                <button onClick={() => setShowVendorModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewVendor} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vendor / Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newVendorName}
                    onChange={e => setNewVendorName(e.target.value)}
                    placeholder="e.g. Precision Spares Pvt Ltd"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Support Person Details</label>
                  <input
                    type="text"
                    value={newVendorContact}
                    onChange={e => setNewVendorContact(e.target.value)}
                    placeholder="e.g. Ramesh Patil (Sales Engineer)"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact No.</label>
                    <input
                      type="text"
                      value={newVendorPhone}
                      onChange={e => setNewVendorPhone(e.target.value)}
                      placeholder="+91 98201 12345"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email ID</label>
                    <input
                      type="email"
                      value={newVendorEmail}
                      onChange={e => setNewVendorEmail(e.target.value)}
                      placeholder="spares@vendor.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address</label>
                  <textarea
                    rows={2}
                    value={newVendorAddress}
                    onChange={e => setNewVendorAddress(e.target.value)}
                    placeholder="Office / workshop address..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowVendorModal(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Save &amp; Select Vendor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Inline Add Document */}
        {showDocModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload New Related Document</h3>
                  <p className="text-xs text-slate-500">Auto-assigns DOC-YYYY-#### ID to Document Library</p>
                </div>
                <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewDocument} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
                  <input
                    type="text"
                    required
                    value={newDocTitle}
                    onChange={e => setNewDocTitle(e.target.value)}
                    placeholder="e.g. Spare Compressor Warranty &amp; Spec Sheet"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Document Type *</label>
                  <select
                    value={newDocType}
                    onChange={e => setNewDocType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Invoice">Invoice</option>
                    <option value="Warranty">Warranty</option>
                    <option value="User Guide">User Guide / Manual</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Upload File (PDF, Images, DOCX)</label>
                  <input
                    type="file"
                    ref={docFileInputRef}
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        setNewDocFileName(e.target.files[0].name)
                        if (!newDocTitle) {
                          setNewDocTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''))
                        }
                      }
                    }}
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    className="hidden"
                  />
                  <div
                    onClick={() => docFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 group transition"
                  >
                    <UploadCloud className="w-6 h-6 mx-auto text-slate-400 group-hover:text-blue-500 mb-1 transition" />
                    <p className="text-xs font-semibold text-slate-800">
                      {newDocFileName ? newDocFileName : 'Choose Document File'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PDF, PNG, JPG up to 10MB</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDocModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Upload &amp; Attach
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
