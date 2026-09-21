import type { TableInsert, TableRow } from '@/lib/supabase/typed'
import type { AssetActivityLog } from '@/types/afms'
import { defineList, table } from './entity'

export function mapAssetActivityLogRow(l: TableRow<'asset_activity_logs'>): AssetActivityLog {
  return {
    id: l.id,
    assetId: l.asset_id ?? '',
    byUser: l.by_user,
    action: l.action,
    remarks: l.remarks ?? undefined,
    referenceId: l.reference_id ?? undefined,
    source: (l.source as AssetActivityLog['source']) || 'Manual',
    timestamp: l.timestamp,
    timestampEpoch: l.timestamp_epoch ?? undefined,
  }
}

export function assetActivityLogToInsert(l: AssetActivityLog): TableInsert<'asset_activity_logs'> {
  return {
    id: l.id,
    asset_id: l.assetId,
    by_user: l.byUser,
    action: l.action,
    remarks: l.remarks || null,
    reference_id: l.referenceId || null,
    source: l.source || 'Manual',
    timestamp: l.timestamp,
    timestamp_epoch: l.timestampEpoch ?? null,
  }
}

// The same event must not be recorded twice. Events that relate to a record (a work
// order completed, an inspection failed, a ticket raised...) are identified by the
// asset + what happened + that record's number, so a repeat of that combination is
// dropped -- whether it is already on screen, saved earlier, or repeated inside the
// same batch. Events with no record (asset created / updated) always go through.
export function withoutRepeats(existing: AssetActivityLog[], incoming: AssetActivityLog[]): AssetActivityLog[] {
  const key = (l: AssetActivityLog) => `${l.assetId}|${l.action}|${l.referenceId}`
  const seen = new Set(existing.filter(l => l.referenceId).map(key))
  return incoming.filter(l => {
    if (!l.referenceId) return true
    const k = key(l)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Newest first by timestamp_epoch (a real epoch), not `timestamp`, which is a
// locale-formatted display string that scrambles order across months. Rows
// without an epoch sort last.
const logs = defineList<AssetActivityLog, 'asset_activity_logs'>({
  table: 'asset_activity_logs',
  orderBy: 'timestamp_epoch',
  descending: true,
  nullsFirst: false,
  fromRow: mapAssetActivityLogRow,
})

export const assetActivityLogKeys = { list: logs.key }
export function useAssetActivityLogs(userId: string, enabled: boolean) {
  const { items, ...query } = logs.useList(userId, enabled)
  return { ...query, assetActivityLogs: items }
}

// Logs are only ever added. A bulk import writes all of its logs as one insert
// instead of one request per asset.
export function useAddAssetActivityLogs(userId: string) {
  return logs.useWrite<AssetActivityLog[]>(
    userId,
    'Save activity log',
    async created => {
      const { error } = await table('asset_activity_logs').insert(created.map(assetActivityLogToInsert))
      if (error) throw new Error(error.message)
    },
    (list, created) => [...created, ...list]
  )
}
