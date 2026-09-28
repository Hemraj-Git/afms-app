import { z } from 'zod'

// Validation rules for the main forms, in one place and in plain words. The
// forms show these messages under the fields (see components/ui/FormField).
// Dates are the 'YYYY-MM-DD' strings date inputs give, so they compare as text.

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const
const isoDate = /^\d{4}-\d{2}-\d{2}$/

// A blank field says "Enter …"; a too-short one says how long it must be.
const text = (label: string, { min = 1, max = 200 } = {}) => {
  let s = z.string().trim().min(1, `Enter ${label.toLowerCase()}.`)
  if (min > 1) s = s.min(min, `${label} needs at least ${min} characters.`)
  return s.max(max, `${label} can be at most ${max} characters.`)
}

const pick = (what: string) => z.string().min(1, `Choose ${what}.`)

const date = (label: string) => z.string().regex(isoDate, `Choose the ${label.toLowerCase()}.`)

// ---------- Service request (desktop "Create Service Request") ----------

export const REQUEST_TYPES = ['Maintenance', 'Cleaning', 'IT Support', 'General'] as const

export const serviceRequestSchema = z
  .object({
    title: text('Title', { min: 3, max: 150 }),
    type: z.enum(REQUEST_TYPES),
    priority: z.enum(PRIORITIES),
    roomId: pick('the room or area'),
    assetId: z.string(),
    description: z.string().trim().max(2000, 'Keep the description under 2000 characters.'),
  })
  .superRefine((v, ctx) => {
    if ((v.type === 'Maintenance' || v.type === 'IT Support') && !v.assetId) {
      ctx.addIssue({ code: 'custom', path: ['assetId'], message: 'Choose the asset that needs attention.' })
    }
  })

export type ServiceRequestForm = z.infer<typeof serviceRequestSchema>

// ---------- Work order (desktop "Create Work Order") ----------

export const WORK_ORDER_TYPES = ['Preventive', 'Corrective', 'Housekeeping'] as const

// Who may be assigned each type: housekeeping staff (or an Admin) for
// Housekeeping; any registered (non-guest) user for the others.
export function canBeAssigned(role: string, type: (typeof WORK_ORDER_TYPES)[number]) {
  return type === 'Housekeeping' ? role === 'Housekeeping' || role === 'Admin' : role !== 'Guest'
}

export const workOrderSchema = z
  .object({
    type: z.enum(WORK_ORDER_TYPES),
    title: text('Title', { min: 3, max: 150 }),
    assetId: z.string(),
    roomId: z.string(),
    assignedTechnicianId: pick('who does the work'),
    priority: z.enum(PRIORITIES),
    dueDate: date('Due date'),
    issueLogged: z.string().trim().max(2000, 'Keep the details under 2000 characters.'),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'Housekeeping' && !v.assetId) {
      ctx.addIssue({ code: 'custom', path: ['assetId'], message: 'Choose the asset.' })
    }
    if (!v.roomId) {
      ctx.addIssue({ code: 'custom', path: ['roomId'], message: 'Choose the room or area.' })
    }
  })

export type WorkOrderForm = z.infer<typeof workOrderSchema>

// ---------- Asset wizard ----------

// Step 1: basic information, purchase, warranty and maintenance contract.
export const assetBasicsSchema = z
  .object({
    assetName: text('Asset name', { max: 150 }),
    categoryId: pick('a category'),
    subCategoryId: pick('a sub-category'),
    manufacturer: text('Manufacturer', { max: 120 }),
    modelNumber: text('Model number', { max: 120 }),
    purchaseDate: date('Purchase date'),
    installationDate: date('Installation date'),
    lastServicedDate: z.string(),
    warrantyTill: date('Warranty expiry date'),
    purchasedFromId: pick('the vendor it was bought from'),
    maintenanceBy: z.enum(['In House', 'Vendor']),
    amcVendorId: z.string(),
    amcStartDate: z.string(),
    amcEndDate: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    const bought = isoDate.test(v.purchaseDate) ? v.purchaseDate : ''
    if (bought && isoDate.test(v.installationDate) && v.installationDate < bought) {
      issue('installationDate', 'Installation can’t be before the purchase date.')
    }
    if (bought && v.lastServicedDate && v.lastServicedDate < bought) {
      issue('lastServicedDate', 'Last service can’t be before the purchase date.')
    }
    if (bought && isoDate.test(v.warrantyTill) && v.warrantyTill < bought) {
      issue('warrantyTill', 'Warranty can’t end before the purchase date.')
    }
    if (v.maintenanceBy === 'Vendor') {
      if (!v.amcVendorId) issue('amcVendorId', 'Choose the AMC vendor.')
      if (!isoDate.test(v.amcStartDate)) issue('amcStartDate', 'Choose the AMC start date.')
      if (!isoDate.test(v.amcEndDate)) issue('amcEndDate', 'Choose the AMC end date.')
      else if (isoDate.test(v.amcStartDate) && v.amcEndDate < v.amcStartDate) {
        issue('amcEndDate', 'The AMC can’t end before it starts.')
      }
    }
  })

export type AssetBasics = z.infer<typeof assetBasicsSchema>

// Step 2: location.
export const assetLocationSchema = z.object({
  campusId: pick('a campus'),
  buildingId: pick('a building / block'),
  roomId: pick('a room / area'),
})

// Field -> first message, for forms that keep their own state (the wizard).
export function fieldErrors<T extends z.ZodType>(schema: T, values: unknown): Record<string, string> {
  const result = schema.safeParse(values)
  if (result.success) return {}
  const out: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
