// ID Formatting and Generation Utilities for AFMS

export function formatId(prefix: string, num: number, padLength: number = 4): string {
  return `${prefix}-${String(num).padStart(padLength, '0')}`
}

export function formatYearlyId(prefix: string, num: number, year: number = new Date().getFullYear(), padLength: number = 4): string {
  return `${prefix}-${year}-${String(num).padStart(padLength, '0')}`
}

// Auto-derives 4-letter Category ID e.g. "Electrical" -> "ELEC", "Mechanical" -> "MECH"
export function formatCategoryId(name: string): string {
  const clean = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!clean) return 'GENR'
  return clean.padEnd(4, 'X').slice(0, 4)
}

// Auto-derives Sub-Category ID e.g. Category="ELEC", SubCategory="Light" -> "ELEC-LIGH"
export function formatSubCategoryId(parentCategoryCodeOrId: string, subCategoryName: string): string {
  const catClean = parentCategoryCodeOrId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'GENR'

  const subClean = subCategoryName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'ITEM'

  return `${catClean}-${subClean.padEnd(4, '0').slice(0, 4)}`
}

export function formatTaxonomyIdFromName(prefix: string, name: string): string {
  const clean = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
  return `${prefix}-${clean || 'GEN'}`
}

// Placeholder woNumber for a Preventive/Corrective maintenance record that
// exists (for due-date tracking / the assignment queue) but isn't yet a
// real, numbered Work Order -- that only happens once a technician is
// assigned. work_orders.wo_number has a UNIQUE constraint, so this can't be
// a shared literal string; it's suffixed with the row's own id to stay
// unique across every pending row.
export function makePendingWoNumber(rowUuid: string): string {
  return `PENDING-${rowUuid}`
}
export function isPendingWorkOrder(woNumber: string | undefined | null): boolean {
  return Boolean(woNumber && woNumber.startsWith('PENDING-'))
}

// Helpers for automatic sequential ID generator
export function getNextSequence(existingIds: string[], prefix: string): number {
  let maxSeq = 0
  const regex = new RegExp(`^${prefix}-(?:\\d{4}-)?(\\d+)$`)
  
  existingIds.forEach(id => {
    const match = id.match(regex)
    if (match && match[1]) {
      const val = parseInt(match[1], 10)
      if (!isNaN(val) && val > maxSeq) {
        maxSeq = val
      }
    }
  })
  
  return maxSeq + 1
}

// Computes next scheduled date string (YYYY-MM-DD) based on base date and interval
export function addIntervalToDate(baseDateStr: string, interval: string = 'Quarterly'): string {
  // Parse baseDateStr safely (supports YYYY-MM-DD or DD-MM-YYYY)
  let date: Date
  if (baseDateStr.includes('-')) {
    const parts = baseDateStr.split('-')
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    } else {
      // DD-MM-YYYY
      date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
    }
  } else {
    date = new Date(baseDateStr)
  }

  if (isNaN(date.getTime())) {
    date = new Date()
  }

  const normalized = interval.toLowerCase()
  if (normalized.includes('week')) {
    date.setDate(date.getDate() + 7)
  } else if (normalized.includes('month') && !normalized.includes('half')) {
    date.setMonth(date.getMonth() + 1)
  } else if (normalized.includes('quat') || normalized.includes('quarter')) {
    date.setMonth(date.getMonth() + 3)
  } else if (normalized.includes('half')) {
    date.setMonth(date.getMonth() + 6)
  } else if (normalized.includes('annual') || normalized.includes('year')) {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    // Default quarterly (3 months)
    date.setMonth(date.getMonth() + 3)
  }

  return date.toISOString().split('T')[0]
}
