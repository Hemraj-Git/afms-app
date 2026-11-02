import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { loadEnvFile } from '../data/db'
import { fillClient, inviteSubject, loadClient, RECOVERY_SUBJECT } from './client'

// Sets up the database of a NEW client's Supabase project (see docs/NEW-CLIENT.md):
// the whole schema from supabase/baseline/0000_baseline.sql, then every migration
// after the baseline, in one transaction, then checks the result against the
// fingerprint of the SoMS schema.
//
//   npm run client:db -- --env .env.<client> --target <project-ref>            (check only)
//   npm run client:db -- --env .env.<client> --target <project-ref> --commit   (writes)
//   npm run client:fingerprint -- --env .env.<client>
//   npm run client:kit -- --client <id>        (emails and settings from clients/<id>.json)
//
// The env file needs SUPABASE_DB_URL (Supabase → Connect → Session pooler) and
// NEXT_PUBLIC_SUPABASE_URL. It refuses any database that already has the app, so
// it can never run over SoMS or a client already live.

const BASELINE = 'supabase/baseline/0000_baseline.sql'
const FINGERPRINT = 'supabase/baseline/fingerprint.sql'
const EXPECTED = 'supabase/baseline/expected-fingerprint.json'
const MIGRATIONS = 'supabase/migrations'
// The last migration already inside the baseline.
const BASELINE_UPTO = 56

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

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

function laterMigrations(): string[] {
  return readdirSync(MIGRATIONS)
    .filter(f => /^\d{4}_.*\.sql$/.test(f) && Number(f.slice(0, 4)) > BASELINE_UPTO)
    .sort()
}

async function open(envFile: string): Promise<{ db: Client; ref: string }> {
  loadEnvFile(envFile)
  const dbUrl = process.env.SUPABASE_DB_URL
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!dbUrl || !apiUrl) fail(`SUPABASE_DB_URL and NEXT_PUBLIC_SUPABASE_URL must be set in ${envFile}.`)
  const ref = new URL(apiUrl).hostname.split('.')[0]
  // Pooler URLs carry the ref in the user name (postgres.<ref>), direct ones in the host.
  if (!dbUrl.includes(ref)) fail(`SUPABASE_DB_URL in ${envFile} is not for the project in NEXT_PUBLIC_SUPABASE_URL (${ref}).`)
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await db.connect()
  return { db, ref }
}

async function fingerprint(db: Client): Promise<Record<string, { items: number; hash: string }>> {
  const { rows } = await db.query<{ part: string; items: string; hash: string }>(read(FINGERPRINT))
  return Object.fromEntries(rows.map(r => [r.part, { items: Number(r.items), hash: r.hash }]))
}

function compare(actual: Record<string, { items: number; hash: string }>): boolean {
  const expected = JSON.parse(read(EXPECTED)).parts as Record<string, { items: number; hash: string }>
  let same = true
  for (const part of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
    const e = expected[part], a = actual[part]
    const ok = e && a && e.hash === a.hash
    if (!ok) same = false
    console.log(`  ${ok ? 'same     ' : 'DIFFERENT'}  ${part.padEnd(16)} ${a?.items ?? 0} (SoMS ${e?.items ?? 0})`)
  }
  return same
}

// The client's emails, filled in, and the settings to type into Supabase and Vercel.
function kit(id: string): void {
  const c = loadClient(id)
  const dir = path.join('clients', 'out', id)
  mkdirSync(dir, { recursive: true })
  for (const name of ['invite', 'recovery']) {
    writeFileSync(path.join(dir, `${name}.html`), fillClient(read(`supabase/templates/${name}.html`), c))
  }
  const site = `https://${c.domain}`
  const ref = c.supabaseRef || '<project-ref>'
  writeFileSync(path.join(dir, 'settings.md'), `# ${c.name}: settings

## Supabase (project ${ref})

Authentication → URL Configuration
- Site URL: ${site}
- Redirect URLs: ${site}/**

Authentication → Emails → Templates (paste the whole file into *Message body*)
- Invite user: subject \`${inviteSubject(c)}\`, body \`invite.html\`
- Reset password: subject \`${RECOVERY_SUBJECT}\`, body \`recovery.html\`

## Vercel (Production and Preview)

\`\`\`
NEXT_PUBLIC_CLIENT_NAME=${c.name}
NEXT_PUBLIC_CLIENT_SHORT_NAME=${c.shortName}
NEXT_PUBLIC_CLIENT_LOGO_URL=${c.logo}
NEXT_PUBLIC_CLIENT_LOGO_MARK_URL=${c.logoMark}
NEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co
\`\`\`
Plus, from the client's Supabase project (never in git or chat): NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY. And the same four Sentry variables as SoMS.
`)
  for (const f of [c.logo, c.logoMark]) if (!existsSync(path.join('public', f))) console.warn(`  Logo file missing: public${f}`)
  console.log(`Written to ${dir}: invite.html, recovery.html, settings.md`)
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2))
  if (command === 'kit') {
    const id = str(flags.client)
    if (!id) fail('--client <id> is required (clients/<id>.json).')
    kit(id)
    return
  }
  const envFile = str(flags.env)
  if (!envFile) fail('--env .env.<client> is required.')
  if (envFile.replace(/^\.\//, '') === '.env.local') fail('.env.local is the SoMS / development project. Use the new client\'s env file.')

  const { db, ref } = await open(envFile)
  try {
    if (command === 'fingerprint') {
      compare(await fingerprint(db))
      return
    }
    if (command !== 'db') fail(`Unknown command "${command}". Use db or fingerprint.`)

    const target = str(flags.target)
    if (target !== ref) fail(`--target must be the project ref of the env file's database ("${ref}"). Nothing was written.`)

    const { rows } = await db.query<{ tables: string }>(`select count(*) as tables from pg_tables where schemaname = 'public'`)
    if (Number(rows[0].tables) > 0) {
      fail(`Project ${ref} already has ${rows[0].tables} tables in public. This sets up empty projects only. Nothing was written.`)
    }

    const later = laterMigrations()
    console.log(`Project ${ref}: empty. Will run the baseline (up to ${String(BASELINE_UPTO).padStart(4, '0')})${later.length ? ` and ${later.join(', ')}` : ''}.`)
    if (flags.commit !== true) {
      console.log('\nCheck only. Nothing was written. Re-run with --commit to set up the database.')
      return
    }

    await db.query('begin')
    try {
      await db.query(read(BASELINE))
      for (const f of later) {
        console.log(`  ${f}`)
        await db.query(read(path.join(MIGRATIONS, f)))
      }
      await db.query('commit')
    } catch (err) {
      await db.query('rollback')
      throw err
    }
    console.log('\nDone. Compared with SoMS:')
    const same = compare(await fingerprint(db))
    console.log(same ? '\nThe schema matches SoMS.' : later.length
      ? '\nDifferences are expected for the parts the later migrations change; check them.'
      : '\nThe schema does NOT match SoMS. Check the parts marked DIFFERENT.')
  } finally {
    await db.end()
  }
}

main().catch(err => fail(err instanceof Error ? err.message : String(err)))
