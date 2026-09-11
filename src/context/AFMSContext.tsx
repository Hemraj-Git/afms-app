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
} from '@/types/afms'
import { formatId, formatYearlyId, formatCategoryId, formatSubCategoryId, formatTaxonomyIdFromName, getNextSequence, addIntervalToDate } from '@/lib/idGenerator'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { supabase } from '@/lib/supabase'
import { mockUsers } from '@/data/mockData'

interface AFMSContextType {
  currentUser: UserProfile
  setCurrentUser: (user: UserProfile) => void
  isLoggedIn: boolean
  setIsLoggedIn: (val: boolean) => void
  login: (user: UserProfile) => void
  guestLogin: (guestData: { fullName?: string; email: string; phone: string }) => UserProfile
  logout: () => void
  users: UserProfile[]
  addUser: (user: Omit<UserProfile, 'id'>) => UserProfile
  updateUser: (id: string, user: Partial<UserProfile>) => void
  deleteUser: (id: string) => { success: boolean; message?: string }
  
  // Department Management (DEP-####)
  departments: Department[]
  addDepartment: (dept: Omit<Department, 'id'>) => Department
  updateDepartment: (id: string, dept: Partial<Department>) => void
  deleteDepartment: (id: string) => { success: boolean; message?: string }

  // Organization CRUD (IDs generated automatically, unchangeable)
  campuses: Campus[]
  addCampus: (campus: Omit<Campus, 'id' | 'code'>) => Campus
  updateCampus: (id: string, campus: Partial<Campus>) => void
  deleteCampus: (id: string) => void

  buildings: Building[]
  addBuilding: (building: Omit<Building, 'id' | 'code'>) => Building
  updateBuilding: (id: string, building: Partial<Building>) => void
  deleteBuilding: (id: string) => void

  rooms: Room[]
  addRoom: (room: Omit<Room, 'id' | 'roomNumber' | 'qrCodeKey'>) => Room
  updateRoom: (id: string, room: Partial<Room>) => void
  deleteRoom: (id: string) => void
  
  // Dynamic Room Types
  roomTypes: string[]
  addRoomType: (type: string) => void
  
  // Taxonomy CRUD (IDs generated automatically, unchangeable)
  categories: Category[]
  addCategory: (cat: Omit<Category, 'id' | 'code'>) => Category
  updateCategory: (id: string, cat: Partial<Category>) => void
  deleteCategory: (id: string) => void

  subCategories: SubCategory[]
  addSubCategory: (sub: Omit<SubCategory, 'id' | 'code'>) => SubCategory
  updateSubCategory: (id: string, sub: Partial<SubCategory>) => void
  deleteSubCategory: (id: string) => void
  
  // Assets (AST-#### automatically generated, unchangeable)
  assets: Asset[]
  addAsset: (asset: Omit<Asset, 'id' | 'assetId' | 'createdAt'>) => Asset
  addBulkAssets: (
    assetsData: Array<Omit<Asset, 'id' | 'assetId' | 'createdAt'>>
  ) => { success: boolean; createdCount: number; createdAssets: Asset[] }
  updateAsset: (id: string, assetData: Partial<Asset>) => void
  updateAssetStatus: (assetId: string, status: Asset['status']) => void
  
  // Inventory Hub / Spares (INV-#### automatically generated, unchangeable)
  inventoryItems: InventoryItem[]
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'inventoryNumber' | 'createdAt'>) => InventoryItem
  updateInventoryItem: (id: string, itemData: Partial<InventoryItem>) => void
  deleteInventoryItem: (id: string) => void
  convertInventoryToAsset: (
    inventoryId: string,
    roomId: string,
    installationDate?: string,
    assignedToUserId?: string
  ) => Asset | null

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
  completeInspection: (id: string, result: 'Pass' | 'Fail', remarks: string, responses: any) => void
  
  // Service Requests (SR-YYYY-#### automatically generated, unchangeable)
  serviceRequests: ServiceRequest[]
  addServiceRequest: (sr: Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>) => ServiceRequest
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
  addVendor: (vendor: Omit<Vendor, 'id'>) => Vendor
  updateVendor: (id: string, vendor: Partial<Vendor>) => void
  deleteVendor: (id: string) => { success: boolean; message?: string }
  documents: DocumentItem[]
  addDocument: (doc: Omit<DocumentItem, 'id' | 'uploadedAt'>) => DocumentItem
  
  // Logs
  roomAccessLogs: RoomAccessLog[]
  checkInRoom: (roomId: string, purpose: string) => void
  checkOutRoom: (roomId: string) => void
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
}

