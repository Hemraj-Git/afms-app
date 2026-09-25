import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { MastersSnapshot } from '@/lib/dataLoad/buildMasters'
import type { TemplateForScheduling } from '@/lib/dataLoad/buildAssets'
import type { AssetsTemplateContext } from '@/lib/dataLoad/generateAssets'
import type { AssetsContext } from '@/lib/dataLoad/validateAssets'
import type { FieldDef } from '@/lib/dataLoad/validateMasters'

// Everything here talks to the database with the service-role key, so it can read and
// write past row-level security. It runs only on our own machine, on purpose, against
// the project named by the env file.

export const LOADS_DIR = 'data-loads'

export function loadEnvFile(file: string): void {
  if (!existsSync(file)) throw new Error(`Env file not found: ${file}`)
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

export function connect(): { client: SupabaseClient; host: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the env file.')
  return {
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    host: new URL(url).hostname,
  }
}

// PostgREST returns at most 1000 rows a request, so read in pages.
export async function fetchAll<T = Record<string, unknown>>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(columns).order('id', { ascending: true }).range(from, from + 999)
    if (error) throw new Error(`Could not read ${table}: ${error.message}`)
    out.push(...((data ?? []) as unknown as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

type Row = Record<string, unknown>
const s = (v: unknown) => (v == null ? '' : String(v))

export async function mastersSnapshot(client: SupabaseClient): Promise<MastersSnapshot> {
  const [campuses, buildings, rooms, vendors, categories, subs, templates] = await Promise.all([
    fetchAll<Row>(client, 'campuses', 'id,name,code'),
    fetchAll<Row>(client, 'buildings', 'id,name,code,campus_id'),
    fetchAll<Row>(client, 'rooms', 'id,name,room_number,building_id'),
    fetchAll<Row>(client, 'vendors', 'id,name,code'),
    fetchAll<Row>(client, 'categories', 'id,name,code'),
    fetchAll<Row>(client, 'sub_categories', 'id,name,code,category_id'),
    fetchAll<Row>(client, 'checklist_templates', 'id,title,type'),
  ])
  return {
    campuses: campuses.map(c => ({ id: s(c.id), name: s(c.name), code: s(c.code) })),
    buildings: buildings.map(b => ({ id: s(b.id), name: s(b.name), code: s(b.code), campus_id: (b.campus_id as string) ?? null })),
    rooms: rooms.map(r => ({ name: s(r.name), room_number: s(r.room_number), building_id: (r.building_id as string) ?? null })),
    vendors: vendors.map(v => ({ name: s(v.name), code: (v.code as string) ?? null })),
    categories: categories.map(c => ({ id: s(c.id), name: s(c.name), code: s(c.code) })),
    subCategories: subs.map(x => ({ name: s(x.name), code: s(x.code), category_id: (x.category_id as string) ?? null })),
    templates: templates.map(t => ({ title: s(t.title), type: s(t.type) })),
  }
}

const toFields = (raw: unknown): FieldDef[] =>
  (Array.isArray(raw) ? (raw as Row[]) : [])
    .map(f => ({
      key: s(f.key), label: s(f.label), type: (s(f.type) || 'Text') as FieldDef['type'],
      unit: s(f.unit) || undefined, required: Boolean(f.required), order: Number(f.order) || 0,
    }))
    .sort((a, b) => a.order - b.order)

export async function assetsContext(client: SupabaseClient) {
  const [campuses, buildings, rooms, vendors, categories, subs, templates, assets, inspections] = await Promise.all([
    fetchAll<Row>(client, 'campuses', 'id,name'),
    fetchAll<Row>(client, 'buildings', 'id,name,campus_id'),
    fetchAll<Row>(client, 'rooms', 'id,name,building_id'),
    fetchAll<Row>(client, 'vendors', 'id,name'),
    fetchAll<Row>(client, 'categories', 'id,name'),
    fetchAll<Row>(client, 'sub_categories', 'id,code,name,category_id,metadata_fields,pm_template_ids,inspection_template_ids'),
    fetchAll<Row>(client, 'checklist_templates', 'id,title,interval,items'),
    fetchAll<Row>(client, 'assets', 'id,asset_id,serial_number,sub_category_id'),
    fetchAll<Row>(client, 'inspections', 'id,inspection_number'),
  ])
  const campusName = new Map(campuses.map(c => [s(c.id), s(c.name)]))
  const building = new Map(buildings.map(b => [s(b.id), b]))
  const categoryName = new Map(categories.map(c => [s(c.id), s(c.name)]))
  const roomLabel = (r: Row) => {
    const b = building.get(s(r.building_id))
    return `${campusName.get(s(b?.campus_id)) ?? ''} / ${s(b?.name)} / ${s(r.name)}`
  }

  const subCategories = subs.map(x => ({
    id: s(x.id), code: s(x.code), name: s(x.name), categoryName: categoryName.get(s(x.category_id)) ?? '',
    fields: toFields(x.metadata_fields),
    pmTemplateIds: ((x.pm_template_ids as string[] | null) ?? []),
    inspectionTemplateIds: ((x.inspection_template_ids as string[] | null) ?? []),
  }))
  const ctx: AssetsContext = {
    subCategories,
    rooms: rooms.map(r => ({ id: s(r.id), label: roomLabel(r) })),
    vendors: vendors.map(v => ({ id: s(v.id), name: s(v.name) })),
    existingSerials: assets
      .filter(a => s(a.serial_number))
      .map(a => ({ subCategoryId: s(a.sub_category_id), serial: s(a.serial_number) })),
  }
  const schedTemplates: TemplateForScheduling[] = templates.map(t => ({
    id: s(t.id), title: s(t.title), interval: (t.interval as string) ?? null, items: t.items,
  }))
  const template: AssetsTemplateContext = {
    subCategories: subCategories
      .map(x => ({ id: x.id, code: x.code, name: x.name, categoryName: x.categoryName, fields: x.fields }))
      .sort((a, b) => `${a.categoryName}/${a.name}`.localeCompare(`${b.categoryName}/${b.name}`)),
    rooms: ctx.rooms.map(r => r.label).sort((a, b) => a.localeCompare(b)),
    vendors: ctx.vendors.map(v => v.name).sort((a, b) => a.localeCompare(b)),
  }
  return {
    ctx,
    template,
    templates: schedTemplates,
    existing: { assetIds: assets.map(a => s(a.asset_id)), inspectionNumbers: inspections.map(i => s(i.inspection_number)) },
  }
}

export async function assertAssetSlaColumn(client: SupabaseClient): Promise<void> {
  const { error } = await client.from('assets').select('sla_priority').limit(1)
  if (error) {
    throw new Error(`The assets table has no sla_priority column (${error.message}). Apply migration 0042_asset_sla_priority.sql first.`)
  }
}

// ---- manifest, commit, undo ----

export interface Manifest {
  stage: 'masters' | 'assets'
  file: string
  fileHash: string
  target: string
  createdAt: string
  status: 'in-progress' | 'committed' | 'undone' | 'rolled-back'
  created: Record<string, string[]>
}

export function manifestPath(stage: string, when: Date): string {
  const stamp = when.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
  return path.join(LOADS_DIR, `${stamp}-${stage}.json`)
}

export function saveManifest(file: string, m: Manifest): void {
  mkdirSync(LOADS_DIR, { recursive: true })
  writeFileSync(file, JSON.stringify(m, null, 2))
}

export function readManifest(file: string): Manifest {
  return JSON.parse(readFileSync(file, 'utf8')) as Manifest
}

// A file that was already loaded (and not undone) must not be loaded a second time.
export function findLoadedByHash(hash: string, stage: string): string | null {
  if (!existsSync(LOADS_DIR)) return null
  for (const f of readdirSync(LOADS_DIR).filter(x => x.endsWith('.json'))) {
    try {
      const m = readManifest(path.join(LOADS_DIR, f))
      if (m.fileHash === hash && m.stage === stage && (m.status === 'committed' || m.status === 'in-progress')) return f
    } catch { /* not a manifest */ }
  }
  return null
}

const chunks = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export async function insertInOrder(
  client: SupabaseClient,
  order: readonly string[],
  rows: Record<string, { id?: string }[]>,
  manifest: Manifest,
  manifestFile: string,
  onProgress: (table: string, done: number, total: number) => void
): Promise<void> {
  for (const table of order) {
    const list = rows[table] ?? []
    manifest.created[table] ??= []
    let done = 0
    for (const part of chunks(list, 200)) {
      const { error } = await client.from(table).insert(part)
      if (error) throw new Error(`${table}: ${error.message}`)
      manifest.created[table].push(...part.map(r => String(r.id)))
      done += part.length
      saveManifest(manifestFile, manifest)
      onProgress(table, done, list.length)
    }
  }
}

// Deletes what a load created, newest dependency first. Returns a list of problems.
export async function undoCreated(
  client: SupabaseClient,
  order: readonly string[],
  created: Record<string, string[]>
): Promise<string[]> {
  const problems: string[] = []
  for (const table of [...order].reverse()) {
    for (const part of chunks(created[table] ?? [], 100)) {
      const { error } = await client.from(table).delete().in('id', part)
      if (error) problems.push(`${table}: ${error.message}`)
    }
  }
  return problems
}
