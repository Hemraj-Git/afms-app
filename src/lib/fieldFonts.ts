import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'

// The field app's typefaces (see the redesign canvas): IBM Plex Sans for text,
// IBM Plex Mono for every record and asset ID. Self-hosted by next/font, so
// the phone never asks Google for them. Put `fieldFontVars` on the field app's
// root element; Tailwind's font-plex / font-plex-mono read these variables.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono-src',
  display: 'swap',
})

export const fieldFontVars = `${plexSans.variable} ${plexMono.variable}`
