import { existsSync, readFileSync } from 'node:fs'

// A client's details (clients/<id>.json) and the %%PLACEHOLDERS%% they fill in the
// email templates and the user guides. See clients/README.md.

export type ClientConfig = {
  id: string
  name: string
  orgName: string
  shortName: string
  domain: string
  logo: string
  logoMark: string
  firstAdmin: string
  supabaseRef: string
  // The Getting Started row on master data. Optional: until the client's own
  // masters are loaded it says they will be.
  masterDataLabel?: string
  masterData?: string
  // The edition date on the guide covers, e.g. "October 2026"; else the month they are built.
  guidesDate?: string
}

const MASTER_DATA_LABEL = 'Master data'
const MASTER_DATA = 'Loaded by HMS - Digital Solutions from your master data workbook before you go live: your campus, buildings, rooms, categories and sub-categories with their custom fields, room types, departments and SLA hours'

const FIELDS: (keyof ClientConfig)[] = ['id', 'name', 'orgName', 'shortName', 'domain', 'logo', 'logoMark', 'firstAdmin', 'supabaseRef']
// May stay "" until known; whatever needs them says so.
const LATER: (keyof ClientConfig)[] = ['firstAdmin', 'supabaseRef']

export function loadClient(id: string): ClientConfig {
  const file = `clients/${id}.json`
  if (!existsSync(file)) throw new Error(`No client file ${file}. Copy clients/soms.json and fill it in.`)
  const client = JSON.parse(readFileSync(file, 'utf8')) as Partial<ClientConfig>
  const missing = FIELDS.filter(f => typeof client[f] !== 'string' || (!LATER.includes(f) && !client[f]!.trim()))
  if (missing.length) throw new Error(`${file} is missing: ${missing.join(', ')}`)
  if (client.id !== id) throw new Error(`${file} has id "${client.id}", expected "${id}".`)
  return client as ClientConfig
}

/** The subject of the invitation email (Supabase → Authentication → Emails). */
export const inviteSubject = (c: ClientConfig) => `You're invited to AssetNXG — ${c.orgName}`
export const RECOVERY_SUBJECT = 'Reset your AssetNXG password'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Fills the placeholders in an HTML file. `logoPrefix` turns the logo's web path
 * into a file path for the guides, which are opened from docs/manual/src.
 */
export function fillClient(html: string, c: ClientConfig, logoPrefix = ''): string {
  const values: Record<string, string> = {
    CLIENT_NAME: c.name,
    CLIENT_ORG: c.orgName,
    CLIENT_SHORT: c.shortName,
    CLIENT_DOMAIN: c.domain,
    CLIENT_LOGO: logoPrefix + c.logo,
    FIRST_ADMIN: c.firstAdmin,
    MASTER_DATA_LABEL: c.masterDataLabel || MASTER_DATA_LABEL,
    MASTER_DATA: c.masterData || MASTER_DATA,
    GUIDES_DATE: c.guidesDate || new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
  }
  return html.replace(/%%([A-Z_]+)%%/g, (m, key: string) => {
    if (!(key in values)) throw new Error(`Unknown placeholder ${m}`)
    if (!values[key].trim()) throw new Error(`${m} is needed here: fill it in clients/${c.id}.json`)
    return escapeHtml(values[key])
  })
}
