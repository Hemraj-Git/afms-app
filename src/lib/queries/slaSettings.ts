import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase/typed'
import type { ServiceRequest, SlaConfig, SlaPriority } from '@/types/afms'

// The SLA hours per priority, kept in the database (0055) so every screen --
// desktop and phone -- uses the same numbers. A new service request takes its
// deadline from these at the moment it is raised (set by the database);
// changing them never alters requests already raised.

export const DEFAULT_SLA_CONFIG: SlaConfig = { Critical: 4, High: 12, Medium: 24, Low: 48 }
const PRIORITIES: SlaPriority[] = ['Critical', 'High', 'Medium', 'Low']

export const slaSettingsKey = ['sla_settings'] as const

/** Rows to a config, falling back to the defaults for anything missing. */
export function toSlaConfig(rows: { priority: string; hours: number }[] | null | undefined): SlaConfig {
  const config = { ...DEFAULT_SLA_CONFIG }
  for (const r of rows ?? []) {
    if ((PRIORITIES as string[]).includes(r.priority) && r.hours > 0) config[r.priority as SlaPriority] = r.hours
  }
  return config
}

export function useSlaSettings(enabled: boolean) {
  return useQuery({
    queryKey: slaSettingsKey,
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db.from('sla_settings').select('priority, hours')
      if (error) throw new Error(error.message)
      return toSlaConfig(data)
    },
  })
}

/** Saves the hours (Admins only; the database refuses anyone else). */
export async function saveSlaSettings(config: SlaConfig): Promise<void> {
  for (const priority of PRIORITIES) {
    const hours = Math.round(Number(config[priority]))
    if (!(hours >= 1 && hours <= 720)) throw new Error(`${priority}: enter between 1 and 720 hours.`)
    const { data, error } = await db.from('sla_settings').update({ hours }).eq('priority', priority).select('priority')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) throw new Error('Only an Admin can change the SLA hours.')
  }
}

/**
 * The hours a request was given: stored on it since 0055, else what its own
 * deadline says, else (no deadline) the current setting.
 */
export function slaHoursOf(sr: Pick<ServiceRequest, 'slaHours' | 'slaDueDate' | 'createdAt' | 'priority'>, config: SlaConfig): number {
  if (sr.slaHours && sr.slaHours > 0) return sr.slaHours
  const due = Date.parse(sr.slaDueDate || '')
  const created = Date.parse(sr.createdAt || '')
  if (Number.isFinite(due) && Number.isFinite(created) && due > created) return Math.round((due - created) / 3_600_000)
  return config[sr.priority as SlaPriority] ?? 24
}
