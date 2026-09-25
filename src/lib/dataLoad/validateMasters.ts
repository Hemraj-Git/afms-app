import { nameKey, type Issue } from './coerce'
import { parseSheetRows, type Rec } from './parseRows'
import { checkHeaders, type RawSheet } from './readWorkbook'
import { customFieldKey, MASTER_ORDER, MASTER_SPECS, type FIELD_TYPES, type FREQUENCIES } from './spec'

export interface FieldDef {
  key: string
  label: string
  type: (typeof FIELD_TYPES)[number]
  unit?: string
  required: boolean
  order: number
}

export interface StepData {
  row: number
  stepNo: number
  task: string
  instructions: string
  mandatory: boolean
  photoRequired: boolean
}

export interface TemplateData {
  row: number
  title: string
  frequency: (typeof FREQUENCIES)[number]
  description: string
  steps: StepData[]
}

export interface MastersData {
  campuses: { row: number; name: string; address: string }[]
  buildings: { row: number; name: string; campus: string; label: string; totalFloors: number }[]
  rooms: {
    row: number; name: string; building: string; label: string; type: string
    floor: string; sizeSqft?: number; reservable: boolean
  }[]
  vendors: {
    row: number; name: string; categorySupplied: string; contactPerson: string; email: string
    phone: string; address: string; hasAmc: boolean; amcContractNo: string; amcStart?: string; amcEnd?: string
  }[]
  categories: { row: number; name: string; description: string }[]
  subCategories: {
    row: number; name: string; category: string; label: string; description: string
    pmTemplates: string[]; inspTemplates: string[]; fields: FieldDef[]
  }[]
  pmTemplates: TemplateData[]
  inspTemplates: TemplateData[]
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function validateMasters(sheets: Map<string, RawSheet>): { data: MastersData; issues: Issue[] } {
  const issues: Issue[] = []
  const err = (sheet: string, row: number, message: string) => issues.push({ severity: 'error', sheet, row, message })
  const warn = (sheet: string, row: number, message: string) => issues.push({ severity: 'warning', sheet, row, message })

  const recs = {} as Record<(typeof MASTER_ORDER)[number], Rec[]>
  for (const key of MASTER_ORDER) {
    const spec = MASTER_SPECS[key]
    const sheet = sheets.get(spec.name)
    if (!sheet) {
      err(spec.name, 0, `The tab "${spec.name}" is missing. Use the template as it was sent; do not delete or rename tabs.`)
      recs[key] = []
      continue
    }
    const headerIssues = checkHeaders(sheet, spec, spec.name)
    issues.push(...headerIssues)
    recs[key] = headerIssues.length ? [] : parseSheetRows(sheet, spec, spec.name, issues)
  }

  const data: MastersData = {
    campuses: [], buildings: [], rooms: [], vendors: [], categories: [],
    subCategories: [], pmTemplates: [], inspTemplates: [],
  }

  // A key -> canonical spelling map that also reports the same key used twice.
  const unique = <T>(
    sheet: string,
    items: { row: number; key: string; item: T }[],
    describe: string
  ): Map<string, T> => {
    const seen = new Map<string, { row: number; item: T }>()
    for (const it of items) {
      const prior = seen.get(it.key)
      if (prior) err(sheet, it.row, `${describe} appears twice (also on row ${prior.row}).`)
      else seen.set(it.key, { row: it.row, item: it.item })
    }
    return new Map([...seen].map(([k, v]) => [k, v.item]))
  }

  // ---- Campuses ----
  const S = MASTER_SPECS
  for (const r of recs.campuses) data.campuses.push({ row: r.row, name: str(r.v.name), address: str(r.v.address) })
  const campusByKey = unique(S.campuses.name, data.campuses.map(c => ({ row: c.row, key: nameKey(c.name), item: c })), 'This campus')

  // ---- Buildings ----
  for (const r of recs.buildings) {
    const campus = campusByKey.get(nameKey(r.v.campus))
    if (!campus) {
      if (str(r.v.campus)) err(S.buildings.name, r.row, `Campus "${str(r.v.campus)}" is not on the Campuses tab.`)
      continue
    }
    const floors = typeof r.v.totalFloors === 'number' ? r.v.totalFloors : 1
    if (floors < 1) { err(S.buildings.name, r.row, 'Total floors must be at least 1.'); continue }
    data.buildings.push({
      row: r.row, name: str(r.v.name), campus: campus.name, label: `${campus.name} / ${str(r.v.name)}`, totalFloors: floors,
    })
  }
  const buildingByKey = unique(S.buildings.name, data.buildings.map(b => ({ row: b.row, key: nameKey(b.label), item: b })), 'This building in this campus')

  // ---- Rooms ----
  for (const r of recs.rooms) {
    const b = buildingByKey.get(nameKey(r.v.building))
    if (!b) {
      if (str(r.v.building)) err(S.rooms.name, r.row, `Building "${str(r.v.building)}" is not on the Buildings tab (pick it from the list).`)
      continue
    }
    data.rooms.push({
      row: r.row,
      name: str(r.v.name),
      building: b.label,
      label: `${b.label} / ${str(r.v.name)}`,
      type: str(r.v.type),
      floor: str(r.v.floor),
      sizeSqft: typeof r.v.sizeSqft === 'number' ? r.v.sizeSqft : undefined,
      reservable: r.v.reservable === undefined ? true : Boolean(r.v.reservable),
    })
  }
  unique(S.rooms.name, data.rooms.map(x => ({ row: x.row, key: nameKey(x.label), item: x })), 'This room in this building')

  // ---- Vendors ----
  for (const r of recs.vendors) {
    const amcStart = typeof r.v.amcStart === 'string' ? r.v.amcStart : undefined
    const amcEnd = typeof r.v.amcEnd === 'string' ? r.v.amcEnd : undefined
    if (amcStart && amcEnd && amcEnd < amcStart) err(S.vendors.name, r.row, 'AMC end date is before the AMC start date.')
    const hasAmcFields = Boolean(str(r.v.amcContractNo) || amcStart || amcEnd)
    if (r.v.hasAmc === false && hasAmcFields) warn(S.vendors.name, r.row, 'AMC details are filled but "Has AMC contract" is No; they will be kept.')
    data.vendors.push({
      row: r.row, name: str(r.v.name), categorySupplied: str(r.v.categorySupplied),
      contactPerson: str(r.v.contactPerson), email: str(r.v.email), phone: str(r.v.phone), address: str(r.v.address),
      hasAmc: r.v.hasAmc === undefined ? hasAmcFields : Boolean(r.v.hasAmc),
      amcContractNo: str(r.v.amcContractNo), amcStart, amcEnd,
    })
    if (str(r.v.email) && !/^\S+@\S+\.\S+$/.test(str(r.v.email))) warn(S.vendors.name, r.row, `Email "${str(r.v.email)}" does not look like an email address.`)
  }
  unique(S.vendors.name, data.vendors.map(v => ({ row: v.row, key: nameKey(v.name), item: v })), 'This vendor')

  // ---- Categories ----
  for (const r of recs.categories) data.categories.push({ row: r.row, name: str(r.v.name), description: str(r.v.description) })
  const categoryByKey = unique(S.categories.name, data.categories.map(c => ({ row: c.row, key: nameKey(c.name), item: c })), 'This category')

  // ---- Templates (header rows) and their steps ----
  const buildTemplates = (
    tKey: 'pmTemplates' | 'inspTemplates',
    sKey: 'pmSteps' | 'inspSteps'
  ): TemplateData[] => {
    const templates: TemplateData[] = recs[tKey].map(r => ({
      row: r.row,
      title: str(r.v.title),
      frequency: r.v.frequency as TemplateData['frequency'],
      description: str(r.v.description),
      steps: [],
    }))
    const byKey = unique(S[tKey].name, templates.map(t => ({ row: t.row, key: nameKey(t.title), item: t })), 'This template title')
    for (const r of recs[sKey]) {
      const t = byKey.get(nameKey(r.v.template))
      if (!t) {
        if (str(r.v.template)) err(S[sKey].name, r.row, `Template "${str(r.v.template)}" is not on the ${S[tKey].name} tab (pick it from the list).`)
        continue
      }
      t.steps.push({
        row: r.row,
        stepNo: typeof r.v.stepNo === 'number' ? r.v.stepNo : 0,
        task: str(r.v.task),
        instructions: str(r.v.instructions),
        mandatory: r.v.mandatory === undefined ? true : Boolean(r.v.mandatory),
        photoRequired: r.v.photoRequired === undefined ? false : Boolean(r.v.photoRequired),
      })
    }
    for (const t of byKey.values()) {
      if (t.steps.length === 0) {
        err(S[tKey].name, t.row, `Template "${t.title}" has no steps on the ${S[sKey].name} tab.`)
        continue
      }
      // Steps without a number keep the order they were typed in, after the numbered ones.
      const numbered = t.steps.filter(s => s.stepNo > 0)
      const dupNo = new Set<number>()
      for (const s of numbered) {
        if (dupNo.has(s.stepNo)) err(S[sKey].name, s.row, `Step no ${s.stepNo} is used twice in "${t.title}".`)
        dupNo.add(s.stepNo)
      }
      t.steps = [
        ...numbered.sort((a, b) => a.stepNo - b.stepNo || a.row - b.row),
        ...t.steps.filter(s => s.stepNo <= 0).sort((a, b) => a.row - b.row),
      ]
    }
    return templates
  }
  data.pmTemplates = buildTemplates('pmTemplates', 'pmSteps')
  data.inspTemplates = buildTemplates('inspTemplates', 'inspSteps')
  const pmByKey = new Map(data.pmTemplates.map(t => [nameKey(t.title), t]))
  const inspByKey = new Map(data.inspTemplates.map(t => [nameKey(t.title), t]))

  // ---- Sub-categories ----
  for (const r of recs.subCategories) {
    const cat = categoryByKey.get(nameKey(r.v.category))
    if (!cat) {
      if (str(r.v.category)) err(S.subCategories.name, r.row, `Category "${str(r.v.category)}" is not on the Categories tab.`)
      continue
    }
    const resolve = (keys: string[], map: Map<string, TemplateData>, kind: string): string[] => {
      const picked: string[] = []
      for (const k of keys) {
        const name = str(r.v[k])
        if (!name) continue
        const t = map.get(nameKey(name))
        if (!t) { err(S.subCategories.name, r.row, `${kind} template "${name}" is not on its templates tab (pick it from the list).`); continue }
        if (picked.includes(t.title)) { err(S.subCategories.name, r.row, `${kind} template "${t.title}" is listed twice.`); continue }
        picked.push(t.title)
      }
      return picked
    }
    const pm = resolve(['pm1', 'pm2', 'pm3'], pmByKey, 'Maintenance')
    const insp = resolve(['insp1', 'insp2', 'insp3'], inspByKey, 'Inspection')
    if (pm.length === 0) warn(S.subCategories.name, r.row, `"${str(r.v.name)}" has no maintenance template, so its assets get no preventive maintenance scheduled.`)
    if (insp.length === 0) warn(S.subCategories.name, r.row, `"${str(r.v.name)}" has no inspection template, so its assets get no inspections scheduled.`)
    data.subCategories.push({
      row: r.row, name: str(r.v.name), category: cat.name, label: `${cat.name} / ${str(r.v.name)}`,
      description: str(r.v.description), pmTemplates: pm, inspTemplates: insp, fields: [],
    })
  }
  const subByKey = unique(S.subCategories.name, data.subCategories.map(s => ({ row: s.row, key: nameKey(s.label), item: s })), 'This sub-category in this category')

  // ---- Custom fields ----
  const fieldSeen = new Set<string>()
  for (const r of recs.customFields) {
    const sub = subByKey.get(nameKey(r.v.subCategory))
    if (!sub) {
      if (str(r.v.subCategory)) err(S.customFields.name, r.row, `Sub-category "${str(r.v.subCategory)}" is not on the Sub-Categories tab (pick it from the list).`)
      continue
    }
    const label = str(r.v.label)
    const key = customFieldKey(label)
    const dupKey = `${nameKey(sub.label)}|${key}`
    if (fieldSeen.has(dupKey)) { err(S.customFields.name, r.row, `The field "${label}" is added twice to "${sub.label}".`); continue }
    fieldSeen.add(dupKey)
    sub.fields.push({
      key, label, type: r.v.type as FieldDef['type'], unit: str(r.v.unit) || undefined,
      required: r.v.required === undefined ? false : Boolean(r.v.required),
      order: typeof r.v.order === 'number' && r.v.order > 0 ? r.v.order : 0,
    })
  }
  for (const s of data.subCategories) {
    // Fields without an order keep the order they were typed in, after the numbered ones.
    const numbered = s.fields.filter(f => f.order > 0).sort((a, b) => a.order - b.order)
    const rest = s.fields.filter(f => f.order <= 0)
    s.fields = [...numbered, ...rest].map((f, i) => ({ ...f, order: i + 1 }))
  }

  const total =
    data.campuses.length + data.buildings.length + data.rooms.length + data.vendors.length +
    data.categories.length + data.subCategories.length + data.pmTemplates.length + data.inspTemplates.length
  if (total === 0 && !issues.some(i => i.severity === 'error')) {
    err('Read Me', 0, 'The workbook has no data rows on any tab.')
  }

  // A category nobody uses is harmless but usually a slip.
  for (const c of data.categories) {
    if (!data.subCategories.some(s => nameKey(s.category) === nameKey(c.name))) {
      warn(S.categories.name, c.row, `Category "${c.name}" has no sub-categories, so no assets can be added to it.`)
    }
  }
  return { data, issues }
}
