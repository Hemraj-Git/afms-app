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
import { formatId, formatYearlyId, getNextSequence, addIntervalToDate, makePendingWoNumber, isPendingWorkOrder } from '@/lib/idGenerator'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { getLocalDateStr } from '@/lib/dateUtils'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { generateUUID } from '@/lib/uuid'
import { allocateVendor, useAddVendor, useDeleteVendor, useUpdateVendor, useVendors, vendorKeys } from '@/lib/queries/vendors'
import { allocateDepartment, departmentKeys, useAddDepartment, useDeleteDepartment, useDepartments, useUpdateDepartment } from '@/lib/queries/departments'
import { allocateCampus, campusKeys, useAddCampus, useCampuses, useDeleteCampus, useUpdateCampus } from '@/lib/queries/campuses'
import { allocateBuilding, buildingKeys, useAddBuilding, useBuildings, useDeleteBuilding, useUpdateBuilding } from '@/lib/queries/buildings'
import { allocateCategory, categoryKeys, useAddCategory, useCategories, useDeleteCategory, useUpdateCategory } from '@/lib/queries/categories'
import { allocateSubCategory, subCategoryKeys, useAddSubCategory, useDeleteSubCategory, useSubCategories, useUpdateSubCategory } from '@/lib/queries/subCategories'
import { allocateRoom, roomKeys, useAddRoom, useDeleteRoom, useRooms, useUpdateRoom } from '@/lib/queries/rooms'
import { checklistTemplateKeys, newChecklistTemplate, useAddChecklistTemplate, useChecklistTemplates, useDeleteChecklistTemplate, useUpdateChecklistTemplate } from '@/lib/queries/checklistTemplates'
import { allocateInventoryItem, inventoryKeys, useAddInventoryItem, useDeleteInventoryItem, useInventoryItems, useUpdateInventoryItem } from '@/lib/queries/inventory'
import { documentKeys, newDocument, useAddDocument, useDocuments, useUpdateDocument, type DocumentEntity } from '@/lib/queries/documents'
import { allocateAssets, assetKeys, useAddAssets, useAssets, useUpdateAsset } from '@/lib/queries/assets'
import { useAddReservations, useDeleteReservation, useReservations, useUpdateReservation, reservationKeys } from '@/lib/queries/reservations'
import { roomAccessLogKeys, useRoomAccessLogs } from '@/lib/queries/roomAccessLogs'
import { inspectionKeys, useAddInspections, useInspections, useUpdateInspection } from '@/lib/queries/inspections'
import { serviceRequestKeys, useAddServiceRequest, useServiceRequests, useUpdateServiceRequest } from '@/lib/queries/serviceRequests'
import { useAddWorkOrders, useUpdateWorkOrder, useWorkOrders, workOrderKeys } from '@/lib/queries/workOrders'
import { addInvitedUserToCache, useDeleteUser, useUpdateUser, useUsers } from '@/lib/queries/users'
import { assetActivityLogKeys, useAddAssetActivityLogs, useAssetActivityLogs } from '@/lib/queries/assetActivityLogs'
import { showToast } from '@/lib/toast'
import { useRealtimeSync, type RealtimeStatus } from '@/lib/realtime/useRealtimeSync'

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

  // Entities migrated to TanStack Query (see src/lib/queries). They start once a
  // real profile is known -- the pre-load placeholder user has id 'guest' -- and
  // are keyed by user, so a different sign-in never sees another user's cache.
  const queryClient = useQueryClient()
  const queriesEnabled = isLoggedIn && currentUser.id !== 'guest'
  const vendorsQuery = useVendors(currentUser.id, queriesEnabled)
  const vendors = vendorsQuery.vendors
  const addVendorMutation = useAddVendor(currentUser.id)
  const updateVendorMutation = useUpdateVendor(currentUser.id)
  const deleteVendorMutation = useDeleteVendor(currentUser.id)
  const departmentsQuery = useDepartments(currentUser.id, queriesEnabled)
  const addDepartmentMutation = useAddDepartment(currentUser.id)
  const updateDepartmentMutation = useUpdateDepartment(currentUser.id)
  const deleteDepartmentMutation = useDeleteDepartment(currentUser.id)
  const campusesQuery = useCampuses(currentUser.id, queriesEnabled)
  const campuses = campusesQuery.campuses
  const addCampusMutation = useAddCampus(currentUser.id)
  const updateCampusMutation = useUpdateCampus(currentUser.id)
  const deleteCampusMutation = useDeleteCampus(currentUser.id)
  const buildingsQuery = useBuildings(currentUser.id, queriesEnabled)
  const buildings = buildingsQuery.buildings
  const addBuildingMutation = useAddBuilding(currentUser.id)
  const updateBuildingMutation = useUpdateBuilding(currentUser.id)
  const deleteBuildingMutation = useDeleteBuilding(currentUser.id)
  const categoriesQuery = useCategories(currentUser.id, queriesEnabled)
  const categories = categoriesQuery.categories
  const addCategoryMutation = useAddCategory(currentUser.id)
  const updateCategoryMutation = useUpdateCategory(currentUser.id)
  const deleteCategoryMutation = useDeleteCategory(currentUser.id)
  const subCategoriesQuery = useSubCategories(currentUser.id, queriesEnabled)
  const subCategories = subCategoriesQuery.subCategories
  const addSubCategoryMutation = useAddSubCategory(currentUser.id)
  const updateSubCategoryMutation = useUpdateSubCategory(currentUser.id)
  const deleteSubCategoryMutation = useDeleteSubCategory(currentUser.id)
  const roomsQuery = useRooms(currentUser.id, queriesEnabled)
  const rooms = roomsQuery.rooms
  const addRoomMutation = useAddRoom(currentUser.id)
  const updateRoomMutation = useUpdateRoom(currentUser.id)
  const deleteRoomMutation = useDeleteRoom(currentUser.id)
  const checklistTemplatesQuery = useChecklistTemplates(currentUser.id, queriesEnabled)
  const checklistTemplates = checklistTemplatesQuery.checklistTemplates
  const addChecklistTemplateMutation = useAddChecklistTemplate(currentUser.id)
  const updateChecklistTemplateMutation = useUpdateChecklistTemplate(currentUser.id)
  const deleteChecklistTemplateMutation = useDeleteChecklistTemplate(currentUser.id)
  const inventoryQuery = useInventoryItems(currentUser.id, queriesEnabled)
  const inventoryItems = inventoryQuery.inventoryItems
  const addInventoryMutation = useAddInventoryItem(currentUser.id)
  const updateInventoryMutation = useUpdateInventoryItem(currentUser.id)
  const deleteInventoryMutation = useDeleteInventoryItem(currentUser.id)
  const documentsQuery = useDocuments(currentUser.id, queriesEnabled)
  const documents = documentsQuery.documents
  const addDocumentMutation = useAddDocument(currentUser.id)
  const updateDocumentMutation = useUpdateDocument(currentUser.id)
  const assetsQuery = useAssets(currentUser.id, queriesEnabled)
  const assets = assetsQuery.assets
  const addAssetsMutation = useAddAssets(currentUser.id)
  const updateAssetMutation = useUpdateAsset(currentUser.id)
  const reservationsQuery = useReservations(currentUser.id, queriesEnabled)
  const reservations = reservationsQuery.reservations
  const addReservationsMutation = useAddReservations(currentUser.id)
  const updateReservationMutation = useUpdateReservation(currentUser.id)
  const deleteReservationMutation = useDeleteReservation(currentUser.id)
  const roomAccessLogsQuery = useRoomAccessLogs(currentUser.id, queriesEnabled)
  // The table has no room name; resolve it against the current rooms, so it also
  // follows a renamed room.
  const roomAccessLogs = React.useMemo(() => {
    const roomById = new Map(rooms.map(r => [r.id, r]))
    return roomAccessLogsQuery.roomAccessLogs.map(l => {
      const room = roomById.get(l.roomId)
      return room ? { ...l, roomName: `${room.name} (${room.roomNumber || room.id})` } : l
    })
  }, [roomAccessLogsQuery.roomAccessLogs, rooms])
  const assetActivityLogsQuery = useAssetActivityLogs(currentUser.id, queriesEnabled)
  const assetActivityLogs = assetActivityLogsQuery.assetActivityLogs
  const addAssetActivityLogsMutation = useAddAssetActivityLogs(currentUser.id)
  const inspectionsQuery = useInspections(currentUser.id, queriesEnabled)
  const inspections = inspectionsQuery.inspections
  const addInspectionsMutation = useAddInspections(currentUser.id)
  const updateInspectionMutation = useUpdateInspection(currentUser.id)
  const serviceRequestsQuery = useServiceRequests(currentUser.id, queriesEnabled)
  const addServiceRequestMutation = useAddServiceRequest(currentUser.id)
  const updateServiceRequestMutation = useUpdateServiceRequest(currentUser.id)
  const workOrdersQuery = useWorkOrders(currentUser.id, queriesEnabled)
  const workOrders = workOrdersQuery.workOrders
  const addWorkOrdersMutation = useAddWorkOrders(currentUser.id)
  const updateWorkOrderMutation = useUpdateWorkOrder(currentUser.id)
  const usersQuery = useUsers(currentUser.id, queriesEnabled)
  const users = usersQuery.users
  // A department stores its head as a user id; show that person's name.
  const departments = React.useMemo(() => {
    const nameById = new Map(users.map(u => [u.id, u.fullName]))
    return departmentsQuery.departments.map(d => {
      const head = d.headUserId ? nameById.get(d.headUserId) : undefined
      return head === d.headOfDepartment ? d : { ...d, headOfDepartment: head }
    })
  }, [departmentsQuery.departments, users])
  const updateUserMutation = useUpdateUser(currentUser.id)
  const deleteUserMutation = useDeleteUser(currentUser.id)
  // Every migrated query, for the loading / error / reload plumbing below.
  const migratedQueries = [
    vendorsQuery, departmentsQuery, campusesQuery, buildingsQuery, categoriesQuery, subCategoriesQuery,
    roomsQuery, checklistTemplatesQuery, inventoryQuery, documentsQuery, assetsQuery,
    reservationsQuery, roomAccessLogsQuery, assetActivityLogsQuery, inspectionsQuery, serviceRequestsQuery, workOrdersQuery, usersQuery,
  ]
  const queryLoadFailures = migratedQueries.flatMap(q => (q.isError ? [q.error.message] : []))

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
    // Anything cached before signing in was read without this session.
    queryClient.invalidateQueries()
  }

  const logout = () => {
    setIsLoggedIn(false)
    queryClient.clear()
    try {
      supabase.auth.signOut().catch(() => {})
    } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.setItem('afms_logged_in', 'false')
      localStorage.removeItem('afms_current_user_id')
    }
  }

  
  
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

  // A ticket has no requester-role column, so it reads back as "Staff". Show the
  // requester's real role from their profile instead (Guest, Faculty, ...).
  const serviceRequests = React.useMemo(() => {
    const roleByUserId = new Map(users.map(u => [u.id, u.role]))
    return serviceRequestsQuery.serviceRequests.map(sr => {
      const role = sr.requestedByUserId ? roleByUserId.get(sr.requestedByUserId) : undefined
      return role && role !== sr.requestedByRole ? { ...sr, requestedByRole: role } : sr
    })
  }, [serviceRequestsQuery.serviceRequests, users])
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

  const syncSupabase = React.useCallback(async () => {
      const runId = ++syncRunRef.current
      setIsDataLoading(true)
      setDataLoadError(null)

      const failures: string[] = []

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
  }, [])

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
      refetchWorkOrders: () => { queryClient.invalidateQueries({ queryKey: workOrderKeys.list(currentUser.id) }) },
      refetchServiceRequests: () => { queryClient.invalidateQueries({ queryKey: serviceRequestKeys.list(currentUser.id) }) },
      refetchInspections: () => { queryClient.invalidateQueries({ queryKey: inspectionKeys.list(currentUser.id) }) },
      refetchRooms: () => { queryClient.invalidateQueries({ queryKey: roomKeys.list(currentUser.id) }) },
      refetchRoomAccessLogs: () => { queryClient.invalidateQueries({ queryKey: roomAccessLogKeys.list(currentUser.id) }) },
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
    queryClient.setQueryData(campusKeys.list(currentUser.id), [])
    queryClient.setQueryData(buildingKeys.list(currentUser.id), [])
    queryClient.setQueryData(roomKeys.list(currentUser.id), [])
    queryClient.setQueryData(categoryKeys.list(currentUser.id), [])
    queryClient.setQueryData(subCategoryKeys.list(currentUser.id), [])
    queryClient.setQueryData(vendorKeys.list(currentUser.id), [])
    queryClient.setQueryData(checklistTemplateKeys.list(currentUser.id), [])
    queryClient.setQueryData(assetKeys.list(currentUser.id), [])
    queryClient.setQueryData(inventoryKeys.list(currentUser.id), [])
    queryClient.setQueryData(reservationKeys.list(currentUser.id), [])
    queryClient.setQueryData(serviceRequestKeys.list(currentUser.id), [])
    queryClient.setQueryData(workOrderKeys.list(currentUser.id), [])
    queryClient.setQueryData(inspectionKeys.list(currentUser.id), [])
    queryClient.setQueryData(documentKeys.list(currentUser.id), [])
    queryClient.setQueryData(roomAccessLogKeys.list(currentUser.id), [])
    queryClient.setQueryData(assetActivityLogKeys.list(currentUser.id), [])
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
    queryClient.setQueryData(serviceRequestKeys.list(currentUser.id), [])
    queryClient.setQueryData(workOrderKeys.list(currentUser.id), [])
    queryClient.setQueryData(inspectionKeys.list(currentUser.id), [])
    queryClient.setQueryData(roomAccessLogKeys.list(currentUser.id), [])
    queryClient.setQueryData(assetActivityLogKeys.list(currentUser.id), [])
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
    addInvitedUserToCache(queryClient, currentUser.id, profile)
  }
  // Edits and deletes of another user go through Admin-verified Server Actions:
  // the browser client can't do them (RLS only lets a user update their own
  // profile row, and there is no delete policy), so the old direct write
  // matched 0 rows while the screen showed it as done. Email is not editable
  // here -- it is the login identity and lives in Supabase Auth. The change
  // shows at once and is undone (with a toast) if the action refuses it.
  const updateUser = async (id: string, userData: Partial<UserProfile>): Promise<{ success: boolean; message?: string }> => {
    const { id: _id, email: _email, ...safeData } = userData // Enforce immutable ID; email isn't editable here
    const wasCurrentUser = currentUser.id === id
    const previousCurrent = currentUser
    if (wasCurrentUser) {
      setCurrentUser(prev => ({ ...prev, ...safeData }))
    }
    try {
      await updateUserMutation.mutateAsync({ id, changes: safeData })
      return { success: true }
    } catch (err) {
      if (wasCurrentUser) setCurrentUser(previousCurrent)
      return { success: false, message: err instanceof Error ? err.message : 'Could not update the user.' }
    }
  }
  const deleteUser = async (id: string): Promise<{ success: boolean; message?: string }> => {
    if (id === currentUser.id) {
      showToast('error', 'You cannot delete the account you are signed in with.')
      return { success: false, message: 'Cannot delete the active logged-in user profile.' }
    }
    try {
      await deleteUserMutation.mutateAsync(id)
      // If they headed a department, the database has cleared that link.
      queryClient.invalidateQueries({ queryKey: departmentKeys.list(currentUser.id) })
      return { success: true }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Could not delete the user.' }
    }
  }

  // 1b. Department: DEP-#### (Immutable ID, Deletion Protected by User Linkage)
  // The add* functions reject if the save fails (after the list is rolled back and
  // a toast shown), so callers can keep their form open.
  const addDepartment = async (deptData: Omit<Department, 'id'>): Promise<Department> => {
    const newDept = await allocateDepartment(deptData, departments)
    await addDepartmentMutation.mutateAsync(newDept)
    return newDept
  }

  const updateDepartment = (id: string, deptData: Partial<Department>) => {
    updateDepartmentMutation.mutate({ id, changes: deptData })
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

    deleteDepartmentMutation.mutate(id)
    return { success: true }
  }

  // 2. Campus: CAM-#### (Immutable ID)
  const addCampus = async (campus: Omit<Campus, 'id' | 'code'>): Promise<Campus> => {
    const newCampus = await allocateCampus(campus, campuses)
    await addCampusMutation.mutateAsync(newCampus)
    return newCampus
  }
  const updateCampus = (id: string, campusData: Partial<Campus>) => {
    updateCampusMutation.mutate({ id, changes: campusData })
  }
  const deleteCampus = (id: string) => {
    deleteCampusMutation.mutate(id)
  }

  // 3. Building: BLD-#### (Immutable ID)
  const addBuilding = async (bld: Omit<Building, 'id' | 'code'>): Promise<Building> => {
    const newBld = await allocateBuilding(bld, buildings)
    await addBuildingMutation.mutateAsync(newBld)
    return newBld
  }
  const updateBuilding = (id: string, bldData: Partial<Building>) => {
    updateBuildingMutation.mutate({ id, changes: bldData })
  }
  const deleteBuilding = (id: string) => {
    deleteBuildingMutation.mutate(id)
  }

  // 4. Room: ROM-#### (Immutable ID & QR Key)
  const addRoom = async (room: Omit<Room, 'id' | 'roomNumber' | 'qrCodeKey'>): Promise<Room> => {
    const newRoom = await allocateRoom(room, rooms)
    await addRoomMutation.mutateAsync(newRoom)
    return newRoom
  }
  const updateRoom = (id: string, roomData: Partial<Room>) => {
    updateRoomMutation.mutate({ id, changes: roomData })
  }
  const deleteRoom = (id: string) => {
    deleteRoomMutation.mutate(id)
  }

  // Room Types
  const addRoomType = (newType: string) => {
    const trimmed = newType.trim()
    if (!trimmed) return
    setRoomTypes(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }

  // 5. Category: 4-letter uppercase ID derived automatically from Name e.g. "Electrical" -> "ELEC"
  const addCategory = async (cat: Omit<Category, 'id' | 'code'>): Promise<Category> => {
    const newCat = await allocateCategory(cat, categories)
    await addCategoryMutation.mutateAsync(newCat)
    return newCat
  }
  const updateCategory = (id: string, catData: Partial<Category>) => {
    updateCategoryMutation.mutate({ id, changes: catData })
  }
  const deleteCategory = (id: string) => {
    deleteCategoryMutation.mutate(id)
  }

  // 6. SubCategory: CategoryId-SubCategoryId derived automatically e.g. "ELEC-LIGH"
  const addSubCategory = async (sub: Omit<SubCategory, 'id' | 'code'>): Promise<SubCategory> => {
    const parentCat = categories.find(c => c.id === sub.categoryId)
    const parentCode = parentCat?.code || parentCat?.id || sub.categoryId || 'GENR'
    const newSub = await allocateSubCategory(sub, parentCode, subCategories)
    await addSubCategoryMutation.mutateAsync(newSub)
    return newSub
  }
  const updateSubCategory = (id: string, subData: Partial<SubCategory>) => {
    updateSubCategoryMutation.mutate({ id, changes: subData })
  }
  const deleteSubCategory = (id: string) => {
    deleteSubCategoryMutation.mutate(id)
  }

  // 7. Asset: AST-#### (Immutable ID)
  const addAsset = async (assetData: Omit<Asset, 'id' | 'assetId' | 'createdAt'>): Promise<Asset> => {
    const today = getLocalDateStr()
    const [createdAsset] = await allocateAssets([assetData], assets)
    const newUuid = createdAsset.id
    const newId = createdAsset.assetId

    // Awaited deliberately: work_orders/inspections/documents/asset_activity_logs
    // all carry a foreign key on asset_id. Firing them concurrently with this
    // insert (the previous behavior) meant they frequently reached the
    // database before this row had actually committed, and were rejected
    // outright with a foreign-key violation — confirmed live via Postgres
    // logs (every PM work order insert failed this way, and most
    // inspections). Nothing that depends on this asset existing may fire
    // until this specific insert has actually succeeded. If it fails this
    // rejects (after the list is rolled back and a toast shown), so none of
    // the follow-on records are created for an asset that does not exist.
    await addAssetsMutation.mutateAsync([createdAsset])

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
      const newPmWorkOrders: WorkOrder[] = pmIds.map((pmTmplId) => {
        const tmpl = checklistTemplates.find(t => t.id === pmTmplId)
        const interval = tmpl?.interval || 'Quarterly'
        const nextPmDueDate = addIntervalToDate(installDate, interval)
        const pmWoUuid = generateUUID()
        return {
          id: pmWoUuid,
          woNumber: makePendingWoNumber(pmWoUuid),
          title: tmpl ? `${tmpl.title} (${interval})` : `${assetData.name} ${interval} PM`,
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
      })
      if (newPmWorkOrders.length > 0) addWorkOrdersMutation.mutate(newPmWorkOrders)

      const inspIds = Array.from(new Set(sub.inspectionTemplateIds && sub.inspectionTemplateIds.length > 0 ? sub.inspectionTemplateIds : (sub.inspectionTemplateId ? [sub.inspectionTemplateId] : []))).filter(Boolean)
      let inspSeq = getNextSequence(inspections.map(i => i.inspectionNumber), 'INSP')
      const newInspections: Inspection[] = inspIds.map((inspTmplId) => {
        const tmpl = checklistTemplates.find(t => t.id === inspTmplId)
        const interval = tmpl?.interval || 'Quarterly'
        const nextInspDueDate = addIntervalToDate(installDate, interval)
        const inspNumber = formatYearlyId('INSP', inspSeq++)
        return {
          id: generateUUID(),
          inspectionNumber: inspNumber,
          assetId: newUuid,
          templateId: inspTmplId,
          templateVersion: 1,
          dueDate: nextInspDueDate,
          status: 'Scheduled',
          checklistSnapshot: tmpl?.items,
          createdAt: today,
        }
      })
      // inspection_number is re-minted server-side by a DB trigger (see
      // supabase/migrations/0014_server_side_ticket_numbering.sql), which
      // ignores whatever is sent -- the number above is only the on-screen
      // guess; the list is re-read as soon as the write settles.
      if (newInspections.length > 0) addInspectionsMutation.mutate(newInspections)
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
    // Numbering continues from the highest AST-#### seen on screen or stored
    // (it once restarted at AST-0001 on every import).
    const createdAssets = await allocateAssets(assetsData, assets)

    // The assets go in first, as one statement, and nothing else is created
    // unless it succeeds: work_orders and inspections carry a foreign key on
    // asset_id, so they must not fire until the assets have committed. On
    // failure the list is rolled back and a toast shown by the mutation.
    try {
      await addAssetsMutation.mutateAsync(createdAssets)
    } catch {
      return { success: false, createdCount: 0, createdAssets: [] }
    }

    let inspSeq = getNextSequence(inspections.map(i => i.inspectionNumber), 'INSP')

    const newWorkOrders: WorkOrder[] = []
    const newInspections: Inspection[] = []
    const newLogs: Omit<AssetActivityLog, 'id' | 'timestamp'>[] = []

    for (const createdAsset of createdAssets) {
      const newUuid = createdAsset.id
      const displayId = createdAsset.assetId

      const sub = subCategories.find(s => s.id === createdAsset.subCategoryId)
      if (sub) {
        // Same anchor rule as addAsset: Last Serviced Date, else today —
        // never a backdated Installation Date.
        const installDate = createdAsset.lastServicedDate || today

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
            title: tmpl ? `${tmpl.title} (${interval})` : `${createdAsset.name} ${interval} PM`,
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

    if (newWorkOrders.length > 0) {
      // One insert for all of them, after the assets have saved.
      addWorkOrdersMutation.mutate(newWorkOrders)
    }
    if (newInspections.length > 0) {
      // One insert for all of them; numbers are re-minted by the database and the
      // list is re-read when the write settles.
      addInspectionsMutation.mutate(newInspections)
    }
    addAssetLogs(newLogs)


    return { success: true, createdCount: createdAssets.length, createdAssets }
  }

  const updateAsset = (id: string, assetData: Partial<Asset>) => {
    // Installation Date anchors the PM/Inspection schedule generated once
    // at creation time — allowing it to be edited later would silently
    // desync already-generated due dates from what the UI shows, so it's
    // stripped here as a defense-in-depth guard (the wizard also disables
    // the field in edit mode).
    const { id: _, assetId: __, createdAt: ___, installationDate: ____, ...safeData } = assetData
    updateAssetMutation.mutate({ id, changes: safeData })
    addAssetLog({
      assetId: id,
      action: 'Asset Updated',
      byUser: currentUser.fullName,
      source: 'Manual',
      remarks: `Asset specification and profile updated.`,
    })
  }

  const updateAssetStatus = (assetId: string, status: Asset['status']) => {
    const listKey = assetKeys.list(currentUser.id)
    queryClient.setQueryData<Asset[]>(listKey, prev => (prev ?? []).map(a => (a.id === assetId ? { ...a, status } : a)))
    // Via RPC, not a direct table .update() -- "Admin all on assets" is the
    // only write policy on assets, so a Technician's direct update here
    // silently no-ops under RLS. set_asset_status (0023) is role-gated
    // (Admin or Technician) and only ever touches the status column.
    supabase.rpc('set_asset_status', { p_asset_id: assetId, p_status: status }).then(({ error }) => {
      if (error) {
        console.error('Supabase asset status update error:', error.message)
        showToast('error', `Update asset status failed and was undone: ${error.message}`)
      }
      // Success or failure, re-read so the screen shows what is stored.
      queryClient.invalidateQueries({ queryKey: listKey })
    })
  }

  // 7b. Inventory Item: INV-#### (Immutable ID, No auto PM/Inspection)
  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id' | 'inventoryNumber' | 'createdAt'>): Promise<InventoryItem> => {
    const newItem = await allocateInventoryItem(itemData, inventoryItems)
    await addInventoryMutation.mutateAsync(newItem)
    return newItem
  }

  // Callers pass either the row id or the INV-#### number.
  const resolveInventoryId = (idOrNumber: string) =>
    inventoryItems.find(item => item.id === idOrNumber || item.inventoryNumber === idOrNumber)?.id ?? idOrNumber

  const updateInventoryItem = async (id: string, itemData: Partial<InventoryItem>) => {
    // A failed save is rolled back and toasted by the mutation, so it is not
    // rethrown here; callers carry on as they did when this only alerted.
    await updateInventoryMutation.mutateAsync({ id: resolveInventoryId(id), changes: itemData }).catch(() => {})
  }

  const deleteInventoryItem = (id: string) => {
    deleteInventoryMutation.mutate(resolveInventoryId(id))
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

    // Create standard operational asset (which triggers PM/Inspection). If the
    // save fails (already toasted), leave the spare part and its documents alone.
    let newAsset: Asset
    try {
      newAsset = await addAsset({
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
    } catch {
      return null
    }

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
  // These stay synchronous (callers use the result at once); the save happens
  // behind the scenes and is undone with a toast if the database refuses it.
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

    addReservationsMutation.mutate([newRes])

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

    const currentReservations = [...reservations]

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
      // One insert for the whole booking: all of its slots land, or none do.
      addReservationsMutation.mutate(validToCreate)
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

  // Callers pass either the row id or the RSV-YYYY-#### number.
  const resolveReservationId = (idOrNumber: string) =>
    reservations.find(r => r.id === idOrNumber || r.reservationNumber === idOrNumber)?.id ?? idOrNumber

  const updateReservationStatus = (id: string, status: Reservation['status']) => {
    updateReservationMutation.mutate({ id: resolveReservationId(id), changes: { status } })
  }

  const deleteReservation = (id: string) => {
    deleteReservationMutation.mutate(resolveReservationId(id))
  }

  // 8. Service Request: SR-YYYY-#### (minted server-side by a DB trigger —
  // see supabase/migrations/0014_server_side_ticket_numbering.sql. A
  // client-computed guess previously collided with existing tickets a
  // Guest/Technician's RLS-scoped view couldn't see, silently failing the
  // insert while the UI still showed a false "success".)
  const addServiceRequest = async (sr: Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>): Promise<ServiceRequest> => {
    // Stamped from the real session, not the caller — this is what the
    // RLS "own service_requests" policies key off, so it must always be
    // the actual signed-in user regardless of what a caller passes in.
    // requested_by_email is what lets a returning Guest (fresh auth.uid()
    // every login) read requests raised in a previous visit — see the
    // "Guest read same-email service_requests" RLS policy.
    // Rejects if the database refuses; the form shows the message itself.
    const newSr = await addServiceRequestMutation.mutateAsync({
      ...sr,
      requestedByUserId: currentUser.id,
      requestedByEmail: currentUser.email || undefined,
    })

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

  const updateServiceRequestStatus = (
    id: string,
    status: ServiceRequest['status'],
    extraUpdates?: Partial<Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>>
  ) => {
    // Matches by ticketId too, not just id -- callers like the Work Order
    // completion handshake only know the ticket's sourceRefId (its
    // formatted ticketId, e.g. "SR-2026-0001"), never its raw UUID.
    updateServiceRequestMutation.mutate({ id, changes: { ...extraUpdates, status } })
  }

  const updateServiceRequest = (id: string, updates: Partial<ServiceRequest>) => {
    updateServiceRequestMutation.mutate({ id, changes: updates })
  }

  // 9. Vendor: VND-#### (Immutable ID)
  const addVendor = async (v: Omit<Vendor, 'id' | 'code'>): Promise<Vendor> => {
    const newVendor = await allocateVendor(v, vendors)
    // Awaited: assets.purchase_vendor_id/maintenance_vendor_id and
    // inventory_items.vendor_id are real foreign keys to vendors.id, and asset
    // and inventory creation add a vendor inline and reference it a few steps
    // later. If the insert fails this rejects (after the list is rolled back and
    // a toast shown) so callers don't go on to reference a vendor that isn't there.
    await addVendorMutation.mutateAsync(newVendor)
    return newVendor
  }

  const updateVendor = (id: string, vendorData: Partial<Vendor>) => {
    updateVendorMutation.mutate({ id, changes: vendorData })
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
    deleteVendorMutation.mutate(id)
    return { success: true }
  }

  // 10. Document: DOC-YYYY-#### (Immutable ID)
  const addDocument = async (doc: Omit<DocumentItem, 'id' | 'uploadedAt'>): Promise<DocumentItem> => {
    // Resolve the first linked id against assets first, then inventory
    // items — linkedAssetIds is a single flat list used for both, since
    // the wizard UI doesn't distinguish which kind of item it's attaching
    // a document to.
    const linkId = doc.linkedAssetIds?.[0]
    const linkedAsset = linkId ? assets.find(a => a.id === linkId || a.assetId === linkId) : undefined
    const linkedInventoryItem = !linkedAsset && linkId
      ? inventoryItems.find(i => i.id === linkId || i.inventoryNumber === linkId)
      : undefined
    const newDoc = newDocument(doc, {
      assetId: linkedAsset?.id ?? null,
      inventoryItemId: linkedInventoryItem?.id ?? null,
    })
    // Awaited so callers that immediately link this document to something
    // else (e.g. the asset-creation wizard's "attach to this asset" step)
    // can be sure the row actually exists first, rather than racing an
    // UPDATE against an insert that hasn't committed yet. Rejects if the save
    // fails (after rollback and a toast).
    await addDocumentMutation.mutateAsync(newDoc)
    return newDoc
  }

  const updateDocument = async (id: string, updates: { assetId?: string | null; inventoryItemId?: string | null }) => {
    const changes: Partial<DocumentEntity> = {
      linkedAssetIds: [updates.assetId, updates.inventoryItemId].filter(Boolean) as string[],
    }
    if (updates.assetId !== undefined) changes.assetId = updates.assetId
    if (updates.inventoryItemId !== undefined) changes.inventoryItemId = updates.inventoryItemId
    // Rolled back and toasted by the mutation; not rethrown (see updateInventoryItem).
    await updateDocumentMutation.mutateAsync({ id, changes }).catch(() => {})
  }

  // Checklist Templates CRUD
  const addChecklistTemplate = (tmpl: Omit<ChecklistTemplate, 'id' | 'updatedAt'>) => {
    // Built synchronously: callers use the new template right away.
    const newTmpl = newChecklistTemplate(tmpl)
    addChecklistTemplateMutation.mutate(newTmpl)
    return newTmpl
  }
  const updateChecklistTemplate = (id: string, tmplData: Partial<ChecklistTemplate>) => {
    updateChecklistTemplateMutation.mutate({ id, changes: { ...tmplData, updatedAt: getLocalDateStr() } })
  }
  const deleteChecklistTemplate = (id: string) => {
    deleteChecklistTemplateMutation.mutate(id)
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
    // Shown at once; removed again with a toast if the database refuses it.
    addWorkOrdersMutation.mutate([newWo])

    // The PM/Inspection work orders auto-created inside addAsset bypass
    // this function entirely — "Asset Created" already covers that moment,
    // so this only logs manually-raised work orders. Gated on assetId so
    // room-only Housekeeping orders don't spam unrelated asset timelines.
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
  }

  const updateWorkOrderStatus = (
    id: string,
    status: WorkOrder['status'],
    remarks?: string,
    extraUpdates?: Partial<WorkOrder>
  ) => {
    // The latest list, including changes still being saved, so a quick second
    // "Complete" can't slip through and complete (and reschedule) it twice.
    const latest = queryClient.getQueryData<WorkOrder[]>(workOrderKeys.list(currentUser.id)) ?? workOrders
    const targetWo = latest.find(w => w.id === id || w.woNumber === id)

    // Attempt window policy check for Preventive Maintenance Work Orders
    if (status === 'In Progress' || status === 'Completed') {
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
    const isFirstAssignment = Boolean(
      targetWo &&
      (targetWo.type === 'Preventive' || targetWo.type === 'Corrective') &&
      isPendingWorkOrder(targetWo.woNumber) &&
      extraUpdates?.assignedTechnicianId
    )
    // The database re-mints the number on that transition (see
    // supabase/migrations/0014_server_side_ticket_numbering.sql); this is only
    // the on-screen guess until the save returns the real one.
    const numberPrefix = targetWo?.type === 'Preventive' ? 'WO-PM' : 'WO-CR'
    const mintedWoNumber = isFirstAssignment
      ? formatYearlyId(numberPrefix, getNextSequence(latest.map(w => w.woNumber), numberPrefix))
      : undefined

    // Only stamp completed_at on the actual transition into Completed, not on a
    // redundant re-submission of an already-completed order (see the matching
    // guard on the completion effects below for why).
    const stampCompletedAt = status === 'Completed' && targetWo?.status !== 'Completed'
    const completedDateIso = getLocalDateStr()

    const changes: Partial<WorkOrder> = { status }
    if (mintedWoNumber) changes.woNumber = mintedWoNumber
    if (remarks !== undefined) changes.technicianRemarks = remarks
    if (stampCompletedAt) changes.completedAt = completedDateIso
    // Execution details (checklist, photos, parts, vendor fields, assignment...)
    // win over the defaults above, as they did when this built the update by hand.
    for (const [key, value] of Object.entries(extraUpdates ?? {})) {
      if (value !== undefined) (changes as Record<string, unknown>)[key] = value
    }

    // Save first: the change shows at once and is undone with a toast if the
    // database refuses it. The follow-on effects (asset status and log, the
    // linked service request, the next recurring preventive order) only run once
    // it has saved -- before, they ran regardless, from inside a state updater
    // that React may run twice in development.
    void (async () => {
      let saved: { id: string; woNumber: string } | null
      try {
        saved = await updateWorkOrderMutation.mutateAsync({ id: targetWo?.id ?? id, changes })
      } catch {
        return
      }
      if (!targetWo) return
      const woNumber = saved?.woNumber ?? mintedWoNumber ?? targetWo.woNumber

      if (isFirstAssignment) {
        // A Corrective WO getting its first assignment puts the asset
        // 'Under Maintenance' immediately -- it doesn't wait for a separate
        // "start work" step. Preventive only flips when explicitly started.
        if (targetWo.type === 'Corrective' && targetWo.assetId) {
          updateAssetStatus(targetWo.assetId, 'Under Maintenance')
        }
        // A Corrective WO raised from a Service Request left the ticket stamped
        // with the PENDING placeholder -- carry the real number over onto it.
        if (targetWo.source === 'Service Request' && targetWo.sourceRefId) {
          updateServiceRequestStatus(targetWo.sourceRefId, 'In Progress', { workOrderNumber: woNumber })
        }
      }

      // Gating on the PRE-update status makes completion idempotent. Without it,
      // a second "Completed" call (e.g. a technician re-opening an
      // already-completed task and hitting Complete again) would re-run every
      // side effect and, for a Preventive WO, mint a duplicate recurring order.
      if (stampCompletedAt) {
        if (targetWo.assetId) {
          updateAssetStatus(targetWo.assetId, 'Operational')
          const completionLabel =
            targetWo.type === 'Preventive' ? 'Preventive Maintenance Completed' :
            targetWo.type === 'Corrective' ? 'Corrective Maintenance Completed' :
            'Housekeeping Completed'
          addAssetLog({
            assetId: targetWo.assetId,
            action: completionLabel,
            byUser: currentUser.fullName,
            source: 'Manual',
            referenceId: woNumber,
            remarks: remarks || 'Work Order completed successfully.',
          })
        }

        // If this Work Order was triggered by a Service Request, auto-resolve the
        // ticket (persisted through the same query layer).
        if (targetWo.source === 'Service Request' && targetWo.sourceRefId) {
          updateServiceRequestStatus(targetWo.sourceRefId, 'Resolved')
        }

        // A completed Preventive Maintenance order schedules the next interval,
        // anchored on the date it was ACTUALLY completed, never the original due
        // date (a PM finished late shouldn't push every future cycle later forever).
        if (targetWo.type === 'Preventive') {
          const interval = targetWo.frequency || 'Quarterly'
          const nextWoUuid = generateUUID()
          addWorkOrdersMutation.mutate([{
            id: nextWoUuid,
            woNumber: makePendingWoNumber(nextWoUuid),
            title: targetWo.title || `Preventive Maintenance (${interval})`,
            type: 'Preventive',
            assetId: targetWo.assetId,
            roomId: targetWo.roomId,
            priority: 'Medium',
            source: 'Scheduled',
            frequency: interval,
            dueDate: addIntervalToDate(completedDateIso, interval),
            status: 'Scheduled',
            checklistTemplateId: targetWo.checklistTemplateId,
            checklistSnapshot: targetWo.checklistSnapshot,
            createdAt: completedDateIso,
          }])
        }
      } else if (status === 'In Progress') {
        if (targetWo.assetId) {
          updateAssetStatus(targetWo.assetId, 'Under Maintenance')
          addAssetLog({
            assetId: targetWo.assetId,
            action: 'Under Maintenance',
            byUser: currentUser.fullName,
            source: 'System',
            referenceId: woNumber,
          })
        }
      }
    })()
  }

  const addInspection = (insp: Omit<Inspection, 'id' | 'createdAt'>) => {
    addInspectionsMutation.mutate([{ ...insp, id: generateUUID(), createdAt: getLocalDateStr() }])
  }

  // Callers pass either the row id or the INSP-YYYY-#### number.
  const resolveInspectionId = (idOrNumber: string) =>
    inspections.find(i => i.id === idOrNumber || i.inspectionNumber === idOrNumber)?.id ?? idOrNumber

  const updateInspection = (id: string, updates: Partial<Inspection>) => {
    updateInspectionMutation.mutate({ id: resolveInspectionId(id), changes: updates })
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
    const realId = targetInsp?.id ?? id

    // Mark it complete first: the screen shows it at once, and it is undone with
    // a toast if the database refuses. The follow-on records (next cycle,
    // corrective work order) are only created once that has saved -- before,
    // they were created even when the completion failed, and from inside a state
    // updater, which React may run twice in development.
    void (async () => {
      try {
        await updateInspectionMutation.mutateAsync({
          id: realId,
          changes: {
            status: 'Completed',
            result,
            inspectorRemarks: remarks,
            checklistResponses: responses,
            photoUrl: photoUrl || undefined,
            itemPhotos: itemPhotos || undefined,
            completedAt: completedDateIso,
          },
        })
      } catch {
        return
      }
      const ins = targetInsp
      if (!ins) return

      const tmpl = checklistTemplates.find(t => t.id === ins.templateId)
      const interval = tmpl?.interval || 'Quarterly'
      const baseDate = ins.dueDate || completedDateIso
      const nextDueDate = addIntervalToDate(baseDate, interval)
      const nextSeq = getNextSequence(inspections.map(x => x.inspectionNumber), 'INSP')
      const nextInspNumber = formatYearlyId('INSP', nextSeq)

      // Auto-schedule next inspection cycle. inspection_number is re-minted
      // server-side by a DB trigger (see
      // supabase/migrations/0014_server_side_ticket_numbering.sql); the number
      // here is only an on-screen guess, corrected when the list is re-read.
      addInspectionsMutation.mutate([{
        id: generateUUID(),
        inspectionNumber: nextInspNumber,
        assetId: ins.assetId,
        templateId: ins.templateId,
        templateVersion: ins.templateVersion || 1,
        dueDate: nextDueDate,
        status: 'Scheduled',
        checklistSnapshot: ins.checklistSnapshot || tmpl?.items,
        createdAt: completedDateIso,
      }])

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
          title: `Corrective: Defect from ${ins.inspectionNumber}`,
          type: 'Corrective',
          assetId: ins.assetId,
          source: 'Failed Inspection',
          sourceRefId: ins.inspectionNumber,
          dueDate: getLocalDateStr(new Date(Date.now() + 86400000 * 2)),
          status: 'Scheduled',
          issueLogged: `Failed inspection item during inspection: ${remarks}`,
          createdAt: completedDateIso,
        }
        addWorkOrdersMutation.mutate([newCorrectiveWo])

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
    })()
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
    queryClient.setQueryData<RoomAccessLog[]>(roomAccessLogKeys.list(currentUser.id), prev => [log, ...(prev ?? [])])
    queryClient.setQueryData<Room[]>(roomKeys.list(currentUser.id), prev =>
      (prev ?? []).map(r => (r.id === resolvedRoomId || r.roomNumber === resolvedRoomId ? { ...r, status: 'Occupied', currentOccupant: currentUser.fullName } : r))
    )

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
    // Re-read both, so a failed check-in doesn't leave the room shown as occupied.
    queryClient.invalidateQueries({ queryKey: roomKeys.list(currentUser.id) })
    queryClient.invalidateQueries({ queryKey: roomAccessLogKeys.list(currentUser.id) })
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
    queryClient.setQueryData<RoomAccessLog[]>(roomAccessLogKeys.list(currentUser.id), prev =>
      (prev ?? []).map(l => ((l.roomId === resolvedRoomId || l.roomId === roomId) && l.userId === currentUser.id && !l.checkOutTime ? { ...l, checkOutTime: now, checkOutTimestamp: nowTimestamp } : l))
    )
    queryClient.setQueryData<Room[]>(roomKeys.list(currentUser.id), prev =>
      (prev ?? []).map(r => (r.id === resolvedRoomId || r.roomNumber === resolvedRoomId ? { ...r, status: 'Available', currentOccupant: undefined } : r))
    )

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
    queryClient.invalidateQueries({ queryKey: roomKeys.list(currentUser.id) })
    queryClient.invalidateQueries({ queryKey: roomAccessLogKeys.list(currentUser.id) })
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

    const logsKey = roomAccessLogKeys.list(currentUser.id)
    const prevLogs = queryClient.getQueryData<RoomAccessLog[]>(logsKey) ?? []
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

    if (!hasChanges) return

    // One RPC per stale room — atomic log + room status update
    // together (see room_check_out,
    // supabase/migrations/0020_room_check_out_force_params.sql).
    // These used to fire from inside a state updater, which React may run
    // twice in development; they now run exactly once per sweep.
    staleRoomIds.forEach(roomId => {
      supabase.rpc('room_check_out', {
        p_room_id: roomId,
        p_check_out_time: '11:59 PM',
        p_check_out_timestamp: nowTimestamp,
        p_is_force_checkout: true,
        p_auto_checkout_note: 'System Auto Check-Out at 11:59 PM (End of Day Cutoff)',
      }).then(({ error }) => {
        if (error) console.error('Supabase auto-checkout error:', error.message)
        queryClient.invalidateQueries({ queryKey: roomKeys.list(currentUser.id) })
        queryClient.invalidateQueries({ queryKey: logsKey })
      })
    })
    queryClient.setQueryData<Room[]>(roomKeys.list(currentUser.id), prevRooms =>
      (prevRooms ?? []).map(r =>
        updatedRoomsToFree.has(r.id)
          ? { ...r, status: 'Available', currentOccupant: undefined }
          : r
      )
    )
    // activeCheckIn is derived elsewhere (see the useEffect keyed on
    // roomAccessLogs/currentUser.id) — it will automatically clear
    // once the corresponding log above gets its checkOutTime set.
    queryClient.setQueryData<RoomAccessLog[]>(logsKey, newLogs)
  }, [currentUser.id, queryClient])

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
  const addAssetLogs = (logs: Array<Omit<AssetActivityLog, 'id' | 'timestamp'>>) => {
    if (logs.length === 0) return
    const timestamp = new Date().toLocaleString()
    const timestampEpoch = Date.now()
    const created: AssetActivityLog[] = logs.map(log => {
      const targetAsset = assets.find(a => a.id === log.assetId || a.assetId === log.assetId)
      return {
        ...log,
        id: generateUUID(),
        assetId: targetAsset ? targetAsset.id : log.assetId,
        timestamp,
        timestampEpoch,
      }
    })
    // One insert for however many logs (a bulk import writes one per asset).
    addAssetActivityLogsMutation.mutate(created)
  }

  const addAssetLog = (log: Omit<AssetActivityLog, 'id' | 'timestamp'>) => addAssetLogs([log])

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
        isDataLoading: isDataLoading || migratedQueries.some(q => q.isLoading),
        dataLoadError:
          dataLoadError ??
          (queryLoadFailures.length > 0 ? `Some data could not be loaded: ${queryLoadFailures.join('; ')}.` : null),
        reloadData: async () => {
          await Promise.all([syncSupabase(), ...migratedQueries.map(q => q.refetch())])
        },
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
