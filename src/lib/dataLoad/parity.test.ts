// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/typed', () => ({ db: { from: () => ({}) } }))
vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }))

import { assetActivityLogToInsert, mapAssetActivityLogRow } from '@/lib/queries/assetActivityLogs'
import { assetToInsert, mapAssetRow } from '@/lib/queries/assets'
import { buildingToInsert, mapBuildingRow } from '@/lib/queries/buildings'
import { campusToInsert, mapCampusRow } from '@/lib/queries/campuses'
import { categoryToInsert, mapCategoryRow } from '@/lib/queries/categories'
import { checklistTemplateToInsert, mapChecklistTemplateRow } from '@/lib/queries/checklistTemplates'
import { inspectionToInsert, mapInspectionRow } from '@/lib/queries/inspections'
import { mapRoomRow, roomToInsert } from '@/lib/queries/rooms'
import { mapSubCategoryRow, subCategoryToInsert } from '@/lib/queries/subCategories'
import { mapVendorRow, vendorToInsert } from '@/lib/queries/vendors'
import { mapWorkOrderRow, workOrderToInsert } from '@/lib/queries/workOrders'
import { buildAssets } from './buildAssets'
import { buildMasters, emptyMastersSnapshot } from './buildMasters'
import { counterIds } from './testHelpers'
import type { AssetInput, AssetsContext } from './validateAssets'
import type { MastersData } from './validateMasters'

// The loader builds database rows itself (the app's query modules are built for the
// browser). These tests feed every row it makes through the app's own row -> object ->
// row mappers: if the app would write any column differently -- a renamed column, a
// different default, a value it would drop -- the round trip no longer matches and the
// test fails. Columns that change on every write are left out.
const VOLATILE = ['created_at', 'updated_at', 'timestamp', 'timestamp_epoch']

function expectParity(
  label: string,
  rows: object[],
  roundTrip: (row: never) => object,
  ignore: string[] = []
) {
  expect(rows.length, `${label}: nothing to compare`).toBeGreaterThan(0)
  for (const row of rows as Record<string, unknown>[]) {
    const back = roundTrip(row as never) as Record<string, unknown>
    for (const key of Object.keys(row)) {
      if (VOLATILE.includes(key) || ignore.includes(key)) continue
      expect(back[key], `${label}.${key}`).toEqual(row[key])
    }
  }
}

const masters: MastersData = {
  campuses: [{ row: 2, name: 'Main Campus', address: '1 Marine Road' }],
  buildings: [{ row: 2, name: 'Block A', campus: 'Main Campus', label: 'Main Campus / Block A', totalFloors: 3 }],
  rooms: [
    { row: 2, name: 'Lab 1', building: 'Main Campus / Block A', label: 'Main Campus / Block A / Lab 1', type: 'Laboratory', floor: '1', sizeSqft: 450, reservable: true },
    { row: 3, name: 'Store', building: 'Main Campus / Block A', label: 'Main Campus / Block A / Store', type: '', floor: '', reservable: false },
  ],
  vendors: [
    { row: 2, name: 'Cool Air', categorySupplied: 'HVAC', contactPerson: 'Ravi', email: 'r@x.test', phone: '99', address: 'Kochi', hasAmc: true, amcContractNo: 'A1', amcStart: '2026-01-01', amcEnd: '2026-12-31' },
    { row: 3, name: 'Plain Vendor', categorySupplied: '', contactPerson: '', email: '', phone: '', address: '', hasAmc: false, amcContractNo: '' },
  ],
  categories: [{ row: 2, name: 'Electrical', description: 'Wiring' }],
  subCategories: [{
    row: 2, name: 'Light', category: 'Electrical', label: 'Electrical / Light', description: 'Lights',
    pmTemplates: ['Light quarterly'], inspTemplates: ['Light check'],
    fields: [{ key: 'field_wattage', label: 'Wattage', type: 'Number', unit: 'W', required: true, order: 1 }, { key: 'field_finish', label: 'Finish', type: 'Text', required: false, order: 2 }],
  }],
  pmTemplates: [{ row: 2, title: 'Light quarterly', frequency: 'Quarterly', description: 'Clean', steps: [{ row: 2, stepNo: 1, task: 'Clean', instructions: 'Power off', mandatory: true, photoRequired: true }, { row: 3, stepNo: 2, task: 'Test', instructions: '', mandatory: false, photoRequired: false }] }],
  inspTemplates: [{ row: 2, title: 'Light check', frequency: 'Monthly', description: '', steps: [{ row: 2, stepNo: 1, task: 'Works?', instructions: '', mandatory: true, photoRequired: false }] }],
}