const AFMSContext = createContext<AFMSContextType | undefined>(undefined)

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
    role: 'Admin',
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
  }

  const guestLogin = (guestData: { fullName?: string; email: string; phone: string }): UserProfile => {
    const guestUser: UserProfile = {
      id: `USR-GUEST-${Date.now().toString().slice(-4)}`,
      fullName: guestData.fullName?.trim() || 'Guest Visitor',
      email: guestData.email.trim(),
      phone: guestData.phone.trim(),
      role: 'Guest',
      department: 'Visitor Services',
    }
    setCurrentUser(guestUser)
    setIsLoggedIn(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('afms_logged_in', 'true')
      localStorage.setItem('afms_current_user_id', guestUser.id)
    }
    return guestUser
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
  const [isInitialized, setIsInitialized] = useState(false)

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
  React.useEffect(() => {
    let isMounted = true
    async function syncSupabase() {
      try {
        // Authenticated Session & Profile
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && isMounted) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (profile && isMounted) {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email || '',
              fullName: profile.full_name || 'Maritime Staff',
              role: (profile.role as UserRole) || 'Admin',
              department: profile.department || 'Operations',
              phone: profile.phone || '',
            })
            setIsLoggedIn(true)
          }
        }

        // 1. Users from profiles
        const { data: profRows } = await supabase.from('profiles').select('*')
        if (isMounted && profRows && profRows.length > 0) {
          setUsers(prev => {
            const dbUsers: UserProfile[] = profRows.map(p => ({
              id: p.id,
              email: p.email,
              fullName: p.full_name,
              role: (p.role as UserRole) || 'Faculty',
              department: p.department || '',
              phone: p.phone || '',
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
        const { data: deptRows } = await supabase.from('departments').select('*').order('name')
        if (isMounted && deptRows) {
          setDepartments(deptRows.map(d => ({
            id: d.id,
            name: d.name,
            code: d.code,
            description: d.description || '',
            createdAt: d.created_at,
          })))
        }

        // 3. Campuses & Buildings
        const { data: cRows } = await supabase.from('campuses').select('*').order('name')
        if (isMounted && cRows) {
          setCampuses(cRows.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code,
            address: c.address || '',
          })))
        }
        const { data: bRows } = await supabase.from('buildings').select('*').order('name')
        if (isMounted && bRows) {
          setBuildings(bRows.map(b => ({
            id: b.id,
            campusId: b.campus_id,
            name: b.name,
            code: b.code,
            totalFloors: b.total_floors || 1,
          })))
        }

        // 4. Rooms
        const { data: rRows } = await supabase.from('rooms').select('*').order('room_number')
        if (isMounted && rRows) {
          setRooms(rRows.map(r => ({
            id: r.id,
            buildingId: r.building_id,
            name: r.name,
            roomNumber: r.room_number,
            type: r.type || 'General',
            isReservable: Boolean(r.is_reservable),
            qrCodeKey: r.qr_code_key || `ROOM-${r.room_number}`,
            status: (r.status as Room['status']) || 'Available',
            currentOccupant: r.current_occupant_id,
          })))
        }

        // 5. Categories & Subcategories
        const { data: catRows } = await supabase.from('categories').select('*').order('name')
        if (isMounted && catRows) {
          setCategories(catRows.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code,
            description: c.description || '',
          })))
        }
        const { data: subRows } = await supabase.from('sub_categories').select('*').order('name')
        if (isMounted && subRows) {
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
        const { data: astRows } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
        if (isMounted && astRows) {
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
            warrantyTill: a.warranty_till,
            maintenanceBy: a.maintenance_by || 'In House',
            status: (a.status as Asset['status']) || 'Operational',
            imageUrl: a.image_url || undefined,
            notes: a.notes || undefined,
            qrCodeUrl: a.qr_code_url || a.asset_id,
            dynamicSpecifications: a.dynamic_specifications || {},
            createdAt: a.created_at,
          })))
        }

        // 7. Work Orders
        const { data: woRows } = await supabase.from('work_orders').select('*').order('created_at', { ascending: false })
        if (isMounted && woRows) {
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
            createdAt: w.created_at,
            completedAt: w.completed_at,
          })))
        }

        // 8. Service Requests
        const { data: srRows } = await supabase.from('service_requests').select('*').order('created_at', { ascending: false })
        if (isMounted && srRows) {
          setServiceRequests(srRows.map(sr => ({
            id: sr.id,
            ticketId: sr.ticket_id,
            title: sr.title,
            description: sr.description || '',
            requestType: sr.request_type || 'Maintenance',
            roomId: sr.room_id,
            assetId: sr.asset_id,
            requestedBy: sr.requested_by,
            requestedByRole: 'Staff',
            assignedTo: sr.assigned_to,
            status: sr.status || 'Open',
            priority: sr.priority || 'Medium',
            createdAt: sr.created_at,
            slaDueDate: sr.sla_due_date,
            photoUrls: sr.photo_urls || [],
          })))
        }

        // 9. Vendors
        const { data: vRows } = await supabase.from('vendors').select('*').order('name')
        if (isMounted && vRows) {
          setVendors(vRows.map(v => ({
            id: v.id,
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
        const { data: tmplRows } = await supabase.from('checklist_templates').select('*').order('title')
        if (isMounted && tmplRows) {
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
        const { data: inspRows } = await supabase.from('inspections').select('*').order('created_at', { ascending: false })
        if (isMounted && inspRows) {
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
            completedAt: i.conducted_at,
            createdAt: i.created_at,
          })))
        }

        // 12. Documents
        const { data: docRows } = await supabase.from('documents').select('*').order('uploaded_at', { ascending: false })
        if (isMounted && docRows) {
          setDocuments(docRows.map(d => ({
            id: d.id,
            title: d.title,
            fileType: (d.file_type as any) || 'Invoice',
            fileUrl: d.file_url || '',
            fileSizeKb: Math.round(((d as any).file_size_bytes || 102400) / 1024),
            uploadedBy: (d as any).uploaded_by_user_name || 'Staff',
            uploadedAt: d.uploaded_at,
            linkedAssetIds: (d as any).asset_id ? [(d as any).asset_id] : [],
          })))
        }

        // 13. Inventory Items
        const { data: invRows } = await supabase.from('inventory_items').select('*').order('created_at', { ascending: false })
        if (isMounted && invRows && invRows.length > 0) {
          setInventoryItems(invRows.map(inv => ({
            id: inv.id,
            inventoryNumber: inv.inventory_number || inv.id,
            name: inv.name,
            subCategoryId: inv.sub_category_id || '',
            manufacturer: inv.manufacturer || '',
            modelNumber: inv.model_number || '',
            quantity: inv.quantity || 1,
            unit: 'Units',
            storageLocation: inv.storage_location || '',
            purchaseVendorId: inv.vendor_id || undefined,
            dynamicSpecifications: {},
            createdAt: inv.created_at ? inv.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          })))
        }

        // 14. Reservations
        const { data: resRows } = await supabase.from('reservations').select('*').order('created_at', { ascending: false })
        if (isMounted && resRows && resRows.length > 0) {
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
            createdAt: r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          })))
        }

        // 15. Room Access Logs
        const { data: ralRows } = await supabase.from('room_access_logs').select('*').order('check_in_time', { ascending: false })
        if (isMounted && ralRows && ralRows.length > 0) {
          setRoomAccessLogs(ralRows.map(l => ({
            id: l.id,
            roomId: l.room_id,
            roomName: l.room_id,
            userId: l.user_id,
            userName: l.user_name,
            userRole: l.user_role || 'Staff',
            checkInTime: l.check_in_time,
            checkInDate: l.check_in_date,
            checkInTimestamp: l.check_in_timestamp,
            checkOutTime: l.check_out_time,
            purpose: l.purpose || '',
            isForceCheckout: Boolean(l.is_force_checkout),
            autoCheckOutNote: l.auto_checkout_note,
          })))
        }

        // 16. Asset Activity Logs
        const { data: aalRows } = await supabase.from('asset_activity_logs').select('*').order('timestamp', { ascending: false })
        if (isMounted && aalRows && aalRows.length > 0) {
          setAssetActivityLogs(aalRows.map(l => ({
            id: l.id,
            assetId: l.asset_id,
            byUser: l.by_user,
            action: l.action,
            remarks: l.remarks,
            source: (l.source as any) || 'Manual',
            timestamp: l.timestamp,
          })))
        }
      } catch (e) {
        console.warn('Supabase sync notice:', e)
      }
    }
    syncSupabase()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Persist state changes to localStorage whenever state updates
  React.useEffect(() => {
    if (!isInitialized) return
    try {
      localStorage.setItem('afms_sla_config', JSON.stringify(slaConfig))
      localStorage.setItem('afms_users', JSON.stringify(users))
      localStorage.setItem('afms_departments', JSON.stringify(departments))
      localStorage.setItem('afms_campuses', JSON.stringify(campuses))
      localStorage.setItem('afms_buildings', JSON.stringify(buildings))
      localStorage.setItem('afms_rooms', JSON.stringify(rooms))
      localStorage.setItem('afms_room_types', JSON.stringify(roomTypes))
      localStorage.setItem('afms_categories', JSON.stringify(categories))
      localStorage.setItem('afms_subcategories', JSON.stringify(subCategories))
      localStorage.setItem('afms_vendors', JSON.stringify(vendors))
      localStorage.setItem('afms_templates', JSON.stringify(checklistTemplates))
      localStorage.setItem('afms_assets', JSON.stringify(assets))
      localStorage.setItem('afms_inventory', JSON.stringify(inventoryItems))
      localStorage.setItem('afms_reservations', JSON.stringify(reservations))
      localStorage.setItem('afms_service_requests', JSON.stringify(serviceRequests))
      localStorage.setItem('afms_work_orders', JSON.stringify(workOrders))
      localStorage.setItem('afms_inspections', JSON.stringify(inspections))
      localStorage.setItem('afms_documents', JSON.stringify(documents))
      localStorage.setItem('afms_room_logs', JSON.stringify(roomAccessLogs))
      if (activeCheckIn) {
        localStorage.setItem('afms_active_check_in', JSON.stringify(activeCheckIn))
      } else {
        localStorage.removeItem('afms_active_check_in')
      }
      localStorage.setItem('afms_asset_logs', JSON.stringify(assetActivityLogs))
    } catch (err) {
      console.warn('Could not persist AFMS state to local storage:', err)
    }
  }, [
    isInitialized,
    slaConfig,
    users,
    departments,
    campuses,
    buildings,
    rooms,
    roomTypes,
    categories,
    subCategories,
    vendors,
    checklistTemplates,
    assets,
    inventoryItems,
    reservations,
    serviceRequests,
    workOrders,
    inspections,
    documents,
    roomAccessLogs,
    activeCheckIn,
    assetActivityLogs,
  ])

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
  const addUser = (userData: Omit<UserProfile, 'id'>): UserProfile => {
    const nextSeq = getNextSequence(users.map(u => u.id), 'USR')
    const newId = formatId('USR', nextSeq)
    const newUser: UserProfile = {
      ...userData,
      id: newId,
      password: userData.password || 'password123',
      passwordLastChanged: userData.passwordLastChanged || new Date().toISOString().split('T')[0],
    }
    setUsers(prev => [...prev, newUser])
    return newUser
  }
  const updateUser = (id: string, userData: Partial<UserProfile>) => {
    const { id: _, ...safeData } = userData as any // Enforce immutable ID
    if (safeData.password && !safeData.passwordLastChanged) {
      safeData.passwordLastChanged = new Date().toISOString().split('T')[0]
    }
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...safeData } : u)))
    if (currentUser.id === id) {
      setCurrentUser(prev => ({ ...prev, ...safeData }))
    }
    
    // Sync to Supabase profiles if record exists
    supabase.from('profiles').update({
      full_name: safeData.fullName,
      role: safeData.role,
      department: safeData.department,
      phone: safeData.phone,
    }).eq('id', id).then(() => {})
  }
  const deleteUser = (id: string): { success: boolean; message?: string } => {
    if (id === currentUser.id) {
      return { success: false, message: 'Cannot delete the active logged-in user profile.' }
    }
    setUsers(prev => prev.filter(u => u.id !== id))
    supabase.from('profiles').delete().eq('id', id).then(() => {})
    return { success: true }
  }

  // 1b. Department: DEP-#### (Immutable ID, Deletion Protected by User Linkage)
  const addDepartment = (deptData: Omit<Department, 'id'>): Department => {
    const nextSeq = getNextSequence(departments.map(d => d.code || d.id), 'DEP')
    const displayCode = formatId('DEP', nextSeq)
    const newUuid = generateUUID()
    const today = new Date().toISOString().split('T')[0]
    const newDept: Department = {
      ...deptData,
      id: newUuid,
      code: deptData.code || displayCode,
      createdAt: today,
    }
    setDepartments(prev => [...prev, newDept])
    supabase.from('departments').insert([{
      id: newUuid,
      name: newDept.name,
      code: newDept.code,
      description: newDept.description || '',
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase department insert error:', error.message)
    })
    return newDept
  }

  const updateDepartment = (id: string, deptData: Partial<Department>) => {
    const { id: _, ...safeData } = deptData as any
    setDepartments(prev => prev.map(d => (d.id === id ? { ...d, ...safeData } : d)))
    supabase.from('departments').update({
      name: safeData.name,
      code: safeData.code,
      description: safeData.description,
    }).eq('id', id).then(() => {})
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

    setDepartments(prev => prev.filter(d => d.id !== id))
    supabase.from('departments').delete().eq('id', id).then(() => {})
    return { success: true }
  }

  // 2. Campus: CAM-#### (Immutable ID)
  // 2. Campus: CAM-#### (Immutable ID)
  const addCampus = (campus: Omit<Campus, 'id' | 'code'>): Campus => {
    const nextSeq = getNextSequence(campuses.map(c => c.code || c.id), 'CAM')
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
    setCampuses(prev => prev.map(c => (c.id === id ? { ...c, ...safeData } : c)))
    supabase.from('campuses').update(safeData).eq('id', id).then(() => {})
  }
  const deleteCampus = (id: string) => {
    setCampuses(prev => prev.filter(c => c.id !== id))
    supabase.from('campuses').delete().eq('id', id).then(() => {})
  }

  // 3. Building: BLD-#### (Immutable ID)
  const addBuilding = (bld: Omit<Building, 'id' | 'code'>): Building => {
    const nextSeq = getNextSequence(buildings.map(b => b.code || b.id), 'BLD')
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
    setBuildings(prev => prev.map(b => (b.id === id ? { ...b, ...safeData } : b)))
    supabase.from('buildings').update({
      name: safeData.name,
      total_floors: safeData.totalFloors,
    }).eq('id', id).then(() => {})
  }
  const deleteBuilding = (id: string) => {
    setBuildings(prev => prev.filter(b => b.id !== id))
    supabase.from('buildings').delete().eq('id', id).then(() => {})
  }

  // 4. Room: ROM-#### (Immutable ID & QR Key)
  const addRoom = (room: Omit<Room, 'id' | 'roomNumber' | 'qrCodeKey'>): Room => {
    const nextSeq = getNextSequence(rooms.map(r => r.roomNumber || r.id), 'ROM')
    const displayId = formatId('ROM', nextSeq)
    const newUuid = generateUUID()
    const newRoom: Room = {
      ...room,
      id: newUuid,
      roomNumber: displayId,
      qrCodeKey: displayId,
    }
    setRooms(prev => [...prev, newRoom])
    supabase.from('rooms').insert([{
      id: newUuid,
      building_id: newRoom.buildingId || null,
      name: newRoom.name,
      room_number: newRoom.roomNumber,
      type: newRoom.type || 'General',
      is_reservable: Boolean(newRoom.isReservable),
      qr_code_key: newRoom.qrCodeKey,
      status: newRoom.status || 'Available',
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase room insert error:', error.message)
    })
    return newRoom
  }
  const updateRoom = (id: string, roomData: Partial<Room>) => {
    const { id: _, roomNumber: __, qrCodeKey: ___, ...safeData } = roomData as any
    setRooms(prev => prev.map(r => (r.id === id ? { ...r, ...safeData } : r)))
    supabase.from('rooms').update({
      name: safeData.name,
      type: safeData.type,
      is_reservable: safeData.isReservable,
      status: safeData.status,
    }).eq('id', id).then(() => {})
  }
  const deleteRoom = (id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id))
    supabase.from('rooms').delete().eq('id', id).then(() => {})
  }

  // Room Types
  const addRoomType = (newType: string) => {
    const trimmed = newType.trim()
    if (!trimmed) return
    setRoomTypes(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }

  // 5. Category: 4-letter uppercase ID derived automatically from Name e.g. "Electrical" -> "ELEC"
  const addCategory = (cat: Omit<Category, 'id' | 'code'>): Category => {
    const formattedCode = formatCategoryId(cat.name)
    const newUuid = generateUUID()
    const newCat: Category = {
      ...cat,
      id: newUuid,
      code: formattedCode,
    }
    setCategories(prev => [...prev, newCat])
    supabase.from('categories').insert([{
      id: newUuid,
      name: newCat.name,
      code: newCat.code,
      description: newCat.description || '',
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase category insert error:', error.message)
    })
    return newCat
  }
  const updateCategory = (id: string, catData: Partial<Category>) => {
    const { id: _, code: __, ...safeData } = catData as any
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...safeData } : c)))
    supabase.from('categories').update({
      name: safeData.name,
      description: safeData.description,
    }).eq('id', id).then(() => {})
  }
  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
    supabase.from('categories').delete().eq('id', id).then(() => {})
  }

  // 6. SubCategory: CategoryId-SubCategoryId derived automatically e.g. "ELEC-LIGH"
  const addSubCategory = (sub: Omit<SubCategory, 'id' | 'code'>): SubCategory => {
    const parentCat = categories.find(c => c.id === sub.categoryId)
    const parentCode = parentCat?.code || parentCat?.id || sub.categoryId || 'GENR'
    const formattedCode = formatSubCategoryId(parentCode, sub.name)
    const newUuid = generateUUID()
    const newSub: SubCategory = {
      ...sub,
      id: newUuid,
      code: formattedCode,
    }
    setSubCategories(prev => [...prev, newSub])
    supabase.from('sub_categories').insert([{
      id: newUuid,
      category_id: newSub.categoryId || null,
      name: newSub.name,
      code: newSub.code,
      description: newSub.description || '',
      metadata_fields: newSub.metadataFields || [],
      pm_template_ids: Array.from(new Set(newSub.pmTemplateIds || (newSub.pmTemplateId ? [newSub.pmTemplateId] : []))),
      inspection_template_ids: Array.from(new Set(newSub.inspectionTemplateIds || (newSub.inspectionTemplateId ? [newSub.inspectionTemplateId] : []))),
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase subcategory insert error:', error.message)
    })
    return newSub
  }
  const updateSubCategory = (id: string, subData: Partial<SubCategory>) => {
    const { id: _, code: __, ...safeData } = subData as any
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

    supabase.from('sub_categories').update(updatePayload).eq('id', id).then(({ error }) => {
      if (error) console.error('Supabase subcategory update error:', error.message)
    })
  }
  const deleteSubCategory = (id: string) => {
    setSubCategories(prev => prev.filter(s => s.id !== id))
    supabase.from('sub_categories').delete().eq('id', id).then(() => {})
  }

  // 7. Asset: AST-#### (Immutable ID)
  const addAsset = (assetData: Omit<Asset, 'id' | 'assetId' | 'createdAt'>): Asset => {
    const nextSeq = getNextSequence(assets.map(a => a.assetId || a.id), 'AST')
    const newId = formatId('AST', nextSeq)
    const newUuid = generateUUID()
    const today = new Date().toISOString().split('T')[0]
    
    const createdAsset: Asset = {
      ...assetData,
      id: newUuid,
      assetId: newId,
      imageUrl: assetData.imageUrl || '/images/asset-placeholder.png',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-${newId}`,
      createdAt: today,
    }
    
    setAssets(prev => [createdAsset, ...prev])
    supabase.from('assets').insert([{
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
    }]).then(({ error }) => {
      if (error) console.error('Supabase asset insert error:', error.message)
    })

    const sub = subCategories.find(s => s.id === assetData.subCategoryId)
    if (sub) {
      const installDate = assetData.installationDate || today

      const pmIds = Array.from(new Set(sub.pmTemplateIds && sub.pmTemplateIds.length > 0 ? sub.pmTemplateIds : (sub.pmTemplateId ? [sub.pmTemplateId] : []))).filter(Boolean)
      pmIds.forEach((pmTmplId, idx) => {
        const tmpl = checklistTemplates.find(t => t.id === pmTmplId)
        const interval = tmpl?.interval || 'Quarterly'
        const nextPmDueDate = addIntervalToDate(installDate, interval)
        const pmWoUuid = generateUUID()
        const woNumber = `WO-PM-${new Date().getFullYear()}-${String(workOrders.length + 1 + idx).padStart(4, '0')}`
        const woTitle = tmpl ? `${tmpl.title} (${interval})` : `${assetData.name} ${interval} PM`

        const newPmWO: WorkOrder = {
          id: pmWoUuid,
          woNumber,
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
          wo_number: woNumber,
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
      inspIds.forEach((inspTmplId, idx) => {
        const tmpl = checklistTemplates.find(t => t.id === inspTmplId)
        const interval = tmpl?.interval || 'Quarterly'
        const nextInspDueDate = addIntervalToDate(installDate, interval)
        const inspUuid = generateUUID()
        const inspNumber = `INSP-${new Date().getFullYear()}-${String(inspections.length + 1 + idx).padStart(4, '0')}`

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
        }]).then(({ error }) => {
          if (error) console.error('Supabase Inspection insert error:', error.message)
        })
      })
    }

    addAssetLog({
      assetId: newId,
      action: 'Asset Created',
      byUser: currentUser.fullName,
      source: 'Manual',
      remarks: `Asset ${createdAsset.name} registered under ID ${newId}.`,
    })

    return createdAsset
  }

  const addBulkAssets = (
    assetsData: Array<Omit<Asset, 'id' | 'assetId' | 'createdAt'>>
  ): { success: boolean; createdCount: number; createdAssets: Asset[] } => {
    if (!assetsData || assetsData.length === 0) {
      return { success: false, createdCount: 0, createdAssets: [] }
    }

    const today = new Date().toISOString().split('T')[0]
    let currentSeq = getNextSequence(assets.map(a => a.id), 'AST')
    const createdAssets: Asset[] = []
    const newWorkOrders: WorkOrder[] = []
    const newInspections: Inspection[] = []
    const newLogs: Omit<AssetActivityLog, 'id' | 'timestamp'>[] = []

    let woCurrentCount = workOrders.length
    let inspCurrentCount = inspections.length

    for (const item of assetsData) {
      const newId = formatId('AST', currentSeq++)
      const createdAsset: Asset = {
        ...item,
        id: newId,
        assetId: newId,
        imageUrl: item.imageUrl || '/images/asset-placeholder.png',
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-${newId}`,
        createdAt: today,
      }
      createdAssets.push(createdAsset)

      const sub = subCategories.find(s => s.id === item.subCategoryId)
      if (sub) {
        const installDate = item.installationDate || today

        const pmIds = sub.pmTemplateIds || (sub.pmTemplateId ? [sub.pmTemplateId] : [])
        pmIds.forEach((pmTmplId) => {
          woCurrentCount++
          const tmpl = checklistTemplates.find(t => t.id === pmTmplId)
          const interval = tmpl?.interval || 'Quarterly'
          const nextPmDueDate = addIntervalToDate(installDate, interval)

          const newPmWO: WorkOrder = {
            id: `WO-PM-${new Date().getFullYear()}-${String(woCurrentCount).padStart(4, '0')}`,
            woNumber: `WO-PM-${new Date().getFullYear()}-${String(woCurrentCount).padStart(4, '0')}`,
            title: tmpl ? `${tmpl.title} (${interval})` : `${item.name} ${interval} PM`,
            type: 'Preventive',
            assetId: newId,
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
          inspCurrentCount++
          const tmpl = checklistTemplates.find(t => t.id === inspTmplId)
          const interval = tmpl?.interval || 'Quarterly'
          const nextInspDueDate = addIntervalToDate(installDate, interval)

          const newInsp: Inspection = {
            id: `INSP-${new Date().getFullYear()}-${String(inspCurrentCount).padStart(4, '0')}`,
            inspectionNumber: `INSP-${new Date().getFullYear()}-${String(inspCurrentCount).padStart(4, '0')}`,
            assetId: newId,
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
        assetId: newId,
        action: 'Asset Created',
        byUser: currentUser.fullName,
        source: 'Bulk Import',
        remarks: `Asset ${createdAsset.name} registered via bulk upload under ID ${newId}.`,
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

    return { success: true, createdCount: createdAssets.length, createdAssets }
  }

  const updateAsset = (id: string, assetData: Partial<Asset>) => {
    const { id: _, assetId: __, createdAt: ___, ...safeData } = assetData as any // Ensure immutable IDs
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
  }

  const updateAssetStatus = (assetId: string, status: Asset['status']) => {
    setAssets(prev => prev.map(a => (a.id === assetId ? { ...a, status } : a)))
  }

  // 7b. Inventory Item: INV-#### (Immutable ID, No auto PM/Inspection)
  const addInventoryItem = (itemData: Omit<InventoryItem, 'id' | 'inventoryNumber' | 'createdAt'>): InventoryItem => {
    const nextSeq = getNextSequence(inventoryItems.map(i => i.id), 'INV')
    const newId = formatId('INV', nextSeq)
    const today = new Date().toISOString().split('T')[0]
    const newUuid = generateUUID()

    const newItem: InventoryItem = {
      ...itemData,
      id: newUuid,
      inventoryNumber: newId,
      createdAt: today,
    }

    setInventoryItems(prev => [newItem, ...prev])

    supabase.from('inventory_items').insert([{
      id: newUuid,
      inventory_number: newId,
      name: newItem.name,
      sub_category_id: newItem.subCategoryId || null,
      manufacturer: newItem.manufacturer || null,
      model_number: newItem.modelNumber || null,
      quantity: newItem.quantity || 1,
      vendor_id: newItem.purchaseVendorId || null,
      storage_location: newItem.storageLocation || null,
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase inventory insert error:', error.message)
    })

    return newItem
  }

  const updateInventoryItem = (id: string, itemData: Partial<InventoryItem>) => {
    const { id: _, inventoryNumber: __, createdAt: ___, ...safeData } = itemData as any
    setInventoryItems(prev =>
      prev.map(item => (item.id === id || item.inventoryNumber === id ? { ...item, ...safeData } : item))
    )

    const dbUpdates: Record<string, any> = {}
    if (safeData.name !== undefined) dbUpdates.name = safeData.name
    if (safeData.subCategoryId !== undefined) dbUpdates.sub_category_id = safeData.subCategoryId
    if (safeData.manufacturer !== undefined) dbUpdates.manufacturer = safeData.manufacturer
    if (safeData.modelNumber !== undefined) dbUpdates.model_number = safeData.modelNumber
    if (safeData.quantity !== undefined) dbUpdates.quantity = safeData.quantity
    if (safeData.purchaseVendorId !== undefined) dbUpdates.vendor_id = safeData.purchaseVendorId
    if (safeData.storageLocation !== undefined) dbUpdates.storage_location = safeData.storageLocation

    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('inventory_items').update(dbUpdates).or(`id.eq.${id},inventory_number.eq.${id}`).then(({ error }) => {
        if (error) console.error('Supabase inventory update error:', error.message)
      })
    }
  }

  const deleteInventoryItem = (id: string) => {
    setInventoryItems(prev => prev.filter(item => item.id !== id && item.inventoryNumber !== id))
    supabase.from('inventory_items').delete().or(`id.eq.${id},inventory_number.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase inventory delete error:', error.message)
    })
  }

  const convertInventoryToAsset = (
    inventoryId: string,
    roomId: string,
    installationDate?: string,
    assignedToUserId?: string
  ): Asset | null => {
    const item = inventoryItems.find(i => i.id === inventoryId || i.inventoryNumber === inventoryId)
    if (!item) return null

    const assignedUser = assignedToUserId ? users.find(u => u.id === assignedToUserId) : undefined

    // Create standard operational asset (which triggers PM/Inspection)
    const newAsset = addAsset({
      name: item.name,
      subCategoryId: item.subCategoryId,
      roomId,
      manufacturer: item.manufacturer,
      modelNumber: item.modelNumber,
      serialNumber: item.serialNumber,
      price: item.unitPrice,
      purchaseDate: item.purchaseDate,
      installationDate: installationDate || new Date().toISOString().split('T')[0],
      warrantyTill: item.warrantyTill,
      maintenanceBy: 'In House',
      purchaseVendorId: item.purchaseVendorId,
      dynamicSpecifications: item.dynamicSpecifications || {},
      notes: `Deployed from Inventory Hub (${item.inventoryNumber}). ${item.notes || ''}`.trim(),
      status: 'Operational',
      assignedToUserId: assignedToUserId || undefined,
      assignedToUserName: assignedUser ? assignedUser.fullName : undefined,
    })

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
    const today = new Date().toISOString().split('T')[0]
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
    const today = now.toISOString().split('T')[0]
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

  // 8. Service Request: SR-YYYY-#### (Immutable ID)
  const addServiceRequest = (sr: Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>): ServiceRequest => {
    const nextSeq = getNextSequence(serviceRequests.map(s => s.ticketId), 'SR')
    const ticketId = formatYearlyId('SR', nextSeq)
    const newUuid = generateUUID()
    
    const newSr: ServiceRequest = {
      ...sr,
      id: newUuid,
      ticketId,
      createdAt: new Date().toLocaleString(),
    }
    setServiceRequests(prev => [newSr, ...prev])
    supabase.from('service_requests').insert([{
      id: newUuid,
      ticket_id: ticketId,
      title: newSr.title,
      description: newSr.description || '',
      request_type: newSr.requestType || 'Maintenance',
      room_id: newSr.roomId || null,
      asset_id: newSr.assetId || null,
      status: newSr.status || 'Open',
      priority: newSr.priority || 'Medium',
      sla_due_date: newSr.slaDueDate || null,
      photo_urls: newSr.photoUrls || [],
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase service_request insert error:', error.message)
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
    setServiceRequests(prev =>
      prev.map(s => (s.id === id ? { ...s, ...extraUpdates, status } : s))
    )
    supabase.from('service_requests').update({
      status,
      ...extraUpdates
    }).or(`id.eq.${id},ticket_id.eq.${id}`).then(() => {})
  }

  const updateServiceRequest = (id: string, updates: Partial<ServiceRequest>) => {
    setServiceRequests(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    )
    supabase.from('service_requests').update(updates).or(`id.eq.${id},ticket_id.eq.${id}`).then(() => {})
  }

  // 9. Vendor: VND-#### (Immutable ID)
  const addVendor = (v: Omit<Vendor, 'id'>): Vendor => {
    const nextSeq = getNextSequence(vendors.map(vnd => vnd.id), 'VND')
    const newCode = formatId('VND', nextSeq)
    const newUuid = generateUUID()
    const newVendor: Vendor = { ...v, id: newUuid }
    setVendors(prev => [...prev, newVendor])
    supabase.from('vendors').insert([{
      id: newUuid,
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
    }]).then(({ error }) => {
      if (error) console.error('Supabase vendor insert error:', error.message)
    })
    return newVendor
  }

  const updateVendor = (id: string, vendorData: Partial<Vendor>) => {
    const { id: _, ...safeData } = vendorData as any
    setVendors(prev => prev.map(v => (v.id === id ? { ...v, ...safeData } : v)))
    supabase.from('vendors').update(safeData).eq('id', id).then(() => {})
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
    setVendors(prev => prev.filter(v => v.id !== id))
    supabase.from('vendors').delete().eq('id', id).then(() => {})
    return { success: true }
  }

  // 10. Document: DOC-YYYY-#### (Immutable ID)
  const addDocument = (doc: Omit<DocumentItem, 'id' | 'uploadedAt'>): DocumentItem => {
    const nextSeq = getNextSequence(documents.map(d => d.id), 'DOC')
    const displayId = formatYearlyId('DOC', nextSeq)
    const newUuid = generateUUID()
    const today = new Date().toISOString().split('T')[0]
    const newDoc: DocumentItem = {
      ...doc,
      id: newUuid,
      uploadedAt: today,
    }
    setDocuments(prev => [newDoc, ...prev])
    supabase.from('documents').insert([{
      id: newUuid,
      title: newDoc.title,
      category: 'General',
      file_name: newDoc.title.replace(/[^a-zA-Z0-9.-]/g, '_') + '.pdf',
      file_type: newDoc.fileType || 'Invoice',
      file_size_bytes: (newDoc.fileSizeKb || 100) * 1024,
      file_url: newDoc.fileUrl,
      uploaded_by_user_name: newDoc.uploadedBy || 'Staff',
      uploaded_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Supabase document insert error:', error.message)
    })
    return newDoc
  }

  // Checklist Templates CRUD
  const addChecklistTemplate = (tmpl: Omit<ChecklistTemplate, 'id' | 'updatedAt'>) => {
    const newUuid = generateUUID()
    const today = new Date().toISOString().split('T')[0]
    const newTmpl: ChecklistTemplate = {
      ...tmpl,
      id: newUuid,
      updatedAt: today,
    }
    setChecklistTemplates(prev => [...prev, newTmpl])
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
    const today = new Date().toISOString().split('T')[0]
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
    const today = new Date().toISOString().split('T')[0]
    const newWo: WorkOrder = {
      ...wo,
      id: newUuid,
      createdAt: today,
    }
    setWorkOrders(prev => [newWo, ...prev])
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

    const dbUpdates: Record<string, any> = {
      status,
    }
    if (remarks !== undefined) dbUpdates.technician_remarks = remarks
    if (status === 'Completed') {
      dbUpdates.completed_at = new Date().toISOString().split('T')[0]
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
    }

    supabase.from('work_orders').update(dbUpdates).or(`id.eq.${id},wo_number.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase work_order update error:', error.message)
    })

    setWorkOrders(prev => {
      let nextRecurringPmWo: WorkOrder | null = null

      const nextList = prev.map(w => {
        if (w.id === id || w.woNumber === id) {
          const updated: WorkOrder = {
            ...w,
            ...extraUpdates,
            status,
            technicianRemarks: remarks || w.technicianRemarks,
          }
          if (status === 'Completed') {
            const completedDateIso = new Date().toISOString().split('T')[0]
            updated.completedAt = completedDateIso
            if (w.assetId) {
              updateAssetStatus(w.assetId, 'Operational')
              addAssetLog({
                assetId: w.assetId,
                action: 'Maintenance Done',
                byUser: currentUser.fullName,
                source: 'Manual',
                referenceId: w.woNumber,
                remarks: remarks || 'Work Order completed successfully.',
              })
            }

            // If this Work Order was triggered by a Service Request, auto-resolve the ticket
            if (w.source === 'Service Request' && w.sourceRefId) {
              setServiceRequests(srs =>
                srs.map(sr =>
                  sr.ticketId === w.sourceRefId || sr.id === w.sourceRefId
                    ? { ...sr, status: 'Resolved' }
                    : sr
                )
              )
            }

            // If this was a Preventive Maintenance Work Order, auto-schedule next interval
            if (w.type === 'Preventive') {
              const interval = w.frequency || 'Quarterly'
              const baseDate = w.dueDate || completedDateIso
              const nextDueDate = addIntervalToDate(baseDate, interval)
              const nextSeq = prev.length + 1
              const nextWoNumber = `WO-PM-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`
              const nextWoUuid = generateUUID()

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
                referenceId: w.woNumber,
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
    const today = new Date().toISOString().split('T')[0]
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

  const completeInspection = (id: string, result: 'Pass' | 'Fail', remarks: string, responses: any) => {
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

    const completedDateIso = new Date().toISOString().split('T')[0]
    supabase.from('inspections').update({
      status: 'Completed',
      result,
      remarks,
      checklist_responses: responses,
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
            completedAt: completedDateIso,
          }

          const tmpl = checklistTemplates.find(t => t.id === ins.templateId)
          const interval = tmpl?.interval || 'Quarterly'
          const baseDate = ins.dueDate || completedDateIso
          const nextDueDate = addIntervalToDate(baseDate, interval)
          const nextSeq = prev.length + 1
          const nextInspNumber = `INSP-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`
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
          }]).then(({ error }) => {
            if (error) console.error('Supabase recurring inspection insert error:', error.message)
          })

          if (result === 'Fail') {
            updateAssetStatus(ins.assetId, 'Under Maintenance')
            const correctiveWoNumber = `WO-CR-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(4, '0')}`
            const correctiveWoUuid = generateUUID()
            const newCorrectiveWo: WorkOrder = {
              id: correctiveWoUuid,
              woNumber: correctiveWoNumber,
              type: 'Corrective',
              assetId: ins.assetId,
              source: 'Failed Inspection',
              sourceRefId: ins.inspectionNumber,
              dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
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
              remarks: `Inspection failed. Triggered Corrective Work Order ${correctiveWoNumber}.`,
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
  const checkInRoom = (roomId: string, purpose: string) => {
    const room = rooms.find(r => r.id === roomId || r.roomNumber === roomId)
    const resolvedRoomId = room ? room.id : roomId
    const now = new Date()
    const checkInTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const checkInDate = now.toISOString().split('T')[0]
    const newUuid = generateUUID()
    const log: RoomAccessLog = {
      id: newUuid,
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
    setActiveCheckIn(log)
    setRoomAccessLogs(prev => [log, ...prev])
    setRooms(prev => prev.map(r => (r.id === resolvedRoomId || r.roomNumber === resolvedRoomId ? { ...r, status: 'Occupied', currentOccupant: currentUser.fullName } : r)))

    supabase.from('room_access_logs').insert([{
      id: newUuid,
      room_id: resolvedRoomId,
      user_id: currentUser.id,
      user_name: currentUser.fullName,
      user_role: currentUser.role,
      check_in_time: checkInTime,
      check_in_date: checkInDate,
      check_in_timestamp: now.getTime(),
      purpose,
      is_force_checkout: false,
    }]).then(({ error }) => {
      if (error) console.error('Supabase room_access_logs insert error:', error.message)
    })
  }

  const checkOutRoom = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId || r.roomNumber === roomId)
    const resolvedRoomId = room ? room.id : roomId
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setRoomAccessLogs(prev =>
      prev.map(l => ((l.roomId === resolvedRoomId || l.roomId === roomId) && !l.checkOutTime ? { ...l, checkOutTime: now } : l))
    )
    setActiveCheckIn(null)
    setRooms(prev => prev.map(r => (r.id === resolvedRoomId || r.roomNumber === resolvedRoomId ? { ...r, status: 'Available', currentOccupant: undefined } : r)))

    supabase.from('room_access_logs').update({ check_out_time: now }).eq('room_id', resolvedRoomId).is('check_out_time', null).then(({ error }) => {
      if (error) console.error('Supabase room_access_logs checkout update error:', error.message)
    })
  }

  // Automated End-of-Day Check-Out at 11:59 PM
  const evaluateAutoCheckouts = React.useCallback(() => {
    const now = new Date()
    const currentDateStr = now.toISOString().split('T')[0]
    const currentDayCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0)
    const isPast1159Today = now.getTime() >= currentDayCutoff.getTime()

    setRoomAccessLogs(prevLogs => {
      let hasChanges = false
      const updatedRoomsToFree = new Set<string>()

      const newLogs = prevLogs.map(log => {
        if (log.checkOutTime) return log

        const logDateStr = log.checkInDate || currentDateStr
        const isPastLogDate = logDateStr < currentDateStr
        const isSameDayPastCutoff = logDateStr === currentDateStr && isPast1159Today

        if (isPastLogDate || isSameDayPastCutoff) {
          hasChanges = true
          updatedRoomsToFree.add(log.roomId)
          return {
            ...log,
            checkOutTime: '11:59 PM',
            isForceCheckout: true,
            autoCheckOutNote: 'System Auto Check-Out at 11:59 PM (End of Day Cutoff)',
          }
        }
        return log
      })

      if (hasChanges) {
        setRooms(prevRooms =>
          prevRooms.map(r =>
            updatedRoomsToFree.has(r.id)
              ? { ...r, status: 'Available', currentOccupant: undefined }
              : r
          )
        )
        setActiveCheckIn(prevActive => {
          if (!prevActive) return null
          const activeDateStr = prevActive.checkInDate || currentDateStr
          if (activeDateStr < currentDateStr || (activeDateStr === currentDateStr && isPast1159Today)) {
            return null
          }
          return prevActive
        })
        return newLogs
      }

      return prevLogs
    })
  }, [])

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
    const targetAsset = assets.find(a => a.id === log.assetId || a.assetId === log.assetId)
    const resolvedAssetId = targetAsset ? targetAsset.id : log.assetId

    const newLog: AssetActivityLog = {
      ...log,
      id: newUuid,
      assetId: resolvedAssetId,
      timestamp,
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
        guestLogin,
        logout,
        users,
        addUser,
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
