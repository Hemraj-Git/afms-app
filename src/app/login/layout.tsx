import { fieldFontVars } from '@/lib/fieldFonts'

// Sign-in uses the field app's design (IBM Plex, light): most people sign in
// on a phone. The desktop keeps its photo panel beside the form.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fieldFontVars} font-plex text-fa-text antialiased`}>{children}</div>
}