describe('masters rows match what the app writes', () => {
  const { rows } = buildMasters(masters, emptyMastersSnapshot(), counterIds())

  it('campuses, buildings, rooms, vendors, categories', () => {
    expectParity('campuses', rows.campuses, r => campusToInsert(mapCampusRow(r)))
    expectParity('buildings', rows.buildings, r => buildingToInsert(mapBuildingRow(r)))
    expectParity('rooms', rows.rooms, r => roomToInsert(mapRoomRow(r)))
    expectParity('vendors', rows.vendors, r => vendorToInsert(mapVendorRow(r)))
    expectParity('categories', rows.categories, r => categoryToInsert(mapCategoryRow(r)))
  })

  it('templates and sub-categories, including their JSON columns', () => {
    expectParity('templates', rows.checklist_templates, r => checklistTemplateToInsert(mapChecklistTemplateRow(r)))
    expectParity('sub_categories', rows.sub_categories, r => subCategoryToInsert(mapSubCategoryRow(r)))
  })
})

describe('asset rows match what the app writes', () => {
  const ctx: Pick<AssetsContext, 'subCategories'> = {
    subCategories: [{
      id: 'sub-1', code: 'ELEC-LIGH', name: 'Light', categoryName: 'Electrical', fields: [],
      pmTemplateIds: ['t-pm'], inspectionTemplateIds: ['t-in'],
    }],
  }
  const templates = [
    { id: 't-pm', title: 'Light quarterly', interval: 'Quarterly', items: [{ id: 'ci-1', order: 1, itemText: 'Clean', responseType: 'Checkbox', mandatory: true, photoRequired: false }] },
    { id: 't-in', title: 'Light check', interval: 'Monthly', items: [{ id: 'ci-1', order: 1, itemText: 'Works?', responseType: 'Pass-Fail', mandatory: true, photoRequired: false }] },
  ]
  const full: AssetInput = {
    sheet: 'Light', row: 2, subCategoryId: 'sub-1', name: 'Tube light 1', roomId: 'r-1', slaPriority: 'High',
    manufacturer: 'Philips', model: 'TL-1', serial: 'SN-1', price: 1200, purchaseDate: '2024-01-10', installDate: '2024-01-20',
    warrantyTill: '2027-01-20', lastServiced: '2026-06-15', status: 'Operational', maintainedBy: 'Vendor',
    maintenanceVendorId: 'v-1', purchaseVendorId: 'v-1', amcStart: '2026-01-01', amcEnd: '2026-12-31', notes: 'Near window',
    specs: { field_wattage: '36' },
  }
  const sparse: AssetInput = {
    sheet: 'Light', row: 3, subCategoryId: 'sub-1', name: 'Tube light 2', roomId: 'r-2', slaPriority: 'Low',
    status: 'In Storage', maintainedBy: 'In House', specs: {},
  }
  const plan = buildAssets([full, sparse], ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), new Date(2026, 8, 25))

  it('assets (the SLA priority is new, so the app does not know that column yet)', () => {
    expectParity('assets', plan.assets, r => assetToInsert(mapAssetRow(r)), ['sla_priority'])
    expect(plan.assets.map(a => a.sla_priority)).toEqual(['High', 'Low'])
  })

  it('preventive work orders, inspections and history entries', () => {
    expectParity('work_orders', plan.work_orders, r => workOrderToInsert(mapWorkOrderRow(r)))
    expectParity('inspections', plan.inspections, r => inspectionToInsert(mapInspectionRow(r)))
    expectParity('asset_activity_logs', plan.asset_activity_logs, r => assetActivityLogToInsert(mapAssetActivityLogRow(r)))
  })
})
