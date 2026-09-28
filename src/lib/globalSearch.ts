import type {
  Asset,
  Inspection,
  InventoryItem,
  OutsideRepair,
  Room,
  ServiceRequest,
  UserProfile,
  Vendor,
  WorkOrder,
} from '@/types/afms'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { repairItemLabel } from '@/lib/outsideRepairState'

// The header search (Ctrl+K): finds records across the lists the app already
// holds in memory, so it only ever sees what this user can already see. Pure
// matching and ranking live here; GlobalSearch.tsx is the dialog around it.

export type SearchKind =
  | 'asset'
  | 'workOrder'
  | 'request'
  | 'inspection'
  | 'outsideRepair'
  | 'room'
  | 'inventory'
  | 'vendor'
  | 'user'

export interface SearchHit {
  kind: SearchKind
  id: string
  title: string
  subtitle?: string
  href: string
  score: number
}

export interface SearchGroup {
  kind: SearchKind
  label: string
  hits: SearchHit[]
  // Matches in this group before the per-group cut.
  total: number
}

export interface SearchData {
  assets?: Asset[]
  workOrders?: WorkOrder[]
  serviceRequests?: ServiceRequest[]
  inspections?: Inspection[]
  outsideRepairs?: OutsideRepair[]
  rooms?: Room[]
  inventoryItems?: InventoryItem[]
  vendors?: Vendor[]
  users?: UserProfile[]
}

export const GROUP_LABELS: Record<SearchKind, string> = {
  asset: 'Assets',
  workOrder: 'Work orders',
  request: 'Service requests',
  inspection: 'Inspections',
  outsideRepair: 'Outside repairs',
  room: 'Rooms',
  inventory: 'Inventory',
  vendor: 'Vendors',
  user: 'Users',
}

// Order the groups appear in when their best scores tie.
const GROUP_ORDER: SearchKind[] = [
  'asset',
  'workOrder',
  'request',
  'inspection',
  'outsideRepair',
  'room',
  'inventory',
  'vendor',
  'user',
]

export const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim()

