'use client'

import React, { useState, useRef } from 'react'
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Boxes,
  Layers,
  Building2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { getLocalDateStr } from '@/lib/dateUtils'
import {
  downloadAssetExcelTemplate,
  parseAssetExcelFile,
  ParsedAssetRow,
} from '@/utils/assetExcelUtils'
import { Asset } from '@/types/afms'

interface BulkAssetUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (createdCount: number) => void
}

export function BulkAssetUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkAssetUploadModalProps) {
  const {
    categories,
    subCategories,
    campuses,
    buildings,
    rooms,
    vendors,
    addBulkAssets,
  } = useAFMS()

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedAssetRow[]>([])
  const [activeTab, setActiveTab] = useState<'ALL' | 'VALID' | 'ERRORS'>('ALL')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    count: number
    assets: Asset[]
  } | null>(null)

  if (!isOpen) return null

  const handleDownloadTemplate = () => {
    downloadAssetExcelTemplate({
      categories,
      subCategories,
      campuses,
      buildings,
      rooms,
      vendors,
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = async (file: File) => {
    setSelectedFile(file)
    setIsParsing(true)
    setParseError(null)
    setParsedRows([])
    setImportResult(null)

    try {
      const rows = await parseAssetExcelFile(
        file,
        categories,
        subCategories,
        campuses,
        buildings,
        rooms,
        vendors
      )
      setParsedRows(rows)
    } catch (err: any) {
      console.error('Failed to parse Excel file:', err)
      setParseError(err.message || 'Failed to read the uploaded spreadsheet file.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setParsedRows([])
    setParseError(null)
    setImportResult(null)
    setActiveTab('ALL')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validRows = parsedRows.filter(r => r.isValid)
  const invalidRows = parsedRows.filter(r => !r.isValid)

  const displayedRows = parsedRows.filter(r => {
    if (activeTab === 'VALID') return r.isValid
    if (activeTab === 'ERRORS') return !r.isValid
    return true
  })

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return

    setIsSubmitting(true)

    try {
      const assetsToCreate: Array<Omit<Asset, 'id' | 'assetId' | 'createdAt'>> = validRows.map(r => {
        const subCat = r.matchedSubCategory!
        const targetRoom = r.matchedRoom!

        return {
          name: r.name,
          subCategoryId: subCat.id,
          roomId: targetRoom.id,
          manufacturer: r.manufacturer || undefined,
          modelNumber: r.modelNumber || undefined,
          serialNumber: r.serialNumber || undefined,
          price: r.price,
          purchaseDate: r.purchaseDate,
          installationDate: r.installationDate || getLocalDateStr(),
          warrantyTill: r.warrantyTill,
          status: r.status,
          maintenanceBy: r.maintenanceBy,
          maintenanceVendorId: r.matchedMaintenanceVendor?.id,
          purchaseVendorId: r.matchedPurchaseVendor?.id,
          dynamicSpecifications: {},
          notes: r.notes || undefined,
        }
      })

      const res = await addBulkAssets(assetsToCreate)
      if (res.success) {
        setImportResult({
          success: true,
          count: res.createdCount,
          assets: res.createdAssets,
        })
        if (onSuccess) {
          onSuccess(res.createdCount)
        }
      }
    } catch (err) {
      console.error('Import failed:', err)
      alert('An unexpected error occurred during import. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Bulk Upload Assets via Excel
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300 border border-emerald-500/30">
                  .xlsx / .csv
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Import and auto-generate barcodes, QR codes, and maintenance schedules for multiple assets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Success Result View */}
          {importResult ? (
            <div className="space-y-6 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">
                  Successfully Imported {importResult.count} Assets!
                </h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  All equipment records have been registered with unique sequential IDs, auto-generated QR codes, and attached preventive maintenance workflows.
                </p>
              </div>

              {/* Created Assets Pill Grid */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Created Asset Tags:
                </p>
                <div className="flex flex-wrap gap-2">
                  {importResult.assets.map(ast => (
                    <span
                      key={ast.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs font-mono text-emerald-300"
                    >
                      <Boxes className="h-3 w-3 text-emerald-400" />
                      {ast.assetId} — {ast.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Upload Another File
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-colors"
                >
                  Done & View Assets
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Download Template Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-200">
                      Step 1: Download Standard Spreadsheet Template
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Includes pre-filled column headers, reference sheets of active Sub-Categories, Campus/Room locations, and sample rows.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-900/30 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Download Asset Template (.xlsx)
                </button>
              </div>

              {/* Step 2: Upload Area */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Step 2: Upload Completed Excel Spreadsheet
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="asset-excel-upload"
                />

                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                    selectedFile
                      ? 'border-emerald-500/50 bg-emerald-950/10'
                      : 'border-slate-700 bg-slate-950/40 hover:border-emerald-500/40 hover:bg-slate-950/70'
                  }`}
                >
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
                      <p className="text-sm font-medium text-slate-300">
                        Analyzing spreadsheet rows & verifying taxonomy...
                      </p>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-400">
                        <FileSpreadsheet className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to replace
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-xl bg-slate-800 p-3 text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                        <UploadCloud className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-semibold text-white">
                        Click to browse or drag and drop spreadsheet
                      </p>
                      <p className="text-xs text-slate-400">
                        Supports Microsoft Excel (.xlsx, .xls) and CSV format
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Alert */}
              {parseError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-rose-300">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                  <div className="text-xs">
                    <p className="font-semibold text-rose-200">Failed to Parse File</p>
                    <p className="mt-0.5">{parseError}</p>
                  </div>
                </div>
              )}

              {/* Step 3: Parsed Rows Preview & Validation Summary */}
              {parsedRows.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        Validation & Import Preview
                        <span className="text-xs font-normal text-slate-400">
                          ({parsedRows.length} total rows detected)
                        </span>
                      </h4>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 rounded-xl bg-slate-950/80 p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setActiveTab('ALL')}
                        className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                          activeTab === 'ALL'
                            ? 'bg-slate-800 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All ({parsedRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('VALID')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                          activeTab === 'VALID'
                            ? 'bg-emerald-600/40 text-emerald-200 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-emerald-300'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Valid ({validRows.length})
                      </button>
                      {invalidRows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('ERRORS')}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                            activeTab === 'ERRORS'
                              ? 'bg-rose-600/40 text-rose-200 border border-rose-500/40'
                              : 'text-slate-400 hover:text-rose-300'
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                          Issues ({invalidRows.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-xs text-slate-400">Total Rows Found</p>
                      <p className="text-xl font-bold text-white mt-1">{parsedRows.length}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
                      <p className="text-xs text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Ready to Import
                      </p>
                      <p className="text-xl font-bold text-emerald-400 mt-1">{validRows.length}</p>
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3">
                      <p className="text-xs text-rose-300 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                        Invalid / Incomplete
                      </p>
                      <p className="text-xl font-bold text-rose-400 mt-1">{invalidRows.length}</p>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-3 py-2.5">Row</th>
                          <th className="px-3 py-2.5">Validation</th>
                          <th className="px-3 py-2.5">Asset Name</th>
                          <th className="px-3 py-2.5">Sub-Category</th>
                          <th className="px-3 py-2.5">Room / Location</th>
                          <th className="px-3 py-2.5">Manufacturer / Model</th>
                          <th className="px-3 py-2.5">Serial No.</th>
                          <th className="px-3 py-2.5">Cost</th>
                          <th className="px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                              No rows in this filter.
                            </td>
                          </tr>
                        ) : (
                          displayedRows.map(row => (
                            <tr
                              key={row.rowNumber}
                              className={`transition-colors font-sans ${
                                row.isValid
                                  ? 'hover:bg-slate-800/40'
                                  : 'bg-rose-950/10 hover:bg-rose-950/20'
                              }`}
                            >
                              <td className="px-3 py-2.5 font-mono text-slate-400 font-medium">
                                #{row.rowNumber}
                              </td>
                              <td className="px-3 py-2.5">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Valid
                                  </span>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/20">
                                      <AlertTriangle className="h-3 w-3" />
                                      Error
                                    </span>
                                    {row.errors.map((err, eIdx) => (
                                      <p key={eIdx} className="text-[10px] text-rose-400">
                                        • {err}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-white max-w-[160px] truncate">
                                {row.name || <span className="text-rose-400 italic">Missing</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                {row.matchedSubCategory ? (
                                  <span className="inline-flex items-center gap-1 text-slate-200">
                                    <Layers className="h-3 w-3 text-cyan-400 shrink-0" />
                                    {row.matchedSubCategory.name}
                                  </span>
                                ) : (
                                  <span className="text-rose-400">{row.subCategoryNameOrCode || 'Missing'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {row.matchedRoom ? (
                                  <span className="inline-flex items-center gap-1 text-slate-200">
                                    <Building2 className="h-3 w-3 text-indigo-400 shrink-0" />
                                    {row.matchedRoom.name} ({row.matchedRoom.roomNumber})
                                  </span>
                                ) : (
                                  <span className="text-rose-400">{row.roomNameOrNumber || 'Missing'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-300">
                                {row.manufacturer || '-'}{row.modelNumber ? ` / ${row.modelNumber}` : ''}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-slate-400">
                                {row.serialNumber || '-'}
                              </td>
                              <td className="px-3 py-2.5 text-slate-300">
                                {row.price ? `$${row.price.toLocaleString()}` : '-'}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importResult && (
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-6 py-4">
            <button
              type="button"
              onClick={handleReset}
              disabled={!selectedFile || isSubmitting}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-40"
            >
              Clear / Reset
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={validRows.length === 0 || isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Registering Assets...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Import {validRows.length} Valid Asset{validRows.length === 1 ? '' : 's'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
