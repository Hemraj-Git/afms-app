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
    source: l.source || 'Manual',
    timestamp: l.timestamp,
    timestamp_epoch: l.timestampEpoch ?? null,
  }
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