// How well one search word matches one field: whole field, start of the field,
// start of a word in it, anywhere in it; 0 = not at all.
function termScore(term: string, field: string): number {
  if (!field) return 0
  if (field === term) return 100
  if (field.startsWith(term)) return 80
  const at = field.indexOf(term)
  if (at === -1) return 0
  return /[\s\-_/.(#:]/.test(field[at - 1]) ? 60 : 40
}

// Every word of the query must match some field. Earlier fields are the
// identifying ones (numbers, names), so a match there counts a little more.
// Returns 0 when the record does not match.
export function scoreRecord(query: string, fields: (string | undefined | null)[]): number {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return 0
  const norm = fields.map(f => (f ? normalize(f) : ''))
  let total = 0
  for (const term of terms) {
    let best = 0
    norm.forEach((f, i) => {
      const s = termScore(term, f)
      if (s > 0) best = Math.max(best, s - i)
    })
    if (best === 0) return 0
    total += best
  }
  return total / terms.length
}

const q = encodeURIComponent

export function globalSearch(query: string, data: SearchData, perGroup = 5): SearchGroup[] {
  if (!normalize(query)) return []

  const assetById = new Map((data.assets ?? []).map(a => [a.id, a]))
  const roomById = new Map((data.rooms ?? []).map(r => [r.id, r]))
  const hits: SearchHit[] = []
  const add = (hit: Omit<SearchHit, 'score'>, fields: (string | undefined | null)[]) => {
    const score = scoreRecord(query, fields)
    if (score > 0) hits.push({ ...hit, score })
  }

  for (const a of data.assets ?? []) {
    const room = roomById.get(a.roomId)
    add(
      {
        kind: 'asset',
        id: a.id,
        title: a.name,
        subtitle: [a.assetId, room?.name, a.status].filter(Boolean).join(' · '),
        href: `/assets/${a.assetId || a.id}`,
      },
      [a.assetId, a.name, a.serialNumber, a.modelNumber, a.manufacturer]
    )
  }

  for (const w of data.workOrders ?? []) {
    const asset = w.assetId ? assetById.get(w.assetId) : undefined
    const pending = isPendingWorkOrder(w.woNumber)
    add(
      {
        kind: 'workOrder',
        id: w.id,
        title: pending ? `${w.title || `${w.type} work order`} (pending assignment)` : `${w.woNumber} · ${w.title || `${w.type} work order`}`,
        subtitle: [w.type, w.status, asset?.name].filter(Boolean).join(' · '),
        // A not-yet-assigned order has no number and lives in its type's queue.
        href: pending
          ? `/maintenance/${w.type === 'Preventive' ? 'preventive' : w.type === 'Housekeeping' ? 'housekeeping' : 'corrective'}`
          : `/maintenance/work-orders?q=${q(w.woNumber)}`,
      },
      [pending ? '' : w.woNumber, w.title, asset?.name, w.assignedTechnicianName, w.sourceRefId]
    )
  }

  for (const r of data.serviceRequests ?? []) {
    add(
      {
        kind: 'request',
        id: r.id,
        title: `${r.ticketId} · ${r.title}`,
        subtitle: [r.status, r.priority, r.requestedBy].filter(Boolean).join(' · '),
        href: `/service-requests?q=${q(r.ticketId)}`,
      },
      [r.ticketId, r.title, r.requestedBy, r.workOrderNumber]
    )
  }

  for (const i of data.inspections ?? []) {
    const asset = assetById.get(i.assetId)
    add(
      {
        kind: 'inspection',
        id: i.id,
        title: `${i.inspectionNumber} · ${asset?.name || 'Asset'}`,
        subtitle: [i.status === 'Completed' ? i.result : i.status, i.assignedInspectorName].filter(Boolean).join(' · '),
        href: `/inspections?q=${q(i.inspectionNumber)}`,
      },
      [i.inspectionNumber, asset?.name, asset?.assetId, i.assignedInspectorName]
    )
  }

  for (const o of data.outsideRepairs ?? []) {
    const asset = o.assetId ? assetById.get(o.assetId) : undefined
    add(
      {
        kind: 'outsideRepair',
        id: o.id,
        title: `${o.repairNumber} · ${repairItemLabel(o)}`,
        subtitle: [o.status, asset?.name].filter(Boolean).join(' · '),
        href: `/maintenance/outside-repairs?q=${q(o.repairNumber)}`,
      },
      [o.repairNumber, repairItemLabel(o), asset?.name, o.dispatchRef, o.vendorRef]
    )
  }

  for (const r of data.rooms ?? []) {
    add(
      {
        kind: 'room',
        id: r.id,
        title: r.name,
        subtitle: [`Room ${r.roomNumber}`, r.type, r.status].filter(Boolean).join(' · '),
        href: `/organization/rooms/${r.roomNumber || r.id}`,
      },
      [r.roomNumber, r.name, r.type]
    )
  }

  for (const it of data.inventoryItems ?? []) {
    add(
      {
        kind: 'inventory',
        id: it.id,
        title: it.name,
        subtitle: [it.inventoryNumber, `${it.quantity} ${it.unit || 'Units'}`].filter(Boolean).join(' · '),
        href: `/inventory/${it.id}`,
      },
      [it.inventoryNumber, it.name, it.serialNumber, it.modelNumber, it.manufacturer]
    )
  }

  for (const v of data.vendors ?? []) {
    add(
      {
        kind: 'vendor',
        id: v.id,
        title: v.name,
        subtitle: [v.code, v.categorySupplied, v.contactPerson].filter(Boolean).join(' · '),
        href: `/utility/vendors?q=${q(v.name)}`,
      },
      [v.code, v.name, v.contactPerson, v.phone, v.email]
    )
  }

  for (const u of data.users ?? []) {
    if (u.role === 'Guest') continue
    add(
      {
        kind: 'user',
        id: u.id,
        title: u.fullName,
        subtitle: [u.role, u.department, u.email].filter(Boolean).join(' · '),
        href: `/admin/users?q=${q(u.email || u.fullName)}`,
      },
      [u.fullName, u.email, u.phone, u.department]
    )
  }

  const groups: SearchGroup[] = []
  for (const kind of GROUP_ORDER) {
    const inKind = hits
      .filter(h => h.kind === kind)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    if (inKind.length) groups.push({ kind, label: GROUP_LABELS[kind], hits: inKind.slice(0, perGroup), total: inKind.length })
  }
  // The group holding the best match comes first; ties keep the order above.
  return groups.sort((a, b) => b.hits[0].score - a.hits[0].score)
}

// The results in the order the arrow keys walk through them.
export const flattenHits = (groups: SearchGroup[]) => groups.flatMap(g => g.hits)
