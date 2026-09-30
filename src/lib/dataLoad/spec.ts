// The layout of the data-collection workbooks, in one place. The generators write
// these tabs and columns, the loader reads them back by the same definitions, and
// the tests check both against each other -- so a template and its loader cannot
// drift apart.

export const FREQUENCIES = ['Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annually'] as const
export const FIELD_TYPES = ['Text', 'Number', 'Date'] as const
export const SLA_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const
export const ASSET_STATUSES = ['Operational', 'Under Maintenance', 'In Storage', 'Retired'] as const
export const MAINTAINED_BY = ['In House', 'Vendor'] as const
export const YES_NO = ['Yes', 'No'] as const
// The room types the Rooms screen offers. Others are allowed (a warning, not a stop).
export const ROOM_TYPES = [
  'Classroom', 'Simulator Block', 'Engine Room', 'Workshop', 'Office',
  'Common Area', 'Dining Area', 'Laboratory', 'Conference Hall',
] as const

export type ColumnKind = 'text' | 'integer' | 'number' | 'date' | 'yesno' | 'choice'

// Named dropdown sources on the hidden-in-plain-sight "Lists" tab.
export type ListName =
  | 'campuses' | 'buildings' | 'rooms' | 'vendors' | 'categories'
  | 'subCategories' | 'pmTemplates' | 'inspTemplates'

export interface ColumnSpec {
  key: string
  // Exact header text, including the trailing " *" of a required column.
  header: string
  required?: boolean
  kind: ColumnKind
  width: number
  // Inline dropdown (kind 'choice').
  choices?: readonly string[]
  // Dropdown filled from another tab's data (a value that must already exist).
  listRef?: ListName
  // A dropdown built somewhere other than the named lists above: the Assets
  // workbook needs one list of sub-categories per category tab.
  listRange?: { range: string; dropdown: string }
  // A value outside `choices` is only warned about, not refused.
  allowOther?: boolean
  // A custom field on a category tab belongs only to some of that category's
  // sub-categories, so whether it is required -- or allowed at all -- depends on
  // the sub-category chosen in `onColumn` (a 0-based column index). Each range
  // lists the sub-category names, on the hidden fields tab.
  conditional?: {
    onColumn: number
    appliesRange: string
    requiredRange: string
  }
}

export interface SheetSpec {
  name: string
  title: string
  intro: string
  columns: ColumnSpec[]
  // Columns that together identify a row; the same combination twice is a duplicate.
  keyColumns: string[]
  maxRows: number
}

const col = (
  key: string,
  label: string,
  kind: ColumnKind,
  width: number,
  opts: Partial<Omit<ColumnSpec, 'key' | 'header' | 'kind' | 'width'>> = {}
): ColumnSpec => ({ key, header: opts.required ? `${label} *` : label, kind, width, ...opts })

export const MASTER_SHEETS = {
  campuses: 'Campuses',
  buildings: 'Buildings',
  rooms: 'Rooms',
  vendors: 'Vendors',
  categories: 'Categories',
  subCategories: 'Sub-Categories',
  customFields: 'Custom Fields',
  pmTemplates: 'Maintenance Templates',
  pmSteps: 'Maintenance Steps',
  inspTemplates: 'Inspection Templates',
  inspSteps: 'Inspection Steps',
} as const

const templateColumns = (): ColumnSpec[] => [
  col('title', 'Template title', 'text', 38, { required: true }),
  col('frequency', 'Frequency', 'choice', 16, { required: true, choices: FREQUENCIES }),
  col('description', 'Description', 'text', 50),
]

const stepColumns = (list: ListName): ColumnSpec[] => [
  col('template', 'Template title', 'text', 38, { required: true, listRef: list }),
  col('stepNo', 'Step no', 'integer', 10),
  col('task', 'Task / what to check', 'text', 60, { required: true }),
  col('instructions', 'Instructions', 'text', 50),
  col('mandatory', 'Mandatory (Yes/No)', 'yesno', 18),
  col('photoRequired', 'Photo required (Yes/No)', 'yesno', 22),
]

