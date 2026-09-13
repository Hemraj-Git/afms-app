export type UserRole = 'Admin' | 'Faculty' | 'Technician' | 'Housekeeping' | 'Guest'

export interface Department {
  id: string
  name: string
  code: string
  description?: string
  headOfDepartment?: string
  createdAt?: string
}

export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: UserRole
  department?: string
  departmentId?: string
  phone?: string
  avatarUrl?: string
}

export interface Campus {
  id: string
  name: string
  code: string
  address: string
}

export interface Building {
  id: string
  campusId: string
  name: string
  code: string
  totalFloors: number
}

export interface Room {
  id: string
  buildingId: string
  name: string
  roomNumber: string
  type: string
  floor?: string
  roomSizeSqft?: number
  isReservable: boolean
  qrCodeKey: string
  status: 'Available' | 'Occupied' | 'Under Maintenance'
  currentOccupant?: string
  lastPrintedAt?: string
}

export interface Reservation {
  id: string                   // e.g. RSV-2026-0001
  reservationNumber: string    // e.g. RSV-2026-0001
  roomId: string
  roomName: string
  userId: string
  userName: string
  userRole?: string
  departmentName?: string
  date: string                 // YYYY-MM-DD
  timeSlot: string             // e.g. '09:00 AM - 10:00 AM'
  slotHour: number             // e.g. 9
  purpose: string
  status: 'Confirmed' | 'Completed' | 'Cancelled'
  groupBookingId?: string      // ID to group multi-date bulk reservations together
  createdAt: string
}

export interface Category {
  id: string
  name: string
  code: string
  description?: string
}

export interface MetadataFieldDef {
  key: string
  label: string
  type: 'Text' | 'Number' | 'Date'
  unit?: string
  required: boolean
  order: number
}

export type SlaPriority = 'Critical' | 'High' | 'Medium' | 'Low'

export interface SlaConfig {
  Critical: number // hours e.g. 4
  High: number // hours e.g. 12
  Medium: number // hours e.g. 24
  Low: number // hours e.g. 48
}

export interface SubCategory {
  id: string
  categoryId: string
  name: string
  code: string
  description?: string
  slaPriority?: SlaPriority
  metadataFields: MetadataFieldDef[]
  pmTemplateIds?: string[]
  pmTemplateId?: string
  inspectionTemplateIds?: string[]
  inspectionTemplateId?: string
}

export interface Vendor {
  id: string
  code?: string
  name: string
  categorySupplied: string
  contactPerson: string
  email: string
  phone: string
  address: string
  hasAmc: boolean
  amcContractNo?: string
  amcStartDate?: string
  amcEndDate?: string
}

export interface ChecklistItemDef {
  id: string
  order: number
  itemText: string
  instructions?: string
  responseType?: 'Checkbox' | 'Pass-Fail' | 'Yes-No' | 'Numeric' | 'Text'
  mandatory: boolean
  photoRequired: boolean
}

export interface ChecklistTemplate {
  id: string
  title: string
  type: 'Preventive Maintenance' | 'Inspection'
  description?: string
  interval?: 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annually'
  items: ChecklistItemDef[]
  updatedAt?: string
}

export interface Asset {
  id: string
  assetId: string // e.g. AST001, MUM-AC-0042
  name: string
  subCategoryId: string
  roomId: string
  manufacturer?: string
  modelNumber?: string
  serialNumber?: string
  price?: number
  purchaseDate?: string
  installationDate: string
  lastServicedDate?: string
  warrantyTill?: string
  maintenanceBy: 'In House' | 'Vendor'
  maintenanceVendorId?: string
  amcStartDate?: string
  amcEndDate?: string
  purchaseVendorId?: string
  assignedToUserId?: string
  assignedToUserName?: string
  dynamicSpecifications: Record<string, any>
  imageUrl?: string
  notes?: string
  status: 'Operational' | 'Under Maintenance' | 'In Storage' | 'Retired'
  qrCodeUrl?: string
  lastPrintedAt?: string
  createdAt: string
}

