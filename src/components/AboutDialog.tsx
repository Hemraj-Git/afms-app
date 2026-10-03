'use client'

/* eslint-disable @next/next/no-img-element -- static brand files, shown at a fixed height */

import { createPortal } from 'react-dom'
import { Copy, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { showToast } from '@/lib/toast'
import { formatDateDisplay } from '@/lib/dateUtils'
import {
  APP_VERSION,
  BUILD_DATE,
  CLIENT_NAME,
  MAKER_LOGO_URL,
  MAKER_NAME,
  POWERED_BY_LOGO_URL,
  POWERED_BY_NAME,
  PRODUCT_LOGO_URL,
  PRODUCT_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from '@/lib/brand'

export function copyText(text: string, what: string) {
  try {
    navigator.clipboard.writeText(text).then(
      () => showToast('success', `${what} copied`),
      () => showToast('error', `Couldn't copy. ${what}: ${text}`),
    )
  } catch {
    showToast('error', `Couldn't copy. ${what}: ${text}`)
  }
}

/** A value with a copy button (support email and phone). */
export function CopyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-slate-800 select-all break-all">{value}</span>
      <button
        type="button"
        onClick={() => copyText(value, label)}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// What AssetNXG is, its version, who it is licensed to and how to reach
// support; at the bottom, who makes it (PMV) and who runs it (HMS).
export function AboutDialog({ onClose }: { onClose: () => void }) {
  // Into <body>: opened from the sidebar or the header, whose own layers
  // (the sidebar's slide, the header's stacking) would otherwise hold it.
  return createPortal(
    <Modal title={`About ${PRODUCT_NAME}`} onClose={onClose} closeOnOverlayClick className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden text-xs">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <img src={PRODUCT_LOGO_URL} alt={PRODUCT_NAME} className="h-8 w-auto" />
            <p className="text-slate-500 font-medium">Asset &amp; facility management</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          {PRODUCT_NAME} keeps a campus&apos;s assets and facilities in working order: the asset and spares register, preventive maintenance and
          inspection schedules, breakdowns and service requests, outside repairs, room reservations and QR codes. The office works on the desktop; the
          field team works on the phone.
        </p>

        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 border-y border-slate-100 py-4">
          {APP_VERSION ? (
            <>
              <dt className="text-slate-400 font-semibold">Version</dt>
              <dd className="font-medium text-slate-800">
                {APP_VERSION}
                {BUILD_DATE ? <span className="text-slate-400 font-normal"> · built {formatDateDisplay(BUILD_DATE)}</span> : null}
              </dd>
            </>
          ) : null}
          {CLIENT_NAME ? (
            <>
              <dt className="text-slate-400 font-semibold">Licensed to</dt>
              <dd className="font-medium text-slate-800">{CLIENT_NAME}</dd>
            </>
          ) : null}
          <dt className="text-slate-400 font-semibold pt-1">Support</dt>
          <dd className="space-y-0.5">
            <CopyLine label="Email" value={SUPPORT_EMAIL} />
            <CopyLine label="Phone" value={SUPPORT_PHONE} />
          </dd>
        </dl>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100 border-t border-slate-100">
        <div className="bg-slate-50 px-6 py-5 flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">A product of</p>
          <img src={MAKER_LOGO_URL} alt={MAKER_NAME} className="h-20 w-auto" />
        </div>
        <div className="bg-slate-50 px-6 py-5 flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Powered by</p>
          <img src={POWERED_BY_LOGO_URL} alt="" className="h-12 w-auto" />
          <p className="font-bold text-slate-800">{POWERED_BY_NAME}</p>
        </div>
      </div>
    </Modal>,
    document.body,
  )
}
