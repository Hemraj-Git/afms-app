'use client'

import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import {
  QrCode,
  Camera,
  DoorOpen,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogOut,
  Sparkles,
  ClipboardList,
  Upload,
  Wrench,
  ShieldCheck,
  Package,
  Phone,
  Mail,
  FileText,
  Clock,
  Plus,
  Trash2,
  ChevronRight,
  Check,
  X,
  ExternalLink,
  Building2,
  RefreshCw,
  Send,
  Calendar,
  Layers,
  Sparkle,
  Image as ImageIcon,
  Eye,
  FileCheck,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { WorkOrder, Asset, Room, Vendor, UserRole, WorkOrderPartItem, Inspection, ServiceRequest } from '@/types/afms'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { NotificationBell } from '@/components/mobile/NotificationBell'
import { QrScanner } from '@/components/mobile/QrScanner'

// Real device-camera photo capture, replacing every "Snap" button that
// previously just set the exact same hardcoded stock-photo URL regardless
// of context. `capture="environment"` opens the rear camera directly on
// iOS Safari and Android without any getUserMedia permissions dance; the
// captured/selected file is read into a base64 data URL, matching the
// FileReader pattern already used for asset/inventory image uploads
// elsewhere in this app.
function CameraCaptureButton({
  onCapture,
  label = 'Snap',
  className,
}: {
  onCapture: (dataUrl: string) => void
  label?: string
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = event => {
              if (event.target?.result) onCapture(event.target.result as string)
            }
            reader.readAsDataURL(file)
          }
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={className || 'px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 shrink-0'}
      >
        <Camera className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    </>
  )
}

// A plain-language, one-line explanation for a Service Request's current
// state — previously a ticket with no resolution notes yet showed nothing
// beyond a bare status word, and "Escalated" in particular was never
// explained anywhere in the UI.
function requestStatusExplanation(sr: ServiceRequest): string {
  if (sr.resolutionNotes) return sr.resolutionNotes
  if (sr.status === 'Escalated') return 'This request has been raised to a supervisor for urgent attention.'
  if (sr.status === 'Open') return 'Received — awaiting assignment.'
  if (sr.status === 'In Progress') return 'A technician has been assigned and is working on this.'
  return ''
}

function MobileFieldAppContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    currentUser,
    rooms,
    buildings,
    campuses,
    assets,
    categories,
    subCategories,
    vendors,
    workOrders,
    updateWorkOrderStatus,
    inspections,
    checklistTemplates,
    completeInspection,
    serviceRequests,
    addServiceRequest,
    slaConfig,
    checkInRoom,
    checkOutRoom,
    activeCheckIn,
    logout,
    isLoggedIn,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
  } = useAFMS()

  // Navigation Tab State (Dynamic per role)
  const [activeTab, setActiveTab] = useState<'Tasks' | 'Housekeeping' | 'Inspections' | 'Scan' | 'RaiseRequest' | 'MyRequests' | 'Profile'>('Tasks')

  // Shared in-app toast, replacing every native browser alert() in this
  // file with one consistent, styled banner (previously error/validation
  // messages used jarring OS-native alert() popups while success messages
  // elsewhere in the app used styled banners -- now everything does).
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const toastTimeoutRef = React.useRef<number | null>(null)
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), type === 'error' ? 4000 : 2500)
  }

  // Real connectivity state for the Profile tab -- previously hardcoded as
  // a static "Active Online" string regardless of actual network status.
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Available tabs computed dynamically according to user role. Every role
  // gets Scan / RaiseRequest / MyRequests / Profile; Tasks, Housekeeping and
  // Inspections are added only for the roles that actually perform that kind
  // of work — Guest gets none of those three, matching "own assigned work or
  // raised requests only, not the full operational surface."
  const availableTabs = useMemo(() => {
    if (currentUser.role === 'Technician') {
      return ['Tasks', 'Inspections', 'Scan', 'RaiseRequest', 'MyRequests', 'Profile'] as const
    }
    if (currentUser.role === 'Housekeeping') {
      return ['Housekeeping', 'Inspections', 'Scan', 'RaiseRequest', 'MyRequests', 'Profile'] as const
    }
    if (currentUser.role === 'Faculty') {
      return ['Inspections', 'Scan', 'RaiseRequest', 'MyRequests', 'Profile'] as const
    }
    if (currentUser.role === 'Guest') {
      return ['Scan', 'RaiseRequest', 'MyRequests', 'Profile'] as const
    }
    // Admin gets the full union
    return ['Tasks', 'Housekeeping', 'Inspections', 'Scan', 'RaiseRequest', 'MyRequests', 'Profile'] as const
  }, [currentUser.role])

  // Automatically reset tab if activeTab is not permitted for the active role
  React.useEffect(() => {
    if (!(availableTabs as readonly string[]).includes(activeTab)) {
      if (currentUser.role === 'Housekeeping') {
        setActiveTab('Housekeeping')
      } else if (currentUser.role === 'Faculty') {
        setActiveTab('Inspections')
      } else if (currentUser.role === 'Guest') {
        setActiveTab('Scan')
      } else {
        setActiveTab('Tasks')
      }
    }
  }, [currentUser.role, availableTabs, activeTab])

  // Technician Work Order Filter (PM and Corrective only)
  const [woFilter, setWoFilter] = useState<'ALL' | 'Preventive' | 'Corrective' | 'Completed'>('ALL')

  // My Requests detail view — previously cards were static dead ends with
  // no way to see the full description/photo/room/SLA due date
  const [viewingRequest, setViewingRequest] = useState<ServiceRequest | null>(null)

  // Housekeeping Work Order Filter
  const [hkFilter, setHkFilter] = useState<'ALL' | 'Scheduled' | 'In Progress' | 'Completed'>('ALL')
  const [selectedHkOrder, setSelectedHkOrder] = useState<WorkOrder | null>(null)
  const [hkStartPhoto, setHkStartPhoto] = useState('')
  const [hkCompletionPhoto, setHkCompletionPhoto] = useState('')
  const [hkNotes, setHkNotes] = useState('')
  // Previously defaulted to mostly pre-checked (true) and was never reset
  // when a different order was opened -- a housekeeping worker's very
  // first "completed" record could already claim work never done, and an
  // unchecked item silently carried over to the next room. Now starts
  // fully unchecked and is explicitly reset in the "Perform Cleaning"
  // handler below.
  const emptyHkChecklist: Record<string, boolean> = {
    dusting: false,
    mopping: false,
    trashDisposal: false,
    sanitization: false,
    restroomClean: false,
  }
  const [hkChecklist, setHkChecklist] = useState<Record<string, boolean>>(emptyHkChecklist)

  // Inspection Filter State
  const [inspFilter, setInspFilter] = useState<'Pending' | 'Completed' | 'ALL'>('Pending')
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null)
  const [viewingInspection, setViewingInspection] = useState<Inspection | null>(null)
  const [inspAnswers, setInspAnswers] = useState<Record<string, string>>({})
  const [inspRemarks, setInspRemarks] = useState('')
  const [inspPhotoUrl, setInspPhotoUrl] = useState('')
  // One photo per checkpoint flagged photoRequired -- previously there was
  // only a single inspection-wide photo field, so there was no way to
  // know or prove which specific checkpoint a photo actually documented.
  const [inspItemPhotos, setInspItemPhotos] = useState<Record<string, string>>({})
  const [inspSuccessMsg, setInspSuccessMsg] = useState(false)

  // Active Work Order for Execution Modal
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null)

  // Work Order Execution Form States
  const [startPhoto, setStartPhoto] = useState<string>('')
  const [completionPhoto, setCompletionPhoto] = useState<string>('')
  const [techRemarks, setTechRemarks] = useState<string>('')
  const [issueDiagnosed, setIssueDiagnosed] = useState<string>('')
  const [actionSolution, setActionSolution] = useState<string>('')
  
  // Corrective Execution Mode: In-House vs Vendor
  const [correctiveMode, setCorrectiveMode] = useState<'In House' | 'Vendor'>('In House')
  
  // In-House Parts Replaced
  const [partsList, setPartsList] = useState<WorkOrderPartItem[]>([])
  const [newPartName, setNewPartName] = useState('')
  const [newPartQty, setNewPartQty] = useState(1)
  const [newPartNotes, setNewPartNotes] = useState('')

  // Vendor Execution Form States
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [vendorTicketNo, setVendorTicketNo] = useState('')
  const [vendorTechName, setVendorTechName] = useState('')
  const [vendorTechPhone, setVendorTechPhone] = useState('')
  const [vendorServiceDate, setVendorServiceDate] = useState(new Date().toISOString().split('T')[0])
  const [vendorJobSheetUrl, setVendorJobSheetUrl] = useState('')
  const [vendorRemarks, setVendorRemarks] = useState('')
  const [vendorCost, setVendorCost] = useState<number | undefined>(undefined)

  // Checklist responses state for PM
  const [checklistResponses, setChecklistResponses] = useState<Record<string, { value: any; remarks?: string }>>({})

  // QR Scanner / Simulation States
  const [scannedEntityType, setScannedEntityType] = useState<'Room' | 'Asset' | null>(null)
  const [scannedRoom, setScannedRoom] = useState<Room | null>(null)
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)

  // Pre-select the scanned room/asset from a real QR scan. A printed QR code
  // resolves through /qr (auth check) into /mobile?type=...&id=..., landing
  // here — this is what actually connects a physical scan to this screen,
  // rather than only the manual simulator below.
  const consumedQrParamsRef = React.useRef<string | null>(null)
  useEffect(() => {
    const qrType = searchParams.get('type')
    const qrId = searchParams.get('id')
    if (!qrType || !qrId) return
    const paramKey = `${qrType}:${qrId}`
    if (consumedQrParamsRef.current === paramKey) return
    consumedQrParamsRef.current = paramKey

    if (qrType === 'room') {
      const room = rooms.find(r => r.id === qrId)
      if (room) {
        setScannedEntityType('Room')
        setScannedRoom(room)
        setScannedAsset(null)
        setActiveTab('Scan')
        setReqRoomId(room.id)
        setReqAssetId('')
      }
    } else if (qrType === 'asset') {
      const asset = assets.find(a => a.id === qrId)
      if (asset) {
        setScannedEntityType('Asset')
        setScannedAsset(asset)
        setScannedRoom(null)
        setActiveTab('Scan')
      }
    }
  }, [searchParams, rooms, assets])

  // Real camera QR scanning (feature-detected; falls back to the manual
  // simulator below on unsupported browsers, notably iOS Safari)
  const [showCameraScanner, setShowCameraScanner] = useState(false)
  const handleQrDetected = (rawValue: string) => {
    setShowCameraScanner(false)
    try {
      const url = new URL(rawValue, window.location.origin)
      const qrType = url.searchParams.get('type')
      const qrId = url.searchParams.get('id') || url.searchParams.get('code')
      if (qrType === 'room' && qrId) {
        const room = rooms.find(r => r.id === qrId)
        if (room) {
          setScannedEntityType('Room')
          setScannedRoom(room)
          setScannedAsset(null)
          setReqRoomId(room.id)
          setReqAssetId('')
          return
        }
      } else if (qrType === 'asset' && qrId) {
        const asset = assets.find(a => a.id === qrId)
        if (asset) {
          setScannedEntityType('Asset')
          setScannedAsset(asset)
          setScannedRoom(null)
          return
        }
      }
      showToast('error', 'This QR code was not recognized as a valid room or equipment tag.')
    } catch {
      showToast('error', 'This QR code was not recognized as a valid room or equipment tag.')
    }
  }

  // Room Check-In Purpose State
  // Previously defaulted to 'Scheduled Maintenance Servicing' and was bound
  // as the actual submitted value, not a placeholder -- every check-in,
  // including a Guest just visiting a room, silently claimed a maintenance
  // purpose unless the user noticed and edited it.
  const [checkInPurpose, setCheckInPurpose] = useState('')
  const [checkInSuccessMsg, setCheckInSuccessMsg] = useState(false)

  // Unified Service Request Form State — previously the Scan tab's inline
  // "Raise Service Request" and the standalone RaiseRequest tab were two
  // structurally different forms with entirely separate state and submit
  // handlers. One shared set of state + one shared form (rendered by
  // renderServiceRequestForm below) is now used by both entry points, so
  // there's exactly one field order/label set regardless of how the user
  // got there.
  const [reqRoomId, setReqRoomId] = useState<string>('')
  const [reqType, setReqType] = useState<'Maintenance' | 'Housekeeping'>('Maintenance')
  const [reqAssetId, setReqAssetId] = useState<string>('')
  const [reqTitle, setReqTitle] = useState('')
  const [reqDescription, setReqDescription] = useState('')
  const [reqPriority, setReqPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium')
  const [reqPhotoUrl, setReqPhotoUrl] = useState('')
  const [reqSuccessMsg, setReqSuccessMsg] = useState(false)

  // When the request is Maintenance and tied to an asset whose sub-category
  // has a configured SLA priority, that priority is used automatically
  // instead of asking the user to pick one — mirrors the desktop Service
  // Requests page's behavior.
  const reqAssetSub = subCategories.find(
    s => s.id === assets.find(a => a.id === reqAssetId)?.subCategoryId
  )
  const isReqPriorityAutoSet = reqType === 'Maintenance' && Boolean(reqAssetSub?.slaPriority)
  React.useEffect(() => {
    if (isReqPriorityAutoSet && reqAssetSub?.slaPriority) {
      setReqPriority(reqAssetSub.slaPriority)
    }
  }, [isReqPriorityAutoSet, reqAssetSub?.slaPriority])

  const assetsInReqRoom = useMemo(() => assets.filter(a => a.roomId === reqRoomId), [assets, reqRoomId])

  const resetServiceRequestForm = () => {
    setReqType('Maintenance')
    setReqAssetId('')
    setReqTitle('')
    setReqDescription('')
    setReqPriority('Medium')
    setReqPhotoUrl('')
  }

  // Active Technician's Work Orders (Preventive & Corrective ONLY - technician does not do housekeeping)
  const technicianWorkOrders = useMemo(() => {
    return workOrders.filter(
      w =>
        w.type !== 'Housekeeping' &&
        (w.assignedTechnicianId === currentUser.id ||
          w.assignedTechnicianName === currentUser.fullName ||
          currentUser.role === 'Admin')
    )
  }, [workOrders, currentUser])

  // Active Housekeeping Work Orders (Housekeeping ONLY)
  const housekeepingWorkOrders = useMemo(() => {
    return workOrders.filter(
      w =>
        w.type === 'Housekeeping' &&
        (w.assignedTechnicianId === currentUser.id ||
          w.assignedTechnicianName === currentUser.fullName ||
          currentUser.role === 'Admin')
    )
  }, [workOrders, currentUser])

  // Filtered Housekeeping Orders
  const displayedHkOrders = useMemo(() => {
    return housekeepingWorkOrders.filter(w => {
      if (hkFilter === 'Scheduled') return w.status === 'Scheduled'
      if (hkFilter === 'In Progress') return w.status === 'In Progress'
      if (hkFilter === 'Completed') return w.status === 'Completed'
      return w.status !== 'Completed'
    })
  }, [housekeepingWorkOrders, hkFilter])

  // KPIs for Housekeeping
  const totalHkAssigned = housekeepingWorkOrders.length
  const hkScheduledCount = housekeepingWorkOrders.filter(w => w.status === 'Scheduled').length
  const hkInProgressCount = housekeepingWorkOrders.filter(w => w.status === 'In Progress').length
  const hkCompletedCount = housekeepingWorkOrders.filter(w => w.status === 'Completed').length
  const hkOverdueCount = housekeepingWorkOrders.filter(
    w => w.status !== 'Completed' && w.dueDate < new Date().toISOString().split('T')[0]
  ).length

  // Filtered Technician Work Orders
  const displayedWorkOrders = useMemo(() => {
    return technicianWorkOrders.filter(w => {
      if (woFilter === 'Preventive') return w.type === 'Preventive' && w.status !== 'Completed'
      if (woFilter === 'Corrective') return w.type === 'Corrective' && w.status !== 'Completed'
      if (woFilter === 'Completed') return w.status === 'Completed'
      return w.status !== 'Completed'
    })
  }, [technicianWorkOrders, woFilter])

  // KPIs for Technician
  const totalAssigned = technicianWorkOrders.length
  const pmCount = technicianWorkOrders.filter(w => w.type === 'Preventive' && w.status !== 'Completed').length
  const correctiveCount = technicianWorkOrders.filter(w => w.type === 'Corrective' && w.status !== 'Completed').length
  const completedCount = technicianWorkOrders.filter(w => w.status === 'Completed').length
  const overdueCount = technicianWorkOrders.filter(
    w => w.status !== 'Completed' && w.dueDate < new Date().toISOString().split('T')[0]
  ).length

  // Assigned Inspections for Current User (Faculty, Technician, Admin, etc.)
  const userInspections = useMemo(() => {
    return inspections.filter(
      i =>
        i.assignedInspectorId === currentUser.id ||
        i.assignedInspectorName === currentUser.fullName ||
        currentUser.role === 'Admin'
    )
  }, [inspections, currentUser])

  // Filtered Inspections
  const displayedInspections = useMemo(() => {
    return userInspections.filter(i => {
      if (inspFilter === 'Pending') return i.status !== 'Completed'
      if (inspFilter === 'Completed') return i.status === 'Completed'
      return true
    })
  }, [userInspections, inspFilter])

  // KPIs for Inspections
  const totalUserInsp = userInspections.length
  const pendingUserInsp = userInspections.filter(i => i.status !== 'Completed').length
  const completedUserInsp = userInspections.filter(i => i.status === 'Completed').length
  const passedUserInsp = userInspections.filter(i => i.result === 'Pass').length
  const failedUserInsp = userInspections.filter(i => i.result === 'Fail').length
  const overdueUserInsp = userInspections.filter(
    i => i.status !== 'Completed' && i.dueDate < new Date().toISOString().split('T')[0]
  ).length

  // Service requests raised by the current user only — real RLS backs this
  // (requested_by_user_id = auth.uid()), this filter is just UI ergonomics.
  const myServiceRequests = useMemo(() => {
    return serviceRequests
      .filter(sr => sr.requestedByUserId === currentUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [serviceRequests, currentUser.id])

  // Open Inspection Execution Modal
  const handleOpenInspectionModal = (insp: Inspection) => {
    setSelectedInspection(insp)
    // Previously every checkpoint silently defaulted to 'Pass' the instant
    // this modal opened -- a rushed inspector who never touched a single
    // row could submit the whole checklist as fully passed. Items now
    // start genuinely unanswered until the inspector explicitly picks one.
    setInspAnswers({})
    setInspRemarks('')
    setInspPhotoUrl('')
    setInspItemPhotos({})
    setInspSuccessMsg(false)
  }

  // Complete Inspection from Mobile PWA
  const handleSubmitInspectionModal = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedInspection) return

    const tmpl = checklistTemplates.find(t => t.id === selectedInspection.templateId)
    const items = tmpl?.items || []

    const unansweredMandatory = items.find(item => item.mandatory && !inspAnswers[item.id])
    if (unansweredMandatory) {
      showToast('error', `Please mark Pass or Fail for the mandatory checkpoint: "${unansweredMandatory.itemText}".`)
      return
    }
    const missingPhoto = items.find(item => item.photoRequired && !inspItemPhotos[item.id])
    if (missingPhoto) {
      showToast('error', `Please attach a photo for the checkpoint: "${missingPhoto.itemText}".`)
      return
    }

    const hasFail = Object.values(inspAnswers).some(val => val === 'Fail')
    const finalResult: 'Pass' | 'Fail' = hasFail ? 'Fail' : 'Pass'
    const defaultRemark = finalResult === 'Pass'
      ? 'Physical checkpoints verified compliant on-site.'
      : 'Defect identified during physical check.'

    completeInspection(
      selectedInspection.id,
      finalResult,
      inspRemarks || defaultRemark,
      inspAnswers
    )

    setInspSuccessMsg(true)
    setTimeout(() => {
      setSelectedInspection(null)
      setInspSuccessMsg(false)
    }, 1000)
  }

  // Assets inside the Scanned Room
  const assetsInScannedRoom = useMemo(() => {
    if (!scannedRoom) return []
    return assets.filter(a => a.roomId === scannedRoom.id)
  }, [assets, scannedRoom])

  // Open Work Order Execution Modal
  const handleOpenWorkOrder = (wo: WorkOrder) => {
    setSelectedWorkOrder(wo)
    setStartPhoto(wo.startPhotoUrl || '')
    setCompletionPhoto(wo.completionPhotoUrl || '')
    setTechRemarks(wo.technicianRemarks || '')
    setIssueDiagnosed(wo.issueLogged || '')
    setActionSolution(wo.solutionTaken || '')
    setCorrectiveMode(wo.executedBy || (wo.vendorId ? 'Vendor' : 'In House'))
    setPartsList(wo.partsReplaced || [])
    
    // Find vendor from asset or work order
    const assetObj = assets.find(a => a.id === wo.assetId || a.assetId === wo.assetId)
    setSelectedVendorId(wo.vendorId || assetObj?.maintenanceVendorId || vendors[0]?.id || '')
    setVendorTicketNo(wo.vendorTicketNo || '')
    setVendorTechName(wo.vendorTechName || '')
    setVendorTechPhone(wo.vendorTechPhone || '')
    setVendorServiceDate(wo.vendorServiceDate || new Date().toISOString().split('T')[0])
    setVendorJobSheetUrl(wo.vendorJobSheetUrl || '')
    setVendorRemarks(wo.vendorRemarks || '')
    setVendorCost(wo.vendorCost)

    // Init checklist responses if PM
    const initialChecklist: Record<string, any> = {}
    if (wo.checklistSnapshot) {
      wo.checklistSnapshot.forEach(item => {
        initialChecklist[item.id] = wo.checklistResponses?.[item.id] || { value: false, remarks: '' }
      })
    }
    setChecklistResponses(initialChecklist)
  }

  // Add Part to List
  const handleAddPart = () => {
    if (!newPartName.trim()) return
    setPartsList(prev => [
      ...prev,
      {
        partName: newPartName.trim(),
        quantity: Math.max(1, newPartQty),
        notes: newPartNotes.trim(),
      },
    ])
    setNewPartName('')
    setNewPartQty(1)
    setNewPartNotes('')
  }

  const handleRemovePart = (index: number) => {
    setPartsList(prev => prev.filter((_, idx) => idx !== index))
  }

  // Submit Work Order (PM or Corrective)
  const handleSubmitWorkOrder = (status: 'In Progress' | 'Completed') => {
    if (!selectedWorkOrder) return

    // Proof of Presence Check -- previously only enforced for Corrective/
    // In-House, even though the Preventive start photo is also labeled
    // "*Required at Start" in the UI. Both are enforced now.
    if (status === 'Completed' && !startPhoto) {
      showToast('error', 'Please capture a photo at job start as proof of presence before completing this task.')
      return
    }
    if (selectedWorkOrder.type === 'Corrective' && correctiveMode === 'In House' && status === 'Completed' && !completionPhoto) {
      showToast('error', 'Please capture a completion photo before marking this job complete.')
      return
    }

    const extraUpdates: Partial<WorkOrder> = {
      startPhotoUrl: startPhoto || undefined,
      completionPhotoUrl: completionPhoto || undefined,
      executedBy: selectedWorkOrder.type === 'Corrective' ? correctiveMode : 'In House',
      technicianRemarks: techRemarks,
      issueLogged: issueDiagnosed || selectedWorkOrder.issueLogged,
      solutionTaken: actionSolution || selectedWorkOrder.solutionTaken,
      checklistResponses: selectedWorkOrder.type === 'Preventive' ? checklistResponses : undefined,
      partsReplaced: partsList.length > 0 ? partsList : undefined,
    }

    if (correctiveMode === 'Vendor') {
      extraUpdates.vendorId = selectedVendorId
      extraUpdates.vendorTicketNo = vendorTicketNo
      extraUpdates.vendorTechName = vendorTechName
      extraUpdates.vendorTechPhone = vendorTechPhone
      extraUpdates.vendorServiceDate = vendorServiceDate
      extraUpdates.vendorJobSheetUrl = vendorJobSheetUrl
      extraUpdates.vendorRemarks = vendorRemarks
      extraUpdates.vendorCost = vendorCost
    }

    updateWorkOrderStatus(selectedWorkOrder.id, status, techRemarks, extraUpdates)
    showToast('success', `Work order ${isPendingWorkOrder(selectedWorkOrder.woNumber) ? '' : selectedWorkOrder.woNumber + ' '}marked as ${status}!`)
    setSelectedWorkOrder(null)
  }

  // Handle Room Check-In
  const handleRoomCheckIn = () => {
    if (!scannedRoom) return
    if (!checkInPurpose.trim()) {
      showToast('error', 'Please enter a purpose of visit before checking in.')
      return
    }
    checkInRoom(scannedRoom.id, checkInPurpose)
    setCheckInSuccessMsg(true)
    setTimeout(() => {
      setCheckInSuccessMsg(false)
    }, 2000)
  }

  // Handle Service Request Submission — shared by both the Scan-tab inline
  // form and the standalone RaiseRequest tab (see renderServiceRequestForm).
  const handleServiceRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqRoomId) {
      showToast('error', 'Please select a room.')
      return
    }
    if (!reqDescription.trim()) {
      showToast('error', 'Please describe the problem or service needed.')
      return
    }

    const roomObj = rooms.find(r => r.id === reqRoomId)
    const targetAsset = assets.find(a => a.id === reqAssetId)
    const targetSub = targetAsset ? subCategories.find(s => s.id === targetAsset.subCategoryId) : undefined
    const finalPriority = (reqType === 'Maintenance' && targetSub?.slaPriority) || reqPriority
    const slaHours = slaConfig[finalPriority] || 24
    const slaDueDate = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString()

    const finalTitle = reqTitle.trim() || (
      reqType === 'Maintenance' && targetAsset
        ? `[Maintenance] ${targetAsset.name} - ${reqDescription.slice(0, 40)}`
        : `[${reqType}] ${roomObj?.name || 'Facility'} - ${reqDescription.slice(0, 40)}`
    )

    addServiceRequest({
      title: finalTitle,
      description: reqDescription,
      requestType: reqType,
      roomId: reqRoomId,
      assetId: reqType === 'Maintenance' ? reqAssetId || undefined : undefined,
      requestedBy: currentUser.fullName,
      requestedByRole: currentUser.role,
      status: 'Open',
      priority: finalPriority,
      slaDueDate,
      photoUrls: reqPhotoUrl ? [reqPhotoUrl] : [],
    })

    setReqSuccessMsg(true)
    setTimeout(() => {
      setReqSuccessMsg(false)
      resetServiceRequestForm()
    }, 2500)
  }

  // Handle Housekeeping Work Order Submission
  const handleHkSubmitWorkOrder = (status: 'In Progress' | 'Completed') => {
    if (!selectedHkOrder) return

    // The completion photo is labeled "*Required" in the UI but was never
    // actually enforced -- an order could be marked Completed with no
    // photo evidence and nothing checked at all.
    if (status === 'Completed' && !hkCompletionPhoto) {
      showToast('error', 'Please capture a completion photo before marking this room as done.')
      return
    }

    const checklistKeys = Object.keys(hkChecklist)
    const completedItems = checklistKeys.filter(k => hkChecklist[k])
    const checklistNotes = completedItems.length > 0
      ? `Verified tasks: ${completedItems.join(', ')}`
      : 'No checklist tasks verified.'

    const extraUpdates: Partial<WorkOrder> = {
      startPhotoUrl: hkStartPhoto || undefined,
      completionPhotoUrl: hkCompletionPhoto || undefined,
      technicianRemarks: hkNotes ? `${hkNotes} | ${checklistNotes}` : checklistNotes,
      solutionTaken: 'Room sanitized, mopped, dusted, waste cleared and hygiene replenished.',
      executedBy: 'In House',
    }

    updateWorkOrderStatus(selectedHkOrder.id, status, hkNotes || 'Sanitation completed', extraUpdates)
    showToast('success', `Housekeeping order ${isPendingWorkOrder(selectedHkOrder.woNumber) ? '' : selectedHkOrder.woNumber + ' '}updated to ${status}!`)
    setSelectedHkOrder(null)
  }


  // Selected Vendor object for Contact details
  const selectedVendorObj = vendors.find(v => v.id === selectedVendorId) || vendors[0]

  // Shared Service Request form — one field order/label set used both
  // inline in the Scan tab (room pre-filled and locked, `locked=true`) and
  // as the standalone RaiseRequest tab's content (`locked=false`, room is a
  // picker). Previously these were two independently-maintained forms with
  // different fields and separate state.
  const renderServiceRequestForm = (locked: boolean) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-bold text-white uppercase tracking-wider">Service Request Form</span>
        <span className="text-[12px] text-slate-400 font-medium">Logged by: {currentUser.fullName}</span>
      </div>

      {reqSuccessMsg && (
        <div className="bg-emerald-600 text-white p-3 text-center text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>Service Request Logged Successfully!</span>
        </div>
      )}

      <form onSubmit={handleServiceRequestSubmit} className="space-y-3 text-xs">
        {/* Request Type Toggle */}
        <div className="space-y-1">
          <label className="block text-[12px] font-bold text-slate-400 uppercase">
            Request Type <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setReqType('Maintenance'); setReqAssetId('') }}
              className={`py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 border ${
                reqType === 'Maintenance'
                  ? 'bg-blue-600 border-blue-500 text-white shadow'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Maintenance</span>
            </button>
            <button
              type="button"
              onClick={() => { setReqType('Housekeeping'); setReqAssetId('') }}
              className={`py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 border ${
                reqType === 'Housekeeping'
                  ? 'bg-purple-600 border-purple-500 text-white shadow'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Housekeeping</span>
            </button>
          </div>
        </div>

        {/* Room — locked (already scanned) or a picker */}
        <div className="space-y-1">
          <label className="block text-[12px] font-bold text-slate-400 uppercase">
            Room / Location <span className="text-rose-400">*</span>
          </label>
          {locked ? (
            <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium flex items-center justify-between">
              <span>{scannedRoom?.name} ({scannedRoom?.roomNumber})</span>
              <span className="text-[12px] text-blue-400 font-semibold">Scanned</span>
            </div>
          ) : (
            <select
              value={reqRoomId}
              onChange={e => { setReqRoomId(e.target.value); setReqAssetId('') }}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Choose Room / Location --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.roomNumber}) - {r.type}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Equipment picker, Maintenance only */}
        {reqType === 'Maintenance' && reqRoomId && (
          <div className="space-y-1">
            <label className="block text-[12px] font-bold text-slate-400 uppercase">
              Equipment in Room ({assetsInReqRoom.length} available):
            </label>
            {assetsInReqRoom.length === 0 ? (
              <p className="text-[12px] text-amber-400 italic p-2 bg-amber-950/20 border border-amber-500/20 rounded-lg">
                No specific equipment assigned to this room. Ticket will be logged for Room Infrastructure.
              </p>
            ) : (
              <select
                value={reqAssetId}
                onChange={e => setReqAssetId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- General Room Fixture (AC, Lighting, Switchboard) --</option>
                {assetsInReqRoom.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.assetId} — {a.name} ({a.manufacturer || 'Equipment'})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Priority & Short Title */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-[12px] font-bold text-slate-400 uppercase">Urgency:</label>
            {isReqPriorityAutoSet ? (
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[12px] text-slate-300">
                <span className="font-bold text-white">{reqPriority}</span>
                <span className="text-slate-500"> (auto-set)</span>
              </div>
            ) : (
              <select
                value={reqPriority}
                onChange={e => setReqPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white"
              >
                <option value="Low">Low (Routine)</option>
                <option value="Medium">Medium (Standard)</option>
                <option value="High">High (Immediate)</option>
                <option value="Critical">Critical (Breakdown)</option>
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] font-bold text-slate-400 uppercase">Short Title:</label>
            <input
              type="text"
              value={reqTitle}
              onChange={e => setReqTitle(e.target.value)}
              placeholder="e.g. Broken knob, Spilled water..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="block text-[12px] font-bold text-slate-400 uppercase">
            Issue Description <span className="text-rose-400">*</span>
          </label>
          <textarea
            rows={3}
            required
            value={reqDescription}
            onChange={e => setReqDescription(e.target.value)}
            placeholder="Describe what is malfunctioning, leaking, unhygienic, or needs immediate attention..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs"
          />
        </div>

        {/* Photo */}
        <div className="space-y-1">
          <label className="block text-[12px] font-bold text-slate-400 uppercase">Photo Evidence (Optional):</label>
          <div className="flex items-center gap-2">
            <CameraCaptureButton
              onCapture={setReqPhotoUrl}
              label={reqPhotoUrl ? 'Retake Photo' : 'Take Photo'}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
            />
          </div>
          {reqPhotoUrl && (
            <img src={reqPhotoUrl} alt="preview" className="h-16 w-auto rounded-xl object-cover border border-slate-800 mt-1" />
          )}
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition active:scale-[0.98]"
        >
          Submit Service Request
        </button>
      </form>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-0 sm:p-4 font-sans">
      {/* Mobile Frame Container */}
      <div className="relative w-full sm:max-w-md bg-slate-950 min-h-screen sm:min-h-[850px] sm:max-h-[890px] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden border border-slate-800">

        {/* Shared Toast — replaces every native alert() with one consistent,
            styled banner regardless of which tab/modal triggered it */}
        {toast && (
          <div className="absolute top-3 left-3 right-3 z-[60] animate-in fade-in slide-in-from-top-2">
            <div className={`rounded-2xl shadow-2xl border px-4 py-3 flex items-start gap-2.5 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/95 border-rose-500/40 text-rose-200'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="flex-1">{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-70 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="bg-slate-900 border-b border-slate-800 p-4 pt-5 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-blue-500/20">
                AFMS
              </div>
              <div>
                <span className="font-bold text-sm text-white tracking-tight">Field Operations PWA</span>
                <span className="block text-[12px] text-blue-400 font-mono">v2.4</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadNotificationCount}
                onMarkRead={markNotificationRead}
              />
              {currentUser.role === 'Admin' && (
                <Link
                  href="/dashboard"
                  className="text-[12px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-xl transition"
                >
                  Desktop Mode
                </Link>
              )}
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                {currentUser.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">{currentUser.fullName}</p>
                <span className="inline-block text-[12px] font-semibold text-blue-400">
                  {currentUser.department || 'Operations'}
                </span>
              </div>
            </div>
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wide px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg">
              {currentUser.role}
            </span>
          </div>

          {/* Active Room Check-In Status Bar */}
          {activeCheckIn && (
            <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div>
                  <p className="text-[12px] font-bold text-emerald-300">Active in: {activeCheckIn.roomName}</p>
                  <p className="text-[12px] text-slate-400 line-clamp-1">{activeCheckIn.purpose}</p>
                  <p className="text-[12px] text-amber-400/90 font-medium">● Auto-checkout at 11:59 PM today</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => checkOutRoom(activeCheckIn.roomId)}
                className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-[12px] font-bold rounded-lg shadow transition active:scale-[0.98]"
              >
                Check Out
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Screen Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: TECHNICIAN TASKS & WORK ORDERS */}
          {activeTab === 'Tasks' && (
            <div className="space-y-4 animate-in fade-in">
              
              {/* Technician KPI Summary Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-blue-400">
                    <ClipboardList className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-slate-400 uppercase">Assigned</span>
                  </div>
                  <p className="text-xl font-black text-white">{totalAssigned}</p>
                  <p className="text-[12px] text-slate-400">Total Work Orders</p>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-emerald-400">
                    <Wrench className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-emerald-400 uppercase">PM Due</span>
                  </div>
                  <p className="text-xl font-black text-emerald-300">{pmCount}</p>
                  <p className="text-[12px] text-slate-400">Preventive Tasks</p>
                </div>

                <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-amber-400 uppercase">Breakdowns</span>
                  </div>
                  <p className="text-xl font-black text-amber-300">{correctiveCount}</p>
                  <p className="text-[12px] text-slate-400">Corrective Jobs</p>
                </div>

                <div className="bg-purple-950/30 border border-purple-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-purple-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-purple-400 uppercase">Closed</span>
                  </div>
                  <p className="text-xl font-black text-purple-300">{completedCount}</p>
                  <p className="text-[12px] text-slate-400">Completed Service</p>
                </div>
              </div>

              {/* Overdue Alert Banner if any */}
              {overdueCount > 0 && (
                <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-xl text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{overdueCount} maintenance task(s) overdue or due today!</span>
                </div>
              )}

              {/* Work Order Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'ALL', label: `All Active (${pmCount + correctiveCount})` },
                  { id: 'Preventive', label: `Preventive (${pmCount})` },
                  { id: 'Corrective', label: `Corrective (${correctiveCount})` },
                  { id: 'Completed', label: `Done (${completedCount})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWoFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                      woFilter === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Work Orders List Feed */}
              <div className="space-y-3">
                {displayedWorkOrders.length === 0 ? (
                  <div className="text-center py-12 space-y-2 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">All caught up!</p>
                    <p className="text-[12px] text-slate-500">No work orders matching this filter.</p>
                  </div>
                ) : (
                  displayedWorkOrders.map(wo => {
                    const targetAsset = assets.find(a => a.id === wo.assetId || a.assetId === wo.assetId)
                    const targetRoom = rooms.find(r => r.id === targetAsset?.roomId || r.id === wo.roomId)

                    // Priority styling
                    const priorityColor =
                      wo.priority === 'Critical'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : wo.priority === 'High'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : wo.priority === 'Medium'
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'

                    return (
                      <div
                        key={wo.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm hover:border-slate-700 transition"
                      >
                        {/* Header: ID, Priority, Type */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-white">{isPendingWorkOrder(wo.woNumber) ? 'Pending Assignment' : wo.woNumber}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[12px] font-bold border ${
                              wo.type === 'Preventive'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}>
                              {wo.type}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${priorityColor}`}>
                            {wo.priority || 'Medium'}
                          </span>
                        </div>

                        {/* Title & Target Details */}
                        <div>
                          <p className="text-xs font-bold text-slate-100">{wo.title || 'Maintenance Task'}</p>
                          <p className="text-[12px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{targetAsset ? `${targetAsset.name} (${targetAsset.assetId})` : 'Room Equipment'}</span>
                          </p>
                          {targetRoom && (
                            <p className="text-[12px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <DoorOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{targetRoom.name} ({targetRoom.roomNumber})</span>
                            </p>
                          )}
                        </div>

                        {/* Due Date & Action Bar */}
                        {(() => {
                          const windowStatus = wo.type === 'Preventive' ? getAttemptWindowStatus(wo.dueDate, wo.frequency) : null
                          const isLocked = windowStatus ? !windowStatus.canAttempt && wo.status !== 'Completed' : false

                          return (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[12px]">
                              <div>
                                <span className="text-slate-400 flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  Due: {wo.dueDate}
                                </span>
                                {isLocked && windowStatus && (
                                  <span className="text-[12px] text-amber-400/90 font-medium block mt-0.5">
                                    Window: {windowStatus.windowDescription}
                                  </span>
                                )}
                              </div>

                              {isLocked ? (
                                <div
                                  className="inline-flex items-center gap-1 bg-slate-800/80 text-slate-400 font-semibold text-[12px] px-2.5 py-1.5 rounded-xl border border-slate-700/60 cursor-not-allowed"
                                  title={`Attempt window opens on ${windowStatus?.unlockDate} (${windowStatus?.windowDescription})`}
                                >
                                  <Lock className="w-3 h-3 text-amber-400" />
                                  <span>Opens {windowStatus?.unlockDate}</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWorkOrder(wo)}
                                  className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition active:scale-[0.98]"
                                >
                                  <span>Execute Task</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })
                )}
              </div>

            </div>
          )}

          {/* TAB: HOUSEKEEPING & SANITIZATION (FOR HOUSEKEEPING STAFF & ADMIN) */}
          {activeTab === 'Housekeeping' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Housekeeping KPI Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-purple-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-slate-400 uppercase">Assigned</span>
                  </div>
                  <p className="text-xl font-black text-white">{totalHkAssigned}</p>
                  <p className="text-[12px] text-slate-400">Housekeeping Orders</p>
                </div>

                <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-amber-400 uppercase">Scheduled</span>
                  </div>
                  <p className="text-xl font-black text-amber-300">{hkScheduledCount}</p>
                  <p className="text-[12px] text-slate-400">Ready for Cleaning</p>
                </div>

                <div className="bg-blue-950/30 border border-blue-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-blue-400">
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-blue-400 uppercase">In Progress</span>
                  </div>
                  <p className="text-xl font-black text-blue-300">{hkInProgressCount}</p>
                  <p className="text-[12px] text-slate-400">Under Sanitization</p>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-emerald-400 uppercase">Completed</span>
                  </div>
                  <p className="text-xl font-black text-emerald-300">{hkCompletedCount}</p>
                  <p className="text-[12px] text-slate-400">Sanitized & Closed</p>
                </div>
              </div>

              {/* Overdue Alert */}
              {hkOverdueCount > 0 && (
                <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-xl text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{hkOverdueCount} cleaning schedule(s) due or overdue!</span>
                </div>
              )}

              {/* Housekeeping Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'ALL', label: `All Active (${hkScheduledCount + hkInProgressCount})` },
                  { id: 'Scheduled', label: `Scheduled (${hkScheduledCount})` },
                  { id: 'In Progress', label: `In Progress (${hkInProgressCount})` },
                  { id: 'Completed', label: `Done (${hkCompletedCount})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHkFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                      hkFilter === tab.id
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Housekeeping Work Orders Feed */}
              <div className="space-y-3">
                {displayedHkOrders.length === 0 ? (
                  <div className="text-center py-12 space-y-2 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">All spaces sanitized!</p>
                    <p className="text-[12px] text-slate-500">No housekeeping orders in this filter queue.</p>
                  </div>
                ) : (
                  displayedHkOrders.map(wo => {
                    const targetRoom = rooms.find(r => r.id === wo.roomId)

                    return (
                      <div
                        key={wo.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-white">{isPendingWorkOrder(wo.woNumber) ? 'Pending Assignment' : wo.woNumber}</span>
                            <span className="px-2 py-0.5 rounded-md text-[12px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Housekeeping
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${
                            wo.status === 'Completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : wo.status === 'In Progress'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {wo.status}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-100">{wo.title || 'Room Sanitization'}</p>
                          {targetRoom && (
                            <p className="text-[12px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <DoorOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{targetRoom.name} ({targetRoom.roomNumber})</span>
                            </p>
                          )}
                          {wo.issueLogged && (
                            <p className="text-[12px] text-slate-400 italic mt-1 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/80">
                              "{wo.issueLogged}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[12px]">
                          <span className="text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Due: {wo.dueDate}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHkOrder(wo)
                              setHkStartPhoto(wo.startPhotoUrl || '')
                              setHkCompletionPhoto(wo.completionPhotoUrl || '')
                              setHkNotes(wo.technicianRemarks || '')
                              setHkChecklist(emptyHkChecklist)
                            }}
                            className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition active:scale-[0.98]"
                          >
                            <span>Perform Cleaning</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: ASSIGNED INSPECTIONS & QUALITY CHECKLISTS */}
          {activeTab === 'Inspections' && (
            <div className="space-y-4 animate-in fade-in">
              
              {/* Inspection Summary Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-blue-400">
                    <FileCheck className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-slate-400 uppercase">Assigned</span>
                  </div>
                  <p className="text-xl font-black text-white">{totalUserInsp}</p>
                  <p className="text-[12px] text-slate-400">Total Inspections</p>
                </div>

                <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-amber-400 uppercase">Pending</span>
                  </div>
                  <p className="text-xl font-black text-amber-300">{pendingUserInsp}</p>
                  <p className="text-[12px] text-slate-400">Action Required</p>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-emerald-400 uppercase">Passed</span>
                  </div>
                  <p className="text-xl font-black text-emerald-300">{passedUserInsp}</p>
                  <p className="text-[12px] text-slate-400">Compliant Assets</p>
                </div>

                <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[12px] font-bold text-rose-400 uppercase">Defects</span>
                  </div>
                  <p className="text-xl font-black text-rose-300">{failedUserInsp}</p>
                  <p className="text-[12px] text-slate-400">Failed / Repair Raised</p>
                </div>
              </div>

              {/* Overdue Alert */}
              {overdueUserInsp > 0 && (
                <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-xl text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{overdueUserInsp} inspection(s) overdue or pending sign-off!</span>
                </div>
              )}

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'Pending', label: `Pending (${pendingUserInsp})` },
                  { id: 'Completed', label: `Completed (${completedUserInsp})` },
                  { id: 'ALL', label: `All (${totalUserInsp})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInspFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                      inspFilter === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Inspections Feed */}
              <div className="space-y-3">
                {displayedInspections.length === 0 ? (
                  <div className="text-center py-12 space-y-2 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">No inspections in this queue</p>
                    <p className="text-[12px] text-slate-500">You are all caught up on your inspections.</p>
                  </div>
                ) : (
                  displayedInspections.map(insp => {
                    const targetAsset = assets.find(a => a.id === insp.assetId || a.assetId === insp.assetId)
                    const targetRoom = rooms.find(r => r.id === targetAsset?.roomId)
                    const tmpl = checklistTemplates.find(t => t.id === insp.templateId)
                    const isPending = insp.status !== 'Completed'

                    return (
                      <div
                        key={insp.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm hover:border-slate-700 transition"
                      >
                        {/* Card Header: Inspection #, Result or Status Badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-white">{insp.inspectionNumber}</span>
                            <span className="text-[12px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                              {tmpl?.interval || 'Quarterly'}
                            </span>
                          </div>

                          {insp.status === 'Completed' ? (
                            insp.result === 'Pass' ? (
                              <span className="px-2 py-0.5 rounded-full text-[12px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>PASS</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[12px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <X className="w-3 h-3" />
                                <span>FAIL (Repair Raised)</span>
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[12px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {insp.status}
                            </span>
                          )}
                        </div>

                        {/* Title & Target Details */}
                        <div>
                          <p className="text-xs font-bold text-slate-100">{tmpl?.title || 'Statutory Inspection'}</p>
                          <p className="text-[12px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{targetAsset ? `${targetAsset.name} (${targetAsset.assetId})` : 'Target Asset'}</span>
                          </p>
                          {targetRoom && (
                            <p className="text-[12px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <DoorOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{targetRoom.name} ({targetRoom.roomNumber})</span>
                            </p>
                          )}
                        </div>

                        {/* Due Date & Action */}
                        {(() => {
                          const windowStatus = getAttemptWindowStatus(insp.dueDate, tmpl?.interval)
                          const isLocked = isPending && !windowStatus.canAttempt

                          return (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[12px]">
                              <div>
                                <span className="text-slate-400 flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  Due: {insp.dueDate}
                                </span>
                                {isLocked && (
                                  <span className="text-[12px] text-amber-400/90 font-medium block mt-0.5">
                                    Window: {windowStatus.windowDescription}
                                  </span>
                                )}
                              </div>

                              {isPending ? (
                                isLocked ? (
                                  <div
                                    className="inline-flex items-center gap-1 bg-slate-800/80 text-slate-400 font-semibold text-[12px] px-2.5 py-1.5 rounded-xl border border-slate-700/60 cursor-not-allowed"
                                    title={`Inspection window opens on ${windowStatus.unlockDate} (${windowStatus.windowDescription})`}
                                  >
                                    <Lock className="w-3 h-3 text-amber-400" />
                                    <span>Opens {windowStatus.unlockDate}</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenInspectionModal(insp)}
                                    className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition active:scale-[0.98]"
                                  >
                                    <FileCheck className="w-3.5 h-3.5" />
                                    <span>Conduct Inspection</span>
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setViewingInspection(insp)}
                                  className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-2.5 py-1.5 rounded-xl border border-slate-700 transition"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Results</span>
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })
                )}
              </div>

            </div>
          )}

          {/* TAB 2: QR SCANNER & CONTEXTUAL FIELD ACTIONS */}
          {activeTab === 'Scan' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white">Scan Room or Equipment QR</h3>
                <p className="text-xs text-slate-400">Access room controls, check-in, and instant fault reporting</p>
              </div>

              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-600/20 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan with Camera</span>
              </button>

              {/* QR Scanner Simulation / Selector (manual fallback / QA tool) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300">Or select manually:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScannedEntityType('Room')
                      setScannedRoom(rooms[0])
                      setScannedAsset(null)
                      setReqRoomId(rooms[0]?.id || '')
                      setReqAssetId('')
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      scannedEntityType === 'Room'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <DoorOpen className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-bold">Scan Room QR</span>
                    <span className="text-[12px] text-slate-500">Check-in &amp; Services</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScannedEntityType('Asset')
                      setScannedAsset(assets[0])
                      setScannedRoom(null)
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      scannedEntityType === 'Asset'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Boxes className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold">Scan Asset QR</span>
                    <span className="text-[12px] text-slate-500">Health &amp; Specs</span>
                  </button>
                </div>
              </div>

              {/* 1. SCANNED ROOM CONTEXT */}
              {scannedEntityType === 'Room' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 animate-in fade-in">
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-[12px] font-bold text-blue-400 uppercase tracking-wider">Scanned Room</span>
                      <h4 className="text-sm font-black text-white">{scannedRoom?.name}</h4>
                      <p className="text-xs text-slate-400">Room #{scannedRoom?.roomNumber} • {scannedRoom?.type}</p>
                    </div>
                    <span className="bg-slate-800 text-slate-300 text-[12px] font-semibold px-2 py-1 rounded-md">
                      {assetsInScannedRoom.length} Assets in Room
                    </span>
                  </div>

                  {/* Manual room switch, in case the QR-scanned room isn't
                      the one the user actually meant, or camera scanning
                      isn't available on this device */}
                  <div>
                    <label className="block text-[12px] font-bold text-slate-400 uppercase mb-1">Or Choose Manually:</label>
                    <select
                      value={scannedRoom?.id}
                      onChange={e => {
                        const r = rooms.find(room => room.id === e.target.value)
                        if (r) {
                          setScannedRoom(r)
                          setReqRoomId(r.id)
                          setReqAssetId('')
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.roomNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action 1: Room Check-In */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <DoorOpen className="w-4 h-4 text-emerald-400" />
                      Room Access &amp; Check-In
                    </p>

                    <div>
                      <label className="block text-[12px] text-slate-400 mb-1">Purpose of Visit: <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        required
                        value={checkInPurpose}
                        onChange={e => setCheckInPurpose(e.target.value)}
                        placeholder="e.g. Class session, Inspection, Equipment check..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleRoomCheckIn}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition active:scale-[0.98]"
                    >
                      {checkInSuccessMsg ? '✓ Checked In Successfully!' : 'Confirm Check-In to Room'}
                    </button>
                  </div>

                  {/* Action 2: Raise Service Request from Room — shared form,
                      room pre-filled and locked since it's already scanned */}
                  {renderServiceRequestForm(true)}
                </div>
              )}

              {/* 2. SCANNED ASSET CONTEXT */}
              {scannedEntityType === 'Asset' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-[12px] font-bold text-emerald-400 uppercase tracking-wider">Scanned Equipment</span>
                      <h4 className="text-sm font-black text-white">{scannedAsset?.name}</h4>
                      <p className="text-xs font-mono text-slate-400">{scannedAsset?.assetId} • {scannedAsset?.manufacturer || 'Standard'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[12px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {scannedAsset?.status}
                    </span>
                  </div>

                  {/* Manual asset switch, same reasoning as the room switcher above */}
                  <div>
                    <label className="block text-[12px] font-bold text-slate-400 uppercase mb-1">Or Choose Manually:</label>
                    <select
                      value={scannedAsset?.id}
                      onChange={e => {
                        const a = assets.find(ast => ast.id === e.target.value)
                        if (a) setScannedAsset(a)
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.assetId} — {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Model No:</span>
                      <span className="text-white font-mono">{scannedAsset?.modelNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Serial No:</span>
                      <span className="text-white font-mono">{scannedAsset?.serialNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Warranty Expiry:</span>
                      <span className="text-white">{scannedAsset?.warrantyTill || 'Active'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      // Pre-fill raise service request for this asset
                      const rm = rooms.find(r => r.id === scannedAsset?.roomId) || rooms[0]
                      setScannedRoom(rm)
                      setScannedEntityType('Room')
                      setReqType('Maintenance')
                      setReqRoomId(rm.id)
                      setReqAssetId(scannedAsset?.id || '')
                    }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    Report Breakdown for this Asset
                  </button>
                </div>
              )}

            </div>
          )}

          {/* TAB: RAISE SERVICE TICKET (UNIVERSAL FOR ALL USERS) */}
          {activeTab === 'RaiseRequest' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white">Log Service Request</h3>
                <p className="text-xs text-slate-400">Directly report equipment breakdown or housekeeping needs</p>
              </div>

              {/* Quick Scan QR Trigger Shortcut */}
              <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Have a Room or Asset QR code?</p>
                    <p className="text-[12px] text-blue-300">Scan to auto-fill location &amp; equipment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('Scan')
                    setScannedEntityType('Room')
                    setScannedRoom(rooms[0])
                    setReqRoomId(rooms[0]?.id || '')
                    setReqAssetId('')
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition"
                >
                  Scan QR
                </button>
              </div>

              {/* Universal Direct Submission Form — shared with the Scan
                  tab's inline version; room is a free picker here */}
              {renderServiceRequestForm(false)}
            </div>
          )}

          {/* TAB: MY RAISED REQUESTS (own service requests only, every role) */}
          {activeTab === 'MyRequests' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">My Requests</h3>
                <span className="text-[12px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                  {myServiceRequests.length} total
                </span>
              </div>

              {myServiceRequests.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
                  <ClipboardList className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">You haven&apos;t raised any service requests yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('RaiseRequest')}
                    className="text-[12px] font-bold text-blue-400 hover:text-blue-300"
                  >
                    Raise a request →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {myServiceRequests.map(sr => {
                    const srRoom = rooms.find(r => r.id === sr.roomId)
                    return (
                    <button
                      key={sr.id}
                      type="button"
                      onClick={() => setViewingRequest(sr)}
                      className="w-full text-left bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3 space-y-1.5 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {sr.ticketId}
                        </span>
                        <span
                          className={`text-[12px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                            sr.status === 'Open'
                              ? 'bg-blue-500/20 text-blue-300'
                              : sr.status === 'In Progress'
                              ? 'bg-amber-500/20 text-amber-300'
                              : sr.status === 'Escalated'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {sr.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-100 line-clamp-2">{sr.title}</p>
                      <div className="flex items-center justify-between text-[12px] text-slate-500">
                        <span>{srRoom ? `${srRoom.name} • ` : ''}{sr.requestType} • {sr.priority}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(sr.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {requestStatusExplanation(sr) && (
                        <p className="text-[12px] text-slate-400 pt-1.5 border-t border-slate-800 italic">
                          {requestStatusExplanation(sr)}
                        </p>
                      )}
                    </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE & APP CONFIG */}
          {activeTab === 'Profile' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-2xl mx-auto">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{currentUser.fullName}</h3>
                  <p className="text-xs text-slate-400">{currentUser.email}</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Role: {currentUser.role}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Department:</span>
                  <span className={currentUser.department ? 'text-white font-medium' : 'text-slate-500 italic'}>
                    {currentUser.department || 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Mobile Phone:</span>
                  <span className={currentUser.phone ? 'text-white font-mono' : 'text-slate-500 italic'}>
                    {currentUser.phone || 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Connection:</span>
                  <span className={`font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ● {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {currentUser.role === 'Admin' && (
                <Link
                  href="/dashboard"
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition"
                >
                  <span>Switch to Desktop Management</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  logout()
                  router.push('/login')
                }}
                className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl border border-rose-500/30 flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

        </div>

        {/* Bottom Tab Navigation Bar (Dynamic based on user role) */}
        <div className="bg-slate-900 border-t border-slate-800 px-3 py-2.5 flex items-center justify-around shrink-0">
          {availableTabs.map(tab => {
            if (tab === 'Tasks') {
              return (
                <button
                  key="Tasks"
                  type="button"
                  onClick={() => setActiveTab('Tasks')}
                  className={`flex flex-col items-center gap-1 text-[12px] font-bold transition relative ${
                    activeTab === 'Tasks' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div className="relative">
                    <ClipboardList className="w-5 h-5" />
                    {totalAssigned > 0 && (
                      <span className="absolute -top-1 -right-2 bg-blue-500 text-white font-black text-[12px] w-4 h-4 rounded-full flex items-center justify-center">
                        {totalAssigned}
                      </span>
                    )}
                  </div>
                  <span>Tasks</span>
                </button>
              )
            }

            if (tab === 'Housekeeping') {
              return (
                <button
                  key="Housekeeping"
                  type="button"
                  onClick={() => setActiveTab('Housekeeping')}
                  className={`flex flex-col items-center gap-1 text-[12px] font-bold transition relative ${
                    activeTab === 'Housekeeping' ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div className="relative">
                    <Sparkles className="w-5 h-5" />
                    {totalHkAssigned > 0 && (
                      <span className="absolute -top-1 -right-2 bg-purple-500 text-white font-black text-[12px] w-4 h-4 rounded-full flex items-center justify-center">
                        {totalHkAssigned}
                      </span>
                    )}
                  </div>
                  <span>Cleaning</span>
                </button>
              )
            }

            if (tab === 'Inspections') {
              return (
                <button
                  key="Inspections"
                  type="button"
                  onClick={() => setActiveTab('Inspections')}
                  className={`flex flex-col items-center gap-1 text-[12px] font-bold transition relative ${
                    activeTab === 'Inspections' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div className="relative">
                    <FileCheck className="w-5 h-5" />
                    {pendingUserInsp > 0 && (
                      <span className="absolute -top-1 -right-2 bg-amber-500 text-slate-950 font-black text-[12px] w-4 h-4 rounded-full flex items-center justify-center">
                        {pendingUserInsp}
                      </span>
                    )}
                  </div>
                  <span>Inspections</span>
                </button>
              )
            }

            if (tab === 'Scan') {
              return (
                <button
                  key="Scan"
                  type="button"
                  onClick={() => setActiveTab('Scan')}
                  className={`flex flex-col items-center gap-1 text-[12px] font-bold transition ${
                    activeTab === 'Scan' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span>Scan QR</span>
                </button>
              )
            }

            if (tab === 'RaiseRequest') {
              return (
                <button
                  key="RaiseRequest"
                  type="button"
                  onClick={() => setActiveTab('RaiseRequest')}
                  className={`flex flex-col items-center gap-1 text-[12px] font-bold transition ${
                    activeTab === 'RaiseRequest' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  <span>Request</span>
                </button>
              )
            }

            if (tab === 'MyRequests') {
              return (
                <button
                  key="MyRequests"
                  type="button"
                  onClick={() => setActiveTab('MyRequests')}
                  className={`flex flex-col items-center gap-1 text-[12px] font-bold transition relative ${
                    activeTab === 'MyRequests' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>My Requests</span>
                </button>
              )
            }

            if (tab === 'Profile') {
              return (
                <button
                  key="Profile"
                  type="button"
                  onClick={() => setActiveTab('Profile')}
                  className={`flex flex-col items-center gap-1 text-[12px] font-bold transition ${
                    activeTab === 'Profile' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Profile</span>
                </button>
              )
            }

            return null
          })}
        </div>

      </div>

      {showCameraScanner && (
        <QrScanner onDetected={handleQrDetected} onClose={() => setShowCameraScanner(false)} />
      )}

      {/* ========================================================================= */}
      {/* WORK ORDER EXECUTION MODAL (PREVENTIVE VS CORRECTIVE / IN-HOUSE VS VENDOR) */}
      {/* ========================================================================= */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            
            {/* Modal Header */}
            <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{selectedWorkOrder.woNumber}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[12px] font-bold border ${
                    selectedWorkOrder.type === 'Preventive'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    {selectedWorkOrder.type} Maintenance
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedWorkOrder.title}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWorkOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              
              {/* ========================================================= */}
              {/* FLOW 1: PREVENTIVE MAINTENANCE (PM) EXECUTION             */}
              {/* ========================================================= */}
              {selectedWorkOrder.type === 'Preventive' && (
                <div className="space-y-4">
                  
                  {/* Step 1: Proof of Presence (Selfie/Photo with Asset at Start) */}
                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-blue-400" />
                        1. Job Start Proof Photo (Mandatory)
                      </p>
                      <span className="text-[12px] text-amber-400 font-semibold">*Required at Start</span>
                    </div>
                    <p className="text-[12px] text-slate-400">
                      Technician must take a photo with the asset on site before servicing.
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <CameraCaptureButton
                        onCapture={setStartPhoto}
                        label={startPhoto ? 'Retake Proof Photo' : 'Snap Proof'}
                      />
                    </div>

                    {startPhoto && (
                      <div className="relative inline-block mt-2">
                        <img src={startPhoto} alt="Start proof" className="h-20 w-auto rounded-xl object-cover border border-emerald-500/40" />
                        <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[12px] px-1.5 py-0.5 rounded font-bold">
                          ✓ Presence Verified
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Step 2: PM Checklist Execution */}
                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-3">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-emerald-400" />
                      2. Preventive Checklist Verification
                    </p>

                    <div className="space-y-2">
                      {selectedWorkOrder.checklistSnapshot && selectedWorkOrder.checklistSnapshot.length > 0 ? (
                        selectedWorkOrder.checklistSnapshot.map((item, idx) => {
                          const currentVal = checklistResponses[item.id]?.value || false
                          const itemRemarks = checklistResponses[item.id]?.remarks || ''
                          return (
                            <div
                              key={item.id}
                              className={`p-2.5 rounded-xl border transition ${
                                currentVal
                                  ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  setChecklistResponses(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], value: !currentVal },
                                  }))
                                }}
                                className="flex items-center justify-between cursor-pointer"
                              >
                                <span className="text-xs font-medium pr-2">
                                  {idx + 1}. {item.itemText}
                                </span>
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                  currentVal
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'border-slate-700 bg-slate-950'
                                }`}>
                                  {currentVal && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                              {/* Per-item remarks — previously the data model
                                  supported this (checklistResponses[id].remarks)
                                  but there was no way to actually enter it */}
                              <input
                                type="text"
                                value={itemRemarks}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setChecklistResponses(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], remarks: e.target.value },
                                }))}
                                placeholder="Add a note for this item (optional)..."
                                className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[12px] text-slate-200 placeholder:text-slate-600"
                              />
                            </div>
                          )
                        })
                      ) : (
                        // Standard default checklist if none attached
                        ['Clean air filter & coils', 'Check compressor pressure', 'Inspect electrical wiring & earth continuity', 'Verify temperature differential'].map((txt, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <span className="text-xs">{idx + 1}. {txt}</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Step 3: Technician Remarks */}
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-bold text-slate-400 uppercase">
                      3. Technician Service Remarks:
                    </label>
                    <textarea
                      rows={2}
                      value={techRemarks}
                      onChange={e => setTechRemarks(e.target.value)}
                      placeholder="Enter details of cleaning, oil lubrication, sensor calibration done..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>

                  {/* Step 4: Completion Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-bold text-slate-400 uppercase">
                      4. Post-Service Asset Completion Photo:
                    </label>
                    <div className="flex items-center gap-2">
                      <CameraCaptureButton
                        onCapture={setCompletionPhoto}
                        label={completionPhoto ? 'Retake Photo' : 'Take Photo'}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
                      />
                    </div>
                    {completionPhoto && (
                      <img src={completionPhoto} alt="Completion proof" className="h-20 w-auto rounded-xl object-cover border border-slate-700 mt-1" />
                    )}
                  </div>

                </div>
              )}

              {/* ========================================================= */}
              {/* FLOW 2: CORRECTIVE BREAKDOWN (IN-HOUSE VS VENDOR)         */}
              {/* ========================================================= */}
              {selectedWorkOrder.type === 'Corrective' && (
                <div className="space-y-4">
                  
                  {/* Execution Mode Selector Toggle */}
                  <div className="bg-slate-950 p-1.5 rounded-2xl border border-slate-800 grid grid-cols-2 gap-1.5 text-xs font-bold text-center">
                    <button
                      type="button"
                      onClick={() => setCorrectiveMode('In House')}
                      className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        correctiveMode === 'In House'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                      <span>In-House Maintenance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCorrectiveMode('Vendor')}
                      className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                        correctiveMode === 'Vendor'
                          ? 'bg-amber-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      <span>Handover to Vendor</span>
                    </button>
                  </div>

                  {/* OPTION A: IN-HOUSE BREAKDOWN MAINTENANCE */}
                  {correctiveMode === 'In House' && (
                    <div className="space-y-3.5">
                      {/* Step 1: Proof Photo at Start */}
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <Camera className="w-4 h-4 text-blue-400" />
                            1. Start Proof Photo (Mandatory for In-House)
                          </p>
                          <span className="text-[12px] text-amber-400 font-semibold">*Required</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CameraCaptureButton
                            onCapture={setStartPhoto}
                            label={startPhoto ? 'Retake Photo' : 'Snap'}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
                          />
                        </div>
                        {startPhoto && (
                          <img src={startPhoto} alt="Start proof" className="h-20 w-auto rounded-lg object-cover border border-slate-700 mt-1" />
                        )}
                      </div>

                      {/* Step 2: Problem Diagnosed */}
                      <div className="space-y-1">
                        <label className="block text-[12px] font-bold text-slate-400 uppercase">
                          2. What was the Diagnosed Problem?
                        </label>
                        <textarea
                          rows={2}
                          value={issueDiagnosed}
                          onChange={e => setIssueDiagnosed(e.target.value)}
                          placeholder="Describe the root cause (e.g. capacitor blown, pipe leakage, belt worn out)..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                        />
                      </div>

                      {/* Step 3: Action Taken / Solution */}
                      <div className="space-y-1">
                        <label className="block text-[12px] font-bold text-slate-400 uppercase">
                          3. Action Taken / Solution:
                        </label>
                        <textarea
                          rows={2}
                          value={actionSolution}
                          onChange={e => setActionSolution(e.target.value)}
                          placeholder="Describe what repair, soldering, rewiring or calibration was performed..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                        />
                      </div>

                      {/* Step 4: Spare Parts Used / Replaced */}
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-emerald-400" />
                            4. Spare Parts Used / Replaced
                          </p>
                          <span className="text-[12px] text-slate-400">{partsList.length} part(s) recorded</span>
                        </div>

                        {/* Add Part Row */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newPartName}
                              onChange={e => setNewPartName(e.target.value)}
                              placeholder="Part Name (e.g. 50uF Capacitor)"
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                            />
                            <input
                              type="number"
                              min={1}
                              value={newPartQty}
                              onChange={e => setNewPartQty(parseInt(e.target.value) || 1)}
                              className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center"
                            />
                            <button
                              type="button"
                              onClick={handleAddPart}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs"
                            >
                              + Add
                            </button>
                          </div>
                        </div>

                        {/* List of Added Parts */}
                        {partsList.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {partsList.map((p, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                <span className="font-medium text-slate-200">
                                  {p.partName} <span className="text-emerald-400 font-bold">(Qty: {p.quantity})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePart(pIdx)}
                                  className="text-rose-400 hover:text-rose-300 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Step 5: Completion Photo */}
                      <div className="space-y-1">
                        <label className="block text-[12px] font-bold text-slate-400 uppercase">
                          5. Repaired Asset Completion Photo:
                        </label>
                        <div className="flex items-center gap-2">
                          <CameraCaptureButton
                            onCapture={setCompletionPhoto}
                            label={completionPhoto ? 'Retake Photo' : 'Snap'}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
                          />
                        </div>
                        {completionPhoto && (
                          <img src={completionPhoto} alt="Completion proof" className="h-20 w-auto rounded-xl object-cover border border-slate-700 mt-1" />
                        )}
                      </div>

                    </div>
                  )}

                  {/* OPTION B: VENDOR MAINTENANCE HANDOVER */}
                  {correctiveMode === 'Vendor' && (
                    <div className="space-y-3.5 animate-in fade-in">
                      
                      {/* Vendor Selector */}
                      <div className="space-y-1">
                        <label className="block text-[12px] font-bold text-slate-400 uppercase">Select Service Vendor:</label>
                        <select
                          value={selectedVendorId}
                          onChange={e => setSelectedVendorId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                        >
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.categorySupplied})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Vendor Contact Information Card */}
                      {selectedVendorObj && (
                        <div className="bg-amber-950/20 border border-amber-500/30 p-3.5 rounded-2xl space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[12px] font-bold text-amber-400 uppercase tracking-wider">Assigned Vendor Contact</span>
                              <h4 className="text-xs font-bold text-white mt-0.5">{selectedVendorObj.name}</h4>
                              <p className="text-[12px] text-slate-300">Contact: {selectedVendorObj.contactPerson}</p>
                            </div>
                            <span className="bg-amber-500/20 text-amber-300 text-[12px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                              {selectedVendorObj.hasAmc ? 'AMC Active' : 'On-Demand'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-500/20 text-[12px]">
                            <a
                              href={`tel:${selectedVendorObj.phone}`}
                              className="flex items-center gap-1.5 bg-slate-900 p-2 rounded-xl border border-slate-800 text-emerald-400 font-bold hover:bg-slate-800 transition"
                            >
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{selectedVendorObj.phone || 'Call Vendor'}</span>
                            </a>
                            <a
                              href={`mailto:${selectedVendorObj.email}`}
                              className="flex items-center gap-1.5 bg-slate-900 p-2 rounded-xl border border-slate-800 text-blue-400 font-medium hover:bg-slate-800 transition truncate"
                            >
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{selectedVendorObj.email || 'Email'}</span>
                            </a>
                          </div>

                          {selectedVendorObj.amcContractNo && (
                            <p className="text-[12px] text-slate-400">
                              AMC Contract #{selectedVendorObj.amcContractNo} (Valid till {selectedVendorObj.amcEndDate || 'Active'})
                            </p>
                          )}
                        </div>
                      )}

                      {/* Vendor Update Fields Form */}
                      <div className="space-y-2.5 pt-1">
                        <p className="text-[12px] font-bold text-white uppercase tracking-wider">Update Vendor Service Records:</p>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[12px] text-slate-400">Vendor Ticket / Job No:</label>
                            <input
                              type="text"
                              value={vendorTicketNo}
                              onChange={e => setVendorTicketNo(e.target.value)}
                              placeholder="e.g. VND-JOB-8841"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[12px] text-slate-400">Service Visit Date:</label>
                            <input
                              type="date"
                              value={vendorServiceDate}
                              onChange={e => setVendorServiceDate(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[12px] text-slate-400">Vendor Technician Name:</label>
                            <input
                              type="text"
                              value={vendorTechName}
                              onChange={e => setVendorTechName(e.target.value)}
                              placeholder="Engineer Name"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[12px] text-slate-400">Engineer Phone:</label>
                            <input
                              type="text"
                              value={vendorTechPhone}
                              onChange={e => setVendorTechPhone(e.target.value)}
                              placeholder="+91..."
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[12px] text-slate-400">Vendor Service Remarks / Parts Replaced:</label>
                          <textarea
                            rows={2}
                            value={vendorRemarks}
                            onChange={e => setVendorRemarks(e.target.value)}
                            placeholder="Enter vendor diagnosis, parts supplied by OEM, and warranty stamps..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[12px] text-slate-400">Vendor Job Sheet / Invoice Attachment:</label>
                          <div className="flex items-center gap-2">
                            <CameraCaptureButton
                              onCapture={setVendorJobSheetUrl}
                              label={vendorJobSheetUrl ? 'Retake Photo' : 'Photograph Job Sheet'}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5"
                            />
                          </div>
                          {vendorJobSheetUrl && (
                            <img src={vendorJobSheetUrl} alt="Job sheet" className="h-20 w-auto rounded-xl object-cover border border-slate-700 mt-1" />
                          )}
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-950 border-t border-slate-800 p-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedWorkOrder(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitWorkOrder('In Progress')}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30"
                >
                  Save as In Progress
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmitWorkOrder('Completed')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Complete &amp; Close</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INSPECTION EXECUTION MODAL (PASS/FAIL CHECKLIST, REMARKS, PROOF)         */}
      {/* ========================================================================= */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            
            {/* Modal Header */}
            <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{selectedInspection.inspectionNumber}</span>
                  <span className="px-2 py-0.5 rounded-md text-[12px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Quality Inspection
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {checklistTemplates.find(t => t.id === selectedInspection.templateId)?.title || 'Inspection Checklist'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInspection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Asset Summary Banner */}
            <div className="bg-blue-950/40 border-b border-blue-500/20 px-4 py-2.5 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-blue-300">
                  Target: {assets.find(a => a.id === selectedInspection.assetId || a.assetId === selectedInspection.assetId)?.name || 'Asset'}
                </p>
                <p className="text-[12px] text-slate-400">Due Date: {selectedInspection.dueDate}</p>
              </div>
              <span className="text-[12px] text-blue-400 font-mono font-semibold">
                {assets.find(a => a.id === selectedInspection.assetId || a.assetId === selectedInspection.assetId)?.assetId}
              </span>
            </div>

            {/* Success feedback alert */}
            {inspSuccessMsg && (
              <div className="bg-emerald-600 text-white p-3 text-center text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Inspection recorded successfully!</span>
              </div>
            )}

            {/* Modal Scrollable Checklist */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              
              {/* Step 1: Verification Checkpoints */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white uppercase text-[12px] tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-emerald-400" />
                    1. Pass / Fail Verification Checkpoints
                  </p>
                  <span className="text-[12px] text-slate-400">
                    {checklistTemplates.find(t => t.id === selectedInspection.templateId)?.items.length || 0} Checkpoints
                  </span>
                </div>

                <div className="space-y-2.5">
                  {checklistTemplates.find(t => t.id === selectedInspection.templateId)?.items.map((item, idx) => {
                    const currentVal = inspAnswers[item.id]
                    const itemPhoto = inspItemPhotos[item.id] || ''

                    return (
                      <div key={item.id || idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-200 text-xs">
                            <span className="text-slate-500 font-mono mr-1">{idx + 1}.</span>
                            {item.itemText} {item.mandatory && <span className="text-rose-400 font-bold">*</span>}
                          </p>
                          {item.photoRequired && (
                            <span className={`text-[12px] px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5 font-semibold border ${
                              itemPhoto
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            }`}>
                              <Camera className="w-2.5 h-2.5" />
                              {itemPhoto ? 'Photo Attached' : 'Photo Required'}
                            </span>
                          )}
                        </div>

                        {/* Pass / Fail Big Toggle Buttons -- no default selection;
                            a checkpoint the inspector hasn't touched shows neither
                            button highlighted, instead of silently reading as Pass. */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setInspAnswers(prev => ({ ...prev, [item.id]: 'Pass' }))}
                            className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                              currentVal === 'Pass'
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>PASS</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspAnswers(prev => ({ ...prev, [item.id]: 'Fail' }))}
                            className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                              currentVal === 'Fail'
                                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>FAIL</span>
                          </button>
                        </div>
                        {!currentVal && (
                          <p className="text-[12px] text-amber-400/90 font-semibold">Not yet reviewed</p>
                        )}

                        {item.photoRequired && (
                          <div className="flex items-center gap-2 pt-1">
                            <CameraCaptureButton
                              onCapture={url => setInspItemPhotos(prev => ({ ...prev, [item.id]: url }))}
                              label={itemPhoto ? 'Retake Photo' : 'Attach Photo for this Checkpoint'}
                              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-[12px] flex items-center gap-1.5"
                            />
                            {itemPhoto && (
                              <img src={itemPhoto} alt={`Photo for ${item.itemText}`} className="h-10 w-10 rounded-lg object-cover border border-purple-500/40" />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Step 2: Inspector Remarks */}
              <div className="space-y-1.5 bg-slate-950 border border-slate-800 p-3 rounded-2xl">
                <label className="block text-[12px] font-bold text-slate-400 uppercase">
                  2. Inspector Observations &amp; Remarks:
                </label>
                <textarea
                  rows={2}
                  value={inspRemarks}
                  onChange={e => setInspRemarks(e.target.value)}
                  placeholder="Record what you observed during the inspection..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              {/* Step 3: Overall Photo (optional, in addition to any
                  per-checkpoint photos above) */}
              <div className="space-y-1.5 bg-slate-950 border border-slate-800 p-3 rounded-2xl">
                <label className="block text-[12px] font-bold text-slate-400 uppercase">
                  3. Overall Photo (Optional):
                </label>
                <div className="flex items-center gap-2">
                  <CameraCaptureButton
                    onCapture={setInspPhotoUrl}
                    label={inspPhotoUrl ? 'Retake Photo' : 'Take Photo'}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 shrink-0"
                  />
                </div>
                {inspPhotoUrl && (
                  <div className="mt-2">
                    <img src={inspPhotoUrl} alt="Inspection proof" className="h-20 w-auto rounded-xl object-cover border border-slate-700" />
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-950 border-t border-slate-800 p-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedInspection(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitInspectionModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>Submit &amp; Complete Inspection</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPLETED INSPECTION DETAILS MODAL                                        */}
      {/* ========================================================================= */}
      {viewingInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            
            {/* Modal Header */}
            <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{viewingInspection.inspectionNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${
                    viewingInspection.result === 'Pass'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    {viewingInspection.result === 'Pass' ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {checklistTemplates.find(t => t.id === viewingInspection.templateId)?.title || 'Inspection Details'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingInspection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Asset & Inspector Info */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Target Asset:</span>
                  <span className="text-white font-medium">
                    {assets.find(a => a.id === viewingInspection.assetId || a.assetId === viewingInspection.assetId)?.name || 'Asset'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Inspector:</span>
                  <span className="text-blue-300 font-semibold">{viewingInspection.assignedInspectorName || 'Assigned Staff'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Completed Date:</span>
                  <span className="text-white font-mono">{viewingInspection.completedAt || viewingInspection.dueDate}</span>
                </div>
                <div className="py-1">
                  <span className="text-slate-400 block mb-1">Remarks:</span>
                  <p className="text-slate-200 bg-slate-900 p-2.5 rounded-xl border border-slate-800 italic">
                    "{viewingInspection.inspectorRemarks || 'Compliant with all physical parameters.'}"
                  </p>
                </div>
              </div>

              {/* Checkpoints summary */}
              <div className="space-y-2">
                <p className="font-bold text-white uppercase text-[12px] tracking-wider">Checkpoint Verification Results:</p>
                <div className="space-y-2">
                  {checklistTemplates.find(t => t.id === viewingInspection.templateId)?.items.map((item, idx) => {
                    const resVal = viewingInspection.checklistResponses?.[item.id] || 'Pass'
                    const isPass = resVal === 'Pass' || resVal?.value === 'Pass' || resVal?.value === true

                    return (
                      <div key={item.id || idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-medium text-xs">
                          {idx + 1}. {item.itemText}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[12px] font-bold shrink-0 ${
                          isPass
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border-t border-slate-800 p-3.5 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingInspection(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MY REQUEST DETAIL MODAL -- previously a tap-nowhere dead end, this now  */}
      {/* shows the full description, photo, room, and SLA due date that were    */}
      {/* already stored but never surfaced.                                    */}
      {/* ========================================================================= */}
      {viewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">

            <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{viewingRequest.ticketId}</span>
                  <span
                    className={`text-[12px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      viewingRequest.status === 'Open'
                        ? 'bg-blue-500/20 text-blue-300'
                        : viewingRequest.status === 'In Progress'
                        ? 'bg-amber-500/20 text-amber-300'
                        : viewingRequest.status === 'Escalated'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {viewingRequest.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{viewingRequest.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingRequest(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <p className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 italic">
                {requestStatusExplanation(viewingRequest)}
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Location:</span>
                  <span className="text-white font-medium">
                    {rooms.find(r => r.id === viewingRequest.roomId)?.name || 'Not specified'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-white font-medium">{viewingRequest.requestType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Priority:</span>
                  <span className="text-white font-medium">{viewingRequest.priority}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Raised On:</span>
                  <span className="text-white font-mono">{new Date(viewingRequest.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                {viewingRequest.slaDueDate && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Expected By:</span>
                    <span className="text-white font-mono">{new Date(viewingRequest.slaDueDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[12px] font-bold text-slate-400 uppercase">Description</p>
                <p className="text-slate-200 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {viewingRequest.description || 'No additional details provided.'}
                </p>
              </div>

              {viewingRequest.photoUrls && viewingRequest.photoUrls.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-slate-400 uppercase">Attached Photo</p>
                  <img src={viewingRequest.photoUrls[0]} alt="Request evidence" className="h-32 w-auto rounded-xl object-cover border border-slate-800" />
                </div>
              )}
            </div>

            <div className="bg-slate-950 border-t border-slate-800 p-3.5 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingRequest(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HOUSEKEEPING EXECUTION MODAL (CLEANING, SANITIZATION CHECKLIST & PROOF)    */}
      {/* ========================================================================= */}
      {selectedHkOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{selectedHkOrder.woNumber}</span>
                  <span className="px-2 py-0.5 rounded-md text-[12px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Housekeeping &amp; Sanitation
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedHkOrder.title}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHkOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Room Banner */}
            <div className="bg-purple-950/40 border-b border-purple-500/20 px-4 py-2.5 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-purple-300 flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>{rooms.find(r => r.id === selectedHkOrder.roomId)?.name || 'Facility Area'}</span>
                </p>
                <p className="text-[12px] text-slate-400">Due: {selectedHkOrder.dueDate}</p>
              </div>
              <span className="text-[12px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded border border-purple-500/30">
                {selectedHkOrder.priority} Priority
              </span>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Step 1: Pre-Cleaning / Start Photo */}
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-purple-400" />
                    1. Before Cleaning / Arrival Photo:
                  </p>
                  <span className="text-[12px] text-slate-400">Proof of condition</span>
                </div>
                <div className="flex items-center gap-2">
                  <CameraCaptureButton
                    onCapture={setHkStartPhoto}
                    label={hkStartPhoto ? 'Retake Photo' : 'Snap'}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
                  />
                </div>
                {hkStartPhoto && (
                  <img src={hkStartPhoto} alt="Before cleaning" className="h-20 w-auto rounded-xl object-cover border border-purple-500/40 mt-1" />
                )}
              </div>

              {/* Step 2: Sanitization Checkpoints */}
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2.5">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-emerald-400" />
                  2. Sanitation Tasks Checklist:
                </p>
                <div className="space-y-2">
                  {[
                    { key: 'dusting', label: 'Dust desks, simulator cockpits & fixtures' },
                    { key: 'mopping', label: 'Sweep and wet mop entire floor with disinfectant' },
                    { key: 'trashDisposal', label: 'Empty waste bins & replace liner bags' },
                    { key: 'sanitization', label: 'Wipe door handles, switches & touchpoints' },
                    { key: 'restroomClean', label: 'Restroom deep-clean and supply replenishment' },
                  ].map(item => {
                    const checked = (hkChecklist as any)[item.key] || false
                    return (
                      <div
                        key={item.key}
                        onClick={() => setHkChecklist(prev => ({ ...prev, [item.key]: !checked }))}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          checked
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-medium">{item.label}</span>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          checked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700 bg-slate-950'
                        }`}>
                          {checked && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Step 3: Housekeeping Remarks & Chemical Supplies Used */}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-bold text-slate-400 uppercase">
                  3. Cleaning Notes &amp; Supplies Used:
                </label>
                <textarea
                  rows={2}
                  value={hkNotes}
                  onChange={e => setHkNotes(e.target.value)}
                  placeholder="e.g. Floor cleaner 50ml used, hand sanitizers refilled, trash bag replaced..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              {/* Step 4: After Cleaning Completion Photo */}
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    4. Cleaned &amp; Sanitized Room Completion Photo:
                  </p>
                  <span className="text-[12px] text-emerald-400 font-semibold">*Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CameraCaptureButton
                    onCapture={setHkCompletionPhoto}
                    label={hkCompletionPhoto ? 'Retake Photo' : 'Snap'}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
                  />
                </div>
                {hkCompletionPhoto && (
                  <img src={hkCompletionPhoto} alt="After cleaning" className="h-20 w-auto rounded-xl object-cover border border-emerald-500/40 mt-1" />
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-950 border-t border-slate-800 p-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedHkOrder(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleHkSubmitWorkOrder('In Progress')}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30"
                >
                  Save In Progress
                </button>

                <button
                  type="button"
                  onClick={() => handleHkSubmitWorkOrder('Completed')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Complete Sanitization</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function MobileFieldApp() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-xs text-slate-400 font-semibold">Loading Field Operations PWA...</div>
        </div>
      }
    >
      <MobileFieldAppContent />
    </Suspense>
  )
}
