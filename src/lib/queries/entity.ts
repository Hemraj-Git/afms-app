import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db, type TableInsert, type TableRow, type TableUpdate } from '@/lib/supabase/typed'
import { showToast } from '@/lib/toast'
import type { Database } from '@/types/database'

// The shared shape of every entity moved off AFMSContext: a per-user cached
// list, and writes that update the cache immediately, roll back and toast if the
// database refuses, then re-read so the screen shows what is really stored.
// defineList is the read half (some tables are only written by database
// functions); defineEntity adds add / update / delete. An entity file only
// supplies its table name and the row <-> app-type mapping; see vendors.ts.

type TableName = keyof Database['public']['Tables']

export const NO_ROWS = 'nothing was changed (you may not have permission, or it no longer exists)'

type DbError = { message: string } | null
type Rows = PromiseLike<{ data: unknown[] | null; error: DbError }>
type OrderOptions = { ascending: boolean; nullsFirst?: boolean }

// The few query-builder calls the helper makes. The generated types are enforced
// where each entity maps rows (TableRow / TableInsert / TableUpdate); inside the
// generic helper the builder is used through this narrow shape instead, because
// TypeScript cannot resolve the table-specific overloads for a generic table name.
interface LooseTable {
  select(columns: string): Rows & { order(column: string, options?: OrderOptions): Rows }
  insert(rows: unknown[]): PromiseLike<{ error: DbError }>
  update(patch: unknown): { eq(column: string, value: string): { select(columns: string): Rows } }
  delete(): { eq(column: string, value: string): { select(columns: string): Rows } }
}

export const table = (name: TableName) => db.from(name) as unknown as LooseTable

// Codes already stored, so a new one is never computed from a stale or
// still-loading list on screen (that produced duplicate CAM-0001 codes once).
// `column` is 'code' unless the table calls it something else (room_number).
export async function fetchExistingCodes(name: TableName, column = 'code'): Promise<string[]> {
  const { data } = await table(name).select(column)
  return (data ?? []).map(r => (r as Record<string, string | null>)[column]).filter((c): c is string => Boolean(c))
}

// `base`, or `base-2`, `base-3`... if that code is taken.
export function uniqueCode(base: string, known: Iterable<string>): string {
  const taken = new Set(known)
  let code = base
  let suffix = 2
  while (taken.has(code)) {
    code = `${base}-${suffix}`
    suffix++
  }
  return code
}

export interface ListConfig<T extends { id: string }, K extends TableName> {
  table: K
  orderBy: string
  // Newest first (created_at / uploaded_at) rather than A-Z.
  descending?: boolean
  // Where rows with a null sort key go when descending; the database puts them
  // first unless this is false.
  nullsFirst?: boolean
  fromRow: (row: TableRow<K>) => T
}

export interface EntityConfig<T extends { id: string }, K extends TableName> extends ListConfig<T, K> {
  // Shown in the toast: "Add vendor failed and was undone: ..."
  label: string
  toInsert: (item: T) => TableInsert<K>
  toUpdate: (changes: Partial<T>) => TableUpdate<K>
  // Fields an update may never change, in the database or in the optimistic copy.
  immutable: (keyof T)[]
}

export function defineList<T extends { id: string }, K extends TableName>(cfg: ListConfig<T, K>) {
  // userId is part of the key so two people signing in on one browser never
  // share a cache; the rows are RLS-scoped per user.
  const key = (userId: string) => [cfg.table, userId] as const
  const EMPTY: T[] = []

  async function fetchAll(): Promise<T[]> {
    const options: OrderOptions = { ascending: !cfg.descending }
    if (cfg.nullsFirst !== undefined) options.nullsFirst = cfg.nullsFirst
    const { data, error } = await table(cfg.table).select('*').order(cfg.orderBy, options)
    if (error) throw new Error(error.message)
    return (data ?? []).map(row => cfg.fromRow(row as TableRow<K>))
  }

  function useList(userId: string, enabled: boolean) {
    const query = useQuery({ queryKey: key(userId), queryFn: fetchAll, enabled })
    // A stable empty array, so the list doesn't change identity every render
    // while nothing is loaded (it is used in effect dependency lists).
    return { ...query, items: query.data ?? EMPTY }
  }

  type Snapshot = { previous: T[] | undefined }

  interface WriteOptions<TVars, TResult> {
    // Set false when the caller already shows the failure itself (a form that
    // catches the rejection), so the user is not told twice.
    reportErrors?: boolean
    // Fold the write's result into the cached list once it has saved (e.g. the
    // row the database returned, with its minted ticket number).
    applyResult?: (list: T[], result: TResult, vars: TVars) => T[]
  }

  // A write that changes the cached list first and undoes it if it fails.
  function useWrite<TVars, TResult = void>(
    userId: string,
    action: string,
    write: (vars: TVars) => Promise<TResult>,
    apply: (list: T[], vars: TVars) => T[],
    options: WriteOptions<TVars, TResult> = {}
  ) {
    const qc = useQueryClient()
    const listKey = key(userId)
    return useMutation<TResult, Error, TVars, Snapshot>({
      mutationFn: write,
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData<T[]>(listKey)
        qc.setQueryData<T[]>(listKey, list => apply(list ?? [], vars))
        return { previous }
      },
      onSuccess: (result, vars) => {
        const { applyResult } = options
        if (applyResult) qc.setQueryData<T[]>(listKey, list => applyResult(list ?? [], result, vars))
      },
      onError: (error, _vars, snapshot) => {
        if (snapshot) qc.setQueryData(listKey, snapshot.previous)
        console.error(`Supabase ${action} error:`, error.message)
        if (options.reportErrors !== false) showToast('error', `${action} failed and was undone: ${error.message}`)
      },
      onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
    })
  }

  return { key, fetchAll, useList, useWrite }
}

export function defineEntity<T extends { id: string }, K extends TableName>(cfg: EntityConfig<T, K>) {
  const list = defineList(cfg)
  const { useWrite } = list

  function useAdd(userId: string) {
    return useWrite<T>(
      userId,
      `Add ${cfg.label}`,
      async item => {
        const { error } = await table(cfg.table).insert([cfg.toInsert(item)])
        if (error) throw new Error(error.message)
      },
      (rows, item) => [...rows, item]
    )
  }

  function useUpdate(userId: string) {
    return useWrite<{ id: string; changes: Partial<T> }>(
      userId,
      `Update ${cfg.label}`,
      async ({ id, changes }) => {
        const patch = cfg.toUpdate(changes)
        if (Object.keys(patch).length === 0) return
        const { data, error } = await table(cfg.table).update(patch).eq('id', id).select('id')
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) throw new Error(NO_ROWS)
      },
      (rows, { id, changes }) =>
        rows.map(item => {
          if (item.id !== id) return item
          const merged = { ...item, ...changes }
          for (const field of cfg.immutable) merged[field] = item[field]
          return merged
        })
    )
  }

  function useDelete(userId: string) {
    return useWrite<string>(
      userId,
      `Delete ${cfg.label}`,
      async id => {
        const { data, error } = await table(cfg.table).delete().eq('id', id).select('id')
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) throw new Error(NO_ROWS)
      },
      (rows, id) => rows.filter(item => item.id !== id)
    )
  }

  return { ...list, useAdd, useUpdate, useDelete }
}
