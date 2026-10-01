import type { ChecklistItemDef } from '@/types/afms'

// Housekeeping's 5 sanitation items are fixed (not template-driven like
// Preventive), so this is the one-time snapshot saved alongside each
// order's checklistResponses -- the same WorkOrder fields Preventive
// already uses to persist/restore its checklist, just with a constant
// item list instead of one pulled from a maintenance template. Shared by
// both field apps, so a task started in one reopens the same in the other.
export const HK_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { id: 'dusting', order: 1, itemText: 'Dust desks, simulator cockpits & fixtures', mandatory: false, photoRequired: false, responseType: 'Checkbox' },
  { id: 'mopping', order: 2, itemText: 'Sweep and wet mop entire floor with disinfectant', mandatory: false, photoRequired: false, responseType: 'Checkbox' },
  { id: 'trashDisposal', order: 3, itemText: 'Empty waste bins & replace liner bags', mandatory: false, photoRequired: false, responseType: 'Checkbox' },
  { id: 'sanitization', order: 4, itemText: 'Wipe door handles, switches & touchpoints', mandatory: false, photoRequired: false, responseType: 'Checkbox' },
  { id: 'restroomClean', order: 5, itemText: 'Restroom deep-clean and supply replenishment', mandatory: false, photoRequired: false, responseType: 'Checkbox' },
]

// What was done when a room is finished, as the record has always said it.
export const HK_SOLUTION = 'Room sanitized, mopped, dusted, waste cleared and hygiene replenished.'
