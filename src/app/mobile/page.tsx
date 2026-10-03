import type { Metadata } from 'next'
import { fieldFontVars } from '@/lib/fieldFonts'
import { FieldApp } from './FieldApp'

export const metadata: Metadata = { title: 'Field Operations | AssetNXG' }

// The field app for Technician, Housekeeping, Faculty and Guest phones.
export default function FieldAppPage() {
  return (
    <div className={`${fieldFontVars} font-plex text-fa-text antialiased`}>
      <FieldApp />
    </div>
  )
}
