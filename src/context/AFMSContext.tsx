'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  UserProfile,
  UserRole,
  Department,
  Asset,
  InventoryItem,
  Reservation,
  ServiceRequest,
  WorkOrder,
  Inspection,
  Category,
  SubCategory,
  Campus,
  Building,
  Room,
  Vendor,
  ChecklistTemplate,
  DocumentItem,
  RoomAccessLog,
  AssetActivityLog,
  SlaConfig,
  SlaPriority,
  AppNotification,
} from '@/types/afms'
import { formatId, formatYearlyId, formatCategoryId, formatSubCategoryId, formatTaxonomyIdFromName, getNextSequence, addIntervalToDate, makePendingWoNumber, isPendingWorkOrder } from '@/lib/idGenerator'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { getLocalDateStr } from '@/lib/dateUtils'
import { supabase } from '@/lib/supabase'
import { mockUsers } from '@/data/mockData'
import { showToast } from '@/lib/toast'
import { useRealtimeSync, type RealtimeStatus } from '@/lib/realtime/useRealtimeSync'
import { updateUserProfile, deleteUserAccount } from '@/app/actions/users'

// Awaits a Supabase write and, if it failed OR matched no rows (which is what
// row-level security does to a write it doesn't allow -- no error, just 0
// rows), runs `undo` to roll back the optimistic local change and tells the
// user. Callers must chain `.select('id')` so a row count comes back.
async function persistWrite(
  label: string,
  op: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  undo: () => void
): Promise<boolean> {
  const { data, error } = await op
  if (error || !data || data.length === 0) {
    const reason = error?.message ?? 'nothing was changed (you may not have permission, or it no longer exists)'
    console.error(`Supabase ${label} error:`, reason)
    undo()
    showToast('error', `${label} failed and was undone: ${reason}`)
    return false
  }
  return true
}

// Puts a removed item back where it was after a failed delete.
function restoreItem<T extends { id: string }>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  item: T,
  index: number
) {
  setter(prev => (prev.some(x => x.id === item.id) ? prev : [...prev.slice(0, index), item, ...prev.slice(index)]))
}

interface AFMSContextType {
  currentUser: UserProfile
  setCurrentUser: (user: UserProfile) => void
  isLoggedIn: boolean
  setIsLoggedIn: (val: boolean) => void
  login: (user: UserProfile) => void
  logout: () => void
  users: UserProfile[]
  // Adds an already-provisioned real Supabase Auth user (created via the
  // inviteUser Server Action, which owns the actual account/profile
  // creation) to local state so it shows up immediately without a refetch.
  addInvitedUser: (profile: UserProfile) => void
  updateUser: (id: string, user: Partial<UserProfile>) => Promise<{ success: boolean; message?: string }>
  deleteUser: (id: string) => Promise<{ success: boolean; message?: string }>
  
  // Department Management (DEP-####)
  departments: Department[]
  addDepartment: (dept: Omit<Department, 'id'>) => Promise<Department>
  updateDepartment: (id: string, dept: Partial<Department>) => void
  deleteDepartment: (id: string) => { success: boolean; message?: string }

  // Organization CRUD (IDs generated automatically, unchangeable)
  campuses: Campus[]
  addCampus: (campus: Omit<Campus, 'id' | 'code'>) => Promise<Campus>
  updateCampus: (id: string, campus: Partial<Campus>) => void
  deleteCampus: (id: string) => void

  buildings: Building[]
  addBuilding: (building: Omit<Building, 'id' | 'code'>) => Promise<Building>
  updateBuilding: (id: string, building: Partial<Building>) => void
  deleteBuilding: (id: string) => void

  rooms: Room[]
  addRoom: (room: Omit<Room, 'id' | 'roomNumber' | 'qrCodeKey'>) => Promise<Room>
  updateRoom: (id: string, room: Partial<Room>) => void
  deleteRoom: (id: string) => void
  
  // Dynamic Room Types
  roomTypes: string[]
  addRoomType: (type: string) => void
  
  // Taxonomy CRUD (IDs generated automatically, unchangeable)
  categories: Category[]
  addCategory: (cat: Omit<Category, 'id' | 'code'>) => Promise<Category>
  updateCategory: (id: string, cat: Partial<Category>) => void
  deleteCategory: (id: string) => void

  subCategories: SubCategory[]
  addSubCategory: (sub: Omit<SubCategory, 'id' | 'code'>) => Promise<SubCategory>
  updateSubCategory: (id: string, sub: Partial<SubCategory>) => void
  deleteSubCategory: (id: string) => void
  
  // Assets (AST-#### automatically generated, unchangeable)
  assets: Asset[]
  addAsset: (asset: Omit<Asset, 'id' | 'assetId' | 'createdAt'>) => Promise<Asset>
  addBulkAssets: (
    assetsData: Array<Omit<Asset, 'id' | 'assetId' | 'createdAt'>>
  ) => Promise<{ success: boolean; createdCount: number; createdAssets: Asset[] }>
  updateAsset: (id: string, assetData: Partial<Asset>) => void
  updateAssetStatus: (assetId: string, status: Asset['status']) => void
  
  // Inventory Hub / Spares (INV-#### automatically generated, unchangeable)
  inventoryItems: InventoryItem[]
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'inventoryNumber' | 'createdAt'>) => Promise<InventoryItem>
  updateInventoryItem: (id: string, itemData: Partial<InventoryItem>) => Promise<void>
  deleteInventoryItem: (id: string) => void
  convertInventoryToAsset: (
    inventoryId: string,
    roomId: string,
    installationDate?: string,
    assignedToUserId?: string
  ) => Promise<Asset | null>

  // Reservations (RSV-YYYY-####)
  reservations: Reservation[]
  addReservation: (res: Omit<Reservation, 'id' | 'reservationNumber' | 'createdAt'>) => { success: boolean; reservation?: Reservation; message?: string }
  addBulkReservations: (
    reservationsData: Array<Omit<Reservation, 'id' | 'reservationNumber' | 'createdAt'>>
  ) => { success: boolean; createdCount: number; conflictCount: number; message?: string }
  updateReservationStatus: (id: string, status: Reservation['status']) => void
  deleteReservation: (id: string) => void

  // Work Orders & Inspections
  workOrders: WorkOrder[]
  addWorkOrder: (wo: Omit<WorkOrder, 'id' | 'createdAt'>) => void
  updateWorkOrderStatus: (
    id: string,
    status: WorkOrder['status'],
    remarks?: string,
    extraUpdates?: Partial<WorkOrder>
  ) => void
  inspections: Inspection[]
  addInspection: (insp: Omit<Inspection, 'id' | 'createdAt'>) => void
  updateInspection: (id: string, updates: Partial<Inspection>) => void
  completeInspection: (id: string, result: 'Pass' | 'Fail', remarks: string, responses: any, photoUrl?: string, itemPhotos?: Record<string, string>) => void
  
  // Service Requests (SR-YYYY-#### automatically generated, unchangeable)
  serviceRequests: ServiceRequest[]
  addServiceRequest: (sr: Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>) => Promise<ServiceRequest>
  updateServiceRequestStatus: (
    id: string,
    status: ServiceRequest['status'],
    extraUpdates?: Partial<Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>>
  ) => void
  updateServiceRequest: (id: string, updates: Partial<ServiceRequest>) => void
  
  // Checklists Templates CRUD
  checklistTemplates: ChecklistTemplate[]
  addChecklistTemplate: (tmpl: Omit<ChecklistTemplate, 'id' | 'version' | 'updatedAt'>) => ChecklistTemplate
  updateChecklistTemplate: (id: string, tmpl: Partial<ChecklistTemplate>) => void
  deleteChecklistTemplate: (id: string) => void

  vendors: Vendor[]
  addVendor: (vendor: Omit<Vendor, 'id' | 'code'>) => Promise<Vendor>
  updateVendor: (id: string, vendor: Partial<Vendor>) => void
  deleteVendor: (id: string) => { success: boolean; message?: string }
  documents: DocumentItem[]
  addDocument: (doc: Omit<DocumentItem, 'id' | 'uploadedAt'>) => Promise<DocumentItem>
  updateDocument: (id: string, updates: { assetId?: string | null; inventoryItemId?: string | null }) => Promise<void>
  
  // Logs
  roomAccessLogs: RoomAccessLog[]
  checkInRoom: (roomId: string, purpose: string) => Promise<void>
  checkOutRoom: (roomId: string) => Promise<void>
  assetActivityLogs: AssetActivityLog[]
  addAssetLog: (log: Omit<AssetActivityLog, 'id' | 'timestamp'>) => void
  
  // SLA Configuration (Hours per tier)
  slaConfig: SlaConfig
  updateSlaConfig: (config: Partial<SlaConfig>) => void

  // Clear data utilities
  clearAllData: () => void
  clearOperationalData: () => void

  // PWA Active Check-in status
  activeCheckIn: RoomAccessLog | null
  evaluateAutoCheckouts: () => void

  // In-app notifications (server-inserted only — see Phase 4 migration)
  notifications: AppNotification[]
  unreadNotificationCount: number
  markNotificationRead: (id: string) => void
  refreshNotifications: () => void
  // True while the first (or post-login) load of all tables is in flight; used
  // to show skeletons instead of empty states. dataLoadError is set when one
  // or more tables failed to load. reloadData re-runs the whole load.
  isDataLoading: boolean
  dataLoadError: string | null
  reloadData: () => Promise<void>
  // Connection state of the live-update channel ('off' while logged out,
  // hidden for a while, or still loading).
  realtimeStatus: RealtimeStatus
}

const AFMSContext = createContext<AFMSContextType | undefined>(undefined)

// Wraps a Supabase query so its error is recorded. syncSupabase passes one that
// collects failures for the "some data failed to load" banner; the Realtime
// refetches use logLoadFailure, since a failed live refresh should not raise a
// banner (the data on screen is merely a bit stale).
type LoadTracker = <T extends { error: { message: string } | null }>(
  label: string,
  query: PromiseLike<T>
) => Promise<T>

const logLoadFailure: LoadTracker = async (label, query) => {
  const result = await query
  if (result.error) console.warn(`Live refresh of ${label} failed:`, result.error.message)
  return result
}

// A row from the notifications table, in the shape the UI uses. Shared by the
// fetch and the Realtime insert handler so the two can't drift.
function mapNotificationRow(n: {
  id: string
  type: string
  title: string
  body?: string | null
  ref_table?: string | null
  ref_id?: string | null
  is_read?: boolean | null
  created_at: string
}): AppNotification {
  return {
    id: n.id,
    type: n.type as AppNotification['type'],
    title: n.title,
    body: n.body || undefined,
    refTable: n.ref_table || undefined,
    refId: n.ref_id || undefined,
    isRead: Boolean(n.is_read),
    createdAt: n.created_at,
  }
}

