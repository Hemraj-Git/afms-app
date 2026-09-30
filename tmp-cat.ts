import { readFileSync } from 'node:fs'
import { readWorkbook } from './src/lib/dataLoad/readWorkbook'
import { validateMasters } from './src/lib/dataLoad/validateMasters'

async function main() {
  const sheets = await readWorkbook(readFileSync('data-loads/AFMS-Masters-Workbook.xlsx'))
  const { data } = validateMasters(sheets)
  const byCat = new Map<string, typeof data.subCategories>()
  for (const s of data.subCategories) {
    if (!byCat.has(s.category)) byCat.set(s.category, [])
    byCat.get(s.category)!.push(s)
  }
  console.log('CATEGORY                 SUBS  DISTINCT CUSTOM FIELDS (by label)')
  for (const [cat, subs] of byCat) {
    const labels = new Map<string, Set<string>>()
    for (const s of subs) for (const f of s.fields) {
      if (!labels.has(f.label)) labels.set(f.label, new Set())
      labels.get(f.label)!.add(`${f.type}${f.unit ? ' ' + f.unit : ''}`)
    }
    const clashes = [...labels].filter(([, v]) => v.size > 1)
    console.log(`  ${cat.padEnd(22)} ${String(subs.length).padStart(4)}  ${labels.size}  ${clashes.length ? `<- ${clashes.length} label(s) with differing type/unit` : ''}`)
    if (labels.size) console.log(`       ${[...labels.keys()].join(' | ')}`)
    for (const [l, v] of clashes) console.log(`       CLASH  ${l}: ${[...v].join('  /  ')}`)
  }
  const required = data.subCategories.flatMap(s => s.fields.filter(f => f.required).map(f => `${s.category}/${s.name}: ${f.label}`))
  console.log(`\nRequired custom fields overall: ${required.length}`)
  required.slice(0, 10).forEach(r => console.log('   ' + r))
}
main()
