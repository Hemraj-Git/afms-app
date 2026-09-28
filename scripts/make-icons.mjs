// Builds the app / notification icons in public/icons from the HMS logo.
// Run after changing public/images/hms-logo.svg:  node scripts/make-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = 'public/images/hms-logo.svg'
const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

// The logo centred on a square background, taking `fill` of the width.
async function square(size, fill, background, file) {
  const inner = Math.round(size * fill)
  const logo = await sharp(SRC, { density: 600 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
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
const shape = await sharp(SRC, { density: 600 })
  .resize(Math.round(badgeSize * 0.84), Math.round(badgeSize * 0.84), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .extractChannel('alpha')
  .toBuffer()
const whiteShape = await sharp({ create: { width: Math.round(badgeSize * 0.84), height: Math.round(badgeSize * 0.84), channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .joinChannel(shape)
  .png()
  .toBuffer()
await sharp({ create: { width: badgeSize, height: badgeSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: whiteShape, gravity: 'center' }])
  .png()
  .toFile(`${OUT}/badge-96.png`)

console.log('icons written to', OUT)
