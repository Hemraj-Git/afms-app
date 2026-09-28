import { useMemo } from 'react'
import { useAssets } from './assets'
import { useBuildings } from './buildings'
import { useCampuses } from './campuses'
import { useCategories } from './categories'
import { useInspections } from './inspections'
import { useInventoryItems } from './inventory'
import { useRoomAccessLogs, withRoomNames } from './roomAccessLogs'
import { useRooms } from './rooms'
import { useServiceRequests, withRequesterRoles } from './serviceRequests'
import { useSubCategories } from './subCategories'
import { useUsers } from './users'
import { useVendors } from './vendors'
import { useWorkOrders } from './workOrders'

// The Reports page reads the query cache directly rather than through
// AFMSContext. The keys are the ones the context uses, so this shares its cache
// and costs no extra requests; what it adds is per-list status, so a report can
// be refreshed on its own and show when its data was last read.

export type ReportSource =
  | 'assets'
  | 'campuses'
  | 'buildings'
  | 'rooms'
  | 'categories'
  | 'subCategories'
  | 'vendors'
  | 'workOrders'
  | 'inspections'
  | 'serviceRequests'
  | 'roomAccessLogs'
  | 'inventoryItems'
  | 'users'

interface SourceStatus {
  isFetching: boolean
  dataUpdatedAt: number
  // On failure the query keeps its last data and the result says isError.
  refetch: () => Promise<{ isError: boolean }>
}

export function useReportData(userId: string, enabled: boolean) {
  const assets = useAssets(userId, enabled)
  const campuses = useCampuses(userId, enabled)
  const buildings = useBuildings(userId, enabled)
  const rooms = useRooms(userId, enabled)
  const categories = useCategories(userId, enabled)
  const subCategories = useSubCategories(userId, enabled)
  const vendors = useVendors(userId, enabled)
  const workOrders = useWorkOrders(userId, enabled)
  const inspections = useInspections(userId, enabled)
  const serviceRequests = useServiceRequests(userId, enabled)
  const roomAccessLogs = useRoomAccessLogs(userId, enabled)
  const inventoryItems = useInventoryItems(userId, enabled)
  const users = useUsers(userId, enabled)

  // The same display fixes the context applies (see withRoomNames / withRequesterRoles).
  const logsWithRooms = useMemo(
    () => withRoomNames(roomAccessLogs.roomAccessLogs, rooms.rooms),
    [roomAccessLogs.roomAccessLogs, rooms.rooms]
  )
  const requestsWithRoles = useMemo(
    () => withRequesterRoles(serviceRequests.serviceRequests, users.users),
    [serviceRequests.serviceRequests, users.users]
  )

  const sources: Record<ReportSource, SourceStatus> = {
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
  }

  return {
    assets: assets.assets,
    campuses: campuses.campuses,
    buildings: buildings.buildings,
    rooms: rooms.rooms,
    categories: categories.categories,
    subCategories: subCategories.subCategories,
    vendors: vendors.vendors,
    workOrders: workOrders.workOrders,
    inspections: inspections.inspections,
    serviceRequests: requestsWithRoles,
    roomAccessLogs: logsWithRooms,
    inventoryItems: inventoryItems.inventoryItems,
    users: users.users,
    sources,
  }
}

// Whether any of `names` is being read now, and when the oldest of them was last
// read (0 if one has never loaded).
export function sourceStatus(sources: Record<ReportSource, SourceStatus>, names: readonly ReportSource[]) {
  const picked = names.map(n => sources[n])
  return {
    isFetching: picked.some(s => s.isFetching),
    updatedAt: picked.length ? Math.min(...picked.map(s => s.dataUpdatedAt)) : 0,
    refetch: () => Promise.all(picked.map(s => s.refetch())),
  }
}
