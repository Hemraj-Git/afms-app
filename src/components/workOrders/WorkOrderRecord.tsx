'use client'

import React from 'react'
import { Building2, Camera, CheckCircle2, ClipboardList, FileText, Package, Search, Wrench, XCircle } from 'lucide-react'
import type { ChecklistItemDef, WorkOrder } from '@/types/afms'
import { formatDateDisplay } from '@/lib/dateUtils'

// Everything recorded on a work order, for the office: what the office asked
// for, and what the technician (or housekeeper) has done -- while it is in
// progress as well as once it is finished. Nothing is filled in for them: a
// field left empty says "Not recorded".

const none = <span className="italic text-slate-400">Not recorded</span>

function Section({ icon: Icon, title, children }: { icon: typeof Wrench; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        {title}
      </p>
      {children}
    </div>
  )
}

function Text({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">{value?.trim() ? value : none}</p>
    </div>
  )
}

function Photo({ label, url }: { label: string; url?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded photo */}
          <img src={url} alt={label} className="h-32 w-full object-cover" />
        </a>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-[11px] text-slate-400">Not taken</div>
      )}
    </div>
  )
}

export function WorkOrderRecord({ wo, checklistItems }: { wo: WorkOrder; checklistItems: ChecklistItemDef[] }) {
  const finished = wo.status === 'Completed' || wo.status === 'Cancelled'
  const cleaning = wo.type === 'Housekeeping'
  const responses = wo.checklistResponses ?? {}
  const done = checklistItems.filter(i => responses[i.id]?.value === true).length

  return (
    <div className="space-y-3 border-t border-slate-100 pt-2">
      {wo.issueLogged || wo.instructions ? (
        <Section icon={Building2} title="From the office">
          {wo.issueLogged ? <Text label={wo.source === 'Service Request' ? 'Reported issue' : 'Scope / issue'} value={wo.issueLogged} /> : null}
          {wo.instructions ? <Text label="Instructions to the field" value={wo.instructions} /> : null}
        </Section>
      ) : null}

      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {finished ? `Recorded by ${wo.assignedTechnicianName || 'the field'}` : `Recorded so far by ${wo.assignedTechnicianName || 'the field'}`}
        {wo.status === 'Scheduled' ? ' — not started yet' : ''}
      </p>

      <Section icon={Camera} title="Photos">
        <div className="grid grid-cols-2 gap-2.5">
          <Photo label={cleaning ? 'Before cleaning' : 'On site, at the start'} url={wo.startPhotoUrl} />
          <Photo label={cleaning ? 'After cleaning' : wo.type === 'Corrective' ? 'After repair' : 'At completion'} url={wo.completionPhotoUrl} />
        </div>
      </Section>

      {checklistItems.length ? (
        <Section icon={ClipboardList} title={`Checklist — ${done} of ${checklistItems.length} done`}>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200/70 bg-white">
            {checklistItems.map(item => {
              const r = responses[item.id]
              const ticked = r?.value === true
              return (
                <li key={item.id} className="space-y-1 p-2.5">
                  <div className="flex items-start gap-2">
                    {ticked ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Done" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-label="Not done" />
                    )}
                    <span className={`flex-1 text-xs leading-snug ${ticked ? 'text-slate-800' : 'text-slate-500'}`}>{item.itemText}</span>
                    <span className={`shrink-0 text-[10px] font-bold ${ticked ? 'text-emerald-700' : 'text-slate-400'}`}>{ticked ? 'Done' : 'Not done'}</span>
                  </div>
                  {r?.remarks ? <p className="pl-6 text-[11px] italic text-slate-600">Note: {r.remarks}</p> : null}
                  {r?.photoUrl ? (
                    <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="ml-6 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded photo */}
                      <img src={r.photoUrl} alt={`Photo for ${item.itemText}`} className="h-14 w-14 rounded-md border border-slate-200 object-cover" />
                    </a>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Section>
      ) : null}

      {wo.type === 'Corrective' ? (
        <Section icon={Search} title="Diagnosis and fix">
          <Text label="Problem found" value={wo.diagnosis} />
          <Text label="Solution taken" value={wo.solutionTaken} />
        </Section>
      ) : null}

      {!cleaning ? (
        <Section icon={Package} title="Parts used">
          {wo.partsReplaced?.length ? (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200/70 bg-white">
              {wo.partsReplaced.map((p, i) => (
                <li key={`${p.partName}-${i}`} className="flex items-center justify-between p-2.5 text-xs">
                  <span>
                    <span className="font-semibold text-slate-800">{p.partName}</span>
                    {p.notes ? <span className="block text-[10px] text-slate-400">{p.notes}</span> : null}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">Qty {p.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs">{none}</p>
          )}
        </Section>
      ) : null}

      <Section icon={FileText} title={cleaning ? 'Notes from housekeeping' : 'Technician’s notes'}>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">{wo.technicianRemarks?.trim() ? wo.technicianRemarks : none}</p>
        {wo.completedAt ? <p className="text-[11px] text-emerald-700">Completed {formatDateDisplay(wo.completedAt)}</p> : null}
      </Section>
    </div>
  )
}
