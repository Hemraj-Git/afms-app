import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Building, Campus, Category, Department, SubCategory } from '@/types/afms'

// The codes "already in the database" for whichever table a test asks about.
const h = vi.hoisted(() => ({ dbCodes: [] as string[] }))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({
        order: async () => ({ data: [], error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: h.dbCodes.map(code => ({ code })), error: null }),
      }),
    }),
  },
}))

import { uniqueCode } from './entity'
import { allocateDepartment, departmentToInsert, departmentToUpdate, mapDepartmentRow } from './departments'
import { allocateCampus, campusToUpdate, mapCampusRow } from './campuses'
import { allocateBuilding, buildingToInsert, buildingToUpdate, mapBuildingRow } from './buildings'
import { allocateCategory, categoryToUpdate, mapCategoryRow } from './categories'
import { allocateSubCategory, mapSubCategoryRow, subCategoryToInsert, subCategoryToUpdate } from './subCategories'

beforeEach(() => {
  h.dbCodes = []
})

describe('uniqueCode', () => {
  it('keeps a free code and numbers a taken one from 2', () => {
    expect(uniqueCode('ELEC', [])).toBe('ELEC')
    expect(uniqueCode('ELEC', ['ELEC'])).toBe('ELEC-2')
    expect(uniqueCode('ELEC', ['ELEC', 'ELEC-2', 'ELEC-3'])).toBe('ELEC-4')
  })
})

describe('code allocation checks the database as well as the screen', () => {
  const cat = (code: string): Category => ({ id: `id-${code}`, name: code, code })

  it('categories: Electrical and Electronics both start ELEC, the second becomes ELEC-2', async () => {
    const first = await allocateCategory({ name: 'Electrical' }, [])
    expect(first.code).toBe('ELEC')
    const second = await allocateCategory({ name: 'Electronics' }, [cat('ELEC')])
    expect(second.code).toBe('ELEC-2')
  })

  it('categories: a code that only exists in the database (not loaded on screen) is still avoided', async () => {
    h.dbCodes = ['ELEC']
    expect((await allocateCategory({ name: 'Electrical' }, [])).code).toBe('ELEC-2')
  })

  it('campuses: continues the CAM sequence from the highest code seen anywhere', async () => {
    h.dbCodes = ['CAM-0007']
    const onScreen: Campus[] = [{ id: 'a', name: 'A', code: 'CAM-0002', address: '' }]
    expect((await allocateCampus({ name: 'B', address: '' }, onScreen)).code).toBe('CAM-0008')
  })

  it('buildings: continues the BLD sequence, starting at 1', async () => {
    expect((await allocateBuilding({ campusId: 'c', name: 'B', totalFloors: 2 }, [])).code).toBe('BLD-0001')
    const onScreen: Building[] = [{ id: 'a', campusId: 'c', name: 'A', code: 'BLD-0004', totalFloors: 1 }]
    expect((await allocateBuilding({ campusId: 'c', name: 'B', totalFloors: 2 }, onScreen)).code).toBe('BLD-0005')
  })

  it('departments: uses the typed code, disambiguates a clash, and stamps a created date', async () => {
    const known: Department[] = [{ id: 'a', name: 'Marine', code: 'MAR' }]
    const d = await allocateDepartment({ name: 'Marketing', code: 'MAR' }, known)
    expect(d.code).toBe('MAR-2')
    expect(d.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('sub-categories: the parent code prefixes it and a clash gets a suffix', async () => {
    h.dbCodes = ['FURN-OFFI']
    const sub = await allocateSubCategory({ categoryId: 'c', name: 'Office Chair', metadataFields: [] }, 'FURN', [])
    expect(sub.code).toBe('FURN-OFFI-2')
  })
})

describe('row mapping', () => {
  it('department: blank description, created date carried', () => {
    expect(mapDepartmentRow({ id: '1', name: 'Ops', code: 'OPS', description: null, created_at: '2026-01-01' })).toEqual({
      id: '1', name: 'Ops', code: 'OPS', description: '', createdAt: '2026-01-01',
    })
    expect(departmentToInsert({ id: '1', name: 'Ops', code: 'OPS', headOfDepartment: 'Sam' })).toEqual({
      id: '1', name: 'Ops', code: 'OPS', description: '',
    })
  })

  it('department: a code change is allowed; nothing else is invented', () => {
    expect(departmentToUpdate({ code: 'NEW' })).toEqual({ code: 'NEW' })
    expect(departmentToUpdate({ headOfDepartment: 'Sam' })).toEqual({})
  })

  it('campus, building and category updates only send editable fields', () => {
    expect(campusToUpdate({ id: 'x', code: 'CAM-9999', name: 'N', address: 'A' })).toEqual({ name: 'N', address: 'A' })
    expect(categoryToUpdate({ id: 'x', code: 'ZZZZ', name: 'N' })).toEqual({ name: 'N' })
    expect(buildingToUpdate({ id: 'x', code: 'BLD-9999', name: 'N', totalFloors: 3, campusId: 'c2' })).toEqual({
      name: 'N', total_floors: 3, campus_id: 'c2',
    })
  })

  it('campus, building and category rows map with blanks filled', () => {
    expect(mapCampusRow({ id: '1', name: 'Main', code: 'CAM-0001', address: null, created_at: 'x' })).toMatchObject({ address: '' })
    expect(mapCategoryRow({ id: '1', name: 'Elec', code: 'ELEC', description: null, created_at: 'x' })).toMatchObject({ description: '' })
    expect(mapBuildingRow({ id: '1', campus_id: null, name: 'B', code: 'BLD-0001', total_floors: null, created_at: 'x' })).toMatchObject({
      campusId: '', totalFloors: 1,
    })
    expect(buildingToInsert({ id: '1', campusId: '', name: 'B', code: 'BLD-0001', totalFloors: 0 })).toMatchObject({
      campus_id: null, total_floors: 1,
    })
  })
})

describe('sub-category mapping', () => {
  const row = {
    id: '1', category_id: 'c1', name: 'Light', code: 'ELEC-LIGH', description: null,
    metadata_fields: [{ key: 'watts', label: 'Watts', type: 'Number', required: false, order: 1 }],
    pm_template_ids: ['t1'], inspection_template_ids: null, sla_priority: 'Medium', created_at: 'x',
  }

  it('maps arrays, and blanks for missing ones', () => {
    const s = mapSubCategoryRow(row as never)
    expect(s).toMatchObject({ categoryId: 'c1', description: '', pmTemplateIds: ['t1'], inspectionTemplateIds: [] })
    expect(s.metadataFields).toHaveLength(1)
  })

  it('writes template ids as de-duplicated arrays, accepting the single-id shorthand', () => {
    const s: SubCategory = { id: '1', categoryId: 'c1', name: 'Light', code: 'ELEC-LIGH', metadataFields: [], pmTemplateIds: ['a', 'a', 'b'], inspectionTemplateId: 'i1' }
    expect(subCategoryToInsert(s)).toMatchObject({ pm_template_ids: ['a', 'b'], inspection_template_ids: ['i1'] })
  })

  it('update touches template arrays only when a template field was supplied', () => {
    expect(subCategoryToUpdate({ name: 'N' })).toEqual({ name: 'N' })
    expect(subCategoryToUpdate({ pmTemplateId: 'p1' })).toEqual({ pm_template_ids: ['p1'] })
    expect(subCategoryToUpdate({ inspectionTemplateIds: [] })).toEqual({ inspection_template_ids: [] })
  })
})
