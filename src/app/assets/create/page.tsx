'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  UploadCloud,
  Check,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Building,
  DollarSign,
  FileText,
  Plus,
  ShieldCheck,
  Layers,
  Sparkles,
  X,
  PlusCircle,
  Trash2,
  Image as ImageIcon,
  Search,
  Filter,
  Truck,
  Pencil,
} from 'lucide-react'
import { formatId, getNextSequence } from '@/lib/idGenerator'
import { DocumentItem } from '@/types/afms'
import { uploadToStorage, validateUpload } from '@/lib/storageUpload'

export const DEFAULT_ASSET_PLACEHOLDER_IMAGE = '/images/asset-placeholder.png'

export default function AddAssetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Loading Asset Wizard...</div>}>
      <AddAssetForm />
    </Suspense>
  )
}

function AddAssetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editAssetId = searchParams.get('edit')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const docFileInputRef = useRef<HTMLInputElement | null>(null)

  const {
    assets,
    categories,
    subCategories,
    campuses,
    buildings,
    rooms,
    vendors,
    documents,
    users,
    addAsset,
    updateAsset,
    addVendor,
    addDocument,
    updateDocument,
    currentUser,
  } = useAFMS()

  const [currentStep, setCurrentStep] = useState(1)

  // Edit mode state and target asset
  const isEditMode = Boolean(editAssetId)
  const existingAsset = editAssetId ? assets.find(a => a.id === editAssetId || a.assetId === editAssetId) : undefined

  // Step 1: Basic Information (Clear placeholders, empty defaults or existing asset)
  // Starts empty and is computed once `assets` has actually loaded from
  // Supabase (below) — a useState initializer here would run before that
  // fetch resolves and always see an empty array, showing "AST0001" for
  // every new asset regardless of how many already exist.
  const [assetId, setAssetId] = useState('')

  useEffect(() => {
    if (isEditMode) return
    setAssetId(formatId('AST', getNextSequence(assets.map(a => a.assetId || a.id), 'AST')))
  }, [assets, isEditMode])
  const [assetName, setAssetName] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('')
  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [manufacturer, setManufacturer] = useState('')
  const [modelNumber, setModelNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('') // optional
  const [assetPrice, setAssetPrice] = useState('') // optional
  const [purchaseDate, setPurchaseDate] = useState('')
  const [installationDate, setInstallationDate] = useState('')
  const [lastServicedDate, setLastServicedDate] = useState('')
  const [warrantyTill, setWarrantyTill] = useState('')
  const [maintenanceBy, setMaintenanceBy] = useState<'In House' | 'Vendor'>('In House')
  const [purchasedFromId, setPurchasedFromId] = useState('')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('') // optional

  // Conditional AMC fields when maintenanceBy === 'Vendor'
  const [amcVendorId, setAmcVendorId] = useState('')
  const [amcStartDate, setAmcStartDate] = useState('')
  const [amcEndDate, setAmcEndDate] = useState('')

  // Inline Quick Vendor Modal State
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [vendorModalTarget, setVendorModalTarget] = useState<'purchase' | 'amc'>('purchase')
  const [newVendorName, setNewVendorName] = useState('')
  const [newVendorCategory, setNewVendorCategory] = useState('')
  const [newVendorContact, setNewVendorContact] = useState('')
  const [newVendorEmail, setNewVendorEmail] = useState('')
  const [newVendorPhone, setNewVendorPhone] = useState('')
  const [newVendorAddress, setNewVendorAddress] = useState('')

  // Step 2: Location (Hierarchical Cascading: Campus -> Building -> Room)
  const [selectedCampusId, setSelectedCampusId] = useState('')
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')

  // Step 3: Dynamic Metadata
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({})

  // Step 4: Documents Selection & In-Wizard Add Document
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState<string>('All')

  // Load existing asset details when in Edit mode
  useEffect(() => {
    if (!existingAsset) return

    setAssetId(existingAsset.assetId)
    setAssetName(existingAsset.name || '')
    
    // Find subCategory and its parent category
    const sub = subCategories.find(s => s.id === existingAsset.subCategoryId)
    if (sub) {
      setSelectedCategoryId(sub.categoryId)
      setSelectedSubCategoryId(sub.id)
    }

    setManufacturer(existingAsset.manufacturer || '')
    setModelNumber(existingAsset.modelNumber || '')
    setSerialNumber(existingAsset.serialNumber || '')
    setAssetPrice(existingAsset.price ? String(existingAsset.price) : '')
    setPurchaseDate(existingAsset.purchaseDate || '')
    setInstallationDate(existingAsset.installationDate || '')
    setLastServicedDate(existingAsset.lastServicedDate || '')
    setWarrantyTill(existingAsset.warrantyTill || '')
    setMaintenanceBy(existingAsset.maintenanceBy || 'In House')
    setPurchasedFromId(existingAsset.purchaseVendorId || '')
    setAssignedToUserId(existingAsset.assignedToUserId || '')
    setNote(existingAsset.notes || '')
    setImageUrl(existingAsset.imageUrl || '')

    setAmcVendorId(existingAsset.maintenanceVendorId || '')
    setAmcStartDate(existingAsset.amcStartDate || '')
    setAmcEndDate(existingAsset.amcEndDate || '')

    // Location
    const room = rooms.find(r => r.id === existingAsset.roomId)
    if (room) {
      const building = buildings.find(b => b.id === room.buildingId)
      if (building) {
        setSelectedCampusId(building.campusId)
        setSelectedBuildingId(building.id)
      }
      setSelectedRoomId(room.id)
    }

    // Dynamic metadata
    if (existingAsset.dynamicSpecifications) {
      setDynamicValues(existingAsset.dynamicSpecifications)
    }

    // Linked documents
    const linkedDocs = documents.filter(
      d => d.linkedAssetIds?.includes(existingAsset.id) || d.linkedAssetIds?.includes(existingAsset.assetId)
    )
    setSelectedDocIds(linkedDocs.map(d => d.id))
  }, [existingAsset, subCategories, rooms, buildings, documents])

  // Inline Add New Document Modal State
  const [showDocModal, setShowDocModal] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocType, setNewDocType] = useState<DocumentItem['fileType']>('Invoice')
  const [newDocFileName, setNewDocFileName] = useState('')

  // Derived filtered SubCategories based on selected Category
  const availableSubCategories = subCategories.filter(s => s.categoryId === selectedCategoryId)

  // Derived filtered Buildings based on selected Campus
  const availableBuildings = buildings.filter(b => b.campusId === selectedCampusId)

  // Derived filtered Rooms based on selected Building
  const availableRooms = rooms.filter(r => r.buildingId === selectedBuildingId)

  const activeSubCategory = subCategories.find(s => s.id === selectedSubCategoryId)
  const activeCategory = categories.find(c => c.id === selectedCategoryId)

  // Step 4 Filtered Documents list
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.title.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
      doc.id.toLowerCase().includes(docSearchQuery.toLowerCase())
    const matchesType = docTypeFilter === 'All' || doc.fileType === docTypeFilter
    return matchesSearch && matchesType
  })

  // Cascading Handlers
  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId)
    setSelectedSubCategoryId('')
    setDynamicValues({})
  }

  const handleCampusChange = (newCampusId: string) => {
    setSelectedCampusId(newCampusId)
    setSelectedBuildingId('')
    setSelectedRoomId('')
  }

  const handleBuildingChange = (newBuildingId: string) => {
    setSelectedBuildingId(newBuildingId)
    setSelectedRoomId('')
  }

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)

  // Functional Image Upload Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const invalid = validateUpload(file, 'asset-images')
      if (invalid) {
        alert(invalid)
        return
      }
      setIsUploadingImage(true)
      const uploadedUrl = await uploadToStorage(file, 'asset-images')
      if (uploadedUrl) {
        setImageUrl(uploadedUrl)
      } else {
        const reader = new FileReader()
        reader.onload = event => {
          if (event.target?.result) setImageUrl(event.target.result as string)
        }
        reader.readAsDataURL(file)
      }
      setIsUploadingImage(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      const invalid = validateUpload(file, 'asset-images')
      if (invalid) {
        alert(invalid)
        return
      }
      setIsUploadingImage(true)
      const uploadedUrl = await uploadToStorage(file, 'asset-images')
      if (uploadedUrl) {
        setImageUrl(uploadedUrl)
      } else {
        const reader = new FileReader()
        reader.onload = event => {
          if (event.target?.result) setImageUrl(event.target.result as string)
        }
        reader.readAsDataURL(file)
      }
      setIsUploadingImage(false)
    }
  }

  // Handle Vendor Dropdown change (Detect "+ Add New Vendor")
  const handleVendorSelectChange = (value: string, target: 'purchase' | 'amc') => {
    if (value === '__ADD_NEW_VENDOR__') {
      setVendorModalTarget(target)
      setNewVendorName('')
      setNewVendorCategory(activeCategory?.name || 'General Equipment')
      setNewVendorContact('')
      setNewVendorEmail('')
      setNewVendorPhone('')
      setNewVendorAddress('')
      setShowVendorModal(true)
    } else {
      if (target === 'purchase') setPurchasedFromId(value)
      else setAmcVendorId(value)
    }
  }

  // Handle Inline New Vendor Submission
  const handleSaveNewVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVendorName.trim()) {
      alert('Vendor Name is required.')
      return
    }

    try {
      const createdVendor = await addVendor({
        name: newVendorName.trim(),
        categorySupplied: newVendorCategory || 'General Supply',
        contactPerson: newVendorContact,
        email: newVendorEmail,
        phone: newVendorPhone,
        address: newVendorAddress,
        hasAmc: vendorModalTarget === 'amc',
      })

      if (vendorModalTarget === 'purchase') {
        setPurchasedFromId(createdVendor.id)
      } else {
        setAmcVendorId(createdVendor.id)
      }

      setShowVendorModal(false)
    } catch {
      // The vendor wasn't saved (already reported by a toast). Keep the form open.
    }
  }

  // Handle Inline New Document Submission
  const handleSaveNewDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDocTitle.trim()) {
      alert('Document Title is required.')
      return
    }

    let finalFileUrl = '/docs/sample.pdf'
    let finalFileSize = 250
    const rawFile = docFileInputRef.current?.files?.[0]

    if (rawFile) {
      const invalid = validateUpload(rawFile, 'documents')
      if (invalid) {
        alert(invalid)
        return
      }
      setIsUploadingDoc(true)
      const uploadedUrl = await uploadToStorage(rawFile, 'documents')
      if (uploadedUrl) {
        finalFileUrl = uploadedUrl
      }
      finalFileSize = Math.round(rawFile.size / 1024)
      setIsUploadingDoc(false)
    }

    try {
      const createdDoc = await addDocument({
        title: newDocTitle.trim(),
        fileType: newDocType,
        fileUrl: finalFileUrl,
        fileSizeKb: finalFileSize,
        uploadedBy: currentUser.fullName,
        linkedAssetIds: [],
      })

      // Automatically select the newly created document
      setSelectedDocIds(prev => [...prev, createdDoc.id])
      setShowDocModal(false)
      setNewDocTitle('')
      setNewDocFileName('')
    } catch {
      // Not saved (a toast already says why). Keep the form open.
    }
  }

  // Step Validation Logic (Mandatory vs Optional)
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!assetName.trim()) {
        alert('Please enter Asset Name.')
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
      if (!manufacturer.trim()) {
        alert('Please enter Manufacturer Name.')
        return false
      }
      if (!modelNumber.trim()) {
        alert('Please enter Model Number.')
        return false
      }
      if (!purchaseDate) {
        alert('Please select Purchase Date.')
        return false
      }
      if (!installationDate) {
        alert('Please select Installation Date.')
        return false
      }
      if (installationDate < purchaseDate) {
        alert('Installation Date cannot be before Purchase Date.')
        return false
      }
      if (lastServicedDate && lastServicedDate < purchaseDate) {
        alert('Last Serviced Date cannot be before Purchase Date.')
        return false
      }
      if (!warrantyTill) {
        alert('Please select Warranty Expiry Date.')
        return false
      }
      if (warrantyTill < purchaseDate) {
        alert('Warranty Till date cannot be before Purchase Date.')
        return false
      }
      if (!purchasedFromId) {
        alert('Please select Purchased From (Vendor).')
        return false
      }
      if (maintenanceBy === 'Vendor') {
        if (!amcVendorId) {
          alert('Please select an AMC Vendor.')
          return false
        }
        if (!amcStartDate) {
          alert('Please select AMC Start Date.')
          return false
        }
        if (!amcEndDate) {
          alert('Please select AMC End Date.')
          return false
        }
        if (amcEndDate < amcStartDate) {
          alert('AMC End Date cannot be before AMC Start Date.')
          return false
        }
      }
    }

    if (step === 2) {
      if (!selectedCampusId) {
        alert('Please select a Campus.')
        return false
      }
      if (!selectedBuildingId) {
        alert('Please select a Building / Block.')
        return false
      }
      if (!selectedRoomId) {
        alert('Please select a Room / Area.')
        return false
      }
    }

    return true
  }

  const steps = [
    { number: 1, title: 'Basic Information' },
    { number: 2, title: 'Location' },
    { number: 3, title: 'Specification' },
    { number: 4, title: 'Documents' },
    { number: 5, title: 'Review' },
  ]

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleFinalSubmit = async () => {
    if (isUploadingImage || isUploadingDoc) {
      alert('Please wait for the upload to finish before submitting.')
      return
    }

    const finalImageUrl = imageUrl.trim() || DEFAULT_ASSET_PLACEHOLDER_IMAGE

    if (isEditMode && existingAsset) {
      updateAsset(existingAsset.id, {
        name: assetName,
        subCategoryId: selectedSubCategoryId,
        roomId: selectedRoomId,
        manufacturer,
        modelNumber,
        serialNumber: serialNumber || undefined,
        price: assetPrice ? parseFloat(assetPrice) : undefined,
        purchaseDate,
        installationDate,
        lastServicedDate: lastServicedDate || undefined,
        warrantyTill,
        maintenanceBy,
        maintenanceVendorId: maintenanceBy === 'Vendor' ? amcVendorId : undefined,
        amcStartDate: maintenanceBy === 'Vendor' ? amcStartDate : undefined,
        amcEndDate: maintenanceBy === 'Vendor' ? amcEndDate : undefined,
        purchaseVendorId: purchasedFromId,
        assignedToUserId: assignedToUserId || undefined,
        assignedToUserName: assignedToUserId ? users.find(u => u.id === assignedToUserId)?.fullName : undefined,
        dynamicSpecifications: dynamicValues,
        imageUrl: finalImageUrl,
        notes: note || undefined,
      })
      router.push(`/assets/${existingAsset.assetId}`)
    } else {
      let created: Awaited<ReturnType<typeof addAsset>>
      try {
        created = await addAsset({
          name: assetName,
          subCategoryId: selectedSubCategoryId,
          roomId: selectedRoomId,
          manufacturer,
          modelNumber,
          serialNumber: serialNumber || undefined,
          price: assetPrice ? parseFloat(assetPrice) : undefined,
          purchaseDate,
          installationDate,
          lastServicedDate: lastServicedDate || undefined,
          warrantyTill,
          maintenanceBy,
          maintenanceVendorId: maintenanceBy === 'Vendor' ? amcVendorId : undefined,
          amcStartDate: maintenanceBy === 'Vendor' ? amcStartDate : undefined,
          amcEndDate: maintenanceBy === 'Vendor' ? amcEndDate : undefined,
          purchaseVendorId: purchasedFromId,
          assignedToUserId: assignedToUserId || undefined,
          assignedToUserName: assignedToUserId ? users.find(u => u.id === assignedToUserId)?.fullName : undefined,
          dynamicSpecifications: dynamicValues,
          imageUrl: finalImageUrl,
          notes: note || undefined,
          status: 'Operational',
        })
      } catch {
        // The asset wasn't saved (a toast already says why). Stay on the form so nothing typed is lost.
        return
      }

      if (selectedDocIds.length > 0 && created?.id) {
        // Through the context, so the document list updates and a failed link is reported.
        await Promise.all(selectedDocIds.map(docId => updateDocument(docId, { assetId: created.id })))
      }

      router.push('/assets')
    }
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Assets', href: '/assets' },
        { label: isEditMode ? `Edit ${assetId}` : 'Add Asset' },
      ]}
    >
      <div className="space-y-8 max-w-5xl mx-auto pb-12">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isEditMode ? `Edit Asset: ${assetName || assetId}` : 'Add Asset'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEditMode
              ? `Updating asset details & specifications for ${assetId}`
              : 'Automated AST-#### ID with cascading category taxonomy & location hierarchy'}
          </p>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="relative flex items-center justify-between max-w-3xl mx-auto px-4">
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

        {/* Card Form Container */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-8 space-y-6">
          {/* STEP 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">Basic Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Row 1: Asset ID & Asset Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asset ID (Auto-assigned)</label>
                  <input
                    type="text"
                    disabled
                    value={assetId}
                    className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-mono font-bold text-blue-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={e => setAssetName(e.target.value)}
                    placeholder="e.g. Split AC 2 Ton, Engine Simulator #1"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Row 2: Category & Sub-Category (IN SAME ROW, NEXT TO EACH OTHER) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={selectedCategoryId}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code || c.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategory *</label>
                  <select
                    value={selectedSubCategoryId}
                    onChange={e => setSelectedSubCategoryId(e.target.value)}
                    disabled={!selectedCategoryId}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {!selectedCategoryId ? 'Select Category First' : 'Select Sub-Category'}
                    </option>
                    {availableSubCategories.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code || s.id})</option>
                    ))}
                  </select>
                  {selectedCategoryId && availableSubCategories.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">No subcategories under this category yet.</p>
                  )}
                </div>

                {/* Row 3: Manufacturer Name & Model Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer Name *</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    placeholder="e.g. Mitsubishi, Daikin, Philips"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model Number *</label>
                  <input
                    type="text"
                    value={modelNumber}
                    onChange={e => setModelNumber(e.target.value)}
                    placeholder="e.g. DXC18YAMDA-W"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Row 4: Serial Number & Asset Price */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Serial Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="e.g. RN2135677"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Asset Price (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    value={assetPrice}
                    onChange={e => setAssetPrice(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Row 5: Purchase Date & Installation Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => {
                      const v = e.target.value
                      setPurchaseDate(v)
                      // Downstream dates anchored to purchase date are no
                      // longer valid once it changes — clear them rather
                      // than silently leaving a now-impossible ordering.
                      if (installationDate && v && installationDate < v) setInstallationDate('')
                      if (lastServicedDate && v && lastServicedDate < v) setLastServicedDate('')
                      if (warrantyTill && v && warrantyTill < v) setWarrantyTill('')
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Installation Date * (PM Anchor)</label>
                  <input
                    type="date"
                    value={installationDate}
                    min={purchaseDate || undefined}
                    disabled={isEditMode}
                    onChange={e => setInstallationDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {isEditMode && (
                    <p className="text-[10px] text-slate-400 mt-1">Locked after creation — used to schedule PM/Inspection cycles.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Serviced Date <span className="text-slate-400 font-normal">(Optional — for legacy/backdated assets)</span>
                  </label>
                  <input
                    type="date"
                    value={lastServicedDate}
                    min={purchaseDate || undefined}
                    onChange={e => setLastServicedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    If this asset was already installed and serviced before being entered here, set this so the first PM/Inspection cycle is scheduled from this date instead of today.
                  </p>
                </div>

                {/* Row 6: Warranty Till & Maintenance By */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Till *</label>
                  <input
                    type="date"
                    value={warrantyTill}
                    min={purchaseDate || undefined}
                    onChange={e => setWarrantyTill(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Maintenance By *</label>
                  <select
                    value={maintenanceBy}
                    onChange={e => setMaintenanceBy(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="In House">In House</option>
                    <option value="Vendor">Vendor (AMC)</option>
                  </select>
                </div>

                {/* Row 7: Purchased From & Assign To User */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Purchased From (Vendor) *</label>
                    <button
                      type="button"
                      onClick={() => handleVendorSelectChange('__ADD_NEW_VENDOR__', 'purchase')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add New Vendor</span>
                    </button>
                  </div>
                  <select
                    value={purchasedFromId}
                    onChange={e => handleVendorSelectChange(e.target.value, 'purchase')}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Vendor</option>
                    {purchasedFromId && !vendors.some(v => v.id === purchasedFromId) && (
                      <option value={purchasedFromId}>Loading vendor…</option>
                    )}
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.code || v.id})</option>
                    ))}
                    <option value="__ADD_NEW_VENDOR__">+ Add New Vendor...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign To User <span className="text-slate-400 font-normal">(Custodian / In-Charge)</span>
                  </label>
                  <div className="relative">
                    <div
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between cursor-pointer hover:border-blue-400 transition"
                    >
                      {assignedToUserId ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {users.find(u => u.id === assignedToUserId)?.fullName || assignedToUserId}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({users.find(u => u.id === assignedToUserId)?.role} • {users.find(u => u.id === assignedToUserId)?.department || 'Staff'})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unassigned (General Campus Asset)</span>
                      )}
                      <span className="text-slate-400 text-[10px]">▼</span>
                    </div>

                    {/* Searchable Dropdown Menu */}
                    {isUserDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in">
                        <input
                          type="text"
                          value={userSearchQuery}
                          onChange={e => setUserSearchQuery(e.target.value)}
                          placeholder="Search by user name, email, or department..."
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                          <div
                            onClick={() => {
                              setAssignedToUserId('')
                              setIsUserDropdownOpen(false)
                              setUserSearchQuery('')
                            }}
                            className={`p-2 rounded-lg text-xs cursor-pointer hover:bg-slate-50 flex items-center justify-between ${
                              !assignedToUserId ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600'
                            }`}
                          >
                            <span>Unassigned (General Asset)</span>
                            {!assignedToUserId && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>

                          {users
                            .filter(
                              u =>
                                u.role !== 'Guest' &&
                                (u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                  u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                  (u.department && u.department.toLowerCase().includes(userSearchQuery.toLowerCase())))
                            )
                            .map(u => (
                              <div
                                key={u.id}
                                onClick={() => {
                                  setAssignedToUserId(u.id)
                                  setIsUserDropdownOpen(false)
                                  setUserSearchQuery('')
                                }}
                                className={`p-2 rounded-lg text-xs cursor-pointer hover:bg-slate-50 flex items-center justify-between ${
                                  assignedToUserId === u.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                                }`}
                              >
                                <div>
                                  <p className="font-semibold">{u.fullName}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {u.role} • {u.department || 'General'} • {u.email}
                                  </p>
                                </div>
                                {assignedToUserId === u.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 8: Asset Image Upload Card */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Asset Image <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                  />

                  {imageUrl ? (
                    <div className="relative border border-blue-200 rounded-2xl p-3 bg-blue-50/40 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={imageUrl}
                          alt="Asset Preview"
                          className="w-14 h-14 rounded-xl object-cover border border-blue-200 shrink-0 bg-white shadow-2xs"
                        />
                        <p className="text-xs font-bold text-slate-800">Image Attached</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition cursor-pointer shadow-2xs disabled:opacity-60"
                      >
                        {isUploadingImage ? 'Uploading…' : 'Change Photo'}
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
                      <div className="flex items-center gap-3.5 w-full sm:w-auto">
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-white shadow-2xs flex items-center justify-center">
                          <img
                            src={DEFAULT_ASSET_PLACEHOLDER_IMAGE}
                            alt="Default Asset Placeholder"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-xs font-bold text-slate-800">No image uploaded</p>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-xl transition cursor-pointer shadow-2xs disabled:opacity-60"
                        >
                          <UploadCloud className="w-4 h-4 text-blue-600" />
                          <span>{isUploadingImage ? 'Uploading…' : 'Upload Image'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic AMC Section when maintenanceBy === 'Vendor' */}
              {maintenanceBy === 'Vendor' && (
                <div className="p-5 bg-blue-50/40 rounded-2xl border border-blue-100 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900">Vendor AMC Details (Required)</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-700">AMC Vendor *</label>
                        <button
                          type="button"
                          onClick={() => handleVendorSelectChange('__ADD_NEW_VENDOR__', 'amc')}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          + New
                        </button>
                      </div>
                      <select
                        value={amcVendorId}
                        onChange={e => handleVendorSelectChange(e.target.value, 'amc')}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select AMC Vendor</option>
                        {amcVendorId && !vendors.some(v => v.id === amcVendorId) && (
                          <option value={amcVendorId}>Loading vendor…</option>
                        )}
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.code || v.id})</option>
                        ))}
                        <option value="__ADD_NEW_VENDOR__">+ Add New Vendor...</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">AMC Start Date *</label>
                      <input
                        type="date"
                        value={amcStartDate}
                        onChange={e => {
                          const v = e.target.value
                          setAmcStartDate(v)
                          if (amcEndDate && v && amcEndDate < v) setAmcEndDate('')
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">AMC End Date *</label>
                      <input
                        type="date"
                        value={amcEndDate}
                        min={amcStartDate || undefined}
                        onChange={e => setAmcEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add any additional context or operational remarks for this asset..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                ></textarea>
              </div>
            </div>
          )}

          {/* STEP 2: Location */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 pb-1">Location Selection</h2>
                <p className="text-xs text-slate-500">Select Campus first, then choose from available Buildings and Rooms in that hierarchy.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">1. Select Campus *</label>
                  <select
                    value={selectedCampusId}
                    onChange={e => handleCampusChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Campus</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code || c.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">2. Select Building / Block *</label>
                  <select
                    value={selectedBuildingId}
                    onChange={e => handleBuildingChange(e.target.value)}
                    disabled={!selectedCampusId}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {!selectedCampusId ? 'Select Campus First' : 'Select Building'}
                    </option>
                    {availableBuildings.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code || b.id})</option>
                    ))}
                  </select>
                  {selectedCampusId && availableBuildings.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">No buildings in this campus yet.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">3. Select Room / Area *</label>
                  <select
                    value={selectedRoomId}
                    onChange={e => setSelectedRoomId(e.target.value)}
                    disabled={!selectedBuildingId}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {!selectedBuildingId ? 'Select Building First' : 'Select Room'}
                    </option>
                    {availableRooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.roomNumber || r.id})</option>
                    ))}
                  </select>
                  {selectedBuildingId && availableRooms.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">No rooms in this building yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Dynamic Specification Metadata */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Dynamic Specifications</h2>
                <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full">
                  Configured from {activeSubCategory?.name || 'Subcategory'} ({activeSubCategory?.code || activeSubCategory?.id})
                </span>
              </div>

              {activeSubCategory?.metadataFields && activeSubCategory.metadataFields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeSubCategory.metadataFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {field.label} {field.unit && `(${field.unit})`} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type={field.type === 'Number' ? 'number' : field.type === 'Date' ? 'date' : 'text'}
                        value={dynamicValues[field.key] || ''}
                        onChange={e => setDynamicValues({ ...dynamicValues, [field.key]: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                        placeholder={`Enter ${field.label}...`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No custom metadata fields configured for this subcategory.</p>
              )}
            </div>
          )}

          {/* STEP 4: Document Library Attachment with Filter, Search & Inline Add */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Attach Compliance Documents</h2>
                  <p className="text-xs text-slate-500">Link existing invoices, warranty cards or AMC contracts from the Document Library.</p>
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
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "Add New Document" above to upload an invoice or warranty card.</p>
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
                    {selectedDocIds.length} document(s) attached to this asset
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

          {/* STEP 5: Review & Confirm */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">Review & Confirmation</h2>

              {/* Asset Visual Preview */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4 shadow-2xs">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs flex items-center justify-center">
                  <img
                    src={imageUrl || DEFAULT_ASSET_PLACEHOLDER_IMAGE}
                    alt="Asset Final Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <span className="text-sm font-bold text-slate-900">{assetName || 'New Facility Asset'}</span>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    {assetId} • {manufacturer || 'Manufacturer'} ({modelNumber || 'Model'})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200/80">
                  <p className="font-bold text-slate-900">General Overview</p>
                  <p><span className="text-slate-500">Asset ID:</span> <strong className="text-blue-600 font-mono">{assetId}</strong></p>
                  <p><span className="text-slate-500">Asset Name:</span> {assetName}</p>
                  <p><span className="text-slate-500">Category:</span> {activeCategory?.name} ({activeCategory?.code || activeCategory?.id})</p>
                  <p><span className="text-slate-500">Sub-Category:</span> {activeSubCategory?.name} ({activeSubCategory?.code || activeSubCategory?.id})</p>
                  <p><span className="text-slate-500">Manufacturer / Model:</span> {manufacturer} ({modelNumber})</p>
                  {serialNumber && <p><span className="text-slate-500">Serial No:</span> {serialNumber}</p>}
                  {assetPrice && <p><span className="text-slate-500">Price:</span> ₹{assetPrice}</p>}
                  <p><span className="text-slate-500">Installation Date:</span> {installationDate}</p>
                  {lastServicedDate && <p><span className="text-slate-500">Last Serviced Date:</span> {lastServicedDate}</p>}
                  {!isEditMode && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1">
                      Installation Date cannot be changed after this asset is created — it is used to schedule the first Preventive Maintenance and Inspection due dates. Please double-check it before submitting.
                    </p>
                  )}
                  <p><span className="text-slate-500">Maintenance By:</span> {maintenanceBy}</p>
                  {maintenanceBy === 'Vendor' && (
                    <p><span className="text-slate-500">AMC Period:</span> {amcStartDate} to {amcEndDate}</p>
                  )}
                  <p><span className="text-slate-500">Attached Documents:</span> <strong>{selectedDocIds.length} file(s)</strong></p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200/80">
                  <p className="font-bold text-slate-900">Auto-Scheduled Compliance Work</p>
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Quarterly Quality Inspection will be generated automatically.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-50 text-blue-800 text-[11px] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Preventive Maintenance (PM) work order will be created.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
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
                onClick={() => router.push('/assets')}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isUploadingImage || isUploadingDoc}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-60"
                >
                  {isUploadingImage || isUploadingDoc
                    ? 'Uploading…'
                    : isEditMode ? `Save & Update Asset (${assetId})` : `Confirm & Create Asset (${assetId})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal 1: Inline Add Vendor */}
        {showVendorModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add New Vendor</h3>
                    <p className="text-xs text-slate-500">Quick-create vendor without leaving asset registration</p>
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
                    placeholder="e.g. Voltas Marine Climate Ltd, Daikin India"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Support Person Details <span className="text-slate-400 font-normal">(Name, Designation)</span>
                  </label>
                  <input
                    type="text"
                    value={newVendorContact}
                    onChange={e => setNewVendorContact(e.target.value)}
                    placeholder="e.g. Sanjay Deshmukh (Lead Account Engineer)"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Support Contact No.</label>
                    <input
                      type="text"
                      value={newVendorPhone}
                      onChange={e => setNewVendorPhone(e.target.value)}
                      placeholder="+91 98201 11223"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Support Email ID</label>
                    <input
                      type="email"
                      value={newVendorEmail}
                      onChange={e => setNewVendorEmail(e.target.value)}
                      placeholder="service@vendor.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address</label>
                  <textarea
                    rows={2}
                    value={newVendorAddress}
                    onChange={e => setNewVendorAddress(e.target.value)}
                    placeholder="Office / workshop address, city, state, pin code..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowVendorModal(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
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
                  <h3 className="text-base font-bold text-slate-900">Upload New Compliance Document</h3>
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
                    placeholder="e.g. Split AC 5-Year Compressor Warranty Card"
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
                    <option value="AMC Contract">AMC Contract</option>
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
                    disabled={isUploadingDoc}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingDoc}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-60"
                  >
                    {isUploadingDoc ? 'Uploading…' : 'Upload & Attach'}
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
