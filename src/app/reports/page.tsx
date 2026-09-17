'use client'

import React, { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { getLocalDateStr, formatDateDisplay } from '@/lib/dateUtils'
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Boxes,
  MapPin,
  DoorOpen,
  History,
  ShieldCheck,
  Wrench,
  ClipboardList,
  MessageSquare,
  Users,
  Package,
  Printer,
  Search,
  ChevronDown,
  CalendarRange,
  Layers,
  ArrowUpDown,
  FileText,
  Clock,
  X,
} from 'lucide-react'

// Defined Report Types
type ReportTypeKey =
  | 'asset_master'
  | 'location_wise'
  | 'room_wise'
  | 'room_access'
  | 'warranty_amc'
  | 'pm_maintenance'
  | 'corrective_maintenance'
  | 'inspections'
  | 'service_requests'
  | 'technician_workload'
  | 'inventory_spares'

interface ReportMeta {
  key: ReportTypeKey
  title: string
  subtitle: string
  category: 'Assets & Facilities' | 'Operations & Maintenance' | 'Personnel & Inventory'
  icon: React.ElementType
}

const REPORT_DEFINITIONS: ReportMeta[] = [
  {
    key: 'asset_master',
    title: 'Asset Master Report',
    subtitle: 'Detailed list of all registered assets, categories, specifications, and custodians',
    category: 'Assets & Facilities',
    icon: Boxes,
  },
  {
    key: 'location_wise',
    title: 'Location-Wise Summary Report',
    subtitle: 'Campus and building breakdown of rooms, active assets, and operational status',
    category: 'Assets & Facilities',
    icon: MapPin,
  },
  {
    key: 'room_wise',
    title: 'Room-Wise Asset Report',
    subtitle: 'Room-level asset counts, square footage, reservable status, and maintenance loads',
    category: 'Assets & Facilities',
    icon: DoorOpen,
  },
  {
    key: 'room_access',
    title: 'Room Access & Activity Report',
    subtitle: 'QR check-in and check-out logs, purpose of access, and duration per room',
    category: 'Assets & Facilities',
    icon: History,
  },
  {
    key: 'warranty_amc',
    title: 'Asset Warranty & AMC Report',
    subtitle: 'Warranty expirations, service contract deadlines, and vendor coverages',
    category: 'Operations & Maintenance',
    icon: ShieldCheck,
  },
  {
    key: 'pm_maintenance',
    title: 'Preventive Maintenance Report',
    subtitle: 'Routine PM work orders, schedules, frequencies, and technician completions',
    category: 'Operations & Maintenance',
    icon: CalendarRange,
  },
  {
    key: 'corrective_maintenance',
    title: 'Corrective Maintenance (Breakdowns)',
    subtitle: 'Unscheduled maintenance tasks, priority, breakdown resolutions, and remarks',
    category: 'Operations & Maintenance',
    icon: Wrench,
  },
  {
    key: 'inspections',
    title: 'Inspection & Checklist Report',
    subtitle: 'Quality inspections, checklist item outcomes, pass/fail status, and remarks',
    category: 'Operations & Maintenance',
    icon: ClipboardList,
  },
  {
    key: 'service_requests',
    title: 'Service Requests & SLA Report',
    subtitle: 'Staff service tickets, turnaround times, priorities, and resolution metrics',
    category: 'Operations & Maintenance',
    icon: MessageSquare,
  },
  {
    key: 'technician_workload',
    title: 'Technician Workload Report',
    subtitle: 'Assigned maintenance tasks, completed work orders, and technician efficiency',
    category: 'Personnel & Inventory',
    icon: Users,
  },
  {
    key: 'inventory_spares',
    title: 'Inventory Hub & Spares Report',
    subtitle: 'Stock levels, unit prices, total inventory valuation, and minimum stock alerts',
    category: 'Personnel & Inventory',
    icon: Package,
  },
]

