'use client'

import React from 'react'
import { Phone } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { formatDateDisplay } from '@/lib/dateUtils'
import type { WorkOrder } from '@/types/afms'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400 shrink-0">{label}:</span>
      <span className="font-semibold text-slate-800 text-right">{children}</span>
    </div>
  )
}

// What was recorded when a job was handed to an outside vendor: who, their ticket
// number, who came, when, what it cost and the job sheet. Shown to staff on the
// desktop work-order details; the technician enters all of this on the mobile app.
export function VendorHandoverCard({ wo }: { wo: WorkOrder }) {
  const { vendors } = useAFMS()
  if (wo.executedBy !== 'Vendor') return null

  const vendor = vendors.find(v => v.id === wo.vendorId)
  const none = <span className="text-slate-400 font-normal">Not recorded</span>

  return (
    <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 text-xs">
      <p className="font-bold text-[11px] text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
        <Phone className="w-3.5 h-3.5" />
        Handed over to vendor
      </p>
      <Row label="Vendor">{vendor?.name || none}</Row>
      <Row label="Vendor ticket / job no">{wo.vendorTicketNo || none}</Row>
      <Row label="Vendor technician">
        {wo.vendorTechName ? (
          <>
            {wo.vendorTechName}
            {wo.vendorTechPhone && (
              <>
                {' · '}
                <a href={`tel:${wo.vendorTechPhone}`} className="text-blue-600 hover:underline font-mono">
                  {wo.vendorTechPhone}
                </a>
              </>
            )}
          </>
        ) : (
          none
        )}
      </Row>
      <Row label="Service visit">{wo.vendorServiceDate ? formatDateDisplay(wo.vendorServiceDate) : none}</Row>
      <Row label="Cost">
        {wo.vendorCost != null ? `₹${wo.vendorCost.toLocaleString('en-IN')}` : none}
      </Row>
      {wo.vendorRemarks && (
        <div>
          <p className="text-slate-400">Vendor remarks:</p>
          <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{wo.vendorRemarks}</p>
        </div>
      )}
      <div>
        <p className="text-slate-400">Job sheet / invoice:</p>
        {wo.vendorJobSheetUrl ? (
          <a href={wo.vendorJobSheetUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={wo.vendorJobSheetUrl}
              alt="Vendor job sheet"
              className="h-24 w-auto rounded-lg object-cover border border-slate-200 mt-1"
            />
          </a>
        ) : (
          <p className="text-slate-400 mt-0.5">Not attached</p>
        )}
      </div>
    </div>
  )
}
