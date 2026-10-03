import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildAssets, ASSET_TABLE_ORDER } from '@/lib/dataLoad/buildAssets'
import { buildMasters, MASTER_TABLE_ORDER, planCounts } from '@/lib/dataLoad/buildMasters'
import type { Issue } from '@/lib/dataLoad/coerce'
import { assetsContextFromMasters } from '@/lib/dataLoad/assetsFromMasters'
import { generateAssetsWorkbook } from '@/lib/dataLoad/generateAssets'
import { generateMastersWorkbook } from '@/lib/dataLoad/generateMasters'
import { readWorkbook } from '@/lib/dataLoad/readWorkbook'
import { issuesWorkbook, sortIssues, summarizeIssues } from '@/lib/dataLoad/report'
import { validateAssets } from '@/lib/dataLoad/validateAssets'
import { validateMasters } from '@/lib/dataLoad/validateMasters'
import {
  assertAssetSlaColumn, assetsContext, connect, findLoadedByHash, insertInOrder, LOADS_DIR, loadEnvFile,
  manifestPath, mastersSnapshot, readManifest, saveManifest, undoCreated, type Manifest,
} from './db'

// Usage (see docs/DATA-LOAD.md):
//   npm run data:masters-template -- [--out file.xlsx]
//   npm run data:assets-template  -- [--out file.xlsx] [--env .env.client]
//   npm run data:assets-template  -- --from-masters filled-masters.xlsx        (no database)
//   npm run data:load -- --stage masters|assets --file filled.xlsx [--env .env.client]              (dry run)
//   npm run data:load -- --stage masters|assets --file filled.xlsx --commit --target <host-part>   (writes)
//   npm run data:undo -- --manifest data-loads/<file>.json --target <host-part> [--env .env.client]

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | true> } {
  const [command = '', ...rest] = argv
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (!a.startsWith('--')) continue
    const next = rest[i + 1]
    if (next !== undefined && !next.startsWith('--')) { flags[a.slice(2)] = next; i++ } else flags[a.slice(2)] = true
  }
  return { command, flags }
}

const str = (v: string | true | undefined): string | undefined => (typeof v === 'string' ? v : undefined)

function fail(message: string): never {
  console.error(`\nERROR: ${message}\n`)
  process.exit(1)
}

function writeOut(file: string, data: Uint8Array): void {
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  writeFileSync(file, data)
}

function printIssues(issues: Issue[], limit = 40): void {
  const sorted = sortIssues(issues)
  for (const i of sorted.slice(0, limit)) {
    console.log(`  ${i.severity === 'error' ? 'ERROR  ' : 'warning'}  ${i.sheet}${i.row > 0 ? ` row ${i.row}` : ''}: ${i.message}`)
  }
  if (sorted.length > limit) console.log(`  ... and ${sorted.length - limit} more (see the report file)`)
}

async function saveReport(issues: Issue[], stage: string): Promise<string> {
  const file = path.join(LOADS_DIR, `report-${stage}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}.xlsx`)
  writeOut(file, await issuesWorkbook(issues))
  return file
}

