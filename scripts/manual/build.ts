// Renders the user manuals in docs/manual/src/*.html to A4 PDFs with Chromium,
// with the client's details (clients/<id>.json) filled in.
//
//   npx tsx scripts/manual/build.ts                          # every guide, for SoMS
//   npx tsx scripts/manual/build.ts --client abc admin-guide
//
// Output: docs/manual/out/<id>/AssetNXG-<Title>.pdf. The HTML refers to the
// screenshots in docs/manual/shots/ (take them from that client's app first)
// and the logos in public/images/.

import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fillClient, loadClient } from '../client-setup/client'

const SRC = 'docs/manual/src'
const OUT = 'docs/manual/out'

const GUIDES: Record<string, { file: string; footer: string }> = {
  'admin-guide': { file: 'AssetNXG-Administrator-Guide.pdf', footer: 'Administrator Guide' },
  'field-guide': { file: 'AssetNXG-Field-App-Guide.pdf', footer: 'Field App Guide' },
  'quick-cards': { file: 'AssetNXG-Quick-Reference-Cards.pdf', footer: 'Quick Reference Cards' },
  'getting-started': { file: 'AssetNXG-Getting-Started.pdf', footer: 'Getting Started' },
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const footer = (title: string, clientName: string) => `
  <div style="width:100%; padding:0 16mm; font-family:'Segoe UI', Arial, sans-serif; font-size:7.5pt; color:#94a3b8; display:flex; justify-content:space-between;">
    <span>AssetNXG &middot; ${title}</span>
    <span>${escapeHtml(clientName)}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`

async function main() {
  const args = process.argv.slice(2)
  const at = args.indexOf('--client')
  const client = loadClient(at >= 0 ? args[at + 1] : 'soms')
  const only = args.filter((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1))
  const out = path.join(OUT, client.id)
  if (!existsSync(out)) mkdirSync(out, { recursive: true })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    for (const name of readdirSync(SRC).filter(f => f.endsWith('.html') && !f.startsWith('.')).map(f => f.replace(/\.html$/, ''))) {
      const guide = GUIDES[name]
      if (!guide || (only.length && !only.includes(name))) continue
      // Filled in next to the source, so its relative links to shots/ and public/ still work.
      const filled = path.resolve(SRC, `.${name}.${client.id}.html`)
      writeFileSync(filled, fillClient(readFileSync(path.join(SRC, `${name}.html`), 'utf8'), client, '../../../public'))
      try {
        await page.goto(pathToFileURL(filled).href, { waitUntil: 'load' })
        // Every screenshot decoded before printing.
        await page.evaluate(() => Promise.all([...document.images].map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = r })))))
        const missing = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')))
        if (missing.length) console.warn(`  ${name}: missing images: ${missing.join(', ')}`)
        const file = path.join(out, guide.file)
        await page.pdf({
          path: file,
          format: 'A4',
          printBackground: true,
          margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: footer(guide.footer, client.name),
        })
        console.log(`${file}  ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`)
      } finally {
        rmSync(filled, { force: true })
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
