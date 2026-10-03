import type { Metadata } from 'next'
import { fieldFontVars } from '@/lib/fieldFonts'
import { FieldKit } from './FieldKit'

export const metadata: Metadata = { title: 'Field app kit | AssetNXG' }

// Every piece of the field app's design system, in its states, for checking
// against the redesign canvas. Admin-only (a desktop route; see routeAccess.ts).
export default function FieldKitPage() {
  return (
    <div className={`${fieldFontVars} min-h-screen bg-fa-bg font-plex text-fa-text antialiased`}>
      <FieldKit />
    </div>
  )
}
