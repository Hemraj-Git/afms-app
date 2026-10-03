'use client'

import React, { useState, useRef } from 'react'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import { formatDateDisplay } from '@/lib/dateUtils'
import { uploadToStorage, readFileAsDataUrl, validateUpload } from '@/lib/storageUpload'
import {
  FileText,
  Upload,
  Search,
  Download,
  Link2,
  Boxes,
  Plus,
  Filter,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { showToast } from '@/lib/toast'
import { useFormCheck } from '@/lib/useFormCheck'
import { documentUploadSchema } from '@/lib/validation/forms'
import { INVALID } from '@/components/ui/FormField'

export default function DocumentLibraryPage() {
  const { documents, assets, addDocument, currentUser } = useAFMS()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL')
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'size'>('newest')

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<'Invoice' | 'Warranty' | 'User Guide' | 'AMC Contract' | 'Other'>('Invoice')
  const [newLinkedAssetIds, setNewLinkedAssetIds] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fileTypes = ['Invoice', 'Warranty', 'User Guide', 'AMC Contract', 'Other']

  const v = useFormCheck(documentUploadSchema, { title: newTitle, hasFile: Boolean(selectedFile) }, 'doc')
  const openUploadModal = () => {
    v.reset()
    setShowUploadModal(true)
  }

  // Filtered and Sorted Documents
  const filteredDocuments = documents
    .filter(doc => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fileType.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType =
        selectedTypeFilter === 'ALL' || doc.fileType === selectedTypeFilter

      const matchesAsset =
        selectedAssetFilter === 'ALL'
          ? true
          : selectedAssetFilter === 'UNLINKED'
          ? doc.linkedAssetIds.length === 0
          : doc.linkedAssetIds.includes(selectedAssetFilter)

      return matchesSearch && matchesType && matchesAsset
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.uploadedAt || '').localeCompare(a.uploadedAt || '')
      if (sortBy === 'oldest') return (a.uploadedAt || '').localeCompare(b.uploadedAt || '')
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'size') return b.fileSizeKb - a.fileSizeKb
      return 0
    })

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!v.check() || !selectedFile) return

    // Stop here for a bad file -- falling through would trigger the base64
    // fallback below and store the rejected file in the database.
    const invalid = validateUpload(selectedFile, 'facility-documents')
    if (invalid) {
      showToast('error', invalid)
      return
    }

    setIsUploadingFile(true)
    let fileUrl = await uploadToStorage(selectedFile, 'facility-documents')
    if (!fileUrl) {
      fileUrl = await readFileAsDataUrl(selectedFile)
    }
    setIsUploadingFile(false)

    addDocument({
      title: newTitle,
      fileType: newType,
      fileUrl,
      fileSizeKb: Math.round(selectedFile.size / 1024),
      uploadedBy: currentUser.fullName,
      linkedAssetIds: newLinkedAssetIds,
    }).catch(() => {
      // Rolled back and reported by a toast already.
    })
    setShowUploadModal(false)
    setNewTitle('')
    setNewLinkedAssetIds([])
    setSelectedFile(null)
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Utility' }, { label: 'Document Library' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Standalone Document Library</h1>
            <p className="text-xs text-slate-500 mt-0.5">Centralized repository for invoices, warranties, manuals &amp; contracts with multi-asset linking</p>
          </div>

          <button
            onClick={openUploadModal}
            className="btn btn-primary"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, uploader, or type..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* File Type Filter */}
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
            >
              <option value="ALL">All File Types</option>
              {fileTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Linked Asset Filter */}
            <select
              value={selectedAssetFilter}
              onChange={e => setSelectedAssetFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
            >
              <option value="ALL">All Linked Assets</option>
              <option value="UNLINKED">Unlinked Documents Only</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.assetId || a.id})
                </option>
              ))}
            </select>

            {/* Sort Order */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="title">Sort: Title (A-Z)</option>
              <option value="size">Sort: File Size (Largest)</option>
            </select>

            {(searchQuery || selectedTypeFilter !== 'ALL' || selectedAssetFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedTypeFilter('ALL')
                  setSelectedAssetFilter('ALL')
                }}
                className="btn btn-ghost"
                title="Reset Filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Documents Uploaded Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Store compliance certificates, equipment user manuals, purchase invoices, and warranty contracts in the document library.
            </p>
            <button
              onClick={openUploadModal}
              className="btn btn-primary"
            >
              <Upload className="w-4 h-4" />
              <span>Upload First Document</span>
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Matching Documents</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No documents matched your search or filter criteria. Try clearing filters or using different keywords.
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedTypeFilter('ALL')
                setSelectedAssetFilter('ALL')
              }}
              className="btn btn-secondary"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => {
              const linkedAssets = assets.filter(a => doc.linkedAssetIds.includes(a.id))

              return (
                <div key={doc.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        doc.fileType === 'Invoice'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : doc.fileType === 'Warranty'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : doc.fileType === 'AMC Contract'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : doc.fileType === 'User Guide'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {doc.fileType}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">{doc.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-1">{doc.fileSizeKb} KB • Uploaded on {formatDateDisplay(doc.uploadedAt)}</p>
                    </div>

                    {linkedAssets.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {linkedAssets.slice(0, 2).map(a => (
                          <span key={a.id} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium truncate max-w-[150px]">
                            {a.name}
                          </span>
                        ))}
                        {linkedAssets.length > 2 && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">
                            +{linkedAssets.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                      <Link2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>{doc.linkedAssetIds.length} Linked Assets</span>
                    </span>

                    <button
                      onClick={() => {
                        if (doc.fileUrl) window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')
                        else showToast('error', 'No file is available for this document.')
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                      title="Download File"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
            <Modal title="Upload to Document Library" onClose={() => setShowUploadModal(false)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Upload to Document Library</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploadingFile}
                  className="text-slate-400 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Document Title *</label>
                  <input
                    type="text"
                    {...v.props('title')}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Compressor Warranty 2026-2030"
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl ${INVALID}`}
                  />
                  {v.error('title')}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">File Classification Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Invoice">Invoice</option>
                    <option value="Warranty">Warranty</option>
                    <option value="User Guide">User Guide / Manual</option>
                    <option value="AMC Contract">AMC Contract</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  {...v.props('hasFile')}
                  className={`w-full border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition disabled:opacity-60 ${INVALID}`}
                >
                  <Upload className="w-8 h-8 mx-auto text-blue-500 mb-1" />
                  {selectedFile ? (
                    <>
                      <p className="font-bold text-slate-800 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400">{Math.round(selectedFile.size / 1024)} KB &middot; tap to change</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-slate-800">Select PDF or Image file</p>
                      <p className="text-[10px] text-slate-400">Up to 25MB</p>
                    </>
                  )}
                </button>
                {v.error('hasFile')}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    disabled={isUploadingFile}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingFile}
                    className="btn btn-primary"
                  >
                    {isUploadingFile ? 'Uploading…' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </Modal>
        )}
      </div>
    </AppLayout>
  )
}
