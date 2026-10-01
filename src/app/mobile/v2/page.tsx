import type { Metadata } from 'next'
import { fieldFontVars } from '@/lib/fieldFonts'
import { FieldApp } from './FieldApp'

export const metadata: Metadata = { title: 'Field Operations | AFMS' }

// The light-theme field app, being rebuilt screen by screen from the redesign
// canvas. Lives beside the live app (/mobile) until it is complete.
export default function FieldAppV2Page() {
  return (
    <div className={`${fieldFontVars} font-plex text-fa-text antialiased`}>
      <FieldApp />
    </div>
  )
}
