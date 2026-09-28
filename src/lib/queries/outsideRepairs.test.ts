// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/typed', () => ({ db: { from: () => ({}) } }))
vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }))

import { mapOutsideRepairRow, outsideRepairToInsert, outsideRepairToUpdate } from './outsideRepairs'
import type { TableRow } from '@/lib/supabase/typed'

const row: TableRow<'outside_repairs'> = {
  id: 'r1', repair_number: 'OSR-2026-0001', work_order_id: 'wo1', asset_id: 'a1', scope: 'Component',
  component_name: 'Motherboard', fault_description: 'No POST', sent_by: 'Vendor', vendor_id: 'v1',
  sent_date: '2026-09-20', expected_return_date: '2026-10-05', dispatch_ref: 'GP-12', vendor_ref: null,
  estimated_cost: 2500, dispatch_photo_url: null, status: 'Out for Repair', returned_date: null, outcome: null,
  actual_cost: null, return_remarks: null, return_photo_url: null, recorded_by: 'Mack', returned_by: null,
  overdue_notified_at: null, created_at: '2026-09-20T05:00:00Z', updated_at: '2026-09-20T05:00:00Z',
}

describe('outside repair mapping', () => {
  it('maps a row, nulls becoming absent', () => {
    expect(mapOutsideRepairRow(row)).toMatchObject({
      repairNumber: 'OSR-2026-0001', workOrderId: 'wo1', scope: 'Component', componentName: 'Motherboard',
      sentBy: 'Vendor', estimatedCost: 2500, status: 'Out for Repair', vendorRef: undefined, returnedDate: undefined,
    })
  })

  it('writes back every column it read (apart from what the database sets)', () => {
    const back = outsideRepairToInsert(mapOutsideRepairRow(row))
    for (const key of Object.keys(back) as (keyof typeof back)[]) {
      expect(back[key], key).toEqual(row[key as keyof typeof row])
    }
  })

  it('drops a leftover part name when the whole asset is sent', () => {
    const r = { ...mapOutsideRepairRow(row), scope: 'Complete Asset' as const }
    expect(outsideRepairToInsert(r).component_name).toBeNull()
  })

  it('updates only what changed, and never the number or the work order', () => {
    expect(outsideRepairToUpdate({ status: 'Returned', returnedDate: '2026-09-27', outcome: 'Repaired', actualCost: 0 })).toEqual({
      status: 'Returned', returned_date: '2026-09-27', outcome: 'Repaired', actual_cost: 0,
    })
    expect(outsideRepairToUpdate({ repairNumber: 'X', workOrderId: 'Y' } as never)).toEqual({})
  })
})
