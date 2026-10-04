import type { Inspection } from '@/types/afms'

// Compliance = completed inspections that passed ÷ completed inspections.
// With nothing completed there is nothing to score: null, shown as "—" with
// "No inspections yet", never as a made-up 100%.
export function complianceRate(inspections: Pick<Inspection, 'status' | 'result'>[]): number | null {
  const completed = inspections.filter(i => i.status === 'Completed')
  if (completed.length === 0) return null
  const passed = completed.filter(i => i.result === 'Pass').length
  return Math.round((passed / completed.length) * 100)
}

export type ComplianceBand = { label: string; tone: 'good' | 'fair' | 'poor' | 'none' }

export function complianceBand(rate: number | null): ComplianceBand {
  if (rate === null) return { label: 'No inspections yet', tone: 'none' }
  if (rate >= 90) return { label: 'Outstanding', tone: 'good' }
  if (rate >= 75) return { label: 'Good', tone: 'fair' }
  return { label: 'Needs Action', tone: 'poor' }
}