export interface InventoryItem {
  id: string                 // e.g. INV-0001
  inventoryNumber: string    // e.g. INV-0001
  name: string
  subCategoryId: string
  manufacturer?: string
  modelNumber?: string
  serialNumber?: string
  quantity: number           // In stock
  unit: string               // Pieces, Sets, Meters, Units
  minStockThreshold?: number // Minimum safe threshold
  unitPrice?: number
  purchaseDate?: string
  warrantyTill?: string
  purchaseVendorId?: string
  storageLocation: string    // e.g. Main Central Warehouse / Rack B-04
  roomId?: string            // Optional linked storeroom
  dynamicSpecifications: Record<string, any> // Inherited sub-category custom metadata fields
  imageUrl?: string
  notes?: string
  createdAt: string
}

export interface DocumentItem {
  id: string
  title: string
  fileType: 'Invoice' | 'Warranty' | 'User Guide' | 'AMC Contract' | 'Other'
  fileUrl: string
  fileSizeKb: number
  uploadedBy: string
  uploadedAt: string
  linkedAssetIds: string[]
}

export interface ServiceRequest {
  id: string
  ticketId: string // SCT001
  title: string
  description: string
  requestType: 'Maintenance' | 'Cleaning' | 'Housekeeping' | 'IT Support' | 'General'
  roomId: string
  assetId?: string
  requestedBy: string
  requestedByRole: string
  requestedByUserId?: string
  assignedTo?: string
  assignedToName?: string
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Escalated'
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  createdAt: string
  slaDueDate: string
  photoUrls?: string[]
  workOrderNumber?: string
  workOrderId?: string
  workOrderType?: 'Corrective' | 'Housekeeping'
  dismissalReason?: string
  dismissedAt?: string
  dismissedBy?: string
  resolutionNotes?: string
}

export interface WorkOrderPartItem {
  partName: string
  quantity: number
  notes?: string
}

export interface WorkOrder {
  id: string
  woNumber: string // WO-PM-2026-001, WO-CR-2026-001, WO-HK-2026-001
  type: 'Preventive' | 'Corrective' | 'Housekeeping'
  assetId?: string
  roomId?: string
  title?: string
  priority?: 'Low' | 'Medium' | 'High' | 'Critical'
  source: 'Scheduled' | 'Service Request' | 'Failed Inspection' | 'Routine'
  sourceRefId?: string
  frequency?: string
  dueDate: string
  assignedTechnicianId?: string
  assignedTechnicianName?: string
  vendorId?: string
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
  checklistTemplateId?: string
  checklistSnapshot?: ChecklistItemDef[]
  checklistResponses?: Record<string, { value: any; remarks?: string; photoUrl?: string }>
  issueLogged?: string
  solutionTaken?: string
  technicianRemarks?: string
  startPhotoUrl?: string
  completionPhotoUrl?: string
  executedBy?: 'In House' | 'Vendor'
  partsReplaced?: WorkOrderPartItem[]
  vendorTicketNo?: string
  vendorTechName?: string
  vendorTechPhone?: string
  vendorServiceDate?: string
  vendorJobSheetUrl?: string
  vendorRemarks?: string
  vendorCost?: number
  completedAt?: string
  createdAt: string
}

export interface Inspection {
  id: string
  inspectionNumber: string // INSP-2026-0042
  assetId: string
  templateId: string
  templateVersion: number
  assignedInspectorId?: string
  assignedInspectorName?: string
  dueDate: string
  status: 'Scheduled' | 'In Progress' | 'Completed'
  result?: 'Pass' | 'Fail' | 'Not Applicable'
  checklistSnapshot?: ChecklistItemDef[]
  checklistResponses?: Record<string, { value: any; remarks?: string; photoUrl?: string }>
  inspectorRemarks?: string
  completedAt?: string
  createdAt: string
}

export interface AppNotification {
  id: string
  type: 'wo_assigned' | 'inspection_assigned' | 'auto_checkout'
  title: string
  body?: string
  refTable?: string
  refId?: string
  isRead: boolean
  createdAt: string
}

export interface RoomAccessLog {
  id: string
  activityNumber?: string
  roomId: string
  roomName: string
  userId: string
  userName: string
  userRole: string
  checkInTime: string
  checkInDate?: string
  checkInTimestamp?: number
  checkOutTime?: string
  purpose: string
  isForceCheckout: boolean
  autoCheckOutNote?: string
}

export interface AssetActivityLog {
  id: string
  assetId: string
  action: string
  byUser: string
  remarks?: string
  oldValue?: string
  newValue?: string
  referenceId?: string
  source: 'Manual' | 'System' | 'Bulk Import'
  timestamp: string
}