export const MASTER_SPECS: Record<keyof typeof MASTER_SHEETS, SheetSpec> = {
  campuses: {
    name: MASTER_SHEETS.campuses,
    title: 'Campuses',
    intro: 'One row per campus or site.',
    keyColumns: ['name'],
    maxRows: 300,
    columns: [
      col('name', 'Campus name', 'text', 34, { required: true }),
      col('address', 'Address', 'text', 60),
    ],
  },
  buildings: {
    name: MASTER_SHEETS.buildings,
    title: 'Buildings',
    intro: 'One row per building or block. Pick its campus from the list.',
    keyColumns: ['campus', 'name'],
    maxRows: 500,
    columns: [
      col('name', 'Building name', 'text', 34, { required: true }),
      col('campus', 'Campus', 'text', 34, { required: true, listRef: 'campuses' }),
      col('totalFloors', 'Total floors', 'integer', 14),
    ],
  },
  rooms: {
    name: MASTER_SHEETS.rooms,
    title: 'Rooms',
    intro: 'One row per room or area. Pick its building from the list. The app gives every room its own number.',
    keyColumns: ['building', 'name'],
    maxRows: 1500,
    columns: [
      col('name', 'Room / area name', 'text', 34, { required: true }),
      col('building', 'Building', 'text', 40, { required: true, listRef: 'buildings' }),
      col('type', 'Room type', 'choice', 22, { choices: ROOM_TYPES, allowOther: true }),
      col('floor', 'Floor', 'text', 12),
      col('sizeSqft', 'Size (sq ft)', 'number', 14),
      col('reservable', 'Can be reserved (Yes/No)', 'yesno', 24),
    ],
  },
  vendors: {
    name: MASTER_SHEETS.vendors,
    title: 'Vendors',
    intro: 'Suppliers and service companies. Assets refer to them by name.',
    keyColumns: ['name'],
    maxRows: 300,
    columns: [
      col('name', 'Vendor name', 'text', 34, { required: true }),
      col('categorySupplied', 'What they supply / service', 'text', 30),
      col('contactPerson', 'Contact person', 'text', 26),
      col('email', 'Email', 'text', 30),
      col('phone', 'Phone', 'text', 18),
      col('address', 'Address', 'text', 40),
      col('hasAmc', 'Has AMC contract (Yes/No)', 'yesno', 24),
      col('amcContractNo', 'AMC contract no', 'text', 20),
      col('amcStart', 'AMC start date', 'date', 16),
      col('amcEnd', 'AMC end date', 'date', 16),
    ],
  },
  categories: {
    name: MASTER_SHEETS.categories,
    title: 'Categories',
    intro: 'Broad groups of equipment (for example Electrical, HVAC, Furniture).',
    keyColumns: ['name'],
    maxRows: 200,
    columns: [
      col('name', 'Category name', 'text', 34, { required: true }),
      col('description', 'Description', 'text', 60),
    ],
  },
  subCategories: {
    name: MASTER_SHEETS.subCategories,
    title: 'Sub-Categories',
    intro:
      'Types of equipment inside a category (for example Split AC, Ceiling Fan). Link the maintenance and inspection templates that apply; every asset of this type is scheduled from them.',
    keyColumns: ['category', 'name'],
    maxRows: 500,
    columns: [
      col('name', 'Sub-category name', 'text', 34, { required: true }),
      col('category', 'Category', 'text', 30, { required: true, listRef: 'categories' }),
      col('description', 'Description', 'text', 44),
      col('pm1', 'Maintenance template 1', 'text', 34, { listRef: 'pmTemplates' }),
      col('pm2', 'Maintenance template 2', 'text', 34, { listRef: 'pmTemplates' }),
      col('pm3', 'Maintenance template 3', 'text', 34, { listRef: 'pmTemplates' }),
      col('insp1', 'Inspection template 1', 'text', 34, { listRef: 'inspTemplates' }),
      col('insp2', 'Inspection template 2', 'text', 34, { listRef: 'inspTemplates' }),
      col('insp3', 'Inspection template 3', 'text', 34, { listRef: 'inspTemplates' }),
    ],
  },
  customFields: {
    name: MASTER_SHEETS.customFields,
    title: 'Custom Fields',
    intro:
      'Extra details to record for every asset of a sub-category (for example Capacity in TR for an AC). Each row adds one column to that sub-category\'s tab in the Assets workbook.',
    keyColumns: ['subCategory', 'label'],
    maxRows: 1500,
    columns: [
      col('subCategory', 'Sub-category', 'text', 44, { required: true, listRef: 'subCategories' }),
      col('label', 'Field name', 'text', 30, { required: true }),
      col('type', 'Type', 'choice', 12, { required: true, choices: FIELD_TYPES }),
      col('unit', 'Unit (optional)', 'text', 14),
      col('required', 'Must be filled (Yes/No)', 'yesno', 22),
      col('order', 'Order', 'integer', 10),
    ],
  },
  pmTemplates: {
    name: MASTER_SHEETS.pmTemplates,
    title: 'Maintenance Templates',
    intro: 'A preventive-maintenance checklist and how often it is done. The steps go on the next tab.',
    keyColumns: ['title'],
    maxRows: 300,
    columns: templateColumns(),
  },
  pmSteps: {
    name: MASTER_SHEETS.pmSteps,
    title: 'Maintenance Steps',
    intro: 'One row per step. Pick the template from the list; steps run in Step no order.',
    keyColumns: [],
    maxRows: 3000,
    columns: stepColumns('pmTemplates'),
  },
  inspTemplates: {
    name: MASTER_SHEETS.inspTemplates,
    title: 'Inspection Templates',
    intro: 'A pass/fail inspection checklist and how often it is done. The steps go on the next tab.',
    keyColumns: ['title'],
    maxRows: 300,
    columns: templateColumns(),
  },
  inspSteps: {
    name: MASTER_SHEETS.inspSteps,
    title: 'Inspection Steps',
    intro: 'One row per step. Pick the template from the list; steps run in Step no order.',
    keyColumns: [],
    maxRows: 3000,
    columns: stepColumns('inspTemplates'),
  },
}