function requireTarget(flags: Record<string, string | true>, host: string): void {
  const target = str(flags.target)
  if (!target) fail(`--target <part of the host name> is required with --commit / undo. The env file points at "${host}".`)
  if (!host.includes(target)) fail(`--target "${target}" does not match the database in the env file ("${host}"). Nothing was written.`)
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2))
  const envFile = str(flags.env) ?? '.env.local'

  if (command === 'masters-template') {
    const out = str(flags.out) ?? path.join(LOADS_DIR, 'AssetNXG-Masters-Workbook.xlsx')
    writeOut(out, await generateMastersWorkbook())
    console.log(`Masters workbook written to ${out}`)
    return
  }

  if (command === 'assets-template') {
    // From a filled Masters workbook, before anything is loaded: the client can
    // start on the equipment list while the masters wait for deployment day.
    // Tabs carry no database id; they are matched by "Category / Sub-category".
    const fromMasters = str(flags['from-masters'])
    if (fromMasters) {
      if (!existsSync(fromMasters)) fail(`File not found: ${fromMasters}`)
      const sheets = await readWorkbook(new Uint8Array(readFileSync(fromMasters)), {}, 60)
      const { data, issues } = validateMasters(sheets)
      const { errors, warnings } = summarizeIssues(issues)
      if (issues.length) printIssues(issues)
      if (errors > 0) fail(`The Masters workbook has ${errors} error(s). Fix them (or ask the client to) before making the Assets workbook.`)
      const out = str(flags.out) ?? path.join(LOADS_DIR, 'AssetNXG-Assets-Workbook.xlsx')
      const template = assetsContextFromMasters(data)
      writeOut(out, await generateAssetsWorkbook(template))
      const categories = new Set(template.subCategories.map(s => s.categoryName))
      console.log(
        `\nAssets workbook written to ${out}\n` +
          `  ${categories.size} categories (one tab each), ${template.subCategories.length} sub-categories to choose from, ` +
          `${template.rooms.length} rooms and ${template.vendors.length} vendor(s) in the dropdowns` +
          `${warnings ? `, ${warnings} warning(s) above` : ''}.\n` +
          `  Built from ${path.basename(fromMasters)}, not from a database: load that same Masters file before loading the returned assets.`
      )
      return
    }

    loadEnvFile(envFile)
    const { client, host } = connect()
    const { template } = await assetsContext(client)
    const out = str(flags.out) ?? path.join(LOADS_DIR, 'AssetNXG-Assets-Workbook.xlsx')
    writeOut(out, await generateAssetsWorkbook(template))
    console.log(`Assets workbook written to ${out} (${template.subCategories.length} sub-categories, ${template.rooms.length} rooms, ${template.vendors.length} vendors, from ${host})`)
    return
  }

  if (command === 'load') {
    const stage = str(flags.stage)
    const file = str(flags.file)
    if (stage !== 'masters' && stage !== 'assets') fail('--stage must be masters or assets.')
    if (!file || !existsSync(file)) fail('--file <filled workbook.xlsx> is required and must exist.')
    const commit = flags.commit === true

    loadEnvFile(envFile)
    const { client, host } = connect()
    if (commit) requireTarget(flags, host)
    console.log(`Database: ${host}`)
    console.log(commit ? 'Mode: COMMIT (will write)' : 'Mode: dry run (nothing is written)')

    const bytes = readFileSync(file)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const already = findLoadedByHash(hash, stage)
    if (already) fail(`This exact file was already loaded (${already}). Undo that load first, or use an edited file.`)

    const sheets = await readWorkbook(new Uint8Array(bytes), {}, stage === 'assets' ? 120 : 60)
    const now = new Date()
    let issues: Issue[] = []
    let order: readonly string[]
    let rows: Record<string, { id?: string }[]>

    if (stage === 'masters') {
      const { data, issues: v } = validateMasters(sheets)
      issues = v
      const plan = buildMasters(data, await mastersSnapshot(client), randomUUID, now)
      issues = [...issues, ...plan.conflicts]
      order = MASTER_TABLE_ORDER
      rows = plan.rows as unknown as typeof rows
      const counts = planCounts(plan)
      console.log('\nWould create: ' + MASTER_TABLE_ORDER.map(t => `${counts[t]} ${t}`).join(', '))
    } else {
      const c = await assetsContext(client)
      const { assets, issues: v } = validateAssets(sheets, c.ctx)
      issues = v
      const plan = buildAssets(assets, c.ctx, c.templates, c.existing, randomUUID, now)
      order = ASSET_TABLE_ORDER
      rows = plan as unknown as typeof rows
      console.log(`\nWould create: ${plan.assets.length} assets, ${plan.work_orders.length} preventive work orders, ${plan.inspections.length} inspections, ${plan.asset_activity_logs.length} history entries`)
    }

    const { errors, warnings } = summarizeIssues(issues)
    console.log(`\n${errors} error(s), ${warnings} warning(s)`)
    if (issues.length) {
      printIssues(issues)
      console.log(`Full list: ${await saveReport(issues, stage)}`)
    }
    if (errors > 0) fail('Fix the errors above and run again. Nothing was written.')
    if (!commit) {
      console.log('\nDry run only. Nothing was written. Re-run with --commit --target <host-part> to load.')
      return
    }

    if (stage === 'assets') await assertAssetSlaColumn(client)

    const manifestFile = manifestPath(stage, now)
    const manifest: Manifest = {
      stage, file: path.basename(file), fileHash: hash, target: host, createdAt: now.toISOString(),
      status: 'in-progress', created: {},
    }
    saveManifest(manifestFile, manifest)
    try {
      await insertInOrder(client, order, rows, manifest, manifestFile, (t, d, n) => console.log(`  ${t}: ${d}/${n}`))
    } catch (e) {
      console.error(`\nLoad failed: ${(e as Error).message}\nRolling back what was written...`)
      const problems = await undoCreated(client, order, manifest.created)
      manifest.status = problems.length ? 'in-progress' : 'rolled-back'
      saveManifest(manifestFile, manifest)
      if (problems.length) fail(`Rollback incomplete:\n  ${problems.join('\n  ')}\nSee ${manifestFile}`)
      fail('Rolled back. Nothing is left from this load.')
    }
    manifest.status = 'committed'
    saveManifest(manifestFile, manifest)
    console.log(`\nDone. Manifest: ${manifestFile}\nTo remove this load: npm run data:undo -- --manifest ${manifestFile} --target ${host.split('.')[0]}`)
    return
  }

  if (command === 'undo') {
    const file = str(flags.manifest)
    if (!file || !existsSync(file)) fail('--manifest <data-loads/....json> is required and must exist.')
    loadEnvFile(envFile)
    const { client, host } = connect()
    requireTarget(flags, host)
    const manifest = readManifest(file)
    if (manifest.target !== host) fail(`This load was made on "${manifest.target}", but the env file points at "${host}".`)
    if (manifest.status === 'undone') fail('This load was already undone.')
    const order = manifest.stage === 'masters' ? MASTER_TABLE_ORDER : ASSET_TABLE_ORDER
    const problems = await undoCreated(client, order, manifest.created)
    if (problems.length) fail(`Some rows could not be removed (something else now refers to them?):\n  ${problems.join('\n  ')}`)
    manifest.status = 'undone'
    saveManifest(file, manifest)
    const total = Object.values(manifest.created).reduce((n, ids) => n + ids.length, 0)
    console.log(`Removed ${total} rows created by ${path.basename(file)}. (Number sequences are not rewound; the next numbers simply continue.)`)
    return
  }

  fail('Unknown command. Use: masters-template | assets-template | load | undo (see docs/DATA-LOAD.md).')
}

main().catch(e => fail((e as Error).message))
