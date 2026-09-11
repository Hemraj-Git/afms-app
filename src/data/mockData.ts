import {
  Campus,
  Building,
  Room,
  Category,
  SubCategory,
  Vendor,
  ChecklistTemplate,
  Asset,
  ServiceRequest,
  WorkOrder,
  Inspection,
  DocumentItem,
  UserProfile,
  RoomAccessLog,
  AssetActivityLog,
  InventoryItem,
  Reservation,
} from '@/types/afms'

// Default active logged-in user profile & standard organizational staff roles
export const mockUsers: UserProfile[] = [
  {
    id: 'USR-0001',
    email: 'admin@hemrajmarines.com',
    fullName: 'System Administrator',
    role: 'Admin',
    department: 'Facility Operations',
    phone: '+91 98201 12345',
    password: 'password123',
    passwordLastChanged: '2026-02-15',
  },
  {
    id: 'USR-0002',
    email: 'technician@hemrajmarines.com',
    fullName: 'Lead Field Technician',
    role: 'Technician',
    department: 'Engineering & Maintenance',
    phone: '+91 98201 22334',
    password: 'password123',
    passwordLastChanged: '2026-02-15',
  },
  {
    id: 'USR-0003',
    email: 'faculty@hemrajmarines.com',
    fullName: 'Faculty Member',
    role: 'Faculty',
    department: 'Academic Operations',
    phone: '+91 98201 33445',
    password: 'password123',
    passwordLastChanged: '2026-02-15',
  },
  {
    id: 'USR-0004',
    email: 'safety@hemrajmarines.com',
    fullName: 'Safety Officer / Staff',
    role: 'Faculty',
    department: 'Quality & Safety',
    phone: '+91 98201 44556',
    password: 'password123',
    passwordLastChanged: '2026-02-15',
  },
  {
    id: 'USR-0005',
    email: 'housekeeping@hemrajmarines.com',
    fullName: 'Sanitation Lead',
    role: 'Housekeeping',
    department: 'Facilities & Hygiene',
    phone: '+91 98201 55667',
    password: 'password123',
    passwordLastChanged: '2026-02-15',
  },
]

// Empty baseline datasets - all entities are dynamically created by the user
export const mockCampuses: Campus[] = []
export const mockBuildings: Building[] = []
export const mockRooms: Room[] = []
export const mockCategories: Category[] = []
export const mockSubCategories: SubCategory[] = []
export const mockVendors: Vendor[] = []
export const mockChecklistTemplates: ChecklistTemplate[] = []
export const mockAssets: Asset[] = []
export const mockServiceRequests: ServiceRequest[] = []
export const mockWorkOrders: WorkOrder[] = []
export const mockInspections: Inspection[] = []
export const mockDocuments: DocumentItem[] = []
export const mockRoomAccessLogs: RoomAccessLog[] = []
export const mockAssetActivityLogs: AssetActivityLog[] = []
export const mockInventoryItems: InventoryItem[] = []
export const mockReservations: Reservation[] = []
// mockDepartments intentionally removed — departments sync from Supabase (see AFMSContext syncSupabase)
