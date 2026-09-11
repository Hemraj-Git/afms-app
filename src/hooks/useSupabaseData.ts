'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Department,
  Campus,
  Building,
  Room,
  Category,
  SubCategory,
  Asset,
  WorkOrder,
  Inspection,
  UserProfile,
} from '@/types/afms'

// -------------------------------------------------------------
// Departments
// -------------------------------------------------------------
export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return (data || []).map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description || '',
        createdAt: d.created_at,
      }))
    },
  })
}

export function useAddDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dept: Omit<Department, 'id'>) => {
      const { data, error } = await supabase
        .from('departments')
        .insert([{
          id: `DEP-${Date.now().toString().slice(-4)}`,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}

// -------------------------------------------------------------
// Campuses & Buildings
// -------------------------------------------------------------
export function useCampuses() {
  return useQuery<Campus[]>({
    queryKey: ['campuses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campuses').select('*').order('name')
      if (error) throw error
      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        address: c.address || '',
      }))
    },
  })
}

export function useBuildings() {
  return useQuery<Building[]>({
    queryKey: ['buildings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('buildings').select('*').order('name')
      if (error) throw error
      return (data || []).map(b => ({
        id: b.id,
        campusId: b.campus_id,
        name: b.name,
        code: b.code,
        totalFloors: b.total_floors || 1,
      }))
    },
  })
}

// -------------------------------------------------------------
// Rooms
// -------------------------------------------------------------
export function useRooms() {
  return useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true })
      if (error) throw error
      return (data || []).map(r => ({
        id: r.id,
        buildingId: r.building_id,
        name: r.name,
        roomNumber: r.room_number,
        type: r.type || 'General',
        isReservable: Boolean(r.is_reservable),
        qrCodeKey: r.qr_code_key || `ROOM-${r.room_number}`,
        status: (r.status as Room['status']) || 'Available',
        currentOccupant: r.current_occupant_id,
      }))
    },
  })
}

export function useAddRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (room: Omit<Room, 'id'>) => {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{
          building_id: room.buildingId,
          name: room.name,
          room_number: room.roomNumber,
          type: room.type,
          is_reservable: room.isReservable,
          qr_code_key: room.qrCodeKey || `ROOM-${room.roomNumber}`,
          status: room.status || 'Available',
          created_at: new Date().toISOString(),
        }])
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

// -------------------------------------------------------------
// Categories & SubCategories
// -------------------------------------------------------------
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description || '',
      }))
    },
  })
}

export function useSubCategories() {
  return useQuery<SubCategory[]>({
    queryKey: ['sub_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sub_categories').select('*').order('name')
      if (error) throw error
      return (data || []).map(s => ({
        id: s.id,
        categoryId: s.category_id,
        name: s.name,
        code: s.code,
        description: s.description || '',
        metadataFields: s.metadata_fields || [],
      }))
    },
  })
}

// -------------------------------------------------------------
// Assets
// -------------------------------------------------------------
export function useAssets() {
  return useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map(a => ({
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
        qrCodeUrl: a.qr_code_url || a.asset_id,
        dynamicSpecifications: a.dynamic_specifications || {},
        createdAt: a.created_at,
      }))
    },
  })
}

export function useAddAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (asset: Partial<Asset>) => {
      const { data, error } = await supabase
        .from('assets')
        .insert([{
          asset_id: asset.assetId,
          name: asset.name,
          sub_category_id: asset.subCategoryId,
          room_id: asset.roomId,
          manufacturer: asset.manufacturer,
          model_number: asset.modelNumber,
          serial_number: asset.serialNumber,
          price: asset.price,
          installation_date: asset.installationDate || new Date().toISOString().slice(0, 10),
          purchase_date: asset.purchaseDate,
          warranty_till: asset.warrantyTill,
          maintenance_by: asset.maintenanceBy || 'In House',
          status: asset.status || 'Operational',
          qr_code_url: asset.qrCodeUrl || asset.assetId,
          dynamic_specifications: asset.dynamicSpecifications || {},
          created_at: new Date().toISOString(),
        }])
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}

// -------------------------------------------------------------
// Work Orders
// -------------------------------------------------------------
export function useWorkOrders() {
  return useQuery<WorkOrder[]>({
    queryKey: ['work_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map(w => ({
        id: w.id,
        woNumber: w.wo_number,
        type: w.type as WorkOrder['type'],
        assetId: w.asset_id,
        source: w.source || 'Scheduled',
        dueDate: w.due_date,
        assignedTechnicianId: w.assigned_technician_id,
        status: w.status as WorkOrder['status'],
        checklistTemplateId: w.checklist_template_id,
        issueLogged: w.issue_logged,
        solutionTaken: w.solution_taken,
        technicianRemarks: w.technician_remarks,
        createdAt: w.created_at,
        completedAt: w.completed_at,
      }))
    },
  })
}

// -------------------------------------------------------------
// User Profiles
// -------------------------------------------------------------
export function useProfiles() {
  return useQuery<UserProfile[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*')
      if (error) throw error
      return (data || []).map(p => ({
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        role: p.role,
        department: p.department,
        phone: p.phone,
      }))
    },
  })
}
