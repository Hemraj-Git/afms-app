import { fieldFontVars } from '@/lib/fieldFonts'

// The account pages (forgot / set password, expired link) use the field app's
// design: IBM Plex, light. /auth/confirm is a route handler and is unaffected.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fieldFontVars} font-plex text-fa-text antialiased`}>{children}</div>
}
