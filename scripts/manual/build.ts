// Renders the user manuals in docs/manual/src/*.html to A4 PDFs with Chromium.
//
//   npx tsx scripts/manual/build.ts            # every guide
//   npx tsx scripts/manual/build.ts admin-guide
//
// Output: docs/manual/out/AssetNXG-<Title>.pdf. The HTML refers to the
// screenshots in docs/manual/shots/ and the logos in public/images/.

import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SRC = 'docs/manual/src'
const OUT = 'docs/manual/out'

const GUIDES: Record<string, { file: string; footer: string }> = {
  'admin-guide': { file: 'AssetNXG-Administrator-Guide.pdf', footer: 'Administrator Guide' },
  'field-guide': { file: 'AssetNXG-Field-App-Guide.pdf', footer: 'Field App Guide' },
  'quick-cards': { file: 'AssetNXG-Quick-Reference-Cards.pdf', footer: 'Quick Reference Cards' },
  'getting-started': { file: 'AssetNXG-Getting-Started.pdf', footer: 'Getting Started' },
}

const footer = (title: string) => `
  <div style="width:100%; padding:0 16mm; font-family:'Segoe UI', Arial, sans-serif; font-size:7.5pt; color:#94a3b8; display:flex; justify-content:space-between;">
    <span>AssetNXG &middot; ${title}</span>
    <span>School of Maritime Studies, Centurion University</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`

async function main() {
  const only = process.argv.slice(2)
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    for (const name of readdirSync(SRC).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''))) {
      const guide = GUIDES[name]
      if (!guide || (only.length && !only.includes(name))) continue
      await page.goto(pathToFileURL(path.resolve(SRC, `${name}.html`)).href, { waitUntil: 'load' })
      // Every screenshot decoded before printing.
      await page.evaluate(() => Promise.all([...document.images].map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = r })))))
      const missing = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')))
      if (missing.length) console.warn(`  ${name}: missing images: ${missing.join(', ')}`)
      const file = path.join(OUT, guide.file)
      await page.pdf({
        path: file,
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footer(guide.footer),
      })
      console.log(`${file}  ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`)
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
