import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAFMS } from '@/context/AFMSContext'
import {
  Campus,
  Building,
  Room,
  Category,
  SubCategory,
  Asset,
  ServiceRequest,
  WorkOrder,
  Inspection,
  UserProfile,
} from '@/types/afms'

// Query Keys Constant
export const QUERY_KEYS = {
  campuses: ['campuses'] as const,
  buildings: ['buildings'] as const,
  rooms: ['rooms'] as const,
  room: (id: string) => ['rooms', id] as const,
  categories: ['categories'] as const,
  subCategories: ['subCategories'] as const,
  assets: ['assets'] as const,
  asset: (id: string) => ['assets', id] as const,
  serviceRequests: ['serviceRequests'] as const,
  workOrders: ['workOrders'] as const,
  inspections: ['inspections'] as const,
  users: ['users'] as const,
  currentUser: ['currentUser'] as const,
}

// 1. Campuses Query & Mutations
export function useCampuses() {
  const { campuses, addCampus, updateCampus, deleteCampus } = useAFMS()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEYS.campuses,
    queryFn: async () => campuses,
    initialData: campuses,
  })

  const addMutation = useMutation({
    mutationFn: async (data: Omit<Campus, 'id' | 'code'>) => addCampus(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campuses }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Campus> }) => updateCampus(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campuses }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteCampus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campuses }),
  })

  return {
    ...query,
    data: campuses, // Fallback reactive state
    addCampus: addMutation.mutateAsync,
    updateCampus: updateMutation.mutateAsync,
    deleteCampus: deleteMutation.mutateAsync,
  }
}

// 2. Buildings Query & Mutations
export function useBuildings() {
  const { buildings, addBuilding, updateBuilding, deleteBuilding } = useAFMS()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEYS.buildings,
    queryFn: async () => buildings,
    initialData: buildings,
  })

  const addMutation = useMutation({
    mutationFn: async (data: Omit<Building, 'id' | 'code'>) => addBuilding(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.buildings }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Building> }) => updateBuilding(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.buildings }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteBuilding(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.buildings }),
  })

  return {
    ...query,
    data: buildings,
    addBuilding: addMutation.mutateAsync,
    updateBuilding: updateMutation.mutateAsync,
    deleteBuilding: deleteMutation.mutateAsync,
  }
}

// 3. Rooms Query & Mutations
export function useRooms() {
  const { rooms, addRoom, updateRoom, deleteRoom } = useAFMS()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEYS.rooms,
    queryFn: async () => rooms,
    initialData: rooms,
  })

  const addMutation = useMutation({
    mutationFn: async (data: Omit<Room, 'id' | 'roomNumber' | 'qrCodeKey'>) => addRoom(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rooms }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Room> }) => updateRoom(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rooms }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteRoom(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rooms }),
  })

  return {
    ...query,
    data: rooms,
    addRoom: addMutation.mutateAsync,
    updateRoom: updateMutation.mutateAsync,
    deleteRoom: deleteMutation.mutateAsync,
  }
}

// 4. Assets Query & Mutations
export function useAssets() {
  const { assets, addAsset, updateAssetStatus } = useAFMS()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEYS.assets,
    queryFn: async () => assets,
    initialData: assets,
  })

  const addMutation = useMutation({
    mutationFn: async (data: Omit<Asset, 'id' | 'assetId' | 'createdAt'>) => addAsset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assets })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workOrders })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inspections })
    },
  })

  return {
    ...query,
    data: assets,
    addAsset: addMutation.mutateAsync,
    updateAssetStatus,
  }
}

// 5. Service Requests Query & Mutations
export function useServiceRequests() {
  const { serviceRequests, addServiceRequest, updateServiceRequestStatus } = useAFMS()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: QUERY_KEYS.serviceRequests,
    queryFn: async () => serviceRequests,
    initialData: serviceRequests,
  })

  const addMutation = useMutation({
    mutationFn: async (data: Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>) => addServiceRequest(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceRequests }),
  })

  return {
    ...query,
    data: serviceRequests,
    addServiceRequest: addMutation.mutateAsync,
    updateServiceRequestStatus,
  }
}