// Fill order = tab order after the Read Me.
export const MASTER_ORDER: (keyof typeof MASTER_SHEETS)[] = [
  'campuses', 'buildings', 'rooms', 'vendors', 'categories', 'subCategories',
  'customFields', 'pmTemplates', 'pmSteps', 'inspTemplates', 'inspSteps',
]

// ---- Assets workbook: one tab per sub-category ----

export const ASSET_FIXED_COLUMNS: ColumnSpec[] = [
  col('name', 'Asset name', 'text', 32, { required: true }),
  col('room', 'Room / area', 'text', 44, { required: true, listRef: 'rooms' }),
  col('slaPriority', 'SLA priority', 'choice', 16, { required: true, choices: SLA_PRIORITIES }),
  col('manufacturer', 'Manufacturer', 'text', 22),
  col('model', 'Model number', 'text', 22),
  col('serial', 'Serial number', 'text', 22),
  col('price', 'Cost (INR)', 'number', 14),
  col('purchaseDate', 'Purchase date', 'date', 16),
  col('installDate', 'Installation date', 'date', 18),
  col('warrantyTill', 'Warranty till', 'date', 16),
  col('lastServiced', 'Last serviced date', 'date', 18),
  col('status', 'Status', 'choice', 20, { choices: ASSET_STATUSES }),
  col('maintainedBy', 'Maintained by', 'choice', 16, { choices: MAINTAINED_BY }),
  col('maintenanceVendor', 'Maintenance vendor', 'text', 28, { listRef: 'vendors' }),
  col('purchaseVendor', 'Purchased from (vendor)', 'text', 28, { listRef: 'vendors' }),
  col('amcStart', 'AMC start date', 'date', 16),
  col('amcEnd', 'AMC end date', 'date', 16),
  col('notes', 'Notes', 'text', 44),
]

export const META_SHEET = '_Meta'
// Sub-category names per custom field, read only by the Assets workbook's Row
// check formulas. Hidden, like _Meta, and not a tab anyone fills in.
export const FIELDS_SHEET = '_Fields'
export const ROW_CHECK_HEADER = 'Row check'

// "*" and surrounding space never matter when matching a header.
export const normalizeHeader = (h: unknown): string =>
  String(h ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

export function customFieldKey(label: string): string {
  // The same rule the Sub-Categories screen uses for a field without a stored key.
  return `field_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

export function customFieldHeader(f: { label: string; unit?: string; required: boolean }): string {
  // Clients often write the unit into the field name already ("Capacity (VA/W)"),
  // and "Capacity (VA/W) (VA/W)" helps nobody.
  const said = f.unit ? f.label.toLowerCase().includes(`(${f.unit.toLowerCase()})`) : true
  return `${f.label}${f.unit && !said ? ` (${f.unit})` : ''}${f.required ? ' *' : ''}`
}
