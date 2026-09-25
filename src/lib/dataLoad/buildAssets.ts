import { addIntervalToDate, formatId, formatYearlyId, getNextSequence, makePendingWoNumber } from '@/lib/idGenerator'
import { getLocalDateStr } from '@/lib/dateUtils'
import type { TableInsert } from '@/lib/supabase/typed'
import type { AssetInput, AssetsContext } from './validateAssets'

// The same follow-on records the app creates when an asset is added (see
// AFMSContext.addBulkAssets): the asset with its AST-#### number and QR link, one
// preventive work order per maintenance template and one inspection per inspection
// template of its sub-category, and an "Asset Created" history entry.

export interface TemplateForScheduling {
  id: string
  title: string
  interval: string | null
  items: unknown
}

export interface AssetsPlan {
  assets: TableInsert<'assets'>[]
  work_orders: TableInsert<'work_orders'>[]
  inspections: TableInsert<'inspections'>[]
  asset_activity_logs: TableInsert<'asset_activity_logs'>[]
}

export const ASSET_TABLE_ORDER = ['assets', 'work_orders', 'inspections', 'asset_activity_logs'] as const

type Json = TableInsert<'assets'>['dynamic_specifications']

export function buildAssets(
  inputs: AssetInput[],
  ctx: Pick<AssetsContext, 'subCategories'>,
  templates: TemplateForScheduling[],
  existing: { assetIds: string[]; inspectionNumbers: string[] },
  newId: () => string,
  now: Date = new Date()
): AssetsPlan {
  const today = getLocalDateStr(now)
  const iso = now.toISOString()
  const subById = new Map(ctx.subCategories.map(s => [s.id, s]))
  const templateById = new Map(templates.map(t => [t.id, t]))

  let astSeq = getNextSequence(existing.assetIds, 'AST')
  let inspSeq = getNextSequence(existing.inspectionNumbers, 'INSP')

  const plan: AssetsPlan = { assets: [], work_orders: [], inspections: [], asset_activity_logs: [] }

  for (const a of inputs) {
    const id = newId()
    const assetId = formatId('AST', astSeq++)
    plan.assets.push({
      id,
      asset_id: assetId,
      name: a.name,
      sub_category_id: a.subCategoryId,
      room_id: a.roomId || null,
      manufacturer: a.manufacturer || null,
      model_number: a.model || null,
      serial_number: a.serial || null,
      price: a.price || null,
      installation_date: a.installDate || a.purchaseDate || today,
      last_serviced_date: a.lastServiced || null,
      purchase_date: a.purchaseDate || null,
      warranty_till: a.warrantyTill || null,
      maintenance_by: a.maintainedBy,
      purchase_vendor_id: a.purchaseVendorId || null,
      maintenance_vendor_id: a.maintenanceVendorId || null,
      amc_start_date: a.amcStart || null,
      amc_end_date: a.amcEnd || null,
      assigned_to_user_id: null,
      assigned_to_user_name: null,
      image_url: '/images/asset-placeholder.png',
      notes: a.notes || null,
      status: a.status,
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-${assetId}`,
      dynamic_specifications: a.specs as unknown as Json,
      sla_priority: a.slaPriority,
      created_at: iso,
    })

    const sub = subById.get(a.subCategoryId)
    if (sub) {
      // The first cycle is anchored on the last service date, or today: never on a
      // backdated installation date, which would show the first cycle as already overdue.
      const anchor = a.lastServiced || today

      for (const tid of Array.from(new Set(sub.pmTemplateIds)).filter(Boolean)) {
        const t = templateById.get(tid)
        if (!t) continue
        const interval = t.interval || 'Quarterly'
        const woId = newId()
        plan.work_orders.push({
          id: woId,
          wo_number: makePendingWoNumber(woId),
          title: `${t.title} (${interval})`,
          type: 'Preventive',
          asset_id: id,
          room_id: null,
          priority: 'Medium',
          frequency: interval,
          source: 'Scheduled',
          source_ref_id: null,
          due_date: addIntervalToDate(anchor, interval),
          assigned_technician_id: null,
          assigned_technician_name: null,
          status: 'Scheduled',
          checklist_template_id: tid,
          checklist_snapshot: (t.items ?? []) as Json,
          created_at: iso,
        })
      }

      for (const tid of Array.from(new Set(sub.inspectionTemplateIds)).filter(Boolean)) {
        const t = templateById.get(tid)
        if (!t) continue
        const interval = t.interval || 'Quarterly'
        plan.inspections.push({
          id: newId(),
          // The database re-numbers this on insert; the value only has to be unique-looking.
          inspection_number: formatYearlyId('INSP', inspSeq++, now.getFullYear()),
          asset_id: id,
          template_id: tid,
          template_version: 1,
          due_date: addIntervalToDate(anchor, interval),
          status: 'Scheduled',
          result: null,
          remarks: null,
          checklist_snapshot: (t.items ?? []) as Json,
          checklist_responses: {} as Json,
          conducted_by: null,
          conducted_by_user_id: null,
          conducted_at: null,
          created_at: iso,
        })
      }
    }

    plan.asset_activity_logs.push({
      id: newId(),
      asset_id: id,
      by_user: 'Data load',
      action: 'Asset Created',
      remarks: `Asset ${a.name} registered via data load under ID ${assetId}.`,
      reference_id: null,
      source: 'Bulk Import',
      timestamp: now.toLocaleString(),
      timestamp_epoch: now.getTime(),
    })
  }
  return plan
}
