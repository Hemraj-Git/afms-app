import React from 'react'
import { ClipboardCheck, Inbox, ScanLine, Sparkles, Wrench } from 'lucide-react'
import { EmptyState, type FieldTab } from '@/components/field'

// A tab the redesign has not reached yet (this preview only; the live field
// app at /mobile keeps working meanwhile).
const NEXT: Partial<Record<FieldTab, { icon: typeof Wrench; title: string; phase: number }>> = {
  Tasks: { icon: Wrench, title: 'Tasks', phase: 3 },
  Cleaning: { icon: Sparkles, title: 'Cleaning', phase: 4 },
  Inspections: { icon: ClipboardCheck, title: 'Inspections', phase: 4 },
  Scan: { icon: ScanLine, title: 'Scan', phase: 5 },
  Requests: { icon: Inbox, title: 'Requests', phase: 5 },
}

export function ComingSoon({ tab }: { tab: FieldTab }) {
  const n = NEXT[tab]
  if (!n) return null
  return (
    <div className="p-4">
      <EmptyState icon={n.icon} title={`${n.title} is being redesigned`}>
        This screen arrives in phase {n.phase} of the redesign. Until then, field staff keep using the current app.
      </EmptyState>
    </div>
  )
}
