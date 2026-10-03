// Builds the app / notification icons in public/icons, and the browser-tab
// favicon, from the AssetNXG hexagon.
// Run after changing the logo files:  node scripts/make-icons.mjs
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const SRC = 'public/images/assetnxg-mark.svg' // the blue hexagon
const BADGE_SRC = 'public/images/assetnxg-hexagon-white.svg' // white outline, for the status-bar badge
const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

const clear = { r: 0, g: 0, b: 0, alpha: 0 }
const logoAt = (src, size) => sharp(src, { density: 600 }).resize(size, size, { fit: 'contain', background: clear }).png().toBuffer()

// The logo centred on a square background, taking `fill` of the width.
async function square(size, fill, background, file) {
  const logo = await logoAt(SRC, Math.round(size * fill))
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${OUT}/${file}`)
}

const white = { r: 255, g: 255, b: 255, alpha: 1 }
await square(192, 0.78, white, 'icon-192.png')
await square(512, 0.78, white, 'icon-512.png')
// Android crops maskable icons to a circle: keep the logo inside the safe zone.
await square(512, 0.6, white, 'icon-maskable-512.png')
await square(180, 0.78, white, 'apple-touch-icon.png')

// Android's status-bar badge uses only the alpha channel: the logo's shape in white.
const badgeSize = 96
const inner = Math.round(badgeSize * 0.9)
const shape = await sharp(BADGE_SRC, { density: 600 })
  .resize(inner, inner, { fit: 'contain', background: clear })
  .ensureAlpha()
  .extractChannel('alpha')
  .toBuffer()
const whiteShape = await sharp({ create: { width: inner, height: inner, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .joinChannel(shape)
  .png()
  .toBuffer()
await sharp({ create: { width: badgeSize, height: badgeSize, channels: 4, background: clear } })
  .composite([{ input: whiteShape, gravity: 'center' }])
  .png()
  .toFile(`${OUT}/badge-96.png`)

// favicon.ico: 16, 32 and 48 px PNGs in one ICO file (transparent background).
const sizes = [16, 32, 48]
const pngs = await Promise.all(sizes.map(s => logoAt(SRC, s)))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = 6 + 16 * sizes.length
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(s, 0)
  e.writeUInt8(s, 1)
  e.writeUInt16LE(1, 4) // colour planes
  e.writeUInt16LE(32, 6) // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += pngs[i].length
  return e
})
writeFileSync('src/app/favicon.ico', Buffer.concat([header, ...entries, ...pngs]))

console.log('icons written to', OUT, 'and src/app/favicon.ico')