function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function AFMSProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => ({
    id: 'guest',
    email: '',
    fullName: 'Maritime Staff',
    // Least privilege until the real profile loads. This used to be 'Admin', so
    // a session whose profile never loaded (or a missing profile row) was
    // treated as an Admin by the role checks on the mobile page and stamped
    // 'Admin' onto the requests and check-ins it created.
    role: 'Guest',
    department: 'Operations',
  }))
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('afms_logged_in')
      return stored === 'true'
    }
    return false
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isLoggedIn && currentUser?.id) {
        localStorage.setItem('afms_current_user_id', currentUser.id)
      } else if (!isLoggedIn) {
        localStorage.removeItem('afms_current_user_id')
      }
    }
  }, [currentUser, isLoggedIn])

  const login = (user: UserProfile) => {
    setCurrentUser(user)
    setIsLoggedIn(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('afms_logged_in', 'true')
      localStorage.setItem('afms_current_user_id', user.id)
    }
    // The actual Supabase auth session is established server-side (see
    // src/app/actions/auth.ts's Server Action), which this browser client
    // has no way to observe on its own -- so re-run the same fetch that
    // otherwise only ever runs once per real page mount. Without this, a
    // user who first reached /login unauthenticated (every RLS-gated
    // table came back empty on that one mount-time fetch) would see every
    // page stay empty until a hard refresh happened to remount the
    // provider with the session cookie already in place.
    syncSupabase()
  }

  const logout = () => {
    setIsLoggedIn(false)
    try {
      supabase.auth.signOut().catch(() => {})
    } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.setItem('afms_logged_in', 'false')
      localStorage.removeItem('afms_current_user_id')
    }
  }

  const [users, setUsers] = useState<UserProfile[]>(mockUsers)
  const [departments, setDepartments] = useState<Department[]>([])
  
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([])
  
  const [assets, setAssets] = useState<Asset[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [roomAccessLogs, setRoomAccessLogs] = useState<RoomAccessLog[]>([])
  const [assetActivityLogs, setAssetActivityLogs] = useState<AssetActivityLog[]>([])
  
  const [activeCheckIn, setActiveCheckIn] = useState<RoomAccessLog | null>(null)

  // activeCheckIn is derived, not manually set, so it can never drift out
  // of sync with reality or leak across users. Previously it was set
  // ad-hoc inside checkInRoom/checkOutRoom/evaluateAutoCheckouts with no
  // user filter at all — the header's "Checked in: ..." badge showed
  // whichever check-in happened most recently in this browser tab,
  // regardless of which user was actually logged in (confirmed live: a
  // Guest's check-in would show up in the Admin's own header). Deriving it
  // here, scoped to currentUser.id, fixes that at the source — Header.tsx
  // and the mobile PWA both just render whatever this holds.
  useEffect(() => {
    const ownOpenLog = roomAccessLogs.find(l => l.userId === currentUser.id && !l.checkOutTime)
    setActiveCheckIn(ownOpenLog || null)
  }, [roomAccessLogs, currentUser.id])

  const [isInitialized, setIsInitialized] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const fetchNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('Supabase notifications fetch error:', error.message)
      return
    }
    if (data) {
      setNotifications(data.map(mapNotificationRow))
    }
  }

  const refreshNotifications = () => {
    if (currentUser?.id) fetchNotifications(currentUser.id)
  }

  // A notification pushed by Realtime. De-duplicated by id: the row can also
  // arrive through a fetch that raced the event.
  const addNotification = (row: Parameters<typeof mapNotificationRow>[0]) => {
    const mapped = mapNotificationRow(row)
    setNotifications(prev => (prev.some(n => n.id === mapped.id) ? prev : [mapped, ...prev].slice(0, 50)))
  }

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    supabase.from('notifications').update({ is_read: true }).eq('id', id).then(({ error }) => {
      if (error) console.error('Supabase notification mark-read error:', error.message)
    })
  }

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    if (isLoggedIn && currentUser?.id) {
      fetchNotifications(currentUser.id)
    } else {
      setNotifications([])
    }
  }, [isLoggedIn, currentUser?.id])

  const defaultRoomTypes = [
    'Classroom',
    'Simulator Block',
    'Engine Room',
    'Workshop',
    'Office',
    'Common Area',
    'Dining Area',
    'Laboratory',
    'Conference Hall',
  ]
  const [roomTypes, setRoomTypes] = useState<string[]>(defaultRoomTypes)

  const defaultSlaConfig: SlaConfig = {
    Critical: 4, // 4 hours
    High: 12,    // 12 hours
    Medium: 24,  // 24 hours
    Low: 48,     // 48 hours
  }
  const [slaConfig, setSlaConfig] = useState<SlaConfig>(defaultSlaConfig)

  const updateSlaConfig = (config: Partial<SlaConfig>) => {
    setSlaConfig(prev => ({ ...prev, ...config }))
  }

  // 1. Client startup initialization
  React.useEffect(() => {
    try {
      const savedSla = localStorage.getItem('afms_sla_config')
      if (savedSla) setSlaConfig(JSON.parse(savedSla))

      const savedRoomTypes = localStorage.getItem('afms_room_types')
      if (savedRoomTypes) setRoomTypes(JSON.parse(savedRoomTypes))

      // Clean up legacy mock data keys so they do not pollute pure Supabase mode
      const legacyKeys = [
        'afms_users', 'afms_departments', 'afms_campuses', 'afms_buildings',
        'afms_rooms', 'afms_categories', 'afms_subcategories', 'afms_vendors',
        'afms_templates', 'afms_assets', 'afms_inventory', 'afms_reservations',
        'afms_service_requests', 'afms_work_orders', 'afms_inspections', 'afms_documents'
      ]
      legacyKeys.forEach(k => localStorage.removeItem(k))
    } catch (err) {
      console.warn('AFMS initialization warning:', err)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // 1b. Synchronize 100% with Supabase PostgreSQL & Auth Session
  //
  // syncSupabase is stable (useCallback, empty deps -- it only calls
  // setters and the module-level `supabase` client, neither of which
  // change) so it can be invoked a second time from login() below, not
  // just once on mount. Previously this only ran once per real page
  // mount: the browser is usually first authenticated by a Server Action
  // (see src/app/actions/auth.ts), which the client-side Supabase
  // instance used here has no way to observe on its own -- so a user who
  // reached /login unauthenticated (this one-time effect firing with no
  // session, every RLS-gated table coming back empty) and then logged in
  // via a client-side navigation (no full remount) would see every table
  // stay empty until a hard refresh remounted the provider and reran this
  // fetch with the now-existing session cookies. login() now explicitly
  // re-invokes this same fetch instead of relying on a remount.
  const isMountedRef = React.useRef(true)

  // "Is the initial (or post-login) load in flight?" -- drives the skeleton
  // gate in AppLayout and the mobile app. Starts true so the server render and
  // the first client render agree. Only a full sync flips it: it is set true at
  // the start of syncSupabase, which only runs on mount and from login() --
  // both happen while no AppLayout page is mounted (first load, or the /login
  // page), so it never blanks a page the user is already looking at. If a
  // future caller re-runs a full sync from inside a mounted page, give it a
  // "silent" mode instead of reusing this flag. Later refreshes (e.g. Realtime)
  // must not touch it, or every live update would bring the skeleton back.
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataLoadError, setDataLoadError] = useState<string | null>(null)
  // Overlapping syncs (mount + login) must not let the older one clear the flag
  // while the newer one is still running.
  const syncRunRef = React.useRef(0)

  // Per-table loaders. syncSupabase calls them for the full load; the Realtime
  // hook calls them alone to refresh one table. They never touch isDataLoading,
  // so a live refresh cannot bring the skeleton back.
  const fetchWorkOrders = React.useCallback(async (track: LoadTracker = logLoadFailure) => {
    const { data: woRows } = await track('work_orders', supabase.from('work_orders').select('*').order('created_at', { ascending: false }))
    if (isMountedRef.current && woRows) {
      setWorkOrders(woRows.map(w => ({
        id: w.id,
        woNumber: w.wo_number,
        title: w.title || `${w.type || 'Maintenance'} Work Order`,
        type: w.type as WorkOrder['type'],
        assetId: w.asset_id,
        roomId: w.room_id,
        priority: w.priority,
        source: w.source || 'Scheduled',
        sourceRefId: w.source_ref_id,
        frequency: w.frequency,
        dueDate: w.due_date,
        assignedTechnicianId: w.assigned_technician_id,
        assignedTechnicianName: w.assigned_technician_name,
        status: w.status as WorkOrder['status'],
        checklistTemplateId: w.checklist_template_id,
        checklistSnapshot: w.checklist_snapshot || [],
        checklistResponses: w.checklist_responses || {},
        executedBy: w.executed_by,
        issueLogged: w.issue_logged,
        solutionTaken: w.solution_taken,
        technicianRemarks: w.technician_remarks,
        startPhotoUrl: w.start_photo_url || undefined,
        completionPhotoUrl: w.completion_photo_url || undefined,
        partsReplaced: w.parts_replaced || undefined,
        vendorId: w.vendor_id || undefined,
        vendorTicketNo: w.vendor_ticket_no || undefined,
        vendorTechName: w.vendor_tech_name || undefined,
        vendorTechPhone: w.vendor_tech_phone || undefined,
        vendorServiceDate: w.vendor_service_date || undefined,
        vendorJobSheetUrl: w.vendor_job_sheet_url || undefined,
        vendorRemarks: w.vendor_remarks || undefined,
        vendorCost: w.vendor_cost ?? undefined,
        createdAt: w.created_at,
        completedAt: w.completed_at,
      })))
    }
  }, [])

  const fetchServiceRequests = React.useCallback(async (track: LoadTracker = logLoadFailure) => {
    const { data: srRows } = await track('service_requests', supabase.from('service_requests').select('*').order('created_at', { ascending: false }))
    if (isMountedRef.current && srRows) {
      setServiceRequests(srRows.map(sr => ({
        id: sr.id,
        ticketId: sr.ticket_id,
        title: sr.title,
        description: sr.description || '',
        requestType: sr.type || 'Maintenance',
        roomId: sr.room_id,
        assetId: sr.asset_id,
        requestedBy: sr.requested_by_name,
        requestedByRole: 'Staff',
        requestedByUserId: sr.requested_by_user_id || undefined,
        requestedByEmail: sr.requested_by_email || undefined,
        assignedTo: sr.assigned_to,
        assignedToName: sr.assigned_to_name,
        status: sr.status || 'Open',
        priority: sr.priority || 'Medium',
        createdAt: sr.created_at,
        slaDueDate: sr.sla_due_date,
        photoUrls: sr.photo_urls || [],
        workOrderNumber: sr.work_order_number,
        workOrderId: sr.work_order_id,
        workOrderType: sr.work_order_type,
        dismissalReason: sr.dismissal_reason,
        dismissedAt: sr.dismissed_at,
        dismissedBy: sr.dismissed_by,
        resolutionNotes: sr.resolution_notes || undefined,
      })))
    }
  }, [])

  const fetchInspections = React.useCallback(async (track: LoadTracker = logLoadFailure) => {
    const { data: inspRows } = await track('inspections', supabase.from('inspections').select('*').order('created_at', { ascending: false }))
    if (isMountedRef.current && inspRows) {
      setInspections(inspRows.map(i => ({
        id: i.id,
        inspectionNumber: i.inspection_number,
        assetId: i.asset_id,
        templateId: i.template_id,
        templateVersion: i.template_version || 1,
        assignedInspectorId: i.conducted_by_user_id || i.assigned_inspector_id,
        assignedInspectorName: i.conducted_by || i.assigned_inspector_name,
        dueDate: i.due_date,
        status: (i.status as any) || 'Scheduled',
        result: i.result,
        inspectorRemarks: i.remarks,
        checklistSnapshot: i.checklist_snapshot || [],
        checklistResponses: i.checklist_responses || {},
        photoUrl: i.photo_url || undefined,
        itemPhotos: i.item_photos || undefined,
        completedAt: i.conducted_at,
        createdAt: i.created_at,
      })))
    }
  }, [])

  const syncSupabase = React.useCallback(async () => {
      const runId = ++syncRunRef.current
      setIsDataLoading(true)
      setDataLoadError(null)

      // A failed query used to leave its table silently empty -- which looks
      // exactly like "no records". Collect them so the UI can say so.
      const failures: string[] = []
      const tracked = async <T extends { error: { message: string } | null }>(
        label: string,
        query: PromiseLike<T>
      ): Promise<T> => {
        const result = await query
        if (result.error) failures.push(`${label} (${result.error.message})`)
        return result
      }

      try {
        // Authenticated Session & Profile
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && isMountedRef.current) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (profile && isMountedRef.current) {
            setCurrentUser({
              id: session.user.id,
              // profile.email, not session.user.email -- anonymous (Guest)
              // sessions always have a null Auth email; a guest's real,
              // self-reported email only ever lives in profiles.email.
              // Reading session.user.email here silently wiped currentUser
              // .email back to '' right after every guest login (login()
              // calls this immediately), which broke both the "My Requests"
              // history (requested_by_email never got stamped) and the
              // "resume by email" RLS matching that depends on it.
              email: profile.email || '',
              fullName: profile.full_name || 'Maritime Staff',
              role: (profile.role as UserRole) || 'Guest',
              department: profile.department || 'Operations',
              phone: profile.phone || '',
            })
            setIsLoggedIn(true)
          }
        }

        // 1. Users from profiles
        const { data: profRows } = await tracked('profiles', supabase.from('profiles').select('*'))
        if (isMountedRef.current && profRows && profRows.length > 0) {
          setUsers(prev => {
            const dbUsers: UserProfile[] = profRows.map(p => ({
              id: p.id,
              email: p.email,
              fullName: p.full_name,
              role: (p.role as UserRole) || 'Faculty',
              department: p.department || '',
              phone: p.phone || '',
              createdAt: p.created_at || undefined,
            }))
            // Merge dbUsers with mockUsers so standard demo accounts (admin, technician) are always accessible
            const combined = [...dbUsers]
            mockUsers.forEach(mu => {
              if (!combined.some(u => u.email.toLowerCase() === mu.email.toLowerCase())) {
                combined.push(mu)
              }
            })
            return combined
          })
        }

        // 2. Departments
        const { data: deptRows } = await tracked('departments', supabase.from('departments').select('*').order('name'))
        if (isMountedRef.current && deptRows) {
          setDepartments(deptRows.map(d => ({
            id: d.id,
            name: d.name,
            code: d.code,
            description: d.description || '',
            createdAt: d.created_at,
          })))
        }

        // 3. Campuses & Buildings
        const { data: cRows } = await tracked('campuses', supabase.from('campuses').select('*').order('name'))
        if (isMountedRef.current && cRows) {
          setCampuses(cRows.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code,
            address: c.address || '',
          })))
        }
        const { data: bRows } = await tracked('buildings', supabase.from('buildings').select('*').order('name'))
        if (isMountedRef.current && bRows) {
          setBuildings(bRows.map(b => ({
            id: b.id,
            campusId: b.campus_id,
            name: b.name,
            code: b.code,
            totalFloors: b.total_floors || 1,
          })))
        }

        // 4. Rooms
        const { data: rRows } = await tracked('rooms', supabase.from('rooms').select('*').order('room_number'))
        if (isMountedRef.current && rRows) {
          setRooms(rRows.map(r => ({
            id: r.id,
            buildingId: r.building_id,
            name: r.name,
            roomNumber: r.room_number,
            type: r.type || 'General',
            isReservable: Boolean(r.is_reservable),
            qrCodeKey: r.qr_code_key || `ROOM-${r.room_number}`,
            status: (r.status as Room['status']) || 'Available',
            currentOccupant: r.current_occupant || undefined,
          })))
        }

        // 5. Categories & Subcategories
        const { data: catRows } = await tracked('categories', supabase.from('categories').select('*').order('name'))
        if (isMountedRef.current && catRows) {
          setCategories(catRows.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code,
            description: c.description || '',
          })))
        }
        const { data: subRows } = await tracked('sub_categories', supabase.from('sub_categories').select('*').order('name'))
        if (isMountedRef.current && subRows) {
          setSubCategories(subRows.map(s => ({
            id: s.id,
            categoryId: s.category_id,
            name: s.name,
            code: s.code,
            description: s.description || '',
            metadataFields: s.metadata_fields || [],
            pmTemplateIds: s.pm_template_ids || (s.pm_template_id ? [s.pm_template_id] : []),
            inspectionTemplateIds: s.inspection_template_ids || (s.inspection_template_id ? [s.inspection_template_id] : []),
          })))
        }

        // 6. Assets
        const { data: astRows } = await tracked('assets', supabase.from('assets').select('*').order('created_at', { ascending: false }))
        if (isMountedRef.current && astRows) {
          setAssets(astRows.map(a => ({
            id: a.id,
            assetId: a.asset_id,
            name: a.name,
            subCategoryId: a.sub_category_id,
            roomId: a.room_id,
            manufacturer: a.manufacturer,
            modelNumber: a.model_number,
            serialNumber: a.serial_number,
            price: a.price ? Number(a.price) : undefined,
            installationDate: a.installation_date,
            purchaseDate: a.purchase_date,
            lastServicedDate: a.last_serviced_date || undefined,
            warrantyTill: a.warranty_till,
            maintenanceBy: a.maintenance_by || 'In House',
            purchaseVendorId: a.purchase_vendor_id || undefined,
            maintenanceVendorId: a.maintenance_vendor_id || undefined,
            amcStartDate: a.amc_start_date || undefined,
            amcEndDate: a.amc_end_date || undefined,
            assignedToUserId: a.assigned_to_user_id || undefined,
            assignedToUserName: a.assigned_to_user_name || undefined,
            lastPrintedAt: a.last_printed_at || undefined,
            status: (a.status as Asset['status']) || 'Operational',
            imageUrl: a.image_url || undefined,
            notes: a.notes || undefined,
            qrCodeUrl: a.qr_code_url || a.asset_id,
            dynamicSpecifications: a.dynamic_specifications || {},
            createdAt: a.created_at,
          })))
        }

        // 7. Work Orders
        await fetchWorkOrders(tracked)

        // 8. Service Requests
        await fetchServiceRequests(tracked)

        // 9. Vendors
        const { data: vRows } = await tracked('vendors', supabase.from('vendors').select('*').order('name'))
        if (isMountedRef.current && vRows) {
          setVendors(vRows.map(v => ({
            id: v.id,
            code: v.code || undefined,
            name: v.name,
            categorySupplied: v.category_supplied || '',
            contactPerson: v.contact_person || '',
            email: v.email || '',
            phone: v.phone || '',
            address: v.address || '',
            hasAmc: Boolean(v.has_amc),
            amcContractNo: v.amc_contract_no,
            amcStartDate: v.amc_start_date,
            amcEndDate: v.amc_end_date,
          })))
        }

        // 10. Checklist Templates
        const { data: tmplRows } = await tracked('checklist_templates', supabase.from('checklist_templates').select('*').order('title'))
        if (isMountedRef.current && tmplRows) {
          setChecklistTemplates(tmplRows.map(t => ({
            id: t.id,
            title: t.title,
            type: t.type,
            description: t.description || '',
            interval: t.interval || 'Quarterly',
            items: t.items || [],
          })))
        }

        // 11. Inspections
        await fetchInspections(tracked)

        // 12. Documents
        const { data: docRows } = await tracked('documents', supabase.from('documents').select('*').order('uploaded_at', { ascending: false }))
        if (isMountedRef.current && docRows) {
          setDocuments(docRows.map(d => ({
            id: d.id,
            title: d.title,
            fileType: (d.file_type as any) || 'Invoice',
            fileUrl: d.file_url || '',
            fileSizeKb: Math.round(((d as any).file_size_bytes || 102400) / 1024),
            uploadedBy: (d as any).uploaded_by_user_name || 'Staff',
            uploadedAt: d.uploaded_at,
            linkedAssetIds: [(d as any).asset_id, (d as any).inventory_item_id].filter(Boolean),
          })))
        }

        // 13. Inventory Items
        const { data: invRows } = await tracked('inventory_items', supabase.from('inventory_items').select('*').order('created_at', { ascending: false }))
        if (isMountedRef.current && invRows && invRows.length > 0) {
          setInventoryItems(invRows.map(inv => ({
            id: inv.id,
            inventoryNumber: inv.inventory_number || inv.id,
            name: inv.name,
            subCategoryId: inv.sub_category_id || '',
            manufacturer: inv.manufacturer || '',
            modelNumber: inv.model_number || '',
            serialNumber: inv.serial_number || undefined,
            quantity: inv.quantity || 1,
            unit: 'Units',
            minStockThreshold: inv.min_stock_level !== null && inv.min_stock_level !== undefined ? Number(inv.min_stock_level) : undefined,
            unitPrice: inv.unit_cost !== null && inv.unit_cost !== undefined ? Number(inv.unit_cost) : undefined,
            purchaseDate: inv.purchase_date || undefined,
            warrantyTill: inv.warranty_till || undefined,
            storageLocation: inv.storage_location || '',
            roomId: inv.room_id || undefined,
            purchaseVendorId: inv.vendor_id || undefined,
            dynamicSpecifications: inv.dynamic_specifications || {},
            imageUrl: inv.image_url || undefined,
            notes: inv.notes || undefined,
            createdAt: inv.created_at ? inv.created_at.split('T')[0] : getLocalDateStr(),
          })))
        }

        // 14. Reservations
        const { data: resRows } = await tracked('reservations', supabase.from('reservations').select('*').order('created_at', { ascending: false }))
        if (isMountedRef.current && resRows && resRows.length > 0) {
          setReservations(resRows.map(r => ({
            id: r.id,
            reservationNumber: r.reservation_number || r.id,
            roomId: r.room_id,
            roomName: r.room_name || '',
            userId: r.user_id,
            userName: r.user_name,
            userRole: r.user_role || 'Staff',
            departmentName: r.department_name,
            date: r.date,
            slotHour: r.slot_hour,
            timeSlot: r.time_slot,
            purpose: r.purpose || '',
            status: r.status as Reservation['status'],
            createdAt: r.created_at ? r.created_at.split('T')[0] : getLocalDateStr(),
          })))
        }

        // 15. Room Access Logs
        // Ordered by check_in_timestamp (a real epoch), not check_in_time --
        // that's just a formatted "HH:MM:SS AM/PM" display string with no
        // date component, so sorting on it doesn't produce true
        // chronological order across different days.
        const { data: ralRows } = await tracked('room_access_logs', supabase.from('room_access_logs').select('*').order('check_in_timestamp', { ascending: false }))
        if (isMountedRef.current && ralRows && ralRows.length > 0) {
          setRoomAccessLogs(ralRows.map(l => {
            // roomName was previously just set to the raw room_id (a UUID)
            // -- there's no room_name column on this table, so it needs to
            // be resolved against the rooms just fetched above (step 4),
            // not the `rooms` React state, which hasn't re-rendered with
            // that fetch yet inside this same effect run.
            const matchedRoom = rRows?.find(r => r.id === l.room_id)
            const roomName = matchedRoom ? `${matchedRoom.name} (${matchedRoom.room_number || matchedRoom.id})` : l.room_id
            return {
              id: l.id,
              activityNumber: l.activity_number || undefined,
              roomId: l.room_id,
              roomName,
              userId: l.user_id,
              userName: l.user_name,
              userRole: l.user_role || 'Staff',
              checkInTime: l.check_in_time,
              checkInDate: l.check_in_date,
              checkInTimestamp: l.check_in_timestamp,
              checkOutTime: l.check_out_time,
              checkOutTimestamp: l.check_out_timestamp,
              purpose: l.purpose || '',
              isForceCheckout: Boolean(l.is_force_checkout),
              autoCheckOutNote: l.auto_checkout_note,
            }
          }))
        }

        // 16. Asset Activity Logs
        // Ordered by timestamp_epoch (a real epoch), not timestamp -- that's
        // a locale-formatted new Date().toLocaleString() display string
        // (e.g. "1/16/2026, 12:41:55 AM"), and sorting on it lexicographically
        // scrambles order across months/years, not just within a day.
        const { data: aalRows } = await tracked('asset_activity_logs', supabase.from('asset_activity_logs').select('*').order('timestamp_epoch', { ascending: false, nullsFirst: false }))
        if (isMountedRef.current && aalRows && aalRows.length > 0) {
          setAssetActivityLogs(aalRows.map(l => ({
            id: l.id,
            assetId: l.asset_id,
            byUser: l.by_user,
            action: l.action,
            remarks: l.remarks,
            source: (l.source as any) || 'Manual',
            timestamp: l.timestamp,
            timestampEpoch: l.timestamp_epoch || undefined,
          })))
        }
      } catch (e) {
        console.warn('Supabase sync notice:', e)
        failures.push('unexpected error while loading')
      } finally {
        // Always clear the loading flag -- an exception must never leave a
        // skeleton on screen forever -- but only for the newest sync.
        if (isMountedRef.current && runId === syncRunRef.current) {
          setDataLoadError(failures.length > 0 ? `Some data could not be loaded: ${failures.join(', ')}.` : null)
          setIsDataLoading(false)
        }
      }
  }, [fetchWorkOrders, fetchServiceRequests, fetchInspections])

  React.useEffect(() => {
    isMountedRef.current = true
    syncSupabase()
    return () => {
      isMountedRef.current = false
    }
  }, [syncSupabase])

  // Live updates. Starts once the first load has finished and a real profile is
  // known (the pre-load placeholder user has id 'guest'), and stops on logout
  // or user change, which removes the channel. See src/lib/realtime.
  const realtimeStatus = useRealtimeSync({
    enabled: isLoggedIn && !isDataLoading && currentUser.id !== 'guest',
    userId: currentUser.id,
    role: currentUser.role,
    email: currentUser.email,
    handlers: {
      refetchWorkOrders: () => { fetchWorkOrders() },
      refetchServiceRequests: () => { fetchServiceRequests() },
      refetchInspections: () => { fetchInspections() },
      refetchNotifications: refreshNotifications,
      onNotification: addNotification,
    },
  })

  // 2. Persist the two settings that are actually read back on init (see
  // above). Every other entity now lives in Supabase and is reloaded from
  // there on mount — writing it to localStorage on every state change too
  // was pure overhead with no reader, since the init effect above deleted
  // those same keys on every mount anyway.
  React.useEffect(() => {
    if (!isInitialized) return
    try {
      localStorage.setItem('afms_sla_config', JSON.stringify(slaConfig))
      localStorage.setItem('afms_room_types', JSON.stringify(roomTypes))
    } catch (err) {
      console.warn('Could not persist AFMS settings to local storage:', err)
    }
  }, [isInitialized, slaConfig, roomTypes])

  const clearAllData = () => {
    setCampuses([])
    setBuildings([])
    setRooms([])
    setCategories([])
    setSubCategories([])
    setVendors([])
    setChecklistTemplates([])
    setAssets([])
    setInventoryItems([])
    setReservations([])
    setServiceRequests([])
    setWorkOrders([])
    setInspections([])
    setDocuments([])
    setRoomAccessLogs([])
    setAssetActivityLogs([])
    try {
      localStorage.removeItem('afms_campuses')
      localStorage.removeItem('afms_buildings')
      localStorage.removeItem('afms_rooms')
      localStorage.removeItem('afms_categories')
      localStorage.removeItem('afms_subcategories')
      localStorage.removeItem('afms_vendors')
      localStorage.removeItem('afms_templates')
      localStorage.removeItem('afms_assets')
      localStorage.removeItem('afms_inventory')
      localStorage.removeItem('afms_reservations')
      localStorage.removeItem('afms_service_requests')
      localStorage.removeItem('afms_work_orders')
      localStorage.removeItem('afms_inspections')
      localStorage.removeItem('afms_documents')
      localStorage.removeItem('afms_room_logs')
      localStorage.removeItem('afms_asset_logs')
    } catch (e) {
      console.warn('Error clearing localStorage:', e)
    }
  }

  const clearOperationalData = () => {
    setServiceRequests([])
    setWorkOrders([])
    setInspections([])
    setRoomAccessLogs([])
    setAssetActivityLogs([])
    try {
      localStorage.removeItem('afms_service_requests')
      localStorage.removeItem('afms_work_orders')
      localStorage.removeItem('afms_inspections')
      localStorage.removeItem('afms_room_logs')
      localStorage.removeItem('afms_asset_logs')
    } catch (e) {
      console.warn('Error clearing operational localStorage:', e)
    }
  }

  // 1. User: USR-#### (Immutable ID)
  const addInvitedUser = (profile: UserProfile) => {
    setUsers(prev => (prev.some(u => u.id === profile.id) ? prev : [...prev, profile]))
  }
  // Edits and deletes of another user go through Admin-verified Server Actions:
  // the browser client can't do them (RLS only lets a user update their own
  // profile row, and there is no delete policy), so the old direct write
  // matched 0 rows while the screen showed it as done. Email is not editable
  // here -- it is the login identity and lives in Supabase Auth.
  const updateUser = async (id: string, userData: Partial<UserProfile>): Promise<{ success: boolean; message?: string }> => {
    const { id: _, email: __, ...safeData } = userData as any // Enforce immutable ID; email isn't editable here
    const previousUser = users.find(u => u.id === id)
    const wasCurrentUser = currentUser.id === id
    const previousCurrent = currentUser

    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...safeData } : u)))
    if (wasCurrentUser) {
      setCurrentUser(prev => ({ ...prev, ...safeData }))
    }

    const result = await updateUserProfile({
      id,
      fullName: safeData.fullName,
      role: safeData.role,
      department: safeData.department,
      phone: safeData.phone,
    })
    if (!result.success) {
      if (previousUser) setUsers(prev => prev.map(u => (u.id === id ? previousUser : u)))
      if (wasCurrentUser) setCurrentUser(previousCurrent)
      showToast('error', `Could not update the user: ${result.error}`)
      return { success: false, message: result.error }
    }
    return { success: true }
  }
  const deleteUser = async (id: string): Promise<{ success: boolean; message?: string }> => {
    if (id === currentUser.id) {
      showToast('error', 'You cannot delete the account you are signed in with.')
      return { success: false, message: 'Cannot delete the active logged-in user profile.' }
    }
    const index = users.findIndex(u => u.id === id)
    const removed = index >= 0 ? users[index] : undefined
    setUsers(prev => prev.filter(u => u.id !== id))

    const result = await deleteUserAccount(id)
    if (!result.success) {
      if (removed) restoreItem(setUsers, removed, index)
      showToast('error', `Could not delete the user: ${result.error}`)
      return { success: false, message: result.error }
    }
    return { success: true }
  }

  // 1b. Department: DEP-#### (Immutable ID, Deletion Protected by User Linkage)
  const addDepartment = async (deptData: Omit<Department, 'id'>): Promise<Department> => {
    const nextSeq = getNextSequence(departments.map(d => d.code || d.id), 'DEP')
    const displayCode = formatId('DEP', nextSeq)
    const baseCode = deptData.code || displayCode

    // deptData.code can come from free-text admin input or the create form's
    // own "first 3 letters of the name" fallback — neither is checked
    // against existing codes, so two departments (typed or name-derived)
    // can collide against departments.code's UNIQUE constraint the same way
    // categories/sub-categories did. Disambiguate the same way.
    const { data: existingCodeRows } = await supabase.from('departments').select('code')
    const knownCodes = new Set([
      ...departments.map(d => d.code),
      ...(existingCodeRows || []).map(r => r.code).filter(Boolean),
    ])
    let finalCode = baseCode
    let suffix = 2
    while (knownCodes.has(finalCode)) {
      finalCode = `${baseCode}-${suffix}`
      suffix++
    }

    const newUuid = generateUUID()
    const today = getLocalDateStr()
    const newDept: Department = {
      ...deptData,
      id: newUuid,
      code: finalCode,
      createdAt: today,
    }
    setDepartments(prev => [...prev, newDept])
    const { error } = await supabase.from('departments').insert([{
      id: newUuid,
      name: newDept.name,
      code: newDept.code,
      description: newDept.description || '',
      created_at: new Date().toISOString(),
    }])
    if (error) {
      console.error('Supabase department insert error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this department: ${error.message}`)
      }
    }
    return newDept
  }

  const updateDepartment = (id: string, deptData: Partial<Department>) => {
    const { id: _, ...safeData } = deptData as any
    const previous = departments.find(d => d.id === id)
    setDepartments(prev => prev.map(d => (d.id === id ? { ...d, ...safeData } : d)))
    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.code !== undefined) dbUpdates.code = safeData.code
    if (safeData.description !== undefined) dbUpdates.description = safeData.description
    if (Object.keys(dbUpdates).length === 0) return
    void persistWrite(
      'Update department',
      supabase.from('departments').update(dbUpdates).eq('id', id).select('id'),
      () => { if (previous) setDepartments(prev => prev.map(d => (d.id === id ? previous : d))) }
    )
  }

  const deleteDepartment = (id: string): { success: boolean; message?: string } => {
    const targetDept = departments.find(d => d.id === id)
    if (!targetDept) {
      return { success: false, message: 'Department not found.' }
    }

    // Check if any user is linked with this department
    const linkedUser = users.find(
      u => u.departmentId === id || u.department === targetDept.name
    )

    if (linkedUser) {
      return {
        success: false,
        message: `Department "${targetDept.name}" cannot be deleted because it is currently assigned to user "${linkedUser.fullName}" (${linkedUser.id}). Please reassign or remove the users from this department first.`,
      }
    }

    const index = departments.findIndex(d => d.id === id)
    setDepartments(prev => prev.filter(d => d.id !== id))
    void persistWrite(
      'Delete department',
      supabase.from('departments').delete().eq('id', id).select('id'),
      () => restoreItem(setDepartments, targetDept, index)
    )
    return { success: true }
  }

  // 2. Campus: CAM-#### (Immutable ID)
  const addCampus = async (campus: Omit<Campus, 'id' | 'code'>): Promise<Campus> => {
    // Query the DB fresh rather than trusting only local state — a stale or
    // still-loading `campuses` array previously caused the next code to be
    // computed from an incomplete list, silently colliding with a real
    // existing campus's code (confirmed live: two campuses ended up sharing
    // CAM-0001 this way). campuses.code now also has a UNIQUE constraint as
    // a backstop, but this is the actual fix.
    const { data: existingRows } = await supabase.from('campuses').select('code')
    const knownCodes = [
      ...campuses.map(c => c.code || c.id),
      ...(existingRows || []).map(r => r.code).filter((c): c is string => Boolean(c)),
    ]
    const nextSeq = getNextSequence(knownCodes, 'CAM')
    const displayCode = formatId('CAM', nextSeq)
    const newUuid = generateUUID()
    const newCampus: Campus = {
      ...campus,
      id: newUuid,
      code: displayCode,
    }
    setCampuses(prev => [...prev, newCampus])
    supabase.from('campuses').insert([{
      id: newUuid,
      name: newCampus.name,
      code: newCampus.code,
      address: newCampus.address || '',
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) {
        console.error('Supabase campus insert error:', error.message)
      }
    })
    return newCampus
  }
  const updateCampus = (id: string, campusData: Partial<Campus>) => {
    const { id: _, code: __, ...safeData } = campusData as any
    const previous = campuses.find(c => c.id === id)
    setCampuses(prev => prev.map(c => (c.id === id ? { ...c, ...safeData } : c)))

    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.address !== undefined) dbUpdates.address = safeData.address

    if (Object.keys(dbUpdates).length > 0) {
      void persistWrite(
        'Update campus',
        supabase.from('campuses').update(dbUpdates).eq('id', id).select('id'),
        () => { if (previous) setCampuses(prev => prev.map(c => (c.id === id ? previous : c))) }
      )
    }
  }
  const deleteCampus = (id: string) => {
    const index = campuses.findIndex(c => c.id === id)
    const removed = index >= 0 ? campuses[index] : undefined
    setCampuses(prev => prev.filter(c => c.id !== id))
    void persistWrite(
      'Delete campus',
      supabase.from('campuses').delete().eq('id', id).select('id'),
      () => { if (removed) restoreItem(setCampuses, removed, index) }
    )
  }

  // 3. Building: BLD-#### (Immutable ID)
  const addBuilding = async (bld: Omit<Building, 'id' | 'code'>): Promise<Building> => {
    // See addCampus — same fix for the same live-confirmed collision bug.
    const { data: existingRows } = await supabase.from('buildings').select('code')
    const knownCodes = [
      ...buildings.map(b => b.code || b.id),
      ...(existingRows || []).map(r => r.code).filter((c): c is string => Boolean(c)),
    ]
    const nextSeq = getNextSequence(knownCodes, 'BLD')
    const displayCode = formatId('BLD', nextSeq)
    const newUuid = generateUUID()
    const newBld: Building = {
      ...bld,
      id: newUuid,
      code: displayCode,
    }
    setBuildings(prev => [...prev, newBld])
    supabase.from('buildings').insert([{
      id: newUuid,
      campus_id: newBld.campusId || null,
      name: newBld.name,
      code: newBld.code,
      total_floors: newBld.totalFloors || 1,
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase building insert error:', error.message)
    })
    return newBld
  }
  const updateBuilding = (id: string, bldData: Partial<Building>) => {
    const { id: _, code: __, ...safeData } = bldData as any
    const previous = buildings.find(b => b.id === id)
    setBuildings(prev => prev.map(b => (b.id === id ? { ...b, ...safeData } : b)))
    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.totalFloors !== undefined) dbUpdates.total_floors = safeData.totalFloors
    if (Object.keys(dbUpdates).length === 0) return
    void persistWrite(
      'Update building',
      supabase.from('buildings').update(dbUpdates).eq('id', id).select('id'),
      () => { if (previous) setBuildings(prev => prev.map(b => (b.id === id ? previous : b))) }
    )
  }
  const deleteBuilding = (id: string) => {
    const index = buildings.findIndex(b => b.id === id)
    const removed = index >= 0 ? buildings[index] : undefined
    setBuildings(prev => prev.filter(b => b.id !== id))
    void persistWrite(
      'Delete building',
      supabase.from('buildings').delete().eq('id', id).select('id'),
      () => { if (removed) restoreItem(setBuildings, removed, index) }
    )
  }

  // 4. Room: ROM-#### (Immutable ID & QR Key)
  const addRoom = async (room: Omit<Room, 'id' | 'roomNumber' | 'qrCodeKey'>): Promise<Room> => {
    // roomNumber (ROM-####) is now used as the Room detail page's routing
    // key, not just a display label -- a collision would make two rooms
    // indistinguishable by URL. Query the DB fresh rather than trusting
    // only local state, same fix already applied to addCampus/addBuilding/
    // addCategory/addSubCategory/addDepartment this session, backed by a
    // real UNIQUE constraint on rooms.room_number as a safety net.
    const { data: existingRows } = await supabase.from('rooms').select('room_number')
    const knownIds = [
      ...rooms.map(r => r.roomNumber || r.id),
      ...(existingRows || []).map(r => r.room_number).filter((n): n is string => Boolean(n)),
    ]
    const nextSeq = getNextSequence(knownIds, 'ROM')
    const displayId = formatId('ROM', nextSeq)
    const newUuid = generateUUID()
    const newRoom: Room = {
      ...room,
      id: newUuid,
      roomNumber: displayId,
      qrCodeKey: displayId,
    }
    setRooms(prev => [...prev, newRoom])
    const { error } = await supabase.from('rooms').insert([{
      id: newUuid,
      building_id: newRoom.buildingId || null,
      name: newRoom.name,
      room_number: newRoom.roomNumber,
      type: newRoom.type || 'General',
      is_reservable: Boolean(newRoom.isReservable),
      qr_code_key: newRoom.qrCodeKey,
      status: newRoom.status || 'Available',
      created_at: new Date().toISOString(),
    }])
    if (error) {
      console.error('Supabase room insert error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this room: ${error.message}\n\nIt will not persist after a page reload.`)
      }
    }
    return newRoom
  }
  const updateRoom = (id: string, roomData: Partial<Room>) => {
    const { id: _, roomNumber: __, qrCodeKey: ___, ...safeData } = roomData as any
    const previous = rooms.find(r => r.id === id)
    setRooms(prev => prev.map(r => (r.id === id ? { ...r, ...safeData } : r)))
    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.type !== undefined) dbUpdates.type = safeData.type
    if (safeData.isReservable !== undefined) dbUpdates.is_reservable = safeData.isReservable
    if (safeData.status !== undefined) dbUpdates.status = safeData.status
    if (Object.keys(dbUpdates).length === 0) return
    void persistWrite(
      'Update room',
      supabase.from('rooms').update(dbUpdates).eq('id', id).select('id'),
      () => { if (previous) setRooms(prev => prev.map(r => (r.id === id ? previous : r))) }
    )
  }
  const deleteRoom = (id: string) => {
    const index = rooms.findIndex(r => r.id === id)
    const removed = index >= 0 ? rooms[index] : undefined
    setRooms(prev => prev.filter(r => r.id !== id))
    void persistWrite(
      'Delete room',
      supabase.from('rooms').delete().eq('id', id).select('id'),
      () => { if (removed) restoreItem(setRooms, removed, index) }
    )
  }

  // Room Types
  const addRoomType = (newType: string) => {
    const trimmed = newType.trim()
    if (!trimmed) return
    setRoomTypes(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }

  // 5. Category: 4-letter uppercase ID derived automatically from Name e.g. "Electrical" -> "ELEC"
  const addCategory = async (cat: Omit<Category, 'id' | 'code'>): Promise<Category> => {
    const baseCode = formatCategoryId(cat.name)

    // Same collision class confirmed live for sub-categories: formatCategoryId
    // only uses the first 4 letters of the name, so e.g. "Electrical" and
    // "Electronics" would both produce "ELEC" and silently fail against
    // categories.code's UNIQUE constraint. Disambiguate the same way.
    const { data: existingCodeRows } = await supabase.from('categories').select('code')
    const knownCodes = new Set([
      ...categories.map(c => c.code),
      ...(existingCodeRows || []).map(r => r.code).filter(Boolean),
    ])
    let formattedCode = baseCode
    let suffix = 2
    while (knownCodes.has(formattedCode)) {
      formattedCode = `${baseCode}-${suffix}`
      suffix++
    }

    const newUuid = generateUUID()
    const newCat: Category = {
      ...cat,
      id: newUuid,
      code: formattedCode,
    }
    setCategories(prev => [...prev, newCat])
    const { error } = await supabase.from('categories').insert([{
      id: newUuid,
      name: newCat.name,
      code: newCat.code,
      description: newCat.description || '',
      created_at: new Date().toISOString(),
    }])
    if (error) {
      console.error('Supabase category insert error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this category: ${error.message}`)
      }
    }
    return newCat
  }
  const updateCategory = (id: string, catData: Partial<Category>) => {
    const { id: _, code: __, ...safeData } = catData as any
    const previous = categories.find(c => c.id === id)
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...safeData } : c)))
    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.description !== undefined) dbUpdates.description = safeData.description
    if (Object.keys(dbUpdates).length === 0) return
    void persistWrite(
      'Update category',
      supabase.from('categories').update(dbUpdates).eq('id', id).select('id'),
      () => { if (previous) setCategories(prev => prev.map(c => (c.id === id ? previous : c))) }
    )
  }
  const deleteCategory = (id: string) => {
    const index = categories.findIndex(c => c.id === id)
    const removed = index >= 0 ? categories[index] : undefined
    setCategories(prev => prev.filter(c => c.id !== id))
    void persistWrite(
      'Delete category',
      supabase.from('categories').delete().eq('id', id).select('id'),
      () => { if (removed) restoreItem(setCategories, removed, index) }
    )
  }

  // 6. SubCategory: CategoryId-SubCategoryId derived automatically e.g. "ELEC-LIGH"
  const addSubCategory = async (sub: Omit<SubCategory, 'id' | 'code'>): Promise<SubCategory> => {
    const parentCat = categories.find(c => c.id === sub.categoryId)
    const parentCode = parentCat?.code || parentCat?.id || sub.categoryId || 'GENR'
    const baseCode = formatSubCategoryId(parentCode, sub.name)

    // formatSubCategoryId derives the code from only the first 4 letters of
    // the name (e.g. "Office Table" and "Office Chair" both produce
    // "FURN-OFFI" under the same parent) — confirmed live: this collided
    // against sub_categories.code's UNIQUE constraint and the insert was
    // silently rejected while the UI still showed it as created. Disambiguate
    // by appending -2, -3, etc. against both local state and a fresh DB
    // check (existing codes may not be loaded yet in local state).
    const { data: existingCodeRows } = await supabase.from('sub_categories').select('code')
    const knownCodes = new Set([
      ...subCategories.map(s => s.code),
      ...(existingCodeRows || []).map(r => r.code).filter(Boolean),
    ])
    let formattedCode = baseCode
    let suffix = 2
    while (knownCodes.has(formattedCode)) {
      formattedCode = `${baseCode}-${suffix}`
      suffix++
    }

    const newUuid = generateUUID()
    const newSub: SubCategory = {
      ...sub,
      id: newUuid,
      code: formattedCode,
    }
    setSubCategories(prev => [...prev, newSub])
    const { error } = await supabase.from('sub_categories').insert([{
      id: newUuid,
      category_id: newSub.categoryId || null,
      name: newSub.name,
      code: newSub.code,
      description: newSub.description || '',
      metadata_fields: newSub.metadataFields || [],
      pm_template_ids: Array.from(new Set(newSub.pmTemplateIds || (newSub.pmTemplateId ? [newSub.pmTemplateId] : []))),
      inspection_template_ids: Array.from(new Set(newSub.inspectionTemplateIds || (newSub.inspectionTemplateId ? [newSub.inspectionTemplateId] : []))),
      created_at: new Date().toISOString(),
    }])
    if (error) {
      console.error('Supabase subcategory insert error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this sub-category: ${error.message}`)
      }
    }
    return newSub
  }
  const updateSubCategory = (id: string, subData: Partial<SubCategory>) => {
    const { id: _, code: __, ...safeData } = subData as any
    const previous = subCategories.find(s => s.id === id)
    setSubCategories(prev => prev.map(s => (s.id === id ? { ...s, ...safeData } : s)))

    const updatePayload: any = {
      name: safeData.name,
      description: safeData.description,
      metadata_fields: safeData.metadataFields,
    }
    if (safeData.pmTemplateIds !== undefined || safeData.pmTemplateId !== undefined) {
      updatePayload.pm_template_ids = Array.from(new Set(safeData.pmTemplateIds || (safeData.pmTemplateId ? [safeData.pmTemplateId] : [])))
    }
    if (safeData.inspectionTemplateIds !== undefined || safeData.inspectionTemplateId !== undefined) {
      updatePayload.inspection_template_ids = Array.from(new Set(safeData.inspectionTemplateIds || (safeData.inspectionTemplateId ? [safeData.inspectionTemplateId] : [])))
    }

    void persistWrite(
      'Update sub-category',
      supabase.from('sub_categories').update(updatePayload).eq('id', id).select('id'),
      () => { if (previous) setSubCategories(prev => prev.map(s => (s.id === id ? previous : s))) }
    )
  }
  const deleteSubCategory = (id: string) => {
    const index = subCategories.findIndex(s => s.id === id)
    const removed = index >= 0 ? subCategories[index] : undefined
    setSubCategories(prev => prev.filter(s => s.id !== id))
    void persistWrite(
      'Delete sub-category',
      supabase.from('sub_categories').delete().eq('id', id).select('id'),
      () => { if (removed) restoreItem(setSubCategories, removed, index) }
    )
  }

  // 7. Asset: AST-#### (Immutable ID)
  const addAsset = async (assetData: Omit<Asset, 'id' | 'assetId' | 'createdAt'>): Promise<Asset> => {
    const nextSeq = getNextSequence(assets.map(a => a.assetId || a.id), 'AST')
    const newId = formatId('AST', nextSeq)
    const newUuid = generateUUID()
    const today = getLocalDateStr()

    const createdAsset: Asset = {
      ...assetData,
      id: newUuid,
      assetId: newId,
      imageUrl: assetData.imageUrl || '/images/asset-placeholder.png',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-${newId}`,
      createdAt: today,
    }

    setAssets(prev => [createdAsset, ...prev])

    // Awaited deliberately: work_orders/inspections/documents/asset_activity_logs
    // all carry a foreign key on asset_id. Firing them concurrently with this
    // insert (the previous behavior) meant they frequently reached the
    // database before this row had actually committed, and were rejected
    // outright with a foreign-key violation — confirmed live via Postgres
    // logs (every PM work order insert failed this way, and most
    // inspections). Nothing that depends on this asset existing may fire
    // until this specific insert has actually succeeded.
    const { error: assetInsertError } = await supabase.from('assets').insert([{
      id: newUuid,
      asset_id: newId,
      name: createdAsset.name,
      sub_category_id: createdAsset.subCategoryId || null,
      room_id: createdAsset.roomId || null,
      manufacturer: createdAsset.manufacturer || null,
      model_number: createdAsset.modelNumber || null,
      serial_number: createdAsset.serialNumber || null,
      price: createdAsset.price || null,
      installation_date: createdAsset.installationDate || today,
      last_serviced_date: createdAsset.lastServicedDate || null,
      purchase_date: createdAsset.purchaseDate || null,
      warranty_till: createdAsset.warrantyTill || null,
      maintenance_by: createdAsset.maintenanceBy || 'In House',
      purchase_vendor_id: createdAsset.purchaseVendorId || null,
      maintenance_vendor_id: createdAsset.maintenanceVendorId || null,
      amc_start_date: createdAsset.amcStartDate || null,
      amc_end_date: createdAsset.amcEndDate || null,
      assigned_to_user_id: createdAsset.assignedToUserId || null,
      assigned_to_user_name: createdAsset.assignedToUserName || null,
      image_url: createdAsset.imageUrl || null,
      notes: createdAsset.notes || null,
      status: createdAsset.status || 'Operational',
      qr_code_url: createdAsset.qrCodeUrl,
      dynamic_specifications: createdAsset.dynamicSpecifications || {},
      created_at: new Date().toISOString(),
    }])

    if (assetInsertError) {
      console.error('Supabase asset insert error:', assetInsertError.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this asset: ${assetInsertError.message}\n\nIt will not persist after a page reload.`)
      }
      return createdAsset
    }

    const sub = subCategories.find(s => s.id === assetData.subCategoryId)
    if (sub) {
      // Anchor the first PM/inspection cycle to Last Serviced Date (for a
      // legacy asset installed long ago but only entered into the system
      // now) or to today — never to a backdated Installation Date, which
      // would make the first cycle appear already overdue.
      const installDate = assetData.lastServicedDate || today

      // woNumber is a unique 'PENDING-<uuid>' placeholder here, not a
      // minted WO-PM-#### number -- a real number is only minted once a
      // technician is assigned (see updateWorkOrderStatus), so this
      // scheduled-but-unassigned record doesn't count as a real Work
      // Order until then.
      const pmIds = Array.from(new Set(sub.pmTemplateIds && sub.pmTemplateIds.length > 0 ? sub.pmTemplateIds : (sub.pmTemplateId ? [sub.pmTemplateId] : []))).filter(Boolean)
      pmIds.forEach((pmTmplId) => {
        const tmpl = checklistTemplates.find(t => t.id === pmTmplId)
        const interval = tmpl?.interval || 'Quarterly'
        const nextPmDueDate = addIntervalToDate(installDate, interval)
        const pmWoUuid = generateUUID()
        const pendingWoNumber = makePendingWoNumber(pmWoUuid)
        const woTitle = tmpl ? `${tmpl.title} (${interval})` : `${assetData.name} ${interval} PM`

        const newPmWO: WorkOrder = {
          id: pmWoUuid,
          woNumber: pendingWoNumber,
          title: woTitle,
          type: 'Preventive',
          assetId: newUuid,
          source: 'Scheduled',
          frequency: interval,
          dueDate: nextPmDueDate,
          status: 'Scheduled',
          checklistTemplateId: pmTmplId,
          checklistSnapshot: tmpl?.items,
          createdAt: today,
        }
        setWorkOrders(prev => [newPmWO, ...prev])

        supabase.from('work_orders').insert([{
          id: pmWoUuid,
          wo_number: pendingWoNumber,
          title: woTitle,
          type: 'Preventive',
          asset_id: newUuid,
          source: 'Scheduled',
          due_date: nextPmDueDate,
          status: 'Scheduled',
          checklist_template_id: pmTmplId || null,
          checklist_snapshot: tmpl?.items || [],
          created_at: new Date().toISOString(),
        }]).then(({ error }) => {
          if (error) console.error('Supabase PM Work Order insert error:', error.message)
        })
      })

      const inspIds = Array.from(new Set(sub.inspectionTemplateIds && sub.inspectionTemplateIds.length > 0 ? sub.inspectionTemplateIds : (sub.inspectionTemplateId ? [sub.inspectionTemplateId] : []))).filter(Boolean)
      let inspSeq = getNextSequence(inspections.map(i => i.inspectionNumber), 'INSP')
      inspIds.forEach((inspTmplId) => {
        const tmpl = checklistTemplates.find(t => t.id === inspTmplId)
        const interval = tmpl?.interval || 'Quarterly'
        const nextInspDueDate = addIntervalToDate(installDate, interval)
        const inspUuid = generateUUID()
        const inspNumber = formatYearlyId('INSP', inspSeq++)

        const newInsp: Inspection = {
          id: inspUuid,
          inspectionNumber: inspNumber,
          assetId: newUuid,
          templateId: inspTmplId,
          templateVersion: 1,
          dueDate: nextInspDueDate,
          status: 'Scheduled',
          checklistSnapshot: tmpl?.items,
          createdAt: today,
        }
        setInspections(prev => [newInsp, ...prev])

        // inspection_number is re-minted server-side by a DB trigger (see
        // supabase/migrations/0014_server_side_ticket_numbering.sql), which
        // ignores whatever's sent here -- inspNumber above is only an
        // optimistic guess for a snappy UI. Reconcile below if it differs.
        supabase.from('inspections').insert([{
          id: inspUuid,
          inspection_number: inspNumber,
          asset_id: newUuid,
          template_id: inspTmplId || null,
          template_version: 1,
          due_date: nextInspDueDate,
          status: 'Scheduled',
          checklist_snapshot: tmpl?.items || [],
          created_at: new Date().toISOString(),
        }]).select().single().then(({ data, error }) => {
          if (error) {
            console.error('Supabase Inspection insert error:', error.message)
            return
          }
          if (data && data.inspection_number !== inspNumber) {
            setInspections(prev => prev.map(i => (i.id === inspUuid ? { ...i, inspectionNumber: data.inspection_number } : i)))
          }
        })
      })
    }

    // Must use the real UUID (createdAsset.id), not the formatted display
    // code (newId) -- asset_activity_logs.asset_id has a live FK to
    // assets(id). addAssetLog() tries to resolve a formatted code back to
    // a UUID by searching the `assets` array, but that array is a stale
    // closure here (this component hasn't re-rendered since setAssets()
    // was called a few lines up), so the lookup always misses for a
    // brand-new asset and the resulting insert was silently rejected by
    // the FK constraint -- confirmed live: zero "Asset Created" rows ever
    // persisted, for any asset.
    addAssetLog({
      assetId: createdAsset.id,
      action: 'Asset Created',
      byUser: currentUser.fullName,
      source: 'Manual',
      remarks: `Asset ${createdAsset.name} registered under ID ${newId}.`,
    })

    return createdAsset
  }

  const addBulkAssets = async (
    assetsData: Array<Omit<Asset, 'id' | 'assetId' | 'createdAt'>>
  ): Promise<{ success: boolean; createdCount: number; createdAssets: Asset[] }> => {
    if (!assetsData || assetsData.length === 0) {
      return { success: false, createdCount: 0, createdAssets: [] }
    }

    const today = getLocalDateStr()
    // NOTE: previously scanned a.id (a UUID) against the 'AST-####' pattern,
    // which never matched anything -- every bulk import silently restarted
    // numbering at AST-0001 regardless of how many assets already existed.
    let currentSeq = getNextSequence(assets.map(a => a.assetId || a.id), 'AST')
    const createdAssets: Asset[] = []
    const newWorkOrders: WorkOrder[] = []
    const newInspections: Inspection[] = []
    const newLogs: Omit<AssetActivityLog, 'id' | 'timestamp'>[] = []

    let inspSeq = getNextSequence(inspections.map(i => i.inspectionNumber), 'INSP')

    const assetInsertRows: Record<string, unknown>[] = []
    const woInsertRows: Record<string, unknown>[] = []
    const inspInsertRows: Record<string, unknown>[] = []

    for (const item of assetsData) {
      const displayId = formatId('AST', currentSeq++)
      const newUuid = generateUUID()
      const createdAsset: Asset = {
        ...item,
        id: newUuid,
        assetId: displayId,
        imageUrl: item.imageUrl || '/images/asset-placeholder.png',
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-${displayId}`,
        createdAt: today,
      }
      createdAssets.push(createdAsset)

      assetInsertRows.push({
        id: newUuid,
        asset_id: displayId,
        name: createdAsset.name,
        sub_category_id: createdAsset.subCategoryId || null,
        room_id: createdAsset.roomId || null,
        manufacturer: createdAsset.manufacturer || null,
        model_number: createdAsset.modelNumber || null,
        serial_number: createdAsset.serialNumber || null,
        price: createdAsset.price || null,
        installation_date: createdAsset.installationDate || today,
        last_serviced_date: createdAsset.lastServicedDate || null,
        purchase_date: createdAsset.purchaseDate || null,
        warranty_till: createdAsset.warrantyTill || null,
        maintenance_by: createdAsset.maintenanceBy || 'In House',
        purchase_vendor_id: createdAsset.purchaseVendorId || null,
        maintenance_vendor_id: createdAsset.maintenanceVendorId || null,
        image_url: createdAsset.imageUrl || null,
        notes: createdAsset.notes || null,
        status: createdAsset.status || 'Operational',
        qr_code_url: createdAsset.qrCodeUrl,
        dynamic_specifications: createdAsset.dynamicSpecifications || {},
        created_at: new Date().toISOString(),
      })

      const sub = subCategories.find(s => s.id === item.subCategoryId)
      if (sub) {
        // Same anchor rule as addAsset: Last Serviced Date, else today —
        // never a backdated Installation Date.
        const installDate = item.lastServicedDate || today

        const pmIds = sub.pmTemplateIds || (sub.pmTemplateId ? [sub.pmTemplateId] : [])
        pmIds.forEach((pmTmplId) => {
          const tmpl = checklistTemplates.find(t => t.id === pmTmplId)
          const interval = tmpl?.interval || 'Quarterly'
          const nextPmDueDate = addIntervalToDate(installDate, interval)
          const woUuid = generateUUID()
          const woNumber = makePendingWoNumber(woUuid)

          const newPmWO: WorkOrder = {
            id: woUuid,
            woNumber,
            title: tmpl ? `${tmpl.title} (${interval})` : `${item.name} ${interval} PM`,
            type: 'Preventive',
            assetId: newUuid,
            source: 'Scheduled',
            frequency: interval,
            dueDate: nextPmDueDate,
            status: 'Scheduled',
            checklistTemplateId: pmTmplId,
            checklistSnapshot: tmpl?.items,
            createdAt: today,
          }
          newWorkOrders.push(newPmWO)
          woInsertRows.push({
            id: woUuid,
            wo_number: woNumber,
            title: newPmWO.title,
            type: 'Preventive',
            asset_id: newUuid,
            source: 'Scheduled',
            frequency: interval,
            due_date: nextPmDueDate,
            status: 'Scheduled',
            checklist_template_id: pmTmplId || null,
            checklist_snapshot: tmpl?.items || [],
            created_at: new Date().toISOString(),
          })
        })

        const inspIds = sub.inspectionTemplateIds || (sub.inspectionTemplateId ? [sub.inspectionTemplateId] : [])
        inspIds.forEach((inspTmplId) => {
          const tmpl = checklistTemplates.find(t => t.id === inspTmplId)
          const interval = tmpl?.interval || 'Quarterly'
          const nextInspDueDate = addIntervalToDate(installDate, interval)
          const inspUuid = generateUUID()
          const inspNumber = formatYearlyId('INSP', inspSeq++)

          const newInsp: Inspection = {
            id: inspUuid,
            inspectionNumber: inspNumber,
            assetId: newUuid,
            templateId: inspTmplId,
            templateVersion: 1,
            dueDate: nextInspDueDate,
            status: 'Scheduled',
            checklistSnapshot: tmpl?.items,
            createdAt: today,
          }
          newInspections.push(newInsp)
          inspInsertRows.push({
            id: inspUuid,
            inspection_number: inspNumber,
            asset_id: newUuid,
            template_id: inspTmplId || null,
            template_version: 1,
            due_date: nextInspDueDate,
            status: 'Scheduled',
            checklist_snapshot: tmpl?.items || [],
            created_at: new Date().toISOString(),
          })
        })
      }

      newLogs.push({
        // Real UUID, not the formatted display code -- same reasoning as
        // addAsset() above.
        assetId: newUuid,
        action: 'Asset Created',
        byUser: currentUser.fullName,
        source: 'Bulk Import',
        remarks: `Asset ${createdAsset.name} registered via bulk upload under ID ${displayId}.`,
      })
    }

    setAssets(prev => [...createdAssets, ...prev])
    if (newWorkOrders.length > 0) {
      setWorkOrders(prev => [...newWorkOrders, ...prev])
    }
    if (newInspections.length > 0) {
      setInspections(prev => [...newInspections, ...prev])
    }
    newLogs.forEach(log => addAssetLog(log))

    // Previously this function never persisted anything to Supabase --
    // bulk-imported assets and their auto-generated PM/inspection
    // schedules only ever existed in local React state and vanished on
    // reload. Mirrors the same insert shape addAsset() already uses.
    //
    // Awaited deliberately, same reasoning as addAsset(): work_orders and
    // inspections carry a foreign key on asset_id, so they must not fire
    // until the assets themselves have actually committed — confirmed live
    // that firing them concurrently causes every dependent row to be
    // rejected with a foreign-key violation.
    const { error: bulkAssetError } = await supabase.from('assets').insert(assetInsertRows)
    if (bulkAssetError) {
      console.error('Supabase bulk asset insert error:', bulkAssetError.message)
      return { success: false, createdCount: 0, createdAssets: [] }
    }

    if (woInsertRows.length > 0) {
      supabase.from('work_orders').insert(woInsertRows).then(({ error }) => {
        if (error) console.error('Supabase bulk PM work order insert error:', error.message)
      })
    }
    if (inspInsertRows.length > 0) {
      supabase.from('inspections').insert(inspInsertRows).then(({ error }) => {
        if (error) console.error('Supabase bulk inspection insert error:', error.message)
      })
    }

    return { success: true, createdCount: createdAssets.length, createdAssets }
  }

  const updateAsset = (id: string, assetData: Partial<Asset>) => {
    // Installation Date anchors the PM/Inspection schedule generated once
    // at creation time — allowing it to be edited later would silently
    // desync already-generated due dates from what the UI shows, so it's
    // stripped here as a defense-in-depth guard (the wizard also disables
    // the field in edit mode).
    const { id: _, assetId: __, createdAt: ___, installationDate: ____, ...safeData } = assetData as any
    setAssets(prev =>
      prev.map(a => (a.id === id ? { ...a, ...safeData } : a))
    )
    addAssetLog({
      assetId: id,
      action: 'Asset Updated',
      byUser: currentUser.fullName,
      source: 'Manual',
      remarks: `Asset specification and profile updated.`,
    })

    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.subCategoryId !== undefined) dbUpdates.sub_category_id = safeData.subCategoryId
    if (safeData.roomId !== undefined) dbUpdates.room_id = safeData.roomId
    if (safeData.manufacturer !== undefined) dbUpdates.manufacturer = safeData.manufacturer
    if (safeData.modelNumber !== undefined) dbUpdates.model_number = safeData.modelNumber
    if (safeData.serialNumber !== undefined) dbUpdates.serial_number = safeData.serialNumber
    if (safeData.price !== undefined) dbUpdates.price = safeData.price
    if (safeData.purchaseDate !== undefined) dbUpdates.purchase_date = safeData.purchaseDate
    if (safeData.lastServicedDate !== undefined) dbUpdates.last_serviced_date = safeData.lastServicedDate
    if (safeData.warrantyTill !== undefined) dbUpdates.warranty_till = safeData.warrantyTill
    if (safeData.maintenanceBy !== undefined) dbUpdates.maintenance_by = safeData.maintenanceBy
    if (safeData.maintenanceVendorId !== undefined) dbUpdates.maintenance_vendor_id = safeData.maintenanceVendorId
    if (safeData.amcStartDate !== undefined) dbUpdates.amc_start_date = safeData.amcStartDate
    if (safeData.amcEndDate !== undefined) dbUpdates.amc_end_date = safeData.amcEndDate
    if (safeData.purchaseVendorId !== undefined) dbUpdates.purchase_vendor_id = safeData.purchaseVendorId
    if (safeData.assignedToUserId !== undefined) dbUpdates.assigned_to_user_id = safeData.assignedToUserId
    if (safeData.assignedToUserName !== undefined) dbUpdates.assigned_to_user_name = safeData.assignedToUserName
    if (safeData.dynamicSpecifications !== undefined) dbUpdates.dynamic_specifications = safeData.dynamicSpecifications
    if (safeData.imageUrl !== undefined) dbUpdates.image_url = safeData.imageUrl
    if (safeData.notes !== undefined) dbUpdates.notes = safeData.notes
    if (safeData.status !== undefined) dbUpdates.status = safeData.status
    if (safeData.qrCodeUrl !== undefined) dbUpdates.qr_code_url = safeData.qrCodeUrl
    if (safeData.lastPrintedAt !== undefined) dbUpdates.last_printed_at = safeData.lastPrintedAt

    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('assets').update(dbUpdates).eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase asset update error:', error.message)
      })
    }
  }

  const updateAssetStatus = (assetId: string, status: Asset['status']) => {
    setAssets(prev => prev.map(a => (a.id === assetId ? { ...a, status } : a)))
    // Via RPC, not a direct table .update() -- "Admin all on assets" is the
    // only write policy on assets, so a Technician's direct update here
    // silently no-ops under RLS. set_asset_status (0023) is role-gated
    // (Admin or Technician) and only ever touches the status column.
    supabase.rpc('set_asset_status', { p_asset_id: assetId, p_status: status }).then(({ error }) => {
      if (error) console.error('Supabase asset status update error:', error.message)
    })
  }

  // 7b. Inventory Item: INV-#### (Immutable ID, No auto PM/Inspection)
  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id' | 'inventoryNumber' | 'createdAt'>): Promise<InventoryItem> => {
    // `id` is a real client-generated UUID (not a formatted INV-#### string),
    // so computing the next sequence from it never matched the regex and
    // silently produced INV-0001 for every item, colliding with the real
    // unique constraint on inventory_number. Use inventoryNumber (the actual
    // formatted id) and also check the DB fresh, matching the same fix
    // already applied to addCampus/addBuilding/addCategory/etc.
    const { data: existingRows } = await supabase.from('inventory_items').select('inventory_number')
    const knownIds = [
      ...inventoryItems.map(i => i.inventoryNumber || i.id),
      ...(existingRows || []).map(r => r.inventory_number).filter((n): n is string => Boolean(n)),
    ]
    const nextSeq = getNextSequence(knownIds, 'INV')
    const newId = formatId('INV', nextSeq)
    const today = getLocalDateStr()
    const newUuid = generateUUID()

    const newItem: InventoryItem = {
      ...itemData,
      id: newUuid,
      inventoryNumber: newId,
      createdAt: today,
    }

    setInventoryItems(prev => [newItem, ...prev])

    // Previously this insert only wrote 7 of the ~15 real fields — unit
    // price, image, custom fields, warranty/purchase dates, serial number,
    // storeroom, and notes all looked saved in the UI but silently never
    // reached the database, vanishing on the next reload (confirmed live:
    // several of these columns didn't even exist on inventory_items until
    // migration 0010).
    const { error } = await supabase.from('inventory_items').insert([{
      id: newUuid,
      inventory_number: newId,
      name: newItem.name,
      sub_category_id: newItem.subCategoryId || null,
      manufacturer: newItem.manufacturer || null,
      model_number: newItem.modelNumber || null,
      serial_number: newItem.serialNumber || null,
      quantity: newItem.quantity || 1,
      min_stock_level: newItem.minStockThreshold ?? null,
      unit_cost: newItem.unitPrice ?? null,
      vendor_id: newItem.purchaseVendorId || null,
      storage_location: newItem.storageLocation || null,
      room_id: newItem.roomId || null,
      purchase_date: newItem.purchaseDate || null,
      warranty_till: newItem.warrantyTill || null,
      dynamic_specifications: newItem.dynamicSpecifications || {},
      image_url: newItem.imageUrl || null,
      notes: newItem.notes || null,
      created_at: new Date().toISOString(),
    }])
    if (error) {
      console.error('Supabase inventory insert error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this spare part: ${error.message}\n\nIt will not persist after a page reload.`)
      }
    }

    return newItem
  }

  const updateInventoryItem = async (id: string, itemData: Partial<InventoryItem>) => {
    const { id: _, inventoryNumber: __, createdAt: ___, ...safeData } = itemData as any
    setInventoryItems(prev =>
      prev.map(item => (item.id === id || item.inventoryNumber === id ? { ...item, ...safeData } : item))
    )

    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.subCategoryId !== undefined) dbUpdates.sub_category_id = safeData.subCategoryId
    if (safeData.manufacturer !== undefined) dbUpdates.manufacturer = safeData.manufacturer
    if (safeData.modelNumber !== undefined) dbUpdates.model_number = safeData.modelNumber
    if (safeData.serialNumber !== undefined) dbUpdates.serial_number = safeData.serialNumber
    if (safeData.quantity !== undefined) dbUpdates.quantity = safeData.quantity
    if (safeData.minStockThreshold !== undefined) dbUpdates.min_stock_level = safeData.minStockThreshold
    if (safeData.unitPrice !== undefined) dbUpdates.unit_cost = safeData.unitPrice
    if (safeData.purchaseVendorId !== undefined) dbUpdates.vendor_id = safeData.purchaseVendorId
    if (safeData.storageLocation !== undefined) dbUpdates.storage_location = safeData.storageLocation
    if (safeData.roomId !== undefined) dbUpdates.room_id = safeData.roomId
    if (safeData.purchaseDate !== undefined) dbUpdates.purchase_date = safeData.purchaseDate
    if (safeData.warrantyTill !== undefined) dbUpdates.warranty_till = safeData.warrantyTill
    if (safeData.dynamicSpecifications !== undefined) dbUpdates.dynamic_specifications = safeData.dynamicSpecifications
    if (safeData.imageUrl !== undefined) dbUpdates.image_url = safeData.imageUrl
    if (safeData.notes !== undefined) dbUpdates.notes = safeData.notes

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase.from('inventory_items').update(dbUpdates).or(`id.eq.${id},inventory_number.eq.${id}`)
      if (error) {
        console.error('Supabase inventory update error:', error.message)
        if (typeof window !== 'undefined') {
          alert(`Could not save changes to this spare part: ${error.message}`)
        }
      }
    }
  }

  const deleteInventoryItem = (id: string) => {
    setInventoryItems(prev => prev.filter(item => item.id !== id && item.inventoryNumber !== id))
    supabase.from('inventory_items').delete().or(`id.eq.${id},inventory_number.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase inventory delete error:', error.message)
    })
  }

  const convertInventoryToAsset = async (
    inventoryId: string,
    roomId: string,
    installationDate?: string,
    assignedToUserId?: string
  ): Promise<Asset | null> => {
    const item = inventoryItems.find(i => i.id === inventoryId || i.inventoryNumber === inventoryId)
    if (!item) return null

    const assignedUser = assignedToUserId ? users.find(u => u.id === assignedToUserId) : undefined

    // Create standard operational asset (which triggers PM/Inspection)
    const newAsset = await addAsset({
      name: item.name,
      subCategoryId: item.subCategoryId,
      roomId,
      manufacturer: item.manufacturer,
      modelNumber: item.modelNumber,
      serialNumber: item.serialNumber,
      price: item.unitPrice,
      purchaseDate: item.purchaseDate,
      installationDate: installationDate || getLocalDateStr(),
      warrantyTill: item.warrantyTill,
      maintenanceBy: 'In House',
      purchaseVendorId: item.purchaseVendorId,
      dynamicSpecifications: item.dynamicSpecifications || {},
      imageUrl: item.imageUrl,
      notes: `Deployed from Inventory Hub (${item.inventoryNumber}). ${item.notes || ''}`.trim(),
      status: 'Operational',
      assignedToUserId: assignedToUserId || undefined,
      assignedToUserName: assignedUser ? assignedUser.fullName : undefined,
    })

    // Re-point any documents that were attached to the source spare part
    // (e.g. its invoice/warranty PDF) to the newly deployed asset instead
    // of leaving them orphaned on an inventory item that's about to be
    // deleted or decremented.
    const linkedDocs = documents.filter(
      d => d.linkedAssetIds?.includes(item.id) || d.linkedAssetIds?.includes(item.inventoryNumber)
    )
    await Promise.all(linkedDocs.map(d => updateDocument(d.id, { assetId: newAsset.id, inventoryItemId: null })))

    // Reduce stock quantity or delete if 1
    if (item.quantity > 1) {
      updateInventoryItem(item.id, { quantity: item.quantity - 1 })
    } else {
      deleteInventoryItem(item.id)
    }

    return newAsset
  }

  // 7c. Reservations: RSV-YYYY-#### (Conflict detection & multi-date range support)
  const addReservation = (
    resData: Omit<Reservation, 'id' | 'reservationNumber' | 'createdAt'>
  ): { success: boolean; reservation?: Reservation; message?: string } => {
    // Conflict detection for exact date, room, and slot
    const conflict = reservations.find(
      r =>
        r.roomId === resData.roomId &&
        r.date === resData.date &&
        r.slotHour === resData.slotHour &&
        r.status === 'Confirmed'
    )

    if (conflict) {
      return {
        success: false,
        message: `Conflict: Room "${resData.roomName}" is already reserved for slot "${resData.timeSlot}" on ${resData.date} by ${conflict.userName} (${conflict.departmentName || 'Staff'}).`,
      }
    }

    const nextSeq = getNextSequence(reservations.map(r => r.reservationNumber), 'RSV')
    const resNumber = formatYearlyId('RSV', nextSeq)
    const today = getLocalDateStr()
    const newUuid = generateUUID()

    const targetRoom = rooms.find(r => r.id === resData.roomId || r.roomNumber === resData.roomId)
    const resolvedRoomId = targetRoom ? targetRoom.id : resData.roomId
    const resolvedRoomName = resData.roomName || targetRoom?.name || 'Room'

    const newRes: Reservation = {
      ...resData,
      id: newUuid,
      roomId: resolvedRoomId,
      roomName: resolvedRoomName,
      reservationNumber: resNumber,
      createdAt: today,
    }

    setReservations(prev => [newRes, ...prev])

    supabase.from('reservations').insert([{
      id: newUuid,
      reservation_number: resNumber,
      room_id: resolvedRoomId,
      room_name: resolvedRoomName,
      user_id: newRes.userId,
      user_name: newRes.userName,
      user_role: newRes.userRole || 'Staff',
      department_name: newRes.departmentName || null,
      date: newRes.date,
      slot_hour: newRes.slotHour,
      time_slot: newRes.timeSlot,
      purpose: newRes.purpose || 'Room Reservation',
      status: newRes.status || 'Confirmed',
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase reservation insert error:', error.message)
    })

    return { success: true, reservation: newRes }
  }

  const addBulkReservations = (
    reservationsData: Array<Omit<Reservation, 'id' | 'reservationNumber' | 'createdAt'>>
  ): { success: boolean; createdCount: number; conflictCount: number; message?: string } => {
    const now = new Date()
    // Not .toISOString().split('T')[0] -- that's the UTC calendar date,
    // which would be compared here against currentHour (already local),
    // a mixed-clock bug near local midnight.
    const today = getLocalDateStr(now)
    const currentHour = now.getHours()
    const validToCreate: Reservation[] = []
    let conflictCount = 0

    let currentReservations = [...reservations]

    reservationsData.forEach(resData => {
      // Reject past date or passed slot on current day
      const isPast =
        resData.date < today || (resData.date === today && resData.slotHour <= currentHour)
      if (isPast) {
        return
      }

      const targetRoom = rooms.find(r => r.id === resData.roomId || r.roomNumber === resData.roomId)
      const resolvedRoomId = targetRoom ? targetRoom.id : resData.roomId
      const resolvedRoomName = resData.roomName || targetRoom?.name || 'Room'

      const hasConflict = currentReservations.some(
        r =>
          (r.roomId === resolvedRoomId || r.roomId === resData.roomId) &&
          r.date === resData.date &&
          r.slotHour === resData.slotHour &&
          r.status === 'Confirmed'
      )

      if (hasConflict) {
        conflictCount++
      } else {
        const nextSeq = getNextSequence(currentReservations.map(r => r.reservationNumber), 'RSV')
        const resNumber = formatYearlyId('RSV', nextSeq)
        const newUuid = generateUUID()

        const newRes: Reservation = {
          ...resData,
          id: newUuid,
          roomId: resolvedRoomId,
          roomName: resolvedRoomName,
          reservationNumber: resNumber,
          createdAt: today,
        }
        validToCreate.push(newRes)
        currentReservations.push(newRes)
      }
    })

    if (validToCreate.length > 0) {
      setReservations(prev => [...validToCreate, ...prev])

      const inserts = validToCreate.map(r => {
        const targetRoom = rooms.find(rm => rm.id === r.roomId || rm.roomNumber === r.roomId)
        return {
          id: r.id,
          reservation_number: r.reservationNumber,
          room_id: targetRoom ? targetRoom.id : r.roomId,
          room_name: r.roomName || targetRoom?.name || 'Room',
          user_id: r.userId,
          user_name: r.userName,
          user_role: r.userRole || 'Staff',
          department_name: r.departmentName || null,
          date: r.date,
          slot_hour: r.slotHour,
          time_slot: r.timeSlot,
          purpose: r.purpose || 'Room Reservation',
          status: r.status || 'Confirmed',
          created_at: new Date().toISOString(),
        }
      })

      supabase.from('reservations').insert(inserts).then(({ error }) => {
        if (error) console.error('Supabase bulk reservations insert error:', error.message)
      })
    }

    return {
      success: validToCreate.length > 0,
      createdCount: validToCreate.length,
      conflictCount,
      message:
        conflictCount > 0
          ? `Created ${validToCreate.length} reservation slots. Skipped ${conflictCount} conflicting slots.`
          : `Successfully booked ${validToCreate.length} reservation slots.`,
    }
  }

  const updateReservationStatus = (id: string, status: Reservation['status']) => {
    setReservations(prev => prev.map(r => (r.id === id || r.reservationNumber === id ? { ...r, status } : r)))
    supabase.from('reservations').update({ status }).or(`id.eq.${id},reservation_number.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase reservation status update error:', error.message)
    })
  }

  const deleteReservation = (id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id && r.reservationNumber !== id))
    supabase.from('reservations').delete().or(`id.eq.${id},reservation_number.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase reservation delete error:', error.message)
    })
  }

  // 8. Service Request: SR-YYYY-#### (minted server-side by a DB trigger —
  // see supabase/migrations/0014_server_side_ticket_numbering.sql. A
  // client-computed guess previously collided with existing tickets a
  // Guest/Technician's RLS-scoped view couldn't see, silently failing the
  // insert while the UI still showed a false "success".)
  const addServiceRequest = async (sr: Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>): Promise<ServiceRequest> => {
    const newUuid = generateUUID()

    const { data, error } = await supabase.from('service_requests').insert([{
      id: newUuid,
      title: sr.title,
      description: sr.description || '',
      type: sr.requestType || 'Maintenance',
      room_id: sr.roomId || null,
      asset_id: sr.assetId || null,
      status: sr.status || 'Open',
      priority: sr.priority || 'Medium',
      requested_by_name: sr.requestedBy,
      // Stamped from the real session, not the caller — this is what the
      // RLS "own service_requests" policies key off, so it must always be
      // the actual signed-in user regardless of what a caller passes in.
      // requested_by_email is what lets a returning Guest (fresh auth.uid()
      // every login) read requests raised in a previous visit — see the
      // "Guest read same-email service_requests" RLS policy.
      requested_by_user_id: currentUser.id,
      requested_by_email: currentUser.email || null,
      sla_due_date: sr.slaDueDate || null,
      photo_urls: sr.photoUrls || [],
      created_at: new Date().toISOString(),
    }]).select().single()

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create service request.')
    }

    const newSr: ServiceRequest = {
      ...sr,
      id: data.id,
      ticketId: data.ticket_id,
      createdAt: data.created_at,
      requestedByUserId: currentUser.id,
      requestedByEmail: currentUser.email || undefined,
    }
    setServiceRequests(prev => [newSr, ...prev])

    if (sr.assetId) {
      addAssetLog({
        assetId: sr.assetId,
        action: 'Service Request Raised',
        byUser: sr.requestedBy,
        source: 'Manual',
        referenceId: newSr.ticketId,
        remarks: sr.title,
      })
    }
    return newSr
  }

  // Maps camelCase ServiceRequest fields to their snake_case DB columns.
  // Spreading the raw camelCase object into .update() previously failed
  // silently for any multi-word field (e.g. dismissalReason, workOrderNumber)
  // since Postgrest rejects unknown column names outright. Column names below
  // are verified against the live `service_requests` table (see
  // supabase/migrations/0002_service_requests_fix.sql for the columns that
  // had to be added before this mapping could be correct).
  const mapServiceRequestUpdatesToDb = (updates: Partial<ServiceRequest>): Record<string, unknown> => {
    const dbUpdates: Record<string, unknown> = {}
    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.requestType !== undefined) dbUpdates.type = updates.requestType
    if (updates.roomId !== undefined) dbUpdates.room_id = updates.roomId
    if (updates.assetId !== undefined) dbUpdates.asset_id = updates.assetId
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority
    if (updates.requestedBy !== undefined) dbUpdates.requested_by_name = updates.requestedBy
    if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo
    if (updates.assignedToName !== undefined) dbUpdates.assigned_to_name = updates.assignedToName
    if (updates.slaDueDate !== undefined) dbUpdates.sla_due_date = updates.slaDueDate
    if (updates.photoUrls !== undefined) dbUpdates.photo_urls = updates.photoUrls
    if (updates.workOrderNumber !== undefined) dbUpdates.work_order_number = updates.workOrderNumber
    if (updates.workOrderId !== undefined) dbUpdates.work_order_id = updates.workOrderId
    if (updates.workOrderType !== undefined) dbUpdates.work_order_type = updates.workOrderType
    if (updates.dismissalReason !== undefined) dbUpdates.dismissal_reason = updates.dismissalReason
    if (updates.resolutionNotes !== undefined) dbUpdates.resolution_notes = updates.resolutionNotes
    if (updates.dismissedAt !== undefined) dbUpdates.dismissed_at = updates.dismissedAt
    if (updates.dismissedBy !== undefined) dbUpdates.dismissed_by = updates.dismissedBy
    return dbUpdates
  }

  const updateServiceRequestStatus = (
    id: string,
    status: ServiceRequest['status'],
    extraUpdates?: Partial<Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>>
  ) => {
    // Matches by ticketId too, not just id -- callers like the Work Order
    // completion handshake only know the ticket's sourceRefId (its
    // formatted ticketId, e.g. "SR-2026-0001"), never its raw UUID.
    setServiceRequests(prev =>
      prev.map(s => (s.id === id || s.ticketId === id ? { ...s, ...extraUpdates, status } : s))
    )
    const dbUpdates = { ...mapServiceRequestUpdatesToDb(extraUpdates || {}), status }
    supabase.from('service_requests').update(dbUpdates).or(`id.eq.${id},ticket_id.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase service_request status update error:', error.message)
    })
  }

  const updateServiceRequest = (id: string, updates: Partial<ServiceRequest>) => {
    setServiceRequests(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    )
    const dbUpdates = mapServiceRequestUpdatesToDb(updates)
    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('service_requests').update(dbUpdates).or(`id.eq.${id},ticket_id.eq.${id}`).then(({ error }) => {
        if (error) console.error('Supabase service_request update error:', error.message)
      })
    }
  }

  // 9. Vendor: VND-#### (Immutable ID)
  const addVendor = async (v: Omit<Vendor, 'id' | 'code'>): Promise<Vendor> => {
    // Previously this scanned vendors.map(vnd => vnd.id) -- vendor `id` is a
    // UUID, not a "VND-####" string, so the sequence regex never matched
    // and the computed code (which also was never persisted or returned)
    // would always have evaluated to "VND-0001". Fixed the same way as
    // addCampus/addCategory/etc: derive from the real code field, checked
    // fresh against the DB too.
    const { data: existingCodeRows } = await supabase.from('vendors').select('code')
    const knownCodes = [
      ...vendors.map(vnd => vnd.code || vnd.id),
      ...(existingCodeRows || []).map(r => r.code).filter((c): c is string => Boolean(c)),
    ]
    const nextSeq = getNextSequence(knownCodes, 'VND')
    const newCode = formatId('VND', nextSeq)
    const newUuid = generateUUID()
    const newVendor: Vendor = { ...v, id: newUuid, code: newCode }
    setVendors(prev => [...prev, newVendor])
    // Awaited: assets.purchase_vendor_id/maintenance_vendor_id and
    // inventory_items.vendor_id are real foreign keys to vendors.id. Both
    // asset creation and inventory creation let you add a new vendor inline
    // mid-wizard and then reference it a few steps later — the same
    // FK-race shape already confirmed live for work_orders/inspections/
    // documents, just against vendors this time.
    const { error } = await supabase.from('vendors').insert([{
      id: newUuid,
      code: newVendor.code,
      name: newVendor.name,
      category_supplied: newVendor.categorySupplied || '',
      contact_person: newVendor.contactPerson || '',
      email: newVendor.email || '',
      phone: newVendor.phone || '',
      address: newVendor.address || '',
      has_amc: Boolean(newVendor.hasAmc),
      amc_contract_no: newVendor.amcContractNo || null,
      amc_start_date: newVendor.amcStartDate || null,
      amc_end_date: newVendor.amcEndDate || null,
      created_at: new Date().toISOString(),
    }])
    if (error) {
      console.error('Supabase vendor insert error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this vendor: ${error.message}\n\nIt will not persist after a page reload.`)
      }
    }
    return newVendor
  }

  const updateVendor = (id: string, vendorData: Partial<Vendor>) => {
    const { id: _, ...safeData } = vendorData as any
    setVendors(prev => prev.map(v => (v.id === id ? { ...v, ...safeData } : v)))

    const dbUpdates: Record<string, unknown> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.categorySupplied !== undefined) dbUpdates.category_supplied = safeData.categorySupplied
    if (safeData.contactPerson !== undefined) dbUpdates.contact_person = safeData.contactPerson
    if (safeData.email !== undefined) dbUpdates.email = safeData.email
    if (safeData.phone !== undefined) dbUpdates.phone = safeData.phone
    if (safeData.address !== undefined) dbUpdates.address = safeData.address
    if (safeData.hasAmc !== undefined) dbUpdates.has_amc = safeData.hasAmc
    if (safeData.amcContractNo !== undefined) dbUpdates.amc_contract_no = safeData.amcContractNo
    if (safeData.amcStartDate !== undefined) dbUpdates.amc_start_date = safeData.amcStartDate
    if (safeData.amcEndDate !== undefined) dbUpdates.amc_end_date = safeData.amcEndDate

    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('vendors').update(dbUpdates).eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase vendor update error:', error.message)
      })
    }
  }

  const deleteVendor = (id: string): { success: boolean; message?: string } => {
    // Check if vendor is linked to any asset
    const linkedAsset = assets.find(
      a => a.purchaseVendorId === id || a.maintenanceVendorId === id
    )
    if (linkedAsset) {
      return {
        success: false,
        message: `Cannot delete vendor. It is linked to asset ${linkedAsset.name} (${linkedAsset.id}).`,
      }
    }
    const index = vendors.findIndex(v => v.id === id)
    const removed = index >= 0 ? vendors[index] : undefined
    setVendors(prev => prev.filter(v => v.id !== id))
    void persistWrite(
      'Delete vendor',
      supabase.from('vendors').delete().eq('id', id).select('id'),
      () => { if (removed) restoreItem(setVendors, removed, index) }
    )
    return { success: true }
  }

  // 10. Document: DOC-YYYY-#### (Immutable ID)
  const addDocument = async (doc: Omit<DocumentItem, 'id' | 'uploadedAt'>): Promise<DocumentItem> => {
    const nextSeq = getNextSequence(documents.map(d => d.id), 'DOC')
    const displayId = formatYearlyId('DOC', nextSeq)
    const newUuid = generateUUID()
    // Full ISO instant, matching what the DB write below sends and what a
    // reload reads back (documents/page.tsx:656) -- previously this used
    // getLocalDateStr() (YYYY-MM-DD), so a freshly-uploaded document's card
    // visibly changed date format the moment the page refreshed.
    const uploadedAtIso = new Date().toISOString()
    const newDoc: DocumentItem = {
      ...doc,
      id: newUuid,
      uploadedAt: uploadedAtIso,
    }
    setDocuments(prev => [newDoc, ...prev])

    // Resolve the first linked id against assets first, then inventory
    // items — linkedAssetIds is a single flat list used for both, since
    // the wizard UI doesn't distinguish which kind of item it's attaching
    // a document to.
    const linkId = doc.linkedAssetIds?.[0]
    const linkedAsset = linkId ? assets.find(a => a.id === linkId || a.assetId === linkId) : undefined
    const linkedInventoryItem = !linkedAsset && linkId
      ? inventoryItems.find(i => i.id === linkId || i.inventoryNumber === linkId)
      : undefined

    // Awaited so callers that immediately link this document to something
    // else (e.g. the asset-creation wizard's "attach to this asset" step)
    // can be sure the row actually exists first, rather than racing an
    // UPDATE against an insert that hasn't committed yet.
    const { error } = await supabase.from('documents').insert([{
      id: newUuid,
      title: newDoc.title,
      category: 'General',
      file_name: newDoc.title.replace(/[^a-zA-Z0-9.-]/g, '_') + '.pdf',
      file_type: newDoc.fileType || 'Invoice',
      file_size_bytes: (newDoc.fileSizeKb || 100) * 1024,
      file_url: newDoc.fileUrl,
      uploaded_by_user_name: newDoc.uploadedBy || 'Staff',
      uploaded_at: uploadedAtIso,
      asset_id: linkedAsset?.id || null,
      inventory_item_id: linkedInventoryItem?.id || null,
    }])
    if (error) {
      console.error('Supabase document insert error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this document: ${error.message}\n\nIt will not persist after a page reload.`)
      }
    }
    return newDoc
  }

  const updateDocument = async (id: string, updates: { assetId?: string | null; inventoryItemId?: string | null }) => {
    const dbUpdates: Record<string, unknown> = {}
    if (updates.assetId !== undefined) dbUpdates.asset_id = updates.assetId
    if (updates.inventoryItemId !== undefined) dbUpdates.inventory_item_id = updates.inventoryItemId
    const { error } = await supabase.from('documents').update(dbUpdates).eq('id', id)
    if (error) {
      console.error('Supabase document link update error:', error.message)
      if (typeof window !== 'undefined') alert(`Could not update this document's link: ${error.message}`)
    }
    setDocuments(prev => prev.map(d => d.id === id
      ? { ...d, linkedAssetIds: [updates.assetId, updates.inventoryItemId].filter(Boolean) as string[] }
      : d
    ))
  }

  // Checklist Templates CRUD
  const addChecklistTemplate = (tmpl: Omit<ChecklistTemplate, 'id' | 'updatedAt'>) => {
    const newUuid = generateUUID()
    const today = getLocalDateStr()
    const newTmpl: ChecklistTemplate = {
      ...tmpl,
      id: newUuid,
      updatedAt: today,
    }
    setChecklistTemplates(prev => [newTmpl, ...prev])
    supabase.from('checklist_templates').insert([{
      id: newUuid,
      title: newTmpl.title,
      type: newTmpl.type,
      description: newTmpl.description || '',
      interval: newTmpl.interval || 'Quarterly',
      items: newTmpl.items || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase checklist_template insert error:', error.message)
    })
    return newTmpl
  }
  const updateChecklistTemplate = (id: string, tmplData: Partial<ChecklistTemplate>) => {
    const today = getLocalDateStr()
    setChecklistTemplates(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              ...tmplData,
              updatedAt: today,
            }
          : t
      )
    )
    supabase.from('checklist_templates').update({
      title: tmplData.title,
      description: tmplData.description,
      interval: tmplData.interval,
      items: tmplData.items,
      updated_at: new Date().toISOString(),
    }).eq('id', id).then(({ error }) => {
      if (error) console.error('Supabase checklist_template update error:', error.message)
    })
  }
  const deleteChecklistTemplate = (id: string) => {
    setChecklistTemplates(prev => prev.filter(t => t.id !== id))
    supabase.from('checklist_templates').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Supabase checklist_template delete error:', error.message)
    })
  }

  // Work Orders & Inspections status updates
  const addWorkOrder = (wo: Omit<WorkOrder, 'id' | 'createdAt'>) => {
    const newUuid = generateUUID()
    const today = getLocalDateStr()
    // Callers that want a not-yet-assigned Corrective/Preventive record
    // pass the literal sentinel 'PENDING' (they can't know this row's UUID
    // ahead of time) — work_orders.wo_number has a UNIQUE constraint, so
    // it's resolved here into a real per-row placeholder.
    const woNumber = wo.woNumber === 'PENDING' ? makePendingWoNumber(newUuid) : wo.woNumber
    const newWo: WorkOrder = {
      ...wo,
      id: newUuid,
      woNumber,
      createdAt: today,
    }
    setWorkOrders(prev => [newWo, ...prev])

    // The PM/Inspection work orders auto-created inside addAsset bypass
    // this function entirely (their own direct insert) — "Asset Created"
    // already covers that moment, so this only logs manually-raised work
    // orders. Gated on assetId so room-only Housekeeping orders don't spam
    // unrelated asset timelines.
    if (newWo.assetId) {
      addAssetLog({
        assetId: newWo.assetId,
        action: `${newWo.type} Work Order Raised`,
        byUser: currentUser.fullName,
        source: newWo.source === 'Scheduled' ? 'System' : 'Manual',
        referenceId: newWo.woNumber,
        remarks: newWo.issueLogged || newWo.title || `${newWo.type} work order raised.`,
      })
    }

    supabase.from('work_orders').insert([{
      id: newUuid,
      wo_number: newWo.woNumber || newWo.id,
      title: newWo.title || `${newWo.type || 'Maintenance'} Work Order`,
      type: newWo.type,
      asset_id: newWo.assetId || null,
      room_id: newWo.roomId || null,
      priority: newWo.priority || 'Medium',
      frequency: newWo.frequency || null,
      source: newWo.source || 'Scheduled',
      // Was previously omitted entirely, even though the local optimistic
      // state and the WorkOrder type both carry it correctly -- every
      // service-request-linked work order's completion cascade
      // (auto-resolve the ticket, in updateWorkOrderStatus) silently never
      // fired once the page reloaded and re-fetched this as null.
      source_ref_id: newWo.sourceRefId || null,
      due_date: newWo.dueDate || today,
      assigned_technician_id: newWo.assignedTechnicianId || null,
      assigned_technician_name: newWo.assignedTechnicianName || null,
      status: newWo.status || 'Scheduled',
      checklist_template_id: newWo.checklistTemplateId || null,
      checklist_snapshot: newWo.checklistSnapshot || null,
      issue_logged: newWo.issueLogged || null,
      solution_taken: newWo.solutionTaken || null,
      technician_remarks: newWo.technicianRemarks || null,
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase work_order insert error:', error.message)
    })
  }

  const updateWorkOrderStatus = (
    id: string,
    status: WorkOrder['status'],
    remarks?: string,
    extraUpdates?: Partial<WorkOrder>
  ) => {
    // Attempt window policy check for Preventive Maintenance Work Orders
    if (status === 'In Progress' || status === 'Completed') {
      const targetWo = workOrders.find(w => w.id === id || w.woNumber === id)
      if (targetWo && targetWo.type === 'Preventive') {
        const windowStatus = getAttemptWindowStatus(targetWo.dueDate, targetWo.frequency)
        if (!windowStatus.canAttempt) {
          if (typeof window !== 'undefined') {
            alert(`This Preventive Maintenance task cannot be attempted yet. The execution window opens on ${windowStatus.unlockDate} (${windowStatus.windowDescription}).`)
          }
          return
        }
      }
    }

    // Detect "first assignment": a Preventive/Corrective record that was
    // created as a PENDING placeholder (no real WO number yet, per the
    // deferred-creation design) is now getting a technician for the first
    // time. That's the moment it becomes a real, numbered Work Order.
    const targetWoForMint = workOrders.find(w => w.id === id || w.woNumber === id)
    const isFirstAssignment = Boolean(
      targetWoForMint &&
      (targetWoForMint.type === 'Preventive' || targetWoForMint.type === 'Corrective') &&
      isPendingWorkOrder(targetWoForMint.woNumber) &&
      extraUpdates?.assignedTechnicianId
    )
    const mintedWoNumber = isFirstAssignment && targetWoForMint
      ? formatYearlyId(targetWoForMint.type === 'Preventive' ? 'WO-PM' : 'WO-CR', getNextSequence(workOrders.map(w => w.woNumber), targetWoForMint.type === 'Preventive' ? 'WO-PM' : 'WO-CR'))
      : undefined

    const dbUpdates: Record<string, any> = {
      status,
    }
    if (mintedWoNumber) dbUpdates.wo_number = mintedWoNumber
    if (remarks !== undefined) dbUpdates.technician_remarks = remarks
    // Only stamp completed_at on the actual transition into Completed, not
    // on a redundant re-submission of an already-completed order -- see the
    // matching guard below on the completion cascade for why.
    if (status === 'Completed' && targetWoForMint?.status !== 'Completed') {
      dbUpdates.completed_at = getLocalDateStr()
    }
    if (extraUpdates) {
      if (extraUpdates.assignedTechnicianId !== undefined) dbUpdates.assigned_technician_id = extraUpdates.assignedTechnicianId
      if (extraUpdates.assignedTechnicianName !== undefined) dbUpdates.assigned_technician_name = extraUpdates.assignedTechnicianName
      if (extraUpdates.checklistResponses !== undefined) dbUpdates.checklist_responses = extraUpdates.checklistResponses
      if (extraUpdates.checklistSnapshot !== undefined) dbUpdates.checklist_snapshot = extraUpdates.checklistSnapshot
      if (extraUpdates.issueLogged !== undefined) dbUpdates.issue_logged = extraUpdates.issueLogged
      if (extraUpdates.solutionTaken !== undefined) dbUpdates.solution_taken = extraUpdates.solutionTaken
      if (extraUpdates.technicianRemarks !== undefined) dbUpdates.technician_remarks = extraUpdates.technicianRemarks
      if (extraUpdates.executedBy !== undefined) dbUpdates.executed_by = extraUpdates.executedBy
      if (extraUpdates.completedAt !== undefined) dbUpdates.completed_at = extraUpdates.completedAt
      if (extraUpdates.priority !== undefined) dbUpdates.priority = extraUpdates.priority
      if (extraUpdates.dueDate !== undefined) dbUpdates.due_date = extraUpdates.dueDate
      if (extraUpdates.title !== undefined) dbUpdates.title = extraUpdates.title
      if (extraUpdates.roomId !== undefined) dbUpdates.room_id = extraUpdates.roomId
      if (extraUpdates.frequency !== undefined) dbUpdates.frequency = extraUpdates.frequency
      // Previously omitted entirely -- the mobile execution form already
      // collects all of these (photos, parts replaced, and the full
      // Vendor-execution field set), but none of it ever reached the
      // database (see supabase/migrations/0025_wo_inspection_photos_and_vendor_fields.sql).
      if (extraUpdates.startPhotoUrl !== undefined) dbUpdates.start_photo_url = extraUpdates.startPhotoUrl
      if (extraUpdates.completionPhotoUrl !== undefined) dbUpdates.completion_photo_url = extraUpdates.completionPhotoUrl
      if (extraUpdates.partsReplaced !== undefined) dbUpdates.parts_replaced = extraUpdates.partsReplaced
      if (extraUpdates.vendorId !== undefined) dbUpdates.vendor_id = extraUpdates.vendorId
      if (extraUpdates.vendorTicketNo !== undefined) dbUpdates.vendor_ticket_no = extraUpdates.vendorTicketNo
      if (extraUpdates.vendorTechName !== undefined) dbUpdates.vendor_tech_name = extraUpdates.vendorTechName
      if (extraUpdates.vendorTechPhone !== undefined) dbUpdates.vendor_tech_phone = extraUpdates.vendorTechPhone
      if (extraUpdates.vendorServiceDate !== undefined) dbUpdates.vendor_service_date = extraUpdates.vendorServiceDate
      if (extraUpdates.vendorJobSheetUrl !== undefined) dbUpdates.vendor_job_sheet_url = extraUpdates.vendorJobSheetUrl
      if (extraUpdates.vendorRemarks !== undefined) dbUpdates.vendor_remarks = extraUpdates.vendorRemarks
      if (extraUpdates.vendorCost !== undefined) dbUpdates.vendor_cost = extraUpdates.vendorCost
    }

    // wo_number itself is re-minted server-side by a DB trigger (see
    // supabase/migrations/0014_server_side_ticket_numbering.sql) whenever
    // this transition applies -- the client's mintedWoNumber above is only
    // an optimistic guess (computed from an RLS-scoped, possibly-incomplete
    // view) used for a snappy UI. Reconcile local state below if the DB's
    // authoritative number came back different.
    supabase.from('work_orders').update(dbUpdates).or(`id.eq.${id},wo_number.eq.${id}`).select().single().then(({ data, error }) => {
      if (error) {
        console.error('Supabase work_order update error:', error.message)
        return
      }
      const realWoNumber: string | undefined = data?.wo_number
      if (isFirstAssignment && realWoNumber && realWoNumber !== mintedWoNumber) {
        setWorkOrders(prev => prev.map(w => (w.id === data.id ? { ...w, woNumber: realWoNumber } : w)))
        if (targetWoForMint?.source === 'Service Request' && targetWoForMint.sourceRefId) {
          updateServiceRequestStatus(targetWoForMint.sourceRefId, 'In Progress', { workOrderNumber: realWoNumber })
        }
      }
    })

    // If a Corrective WO is being minted for the first time (i.e. just
    // assigned), the asset goes 'Under Maintenance' immediately -- it
    // doesn't wait for a separate "start work" step. Preventive's existing
    // behavior (only flips when explicitly started) is unchanged.
    if (isFirstAssignment && targetWoForMint?.type === 'Corrective' && targetWoForMint.assetId) {
      updateAssetStatus(targetWoForMint.assetId, 'Under Maintenance')
    }

    // If this Corrective WO was raised from a Service Request, the ticket
    // was stamped with the PENDING placeholder at raise time -- now that a
    // real number exists, carry it over onto the ticket too.
    if (isFirstAssignment && mintedWoNumber && targetWoForMint?.source === 'Service Request' && targetWoForMint.sourceRefId) {
      updateServiceRequestStatus(targetWoForMint.sourceRefId, 'In Progress', { workOrderNumber: mintedWoNumber })
    }

    setWorkOrders(prev => {
      let nextRecurringPmWo: WorkOrder | null = null

      const nextList = prev.map(w => {
        if (w.id === id || w.woNumber === id) {
          const updated: WorkOrder = {
            ...w,
            ...extraUpdates,
            status,
            woNumber: mintedWoNumber || w.woNumber,
            technicianRemarks: remarks || w.technicianRemarks,
          }
          // w.status (not the new `status` param) is the PRE-update status --
          // gating on it too makes completion idempotent. Without this, a
          // second "Completed" call (e.g. a technician re-opening an
          // already-completed task and hitting Complete again) would
          // re-stamp completedAt to now, re-run every side effect, and for
          // a Preventive WO mint a duplicate recurring PM work order.
          if (status === 'Completed' && w.status !== 'Completed') {
            const completedDateIso = getLocalDateStr()
            updated.completedAt = completedDateIso
            if (w.assetId) {
              updateAssetStatus(w.assetId, 'Operational')
              const completionLabel =
                w.type === 'Preventive' ? 'Preventive Maintenance Completed' :
                w.type === 'Corrective' ? 'Corrective Maintenance Completed' :
                'Housekeeping Completed'
              addAssetLog({
                assetId: w.assetId,
                action: completionLabel,
                byUser: currentUser.fullName,
                source: 'Manual',
                referenceId: updated.woNumber,
                remarks: remarks || 'Work Order completed successfully.',
              })
            }

            // If this Work Order was triggered by a Service Request, auto-resolve
            // the ticket -- persisted via updateServiceRequestStatus (previously
            // this only updated local React state and was silently lost on reload).
            if (w.source === 'Service Request' && w.sourceRefId) {
              updateServiceRequestStatus(w.sourceRefId, 'Resolved')
            }

            // If this was a Preventive Maintenance Work Order, auto-schedule next
            // interval -- anchored on the date it was ACTUALLY completed, never
            // the original due date (a PM finished late shouldn't push every
            // future cycle later forever).
            if (w.type === 'Preventive') {
              const interval = w.frequency || 'Quarterly'
              const baseDate = completedDateIso
              const nextDueDate = addIntervalToDate(baseDate, interval)
              const nextWoUuid = generateUUID()
              const nextWoNumber = makePendingWoNumber(nextWoUuid)

              nextRecurringPmWo = {
                id: nextWoUuid,
                woNumber: nextWoNumber,
                title: w.title || `Preventive Maintenance (${interval})`,
                type: 'Preventive',
                assetId: w.assetId,
                roomId: w.roomId,
                source: 'Scheduled',
                frequency: interval,
                dueDate: nextDueDate,
                status: 'Scheduled',
                checklistTemplateId: w.checklistTemplateId,
                checklistSnapshot: w.checklistSnapshot,
                createdAt: completedDateIso,
              }

              supabase.from('work_orders').insert([{
                id: nextWoUuid,
                wo_number: nextWoNumber,
                title: nextRecurringPmWo.title,
                type: 'Preventive',
                asset_id: w.assetId || null,
                room_id: w.roomId || null,
                priority: 'Medium',
                source: 'Scheduled',
                frequency: interval,
                due_date: nextDueDate,
                status: 'Scheduled',
                checklist_template_id: w.checklistTemplateId || null,
                checklist_snapshot: w.checklistSnapshot || [],
                created_at: new Date().toISOString(),
              }]).then(({ error }) => {
                if (error) console.error('Supabase recurring PM WO insert error:', error.message)
              })
            }
          } else if (status === 'In Progress') {
            if (w.assetId) {
              updateAssetStatus(w.assetId, 'Under Maintenance')
              addAssetLog({
                assetId: w.assetId,
                action: 'Under Maintenance',
                byUser: currentUser.fullName,
                source: 'System',
                referenceId: updated.woNumber,
              })
            }
          }
          return updated
        }
        return w
      })

      if (nextRecurringPmWo) {
        return [nextRecurringPmWo, ...nextList]
      }
      return nextList
    })
  }

  const addInspection = (insp: Omit<Inspection, 'id' | 'createdAt'>) => {
    const newUuid = generateUUID()
    const today = getLocalDateStr()
    const newInsp: Inspection = {
      ...insp,
      id: newUuid,
      createdAt: today,
    }
    setInspections(prev => [newInsp, ...prev])

    supabase.from('inspections').insert([{
      id: newUuid,
      inspection_number: newInsp.inspectionNumber || newInsp.id,
      asset_id: newInsp.assetId || null,
      template_id: newInsp.templateId || null,
      template_version: newInsp.templateVersion || 1,
      due_date: newInsp.dueDate || today,
      status: newInsp.status || 'Scheduled',
      result: newInsp.result || null,
      remarks: newInsp.inspectorRemarks || null,
      checklist_snapshot: newInsp.checklistSnapshot || [],
      checklist_responses: newInsp.checklistResponses || {},
      conducted_by: newInsp.assignedInspectorName || null,
      conducted_by_user_id: newInsp.assignedInspectorId || null,
      conducted_at: newInsp.completedAt || null,
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase inspection insert error:', error.message)
    })
  }

  const updateInspection = (id: string, updates: Partial<Inspection>) => {
    const dbUpdates: Record<string, any> = {}
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.result !== undefined) dbUpdates.result = updates.result
    if (updates.inspectorRemarks !== undefined) dbUpdates.remarks = updates.inspectorRemarks
    if (updates.assignedInspectorId !== undefined) dbUpdates.conducted_by_user_id = updates.assignedInspectorId
    if (updates.assignedInspectorName !== undefined) dbUpdates.conducted_by = updates.assignedInspectorName
    if (updates.checklistResponses !== undefined) dbUpdates.checklist_responses = updates.checklistResponses
    if (updates.checklistSnapshot !== undefined) dbUpdates.checklist_snapshot = updates.checklistSnapshot
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate
    if (updates.completedAt !== undefined) dbUpdates.conducted_at = updates.completedAt

    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('inspections').update(dbUpdates).or(`id.eq.${id},inspection_number.eq.${id}`).then(({ error }) => {
        if (error) console.error('Supabase inspection update error:', error.message)
      })
    }

    setInspections(prev =>
      prev.map(ins => (ins.id === id || ins.inspectionNumber === id ? { ...ins, ...updates } : ins))
    )
  }

  const completeInspection = (id: string, result: 'Pass' | 'Fail', remarks: string, responses: any, photoUrl?: string, itemPhotos?: Record<string, string>) => {
    // Attempt window policy check for Inspections
    const targetInsp = inspections.find(ins => ins.id === id || ins.inspectionNumber === id)
    if (targetInsp) {
      const tmpl = checklistTemplates.find(t => t.id === targetInsp.templateId)
      const windowStatus = getAttemptWindowStatus(targetInsp.dueDate, tmpl?.interval)
      if (!windowStatus.canAttempt) {
        if (typeof window !== 'undefined') {
          alert(`This inspection cannot be attempted yet. The execution window opens on ${windowStatus.unlockDate} (${windowStatus.windowDescription}).`)
        }
        return
      }
    }

    const completedDateIso = getLocalDateStr()
    supabase.from('inspections').update({
      status: 'Completed',
      result,
      remarks,
      checklist_responses: responses,
      photo_url: photoUrl || null,
      item_photos: itemPhotos || null,
      conducted_at: completedDateIso,
    }).or(`id.eq.${id},inspection_number.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase inspection complete update error:', error.message)
    })

    setInspections(prev => {
      let nextRecurringInsp: Inspection | null = null

      const nextList = prev.map(ins => {
        if (ins.id === id || ins.inspectionNumber === id) {
          const updated: Inspection = {
            ...ins,
            status: 'Completed',
            result,
            inspectorRemarks: remarks,
            checklistResponses: responses,
            photoUrl: photoUrl || undefined,
            itemPhotos: itemPhotos || undefined,
            completedAt: completedDateIso,
          }

          const tmpl = checklistTemplates.find(t => t.id === ins.templateId)
          const interval = tmpl?.interval || 'Quarterly'
          const baseDate = ins.dueDate || completedDateIso
          const nextDueDate = addIntervalToDate(baseDate, interval)
          const nextSeq = getNextSequence(prev.map(x => x.inspectionNumber), 'INSP')
          const nextInspNumber = formatYearlyId('INSP', nextSeq)
          const nextInspUuid = generateUUID()

          // Auto-schedule next inspection cycle
          nextRecurringInsp = {
            id: nextInspUuid,
            inspectionNumber: nextInspNumber,
            assetId: ins.assetId,
            templateId: ins.templateId,
            templateVersion: ins.templateVersion || 1,
            dueDate: nextDueDate,
            status: 'Scheduled',
            checklistSnapshot: ins.checklistSnapshot || tmpl?.items,
            createdAt: completedDateIso,
          }

          // inspection_number is re-minted server-side by a DB trigger (see
          // supabase/migrations/0014_server_side_ticket_numbering.sql),
          // which ignores whatever's sent here -- nextInspNumber above is
          // only an optimistic guess (computed from this technician's own
          // RLS-scoped, possibly-incomplete view) for a snappy UI. Reconcile
          // below if it differs, rather than letting a stale number persist
          // in local state until the next full refresh.
          supabase.from('inspections').insert([{
            id: nextInspUuid,
            inspection_number: nextInspNumber,
            asset_id: ins.assetId,
            template_id: ins.templateId || null,
            template_version: ins.templateVersion || 1,
            due_date: nextDueDate,
            status: 'Scheduled',
            checklist_snapshot: ins.checklistSnapshot || tmpl?.items || [],
            created_at: new Date().toISOString(),
          }]).select().single().then(({ data, error }) => {
            if (error) {
              console.error('Supabase recurring inspection insert error:', error.message)
              return
            }
            if (data && data.inspection_number !== nextInspNumber) {
              setInspections(prev2 => prev2.map(i => (i.id === nextInspUuid ? { ...i, inspectionNumber: data.inspection_number } : i)))
            }
          })

          if (result === 'Fail') {
            // Asset status intentionally does NOT flip to 'Under Maintenance'
            // here anymore -- this Corrective record is unassigned (PENDING)
            // until a technician picks it up, matching the same
            // create-vs-assign split used for Service-Request-triggered
            // Corrective Maintenance. It flips at first assignment instead
            // (see updateWorkOrderStatus).
            const correctiveWoUuid = generateUUID()
            const correctiveWoNumber = makePendingWoNumber(correctiveWoUuid)
            const newCorrectiveWo: WorkOrder = {
              id: correctiveWoUuid,
              woNumber: correctiveWoNumber,
              type: 'Corrective',
              assetId: ins.assetId,
              source: 'Failed Inspection',
              sourceRefId: ins.inspectionNumber,
              dueDate: getLocalDateStr(new Date(Date.now() + 86400000 * 2)),
              status: 'Scheduled',
              issueLogged: `Failed inspection item during inspection: ${remarks}`,
              createdAt: completedDateIso,
            }
            setWorkOrders(wos => [newCorrectiveWo, ...wos])

            supabase.from('work_orders').insert([{
              id: correctiveWoUuid,
              wo_number: correctiveWoNumber,
              title: `Corrective: Defect from ${ins.inspectionNumber}`,
              type: 'Corrective',
              asset_id: ins.assetId,
              source: 'Failed Inspection',
              source_ref_id: ins.inspectionNumber,
              due_date: newCorrectiveWo.dueDate,
              status: 'Scheduled',
              issue_logged: newCorrectiveWo.issueLogged,
              created_at: new Date().toISOString(),
            }]).then(({ error }) => {
              if (error) console.error('Supabase corrective WO insert error:', error.message)
            })

            addAssetLog({
              assetId: ins.assetId,
              action: 'Inspection Failed',
              byUser: currentUser.fullName,
              source: 'Manual',
              referenceId: ins.inspectionNumber,
              remarks: `Inspection failed. A corrective maintenance task has been raised, pending technician assignment.`,
            })
          } else {
            updateAssetStatus(ins.assetId, 'Operational')
            addAssetLog({
              assetId: ins.assetId,
              action: 'Inspection Done',
              byUser: currentUser.fullName,
              source: 'Manual',
              referenceId: ins.inspectionNumber,
              remarks: `Inspection passed with zero non-conformances.`,
            })
          }

          return updated
        }
        return ins
      })

      if (nextRecurringInsp) {
        return [nextRecurringInsp, ...nextList]
      }
      return nextList
    })
  }

  // Room Access Logs & Check-In/Out
  const checkInRoom = async (roomId: string, purpose: string) => {
    const room = rooms.find(r => r.id === roomId || r.roomNumber === roomId)
    const resolvedRoomId = room ? room.id : roomId
    const now = new Date()
    const checkInTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    // Not .toISOString().split('T')[0] -- this is the exact UTC-vs-local
    // ambiguity supabase/migrations/0006_server_side_auto_checkout.sql's
    // comments already documented ("can be off by one day from the IST
    // calendar date near midnight"); this is that value's actual source.
    const checkInDate = getLocalDateStr(now)
    const newUuid = generateUUID()

    // AL-A#### is a real human-readable id (like assets.asset_id,
    // rooms.room_number, etc) instead of the raw UUID. Checked fresh
    // against the DB, same collision-safe pattern used for every other
    // entity's code this session.
    const { data: existingCodeRows } = await supabase.from('room_access_logs').select('activity_number')
    const knownCodes = new Set([
      ...roomAccessLogs.map(l => l.activityNumber).filter(Boolean),
      ...(existingCodeRows || []).map(r => r.activity_number).filter(Boolean),
    ] as string[])
    let maxSeq = 0
    knownCodes.forEach(code => {
      const match = code.match(/^AL-A(\d+)$/)
      if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10))
    })
    let seq = maxSeq + 1
    let activityNumber = `AL-A${String(seq).padStart(4, '0')}`
    while (knownCodes.has(activityNumber)) {
      seq++
      activityNumber = `AL-A${String(seq).padStart(4, '0')}`
    }

    const log: RoomAccessLog = {
      id: newUuid,
      activityNumber,
      roomId: resolvedRoomId,
      roomName: room ? `${room.name} (${room.roomNumber || room.id})` : 'Room',
      userId: currentUser.id,
      userName: currentUser.fullName,
      userRole: currentUser.role,
      checkInTime,
      checkInDate,
      checkInTimestamp: now.getTime(),
      purpose,
      isForceCheckout: false,
    }
    // activeCheckIn is derived elsewhere (see the useEffect keyed on
    // roomAccessLogs/currentUser.id below) — no need to set it here.
    setRoomAccessLogs(prev => [log, ...prev])
    setRooms(prev => prev.map(r => (r.id === resolvedRoomId || r.roomNumber === resolvedRoomId ? { ...r, status: 'Occupied', currentOccupant: currentUser.fullName } : r)))

    // Both the log write and the room status flip happen atomically inside
    // this one RPC (see supabase/migrations/0015_room_self_service_checkin.sql)
    // — previously these were two separate calls, and the room status one
    // silently failed for any non-admin (RLS only lets Admin write to
    // `rooms` directly), so the "Occupied" indicator never survived a
    // reload, or showed up for any other browser session, or even appeared
    // in the first place for a Guest/Technician check-in.
    const { error } = await supabase.rpc('room_check_in', {
      p_id: newUuid,
      p_room_id: resolvedRoomId,
      p_activity_number: activityNumber,
      p_purpose: purpose,
      p_user_name: currentUser.fullName,
      p_user_role: currentUser.role,
      p_check_in_time: checkInTime,
      p_check_in_date: checkInDate,
      p_check_in_timestamp: now.getTime(),
    })
    if (error) {
      console.error('Supabase room_check_in error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this check-in: ${error.message}`)
      }
    }
  }

  const checkOutRoom = async (roomId: string) => {
    const room = rooms.find(r => r.id === roomId || r.roomNumber === roomId)
    const resolvedRoomId = room ? room.id : roomId
    const nowDate = new Date()
    const now = nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const nowTimestamp = nowDate.getTime()
    // Scoped to the caller's own open log only — previously this matched
    // by room alone, so checking out could close a DIFFERENT user's still-
    // open session in a shared room.
    setRoomAccessLogs(prev =>
      prev.map(l => ((l.roomId === resolvedRoomId || l.roomId === roomId) && l.userId === currentUser.id && !l.checkOutTime ? { ...l, checkOutTime: now, checkOutTimestamp: nowTimestamp } : l))
    )
    setRooms(prev => prev.map(r => (r.id === resolvedRoomId || r.roomNumber === resolvedRoomId ? { ...r, status: 'Available', currentOccupant: undefined } : r)))

    // Same atomicity fix as checkInRoom above — one RPC, log update and
    // room status flip together (see
    // supabase/migrations/0015_room_self_service_checkin.sql). Also stamps
    // a real checkout epoch (0017/0018) so a Check Out event can be ranked
    // chronologically against other events, not just assumed to sit right
    // after its own Check In.
    const { error } = await supabase.rpc('room_check_out', {
      p_room_id: resolvedRoomId,
      p_check_out_time: now,
      p_check_out_timestamp: nowTimestamp,
    })
    if (error) {
      console.error('Supabase room_check_out error:', error.message)
      if (typeof window !== 'undefined') {
        alert(`Could not save this check-out: ${error.message}`)
      }
    }
  }

  // Automated End-of-Day Check-Out at 11:59 PM
  //
  // This client-side sweep is only a best-effort, same-tab convenience for
  // the current user's own stale session(s) -- the real, authoritative,
  // always-on auto-checkout is the server-side 23:59 IST pg_cron job
  // (public.run_auto_checkouts, supabase/migrations/0006), which closes
  // every user's stale sessions regardless of whether anyone has a tab
  // open. This function used to compare checkInDate/currentDateStr, both
  // built via `.toISOString().split('T')[0]` -- the UTC calendar date, not
  // the local one, exactly the ambiguity 0006's own comments already
  // documented and the server cron was fixed to avoid. It also wrote
  // directly to room_access_logs/rooms via raw .update() calls instead of
  // the room_check_out RPC, which silently no-ops the rooms status write
  // for a non-admin under RLS -- the same bug already fixed for manual
  // checkout. Both are fixed here: real local dates via getLocalDateStr,
  // and the same RPC checkOutRoom uses (also now stamping a real
  // checkOutTimestamp, previously missing on this path entirely).
  const evaluateAutoCheckouts = React.useCallback(() => {
    const now = new Date()
    const nowTimestamp = now.getTime()
    const currentDateStr = getLocalDateStr(now)
    const currentDayCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0)
    const isPast1159Today = now.getTime() >= currentDayCutoff.getTime()

    setRoomAccessLogs(prevLogs => {
      let hasChanges = false
      const updatedRoomsToFree = new Set<string>()
      const staleRoomIds: string[] = []

      const newLogs = prevLogs.map(log => {
        if (log.checkOutTime) return log
        // Only this session's own open logs -- the RPC below is scoped to
        // auth.uid() regardless of caller role, so that's the most this
        // client can ever actually persist; the server cron is what
        // handles everyone else's stale sessions.
        if (log.userId !== currentUser.id) return log

        const logDateStr = log.checkInDate || currentDateStr
        const isPastLogDate = logDateStr < currentDateStr
        const isSameDayPastCutoff = logDateStr === currentDateStr && isPast1159Today

        if (isPastLogDate || isSameDayPastCutoff) {
          hasChanges = true
          updatedRoomsToFree.add(log.roomId)
          staleRoomIds.push(log.roomId)
          return {
            ...log,
            checkOutTime: '11:59 PM',
            checkOutTimestamp: nowTimestamp,
            isForceCheckout: true,
            autoCheckOutNote: 'System Auto Check-Out at 11:59 PM (End of Day Cutoff)',
          }
        }
        return log
      })

      if (hasChanges) {
        // One RPC per stale room — atomic log + room status update
        // together (see room_check_out,
        // supabase/migrations/0020_room_check_out_force_params.sql).
        staleRoomIds.forEach(roomId => {
          supabase.rpc('room_check_out', {
            p_room_id: roomId,
            p_check_out_time: '11:59 PM',
            p_check_out_timestamp: nowTimestamp,
            p_is_force_checkout: true,
            p_auto_checkout_note: 'System Auto Check-Out at 11:59 PM (End of Day Cutoff)',
          }).then(({ error }) => {
            if (error) console.error('Supabase auto-checkout error:', error.message)
          })
        })
        setRooms(prevRooms =>
          prevRooms.map(r =>
            updatedRoomsToFree.has(r.id)
              ? { ...r, status: 'Available', currentOccupant: undefined }
              : r
          )
        )
        // activeCheckIn is derived elsewhere (see the useEffect keyed on
        // roomAccessLogs/currentUser.id) — it will automatically clear
        // once the corresponding log above gets its checkOutTime set.
        return newLogs
      }

      return prevLogs
    })
  }, [currentUser.id])

  // Auto-checkout scheduler effect
  React.useEffect(() => {
    evaluateAutoCheckouts()

    const interval = setInterval(() => {
      evaluateAutoCheckouts()
    }, 30000)

    const now = new Date()
    const cutoffToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0)
    const msUntil1159 = cutoffToday.getTime() - now.getTime()
    let cutoffTimer: NodeJS.Timeout | null = null

    if (msUntil1159 > 0) {
      cutoffTimer = setTimeout(() => {
        evaluateAutoCheckouts()
      }, msUntil1159)
    }

    return () => {
      clearInterval(interval)
      if (cutoffTimer) clearTimeout(cutoffTimer)
    }
  }, [evaluateAutoCheckouts])

  // Activity Logs
  const addAssetLog = (log: Omit<AssetActivityLog, 'id' | 'timestamp'>) => {
    const newUuid = generateUUID()
    const timestamp = new Date().toLocaleString()
    const timestampEpoch = Date.now()
    const targetAsset = assets.find(a => a.id === log.assetId || a.assetId === log.assetId)
    const resolvedAssetId = targetAsset ? targetAsset.id : log.assetId

    const newLog: AssetActivityLog = {
      ...log,
      id: newUuid,
      assetId: resolvedAssetId,
      timestamp,
      timestampEpoch,
    }
    setAssetActivityLogs(prev => [newLog, ...prev])

    supabase.from('asset_activity_logs').insert([{
      id: newUuid,
      asset_id: resolvedAssetId,
      by_user: log.byUser,
      action: log.action,
      remarks: log.remarks || null,
      source: log.source || 'Manual',
      timestamp,
      timestamp_epoch: timestampEpoch,
    }]).then(({ error }) => {
      if (error) console.error('Supabase asset_activity_log insert error:', error.message)
    })
  }

  return (
    <AFMSContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isLoggedIn,
        setIsLoggedIn,
        login,
        logout,
        users,
        addInvitedUser,
        updateUser,
        deleteUser,
        departments,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        campuses,
        addCampus,
        updateCampus,
        deleteCampus,
        buildings,
        addBuilding,
        updateBuilding,
        deleteBuilding,
        rooms,
        addRoom,
        updateRoom,
        deleteRoom,
        roomTypes,
        addRoomType,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        subCategories,
        addSubCategory,
        updateSubCategory,
        deleteSubCategory,
        assets,
        addAsset,
        addBulkAssets,
        updateAsset,
        updateAssetStatus,
        inventoryItems,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        convertInventoryToAsset,
        reservations,
        addReservation,
        addBulkReservations,
        updateReservationStatus,
        deleteReservation,
        workOrders,
        addWorkOrder,
        updateWorkOrderStatus,
        inspections,
        addInspection,
        updateInspection,
        completeInspection,
        serviceRequests,
        addServiceRequest,
        updateServiceRequestStatus,
        updateServiceRequest,
        checklistTemplates,
        addChecklistTemplate,
        updateChecklistTemplate,
        deleteChecklistTemplate,
        vendors,
        addVendor,
        updateVendor,
        deleteVendor,
        documents,
        addDocument,
        updateDocument,
        roomAccessLogs,
        checkInRoom,
        checkOutRoom,
        assetActivityLogs,
        addAssetLog,
        slaConfig,
        updateSlaConfig,
        clearAllData,
        clearOperationalData,
        activeCheckIn,
        evaluateAutoCheckouts,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        refreshNotifications,
        isDataLoading,
        dataLoadError,
        reloadData: syncSupabase,
        realtimeStatus,
      }}
    >
      {children}
    </AFMSContext.Provider>
  )
}

export function useAFMS() {
  const context = useContext(AFMSContext)
  if (!context) throw new Error('useAFMS must be used within an AFMSProvider')
  return context
}