export default function ReportsHubPage() {
  const {
    assets,
    campuses,
    buildings,
    rooms,
    categories,
    subCategories,
    vendors,
    workOrders,
    inspections,
    serviceRequests,
    roomAccessLogs,
    inventoryItems,
    users,
    departments,
    currentUser,
  } = useAFMS()

  const [activeReportKey, setActiveReportKey] = useState<ReportTypeKey>('asset_master')

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [campusFilter, setCampusFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [assetFilter, setAssetFilter] = useState('ALL')
  const [userFilter, setUserFilter] = useState('ALL')

  // Auto-select report and asset from URL query params (e.g. from asset details page)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const reportParam = params.get('report') as ReportTypeKey | null
      const assetParam = params.get('assetId')
      if (reportParam && REPORT_DEFINITIONS.some(r => r.key === reportParam)) {
        setActiveReportKey(reportParam)
      }
      if (assetParam) {
        setAssetFilter(assetParam)
      }
    }
  }, [])

  // Date Range Filters (Default: Last 90 days to Today)
  const defaultStartDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return getLocalDateStr(d)
  }, [])
  const defaultEndDate = useMemo(() => getLocalDateStr(), [])

  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [datePreset, setDatePreset] = useState<'custom' | 'today' | '30days' | '90days' | 'this_year' | 'all'>('90days')

  // Quick Date Presets Handler
  const applyDatePreset = (preset: 'today' | '30days' | '90days' | 'this_year' | 'all') => {
    setDatePreset(preset)
    const today = new Date()
    const todayStr = getLocalDateStr(today)

    if (preset === 'today') {
      setStartDate(todayStr)
      setEndDate(todayStr)
    } else if (preset === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setStartDate(getLocalDateStr(d))
      setEndDate(todayStr)
    } else if (preset === '90days') {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      setStartDate(getLocalDateStr(d))
      setEndDate(todayStr)
    } else if (preset === 'this_year') {
      const y = today.getFullYear()
      setStartDate(`${y}-01-01`)
      setEndDate(todayStr)
    } else if (preset === 'all') {
      setStartDate('2020-01-01')
      setEndDate('2035-12-31')
    }
  }

  // Active Report Definition
  const activeReport = REPORT_DEFINITIONS.find(r => r.key === activeReportKey) || REPORT_DEFINITIONS[0]

  // Date Check Helper (Timezone-safe)
  const isWithinDateRange = (dateStr?: string) => {
    if (!dateStr || datePreset === 'all') return true
    // Parse just the YYYY-MM-DD part if timestamp has time
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0]
    return cleanDate >= startDate && cleanDate <= endDate
  }

  // ==========================================
  // DATA COMPUTATION FOR EACH REPORT TYPE
  // ==========================================

  // 1. Asset Master
  const assetMasterData = useMemo(() => {
    return assets
      .filter(a => {
        if (!isWithinDateRange(a.purchaseDate || a.installationDate || a.createdAt)) return false
        if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
        if (assetFilter !== 'ALL' && a.id !== assetFilter && a.assetId !== assetFilter) return false
        if (userFilter !== 'ALL') {
          const selectedUser = users.find(u => u.id === userFilter)
          const isMatch =
            a.assignedToUserId === userFilter ||
            (selectedUser && a.assignedToUserName === selectedUser.fullName) ||
            a.assignedToUserName === userFilter
          if (!isMatch) return false
        }
        if (campusFilter !== 'ALL') {
          const room = rooms.find(r => r.id === a.roomId)
          const building = buildings.find(b => b.id === room?.buildingId)
          if (building?.campusId !== campusFilter) return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const sub = subCategories.find(s => s.id === a.subCategoryId)
          const room = rooms.find(r => r.id === a.roomId)
          const match =
            a.name.toLowerCase().includes(q) ||
            a.assetId.toLowerCase().includes(q) ||
            (a.serialNumber && a.serialNumber.toLowerCase().includes(q)) ||
            (sub && sub.name.toLowerCase().includes(q)) ||
            (room && room.name.toLowerCase().includes(q)) ||
            (a.assignedToUserName && a.assignedToUserName.toLowerCase().includes(q))
          if (!match) return false
        }
        return true
      })
      .map(a => {
        const sub = subCategories.find(s => s.id === a.subCategoryId)
        const cat = categories.find(c => c.id === sub?.categoryId)
        const room = rooms.find(r => r.id === a.roomId)
        const building = buildings.find(b => b.id === room?.buildingId)
        const campus = campuses.find(c => c.id === building?.campusId)
        const vendor = vendors.find(v => v.id === a.purchaseVendorId)

        return {
          id: a.id,
          assetId: a.assetId,
          name: a.name,
          category: cat?.name || 'Equipment',
          subCategory: sub?.name || 'Standard',
          location: `${campus?.name || 'Main'} > ${building?.name || 'Block'} > ${room?.name || 'Unassigned'}`,
          serialNumber: a.serialNumber || '—',
          purchaseDate: a.purchaseDate || '—',
          price: a.price ? `₹${a.price.toLocaleString()}` : '—',
          status: a.status,
          assignedTo: a.assignedToUserName || 'Unassigned',
          vendor: vendor?.name || '—',
        }
      })
  }, [assets, rooms, buildings, campuses, categories, subCategories, vendors, users, startDate, endDate, datePreset, statusFilter, campusFilter, assetFilter, userFilter, searchQuery])

  // 2. Location-Wise Summary
  const locationWiseData = useMemo(() => {
    return buildings
      .filter(b => {
        if (campusFilter !== 'ALL' && b.campusId !== campusFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const campus = campuses.find(c => c.id === b.campusId)
          if (!b.name.toLowerCase().includes(q) && !campus?.name.toLowerCase().includes(q)) return false
        }
        return true
      })
      .map(b => {
        const campus = campuses.find(c => c.id === b.campusId)
        const buildingRooms = rooms.filter(r => r.buildingId === b.id)
        const buildingRoomIds = buildingRooms.map(r => r.id)
        const buildingAssets = assets.filter(a => buildingRoomIds.includes(a.roomId))
        const operationalAssets = buildingAssets.filter(a => a.status === 'Operational').length
        const underMaintAssets = buildingAssets.filter(a => a.status === 'Under Maintenance').length
        const openSRs = serviceRequests.filter(s => buildingRoomIds.includes(s.roomId || '') && s.status !== 'Closed' && s.status !== 'Resolved').length

        return {
          buildingId: b.id,
          campusName: campus?.name || 'Main Campus',
          buildingName: b.name,
          totalFloors: b.totalFloors || 1,
          totalRooms: buildingRooms.length,
          totalAssets: buildingAssets.length,
          operationalAssets,
          underMaintAssets,
          openServiceRequests: openSRs,
        }
      })
  }, [buildings, campuses, rooms, assets, serviceRequests, campusFilter, searchQuery])

  // 3. Room-Wise Asset Report
  const roomWiseData = useMemo(() => {
    return rooms
      .filter(r => {
        const building = buildings.find(b => b.id === r.buildingId)
        if (campusFilter !== 'ALL' && building?.campusId !== campusFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (!r.name.toLowerCase().includes(q) && !r.roomNumber.toLowerCase().includes(q) && !r.type.toLowerCase().includes(q)) {
            return false
          }
        }
        return true
      })
      .map(r => {
        const building = buildings.find(b => b.id === r.buildingId)
        const campus = campuses.find(c => c.id === building?.campusId)
        const roomAssets = assets.filter(a => a.roomId === r.id)
        const operational = roomAssets.filter(a => a.status === 'Operational').length
        const underMaint = roomAssets.filter(a => a.status === 'Under Maintenance').length

        return {
          roomId: r.id,
          roomName: r.name,
          roomNumber: r.roomNumber,
          roomType: r.type,
          building: building?.name || 'Block',
          campus: campus?.name || 'Campus',
          floor: r.floor || 'Ground',
          sizeSqft: r.roomSizeSqft ? `${r.roomSizeSqft} sqft` : '—',
          isReservable: r.isReservable ? 'Yes' : 'No',
          totalAssets: roomAssets.length,
          operational,
          underMaint,
          status: r.status,
        }
      })
  }, [rooms, buildings, campuses, assets, campusFilter, searchQuery])

  // 4. Room Access Log Report
  const roomAccessData = useMemo(() => {
    return roomAccessLogs
      .filter(l => {
        // checkInTime is a time-only display string ("11:27:00 PM", no
        // date) -- comparing it against a YYYY-MM-DD range always fails.
        // checkInDate is the actual date field.
        if (!isWithinDateRange(l.checkInDate)) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (
            !l.roomName.toLowerCase().includes(q) &&
            !l.userName.toLowerCase().includes(q) &&
            !l.purpose.toLowerCase().includes(q)
          )
            return false
        }
        return true
      })
      .map(l => ({
        logId: l.activityNumber || l.id,
        roomName: l.roomName,
        userName: l.userName,
        userRole: l.userRole,
        checkInTime: l.checkInTime,
        checkOutTime: l.checkOutTime || 'Active In Room',
        purpose: l.purpose,
        status: !l.checkOutTime ? 'Active' : 'Completed',
      }))
  }, [roomAccessLogs, startDate, endDate, datePreset, searchQuery])

  // 5. Warranty & AMC Expiry Report
  const warrantyAmcData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return assets
      .filter(a => {
        if (assetFilter !== 'ALL' && a.id !== assetFilter && a.assetId !== assetFilter) return false
        if (userFilter !== 'ALL') {
          const selectedUser = users.find(u => u.id === userFilter)
          const isMatch =
            a.assignedToUserId === userFilter ||
            (selectedUser && a.assignedToUserName === selectedUser.fullName) ||
            a.assignedToUserName === userFilter
          if (!isMatch) return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (!a.name.toLowerCase().includes(q) && !a.assetId.toLowerCase().includes(q)) return false
        }
        return true
      })
      .map(a => {
        const vendor = vendors.find(v => v.id === a.purchaseVendorId || v.id === a.maintenanceVendorId)
        let warrantyStatus = 'No Expiry Set'
        let daysLeft = null

        if (a.warrantyTill) {
          const expiryDate = new Date(a.warrantyTill)
          // Zero out time-of-day on both sides -- otherwise `today` retains
          // its current time while `expiryDate` parses to UTC midnight,
          // making a warranty expiring "today" flip to Expired hours early
          // (and disagree with assets/[id]/page.tsx's calculateDaysRemaining,
          // which already does this correctly).
          expiryDate.setHours(0, 0, 0, 0)
          const diffTime = expiryDate.getTime() - today.getTime()
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          if (daysLeft < 0) {
            warrantyStatus = 'Expired'
          } else if (daysLeft <= 30) {
            warrantyStatus = 'Expiring Soon'
          } else {
            warrantyStatus = 'Active Cover'
          }
        }

        return {
          assetId: a.assetId,
          assetName: a.name,
          vendorName: vendor?.name || 'In-House Maintenance',
          purchaseDate: a.purchaseDate || '—',
          warrantyExpiry: a.warrantyTill || '—',
          daysLeft: daysLeft !== null ? `${daysLeft} Days` : '—',
          status: warrantyStatus,
        }
      })
  }, [assets, vendors, users, assetFilter, userFilter, searchQuery])

  // 6. Preventive Maintenance (PM) Report — excludes unassigned PENDING
  // records (not yet real Work Orders; those still show in the dedicated
  // Preventive Maintenance queue as "Pending Assignment").
  const pmData = useMemo(() => {
    return workOrders
      .filter(w => w.type === 'Preventive' && !isPendingWorkOrder(w.woNumber))
      .filter(w => {
        if (!isWithinDateRange(w.dueDate || w.createdAt)) return false
        if (statusFilter !== 'ALL' && w.status !== statusFilter) return false
        if (assetFilter !== 'ALL' && w.assetId !== assetFilter) return false
        if (userFilter !== 'ALL') {
          const selectedUser = users.find(u => u.id === userFilter)
          const isMatch =
            w.assignedTechnicianId === userFilter ||
            (selectedUser && w.assignedTechnicianName === selectedUser.fullName) ||
            w.assignedTechnicianName === userFilter
          if (!isMatch) return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (
            !w.woNumber.toLowerCase().includes(q) &&
            !(w.title && w.title.toLowerCase().includes(q)) &&
            !(w.assignedTechnicianName && w.assignedTechnicianName.toLowerCase().includes(q))
          )
            return false
        }
        return true
      })
      .map(w => {
        const asset = assets.find(a => a.id === w.assetId || a.assetId === w.assetId)
        const room = rooms.find(r => r.id === asset?.roomId || r.id === w.roomId)

        return {
          woNumber: w.woNumber,
          title: w.title || 'Scheduled PM Checklist',
          assetName: asset ? `${asset.name} (${asset.assetId})` : 'General Facility',
          location: room ? `${room.name} (Room ${room.roomNumber})` : '—',
          frequency: w.frequency || 'Monthly',
          dueDate: w.dueDate,
          assignedTo: w.assignedTechnicianName || 'Unassigned',
          completedAt: w.completedAt || '—',
          status: w.status,
        }
      })
  }, [workOrders, assets, rooms, users, startDate, endDate, datePreset, statusFilter, assetFilter, userFilter, searchQuery])

  // 7. Corrective Maintenance Report — same PENDING exclusion as PM above.
  const correctiveData = useMemo(() => {
    return workOrders
      .filter(w => w.type === 'Corrective' && !isPendingWorkOrder(w.woNumber))
      .filter(w => {
        if (!isWithinDateRange(w.createdAt || w.dueDate)) return false
        if (statusFilter !== 'ALL' && w.status !== statusFilter) return false
        if (assetFilter !== 'ALL' && w.assetId !== assetFilter) return false
        if (userFilter !== 'ALL') {
          const selectedUser = users.find(u => u.id === userFilter)
          const isMatch =
            w.assignedTechnicianId === userFilter ||
            (selectedUser && w.assignedTechnicianName === selectedUser.fullName) ||
            w.assignedTechnicianName === userFilter
          if (!isMatch) return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (
            !w.woNumber.toLowerCase().includes(q) &&
            !(w.issueLogged && w.issueLogged.toLowerCase().includes(q)) &&
            !(w.assignedTechnicianName && w.assignedTechnicianName.toLowerCase().includes(q))
          )
            return false
        }
        return true
      })
      .map(w => {
        const asset = assets.find(a => a.id === w.assetId || a.assetId === w.assetId)
        return {
          woNumber: w.woNumber,
          assetName: asset ? `${asset.name} (${asset.assetId})` : 'Room Infrastructure',
          issue: w.issueLogged || w.title || 'Breakdown reported',
          priority: w.priority || 'Medium',
          assignedTo: w.assignedTechnicianName || 'Unassigned',
          dueDate: w.dueDate,
          completedAt: w.completedAt || '—',
          solution: w.solutionTaken || '—',
          status: w.status,
        }
      })
  }, [workOrders, assets, users, startDate, endDate, datePreset, statusFilter, assetFilter, userFilter, searchQuery])

  // 8. Inspection Report
  const inspectionData = useMemo(() => {
    return inspections
      .filter(i => {
        if (!isWithinDateRange(i.dueDate || i.createdAt)) return false
        if (statusFilter !== 'ALL') {
          if (statusFilter === 'Pass' || statusFilter === 'Fail') {
            if (i.result !== statusFilter) return false
          } else if (i.status !== statusFilter) {
            return false
          }
        }
        if (assetFilter !== 'ALL' && i.assetId !== assetFilter) return false
        if (userFilter !== 'ALL') {
          const selectedUser = users.find(u => u.id === userFilter)
          const isMatch =
            i.assignedInspectorId === userFilter ||
            (selectedUser && i.assignedInspectorName === selectedUser.fullName) ||
            i.assignedInspectorName === userFilter
          if (!isMatch) return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (
            !i.inspectionNumber.toLowerCase().includes(q) &&
            !(i.assignedInspectorName && i.assignedInspectorName.toLowerCase().includes(q)) &&
            !(i.templateId && i.templateId.toLowerCase().includes(q))
          )
            return false
        }
        return true
      })
      .map(i => {
        const asset = assets.find(a => a.id === i.assetId || a.assetId === i.assetId)
        return {
          inspectionNumber: i.inspectionNumber,
          assetName: asset ? `${asset.name} (${asset.assetId})` : 'Facility Space',
          inspector: i.assignedInspectorName || 'Unassigned',
          dueDate: i.dueDate,
          completedAt: i.completedAt || '—',
          result: i.result || 'Pending',
          status: i.status,
          remarks: i.inspectorRemarks || '—',
        }
      })
  }, [inspections, assets, users, startDate, endDate, datePreset, statusFilter, assetFilter, userFilter, searchQuery])

  // 9. Service Requests & SLA Report
  const serviceRequestData = useMemo(() => {
    return serviceRequests
      .filter(s => {
        if (!isWithinDateRange(s.createdAt)) return false
        if (statusFilter !== 'ALL' && s.status !== statusFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (
            !s.ticketId.toLowerCase().includes(q) &&
            !s.title.toLowerCase().includes(q) &&
            !s.requestedBy.toLowerCase().includes(q)
          )
            return false
        }
        return true
      })
      .map(s => {
        const asset = assets.find(a => a.id === s.assetId)
        const room = rooms.find(r => r.id === s.roomId)

        return {
          ticketId: s.ticketId,
          title: s.title,
          location: `${room?.name || 'General Space'} ${asset ? `• ${asset.name}` : ''}`,
          requestedBy: `${s.requestedBy} (${s.requestedByRole})`,
          priority: s.priority,
          slaDueDate: s.slaDueDate || '—',
          createdAt: s.createdAt,
          status: s.status,
        }
      })
  }, [serviceRequests, assets, rooms, startDate, endDate, datePreset, statusFilter, searchQuery])

  // 10. Technician Workload Report
  const technicianWorkloadData = useMemo(() => {
    const techUsers = users.filter(u => u.role === 'Technician' || u.role === 'Admin')
    return techUsers.map(t => {
      const assignedWOs = workOrders.filter(w => w.assignedTechnicianId === t.id || w.assignedTechnicianName === t.fullName)
      const completedPMs = assignedWOs.filter(w => w.type === 'Preventive' && w.status === 'Completed').length
      const completedCorrective = assignedWOs.filter(w => w.type === 'Corrective' && w.status === 'Completed').length
      const inProgress = assignedWOs.filter(w => w.status === 'In Progress').length
      const overdue = assignedWOs.filter(w => w.status !== 'Completed' && w.dueDate < getLocalDateStr()).length

      return {
        techId: t.id,
        name: t.fullName,
        department: t.department || 'Engineering',
        totalAssigned: assignedWOs.length,
        completedPMs,
        completedCorrective,
        inProgress,
        overdue,
      }
    })
  }, [users, workOrders])

  // 11. Inventory & Spares Report
  const inventoryReportData = useMemo(() => {
    return inventoryItems
      .filter(item => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (!item.name.toLowerCase().includes(q) && !item.inventoryNumber.toLowerCase().includes(q)) return false
        }
        return true
      })
      .map(item => {
        const sub = subCategories.find(s => s.id === item.subCategoryId)
        const cat = categories.find(c => c.id === sub?.categoryId)
        const vendor = vendors.find(v => v.id === item.purchaseVendorId)
        const totalValuation = (item.quantity || 0) * (item.unitPrice || 0)

        let stockStatus = 'In Stock'
        if (item.quantity === 0) stockStatus = 'Out of Stock'
        else if (item.quantity <= (item.minStockThreshold || 2)) stockStatus = 'Low Stock'

        return {
          inventoryNumber: item.inventoryNumber,
          name: item.name,
          category: cat?.name || 'Spares',
          subCategory: sub?.name || 'General',
          quantity: item.quantity,
          unitPrice: item.unitPrice ? `₹${item.unitPrice.toLocaleString()}` : '—',
          totalValuation: `₹${totalValuation.toLocaleString()}`,
          vendor: vendor?.name || '—',
          status: stockStatus,
        }
      })
  }, [inventoryItems, subCategories, categories, vendors, searchQuery])

  // ==========================================
  // EXPORT HANDLERS: EXCEL (CSV) & PRINT/PDF
  // ==========================================

  // Export to Excel / CSV
  const handleExportCSV = () => {
    let rows: Array<Record<string, any>> = []
    let fileNamePrefix = activeReport.title.replace(/\s+/g, '_')

    switch (activeReportKey) {
      case 'asset_master':
        rows = assetMasterData
        break
      case 'location_wise':
        rows = locationWiseData
        break
      case 'room_wise':
        rows = roomWiseData
        break
      case 'room_access':
        rows = roomAccessData
        break
      case 'warranty_amc':
        rows = warrantyAmcData
        break
      case 'pm_maintenance':
        rows = pmData
        break
      case 'corrective_maintenance':
        rows = correctiveData
        break
      case 'inspections':
        rows = inspectionData
        break
      case 'service_requests':
        rows = serviceRequestData
        break
      case 'technician_workload':
        rows = technicianWorkloadData
        break
      case 'inventory_spares':
        rows = inventoryReportData
        break
    }

    if (rows.length === 0) {
      alert('No records available to export for the selected filter criteria.')
      return
    }

    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        headers
          .map(header => {
            const val = row[header] === undefined || row[header] === null ? '' : String(row[header])
            return `"${val.replace(/"/g, '""')}"`
          })
          .join(',')
      ),
    ].join('\n')

    // UTF-8 BOM encoding for Microsoft Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${fileNamePrefix}_${getLocalDateStr()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print / PDF Export
  const handlePrintReport = () => {
    window.print()
  }

  // Dynamic table record count
  const activeRecordCount = useMemo(() => {
    switch (activeReportKey) {
      case 'asset_master':
        return assetMasterData.length
      case 'location_wise':
        return locationWiseData.length
      case 'room_wise':
        return roomWiseData.length
      case 'room_access':
        return roomAccessData.length
      case 'warranty_amc':
        return warrantyAmcData.length
      case 'pm_maintenance':
        return pmData.length
      case 'corrective_maintenance':
        return correctiveData.length
      case 'inspections':
        return inspectionData.length
      case 'service_requests':
        return serviceRequestData.length
      case 'technician_workload':
        return technicianWorkloadData.length
      case 'inventory_spares':
        return inventoryReportData.length
      default:
        return 0
    }
  }, [
    activeReportKey,
    assetMasterData,
    locationWiseData,
    roomWiseData,
    roomAccessData,
    warrantyAmcData,
    pmData,
    correctiveData,
    inspectionData,
    serviceRequestData,
    technicianWorkloadData,
    inventoryReportData,
  ])

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Reports & Analytics' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Printable Official Header (Visible during Print/PDF export) */}
        <div className="hidden print:block mb-6 border-b pb-4">
          <h1 className="text-xl font-bold text-slate-900">Facility Operations Management System</h1>
          <h2 className="text-sm font-semibold text-slate-700 mt-0.5">{activeReport.title}</h2>
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Generated Date: {formatDateDisplay(new Date())}</span>
            <span>Date Range: {formatDateDisplay(startDate)} to {formatDateDisplay(endDate)}</span>
            {userFilter !== 'ALL' && (
              <span>Personnel: {users.find(u => u.id === userFilter)?.fullName || userFilter}</span>
            )}
            <span>Total Records: {activeRecordCount}</span>
          </div>
        </div>

        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Facility Reports &amp; Analytics Hub</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate, filter by date range, and export operational datasets in Excel or PDF format
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.csv)</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Report Category Switcher Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 print:hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {REPORT_DEFINITIONS.map(report => {
              const Icon = report.icon
              const isActive = activeReportKey === report.key
              return (
                <button
                  key={report.key}
                  onClick={() => {
                    setActiveReportKey(report.key)
                    setSearchQuery('')
                  }}
                  className={`p-3 rounded-xl text-left transition flex flex-col justify-between border ${
                    isActive
                      ? 'bg-blue-50/80 text-blue-900 border-blue-300 ring-2 ring-blue-500/20 font-bold'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                  </div>
                  <span className="text-xs line-clamp-1">{report.title}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Universal Filter & Date Range Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Report Title Badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <activeReport.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{activeReport.title}</h2>
                <p className="text-xs text-slate-500">{activeReport.subtitle}</p>
              </div>
            </div>

            {/* Total Records Counter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                {activeRecordCount} Records Found
              </span>
            </div>
          </div>

          {/* Filter Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100 text-xs">
            {/* Search Input */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Search Records
                </label>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by keyword, ID, name, location..."
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            {/* Date Range End */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            {/* Campus Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campus</label>
              <select
                value={campusFilter}
                onChange={e => setCampusFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              >
                <option value="ALL">All Campuses</option>
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="Operational">Operational</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Open">Open</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            </div>

            {/* Asset Filter (for Asset, Maintenance, and Inspection reports) */}
            {['asset_master', 'warranty_amc', 'pm_maintenance', 'corrective_maintenance', 'inspections'].includes(activeReportKey) && (
              <div className="sm:col-span-2 md:col-span-2 lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Single Asset Filter
                  </label>
                  {assetFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setAssetFilter('ALL')}
                      className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <select
                  value={assetFilter}
                  onChange={e => setAssetFilter(e.target.value)}
                  className={`w-full px-3 py-1.5 border rounded-xl font-medium text-xs transition ${
                    assetFilter !== 'ALL'
                      ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold ring-2 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="ALL">All Assets (Fleet & Facility-wide)</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assetId} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* User-Wise Filter (Assigned User for Assets, Assigned Technician for PM/Corrective, Assigned Inspector for Inspections) */}
            {['asset_master', 'warranty_amc', 'pm_maintenance', 'corrective_maintenance', 'inspections'].includes(activeReportKey) && (
              <div className="sm:col-span-2 md:col-span-2 lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {activeReportKey === 'asset_master' || activeReportKey === 'warranty_amc'
                      ? 'Assigned User / Custodian'
                      : activeReportKey === 'pm_maintenance' || activeReportKey === 'corrective_maintenance'
                      ? 'Assigned Technician'
                      : 'Assigned Inspector'}
                  </label>
                  {userFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setUserFilter('ALL')}
                      className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <select
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  className={`w-full px-3 py-1.5 border rounded-xl font-medium text-xs transition ${
                    userFilter !== 'ALL'
                      ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold ring-2 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="ALL">
                    {activeReportKey === 'asset_master' || activeReportKey === 'warranty_amc'
                      ? 'All Users / Custodians'
                      : activeReportKey === 'pm_maintenance' || activeReportKey === 'corrective_maintenance'
                      ? 'All Technicians'
                      : 'All Reviewers / Inspectors'}
                  </option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role}{u.department ? ` - ${u.department}` : ''})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Date Presets Bar */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Quick Presets:</span>
            {[
              { id: 'today', label: 'Today' },
              { id: '30days', label: 'Last 30 Days' },
              { id: '90days', label: 'Last 90 Days' },
              { id: 'this_year', label: 'This Year' },
              { id: 'all', label: 'All Records' },
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDatePreset(preset.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  datePreset === preset.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Data Table Rendering */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            {/* 1. ASSET MASTER REPORT */}
            {activeReportKey === 'asset_master' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Asset ID</th>
                    <th className="py-3.5 px-4">Asset Name</th>
                    <th className="py-3.5 px-4">Category / Sub-Category</th>
                    <th className="py-3.5 px-4">Location Hierarchy</th>
                    <th className="py-3.5 px-4">Serial No</th>
                    <th className="py-3.5 px-4">Purchase Date</th>
                    <th className="py-3.5 px-4">Price</th>
                    <th className="py-3.5 px-4">Custodian / In-Charge</th>
                    <th className="py-3.5 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assetMasterData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No assets found matching filters.
                      </td>
                    </tr>
                  ) : (
                    assetMasterData.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">
                          <Link href={`/assets/${row.assetId}`} className="hover:underline">
                            {row.assetId}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <p className="font-semibold">{row.subCategory}</p>
                          <p className="text-[10px] text-slate-400">{row.category}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{row.location}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{row.serialNumber}</td>
                        <td className="py-3.5 px-4 text-slate-600">{formatDateDisplay(row.purchaseDate)}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{row.price}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">{row.assignedTo}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Operational'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 2. LOCATION WISE SUMMARY REPORT */}
            {activeReportKey === 'location_wise' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Campus</th>
                    <th className="py-3.5 px-4">Building / Block</th>
                    <th className="py-3.5 px-4">Total Floors</th>
                    <th className="py-3.5 px-4">Total Rooms</th>
                    <th className="py-3.5 px-4">Total Installed Assets</th>
                    <th className="py-3.5 px-4">Operational Assets</th>
                    <th className="py-3.5 px-4">Under Maintenance</th>
                    <th className="py-3.5 px-6 text-right">Open Service Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {locationWiseData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No locations found matching filters.
                      </td>
                    </tr>
                  ) : (
                    locationWiseData.map(row => (
                      <tr key={row.buildingId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-bold text-slate-900">{row.campusName}</td>
                        <td className="py-3.5 px-4 font-bold text-blue-600">{row.buildingName}</td>
                        <td className="py-3.5 px-4 text-slate-600">{row.totalFloors}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{row.totalRooms} Rooms</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.totalAssets} Assets</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">{row.operationalAssets}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-600">{row.underMaintAssets}</td>
                        <td className="py-3.5 px-6 text-right font-bold text-rose-600">{row.openServiceRequests}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 3. ROOM WISE ASSET REPORT */}
            {activeReportKey === 'room_wise' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Room ID</th>
                    <th className="py-3.5 px-4">Room Name &amp; No.</th>
                    <th className="py-3.5 px-4">Room Type</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4">Reservable</th>
                    <th className="py-3.5 px-4">Total Assets</th>
                    <th className="py-3.5 px-4">Operational</th>
                    <th className="py-3.5 px-6 text-right">Room Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomWiseData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No rooms found matching filters.
                      </td>
                    </tr>
                  ) : (
                    roomWiseData.map(row => (
                      <tr key={row.roomId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">
                          <Link href={`/organization/rooms/${row.roomNumber}`} className="hover:underline">
                            {row.roomNumber}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <p>{row.roomName}</p>
                          <p className="text-[10px] text-slate-400 font-normal">Room {row.roomNumber}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{row.roomType}</td>
                        <td className="py-3.5 px-4 text-slate-600">{row.campus} &gt; {row.building} ({row.floor})</td>
                        <td className="py-3.5 px-4 text-slate-600">{row.sizeSqft}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{row.isReservable}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.totalAssets}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">{row.operational}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Available'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 4. ROOM ACCESS REPORT */}
            {activeReportKey === 'room_access' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Log ID</th>
                    <th className="py-3.5 px-4">Room / Space</th>
                    <th className="py-3.5 px-4">Accessed By</th>
                    <th className="py-3.5 px-4">Check-In Time</th>
                    <th className="py-3.5 px-4">Check-Out Time</th>
                    <th className="py-3.5 px-4">Purpose</th>
                    <th className="py-3.5 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomAccessData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No access logs found in selected date range.
                      </td>
                    </tr>
                  ) : (
                    roomAccessData.map(row => (
                      <tr key={row.logId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.logId}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.roomName}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{row.userName}</p>
                          <p className="text-[10px] text-slate-400">{row.userRole}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{row.checkInTime}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{row.checkOutTime}</td>
                        <td className="py-3.5 px-4 text-slate-700">{row.purpose}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 5. WARRANTY & AMC REPORT */}
            {activeReportKey === 'warranty_amc' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Asset ID</th>
                    <th className="py-3.5 px-4">Asset Name</th>
                    <th className="py-3.5 px-4">Vendor / Maintenance Provider</th>
                    <th className="py-3.5 px-4">Purchase Date</th>
                    <th className="py-3.5 px-4">Warranty Expiry Date</th>
                    <th className="py-3.5 px-4">Days Left</th>
                    <th className="py-3.5 px-6 text-right">Coverage Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {warrantyAmcData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No warranty records found.
                      </td>
                    </tr>
                  ) : (
                    warrantyAmcData.map(row => (
                      <tr key={row.assetId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.assetId}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.assetName}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{row.vendorName}</td>
                        <td className="py-3.5 px-4 text-slate-600">{formatDateDisplay(row.purchaseDate)}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{row.warrantyExpiry}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">{row.daysLeft}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Active Cover'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.status === 'Expiring Soon'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 6. PREVENTIVE MAINTENANCE REPORT */}
            {activeReportKey === 'pm_maintenance' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Work Order ID</th>
                    <th className="py-3.5 px-4">Task Title</th>
                    <th className="py-3.5 px-4">Target Asset</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Frequency</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Assigned Technician</th>
                    <th className="py-3.5 px-4">Completion Date</th>
                    <th className="py-3.5 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pmData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No preventive maintenance records found for selected dates.
                      </td>
                    </tr>
                  ) : (
                    pmData.map(row => (
                      <tr key={row.woNumber} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.woNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.title}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-semibold">{row.assetName}</td>
                        <td className="py-3.5 px-4 text-slate-600">{row.location}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{row.frequency}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{formatDateDisplay(row.dueDate)}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-medium">{row.assignedTo}</td>
                        <td className="py-3.5 px-4 text-slate-600">{formatDateDisplay(row.completedAt)}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.status === 'In Progress'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 7. CORRECTIVE MAINTENANCE REPORT */}
            {activeReportKey === 'corrective_maintenance' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Work Order ID</th>
                    <th className="py-3.5 px-4">Target Asset</th>
                    <th className="py-3.5 px-4">Issue Reported</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Assigned Technician</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Resolution / Action Taken</th>
                    <th className="py-3.5 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {correctiveData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No corrective maintenance records found for selected dates.
                      </td>
                    </tr>
                  ) : (
                    correctiveData.map(row => (
                      <tr key={row.woNumber} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.woNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.assetName}</td>
                        <td className="py-3.5 px-4 text-slate-800">{row.issue}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.priority === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : row.priority === 'High'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-medium">{row.assignedTo}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{formatDateDisplay(row.dueDate)}</td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">{row.solution}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 8. INSPECTION REPORT */}
            {activeReportKey === 'inspections' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Inspection ID</th>
                    <th className="py-3.5 px-4">Target Asset</th>
                    <th className="py-3.5 px-4">Assigned Inspector</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Completion Date</th>
                    <th className="py-3.5 px-4">Outcome / Result</th>
                    <th className="py-3.5 px-4">Remarks</th>
                    <th className="py-3.5 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectionData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No inspection records found for selected dates.
                      </td>
                    </tr>
                  ) : (
                    inspectionData.map(row => (
                      <tr key={row.inspectionNumber} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.inspectionNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.assetName}</td>
                        <td className="py-3.5 px-4 text-slate-800 font-medium">{row.inspector}</td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{formatDateDisplay(row.dueDate)}</td>
                        <td className="py-3.5 px-4 text-slate-600">{formatDateDisplay(row.completedAt)}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.result === 'Pass'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.result === 'Fail'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {row.result}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">{row.remarks}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span className="font-semibold text-slate-700">{row.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 9. SERVICE REQUESTS REPORT */}
            {activeReportKey === 'service_requests' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Ticket ID</th>
                    <th className="py-3.5 px-4">Request Title</th>
                    <th className="py-3.5 px-4">Location / Asset</th>
                    <th className="py-3.5 px-4">Requested By</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Raised Date</th>
                    <th className="py-3.5 px-4">SLA Deadline</th>
                    <th className="py-3.5 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {serviceRequestData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No service requests found for selected dates.
                      </td>
                    </tr>
                  ) : (
                    serviceRequestData.map(row => (
                      <tr key={row.ticketId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.ticketId}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.title}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{row.location}</td>
                        <td className="py-3.5 px-4 text-slate-800">{row.requestedBy}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.priority === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : row.priority === 'High'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{formatDateDisplay(row.createdAt)}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">{formatDateDisplay(row.slaDueDate)}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'Resolved' || row.status === 'Closed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 10. TECHNICIAN WORKLOAD REPORT */}
            {activeReportKey === 'technician_workload' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Technician ID</th>
                    <th className="py-3.5 px-4">Technician Name</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Total Assigned Tasks</th>
                    <th className="py-3.5 px-4">Completed PMs</th>
                    <th className="py-3.5 px-4">Completed Breakdowns</th>
                    <th className="py-3.5 px-4">In-Progress Tasks</th>
                    <th className="py-3.5 px-6 text-right">Overdue Tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {technicianWorkloadData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No technician workload data available.
                      </td>
                    </tr>
                  ) : (
                    technicianWorkloadData.map(row => (
                      <tr key={row.techId} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.techId}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">{row.department}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.totalAssigned}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">{row.completedPMs}</td>
                        <td className="py-3.5 px-4 font-bold text-blue-600">{row.completedCorrective}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-600">{row.inProgress}</td>
                        <td className="py-3.5 px-6 text-right font-bold text-rose-600">{row.overdue}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 11. INVENTORY & SPARES REPORT */}
            {activeReportKey === 'inventory_spares' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/60 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Item Code</th>
                    <th className="py-3.5 px-4">Spare Item Name</th>
                    <th className="py-3.5 px-4">Category / Sub-Category</th>
                    <th className="py-3.5 px-4">Quantity In Stock</th>
                    <th className="py-3.5 px-4">Unit Price</th>
                    <th className="py-3.5 px-4">Total Valuation</th>
                    <th className="py-3.5 px-4">Supplier</th>
                    <th className="py-3.5 px-6 text-right">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryReportData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No inventory spare records found.
                      </td>
                    </tr>
                  ) : (
                    inventoryReportData.map(row => (
                      <tr key={row.inventoryNumber} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{row.inventoryNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <p className="font-semibold">{row.subCategory}</p>
                          <p className="text-[10px] text-slate-400">{row.category}</p>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.quantity} units</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">{row.unitPrice}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">{row.totalValuation}</td>
                        <td className="py-3.5 px-4 text-slate-600">{row.vendor}</td>
                        <td className="py-3.5 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.status === 'In Stock'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.status === 'Low Stock'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
