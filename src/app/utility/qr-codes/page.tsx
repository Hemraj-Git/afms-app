'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  QrCode,
  Printer,
  Search,
  CheckSquare,
  Square,
  DoorOpen,
  Boxes,
  ExternalLink,
  Layers,
  X,
  FileDown,
  Info,
  Building,
  Loader2,
} from 'lucide-react'
import { generateRoomPlacardsPdf, generateAssetLabelsPdf } from '@/lib/qrPdfGenerator'

export default function QrDashboardPage() {
  const { assets, rooms, buildings, campuses, updateAsset, updateRoom } = useAFMS()

  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Separated Dashboard Tabs: 'Room' vs 'Asset'
  const [activeTab, setActiveTab] = useState<'Room' | 'Asset'>('Room')
  const [searchQuery, setSearchQuery] = useState('')

  // Independent Selection Sets to guarantee they can never be printed combined
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])

  // Modal print visibility
  const [showRoomPrintModal, setShowRoomPrintModal] = useState(false)
  const [showAssetPrintModal, setShowAssetPrintModal] = useState(false)

  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  // Helpers for Room QR URL and Asset QR URL
  const getRoomQrUrl = (roomId: string) => {
    const base = origin || 'http://localhost:3000'
    return `${base}/qr?type=room&id=${roomId}`
  }

  const getAssetQrUrl = (assetId: string) => {
    const base = origin || 'http://localhost:3000'
    return `${base}/qr?type=asset&id=${assetId}`
  }

  // Filtered Room List
  const filteredRooms = rooms.filter(r => {
    const query = searchQuery.toLowerCase()
    const bld = buildings.find(b => b.id === r.buildingId)
    return (
      r.name.toLowerCase().includes(query) ||
      r.roomNumber.toLowerCase().includes(query) ||
      (bld && bld.name.toLowerCase().includes(query)) ||
      r.type.toLowerCase().includes(query)
    )
  })

  // Filtered Asset List
  const filteredAssets = assets.filter(a => {
    const query = searchQuery.toLowerCase()
    return (
      a.name.toLowerCase().includes(query) ||
      a.assetId.toLowerCase().includes(query) ||
      (a.manufacturer && a.manufacturer.toLowerCase().includes(query)) ||
      (a.modelNumber && a.modelNumber.toLowerCase().includes(query))
    )
  })

  // Room Selection Handlers
  const toggleSelectAllRooms = () => {
    if (selectedRoomIds.length === filteredRooms.length) {
      setSelectedRoomIds([])
    } else {
      setSelectedRoomIds(filteredRooms.map(r => r.id))
    }
  }

  const toggleSelectRoom = (id: string) => {
    setSelectedRoomIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Asset Selection Handlers
  const toggleSelectAllAssets = () => {
    if (selectedAssetIds.length === filteredAssets.length) {
      setSelectedAssetIds([])
    } else {
      setSelectedAssetIds(filteredAssets.map(a => a.id))
    }
  }

  const toggleSelectAsset = (id: string) => {
    setSelectedAssetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Print execution: updates print date and opens window.print()
  const handlePrintRooms = () => {
    const today = new Date().toISOString().split('T')[0]
    selectedRoomIds.forEach(id => {
      updateRoom(id, { lastPrintedAt: today })
    })
    document.body.classList.add('printing-qr-modal')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('printing-qr-modal')
    }, 1000)
  }

  const handlePrintAssets = () => {
    const today = new Date().toISOString().split('T')[0]
    selectedAssetIds.forEach(id => {
      updateAsset(id, { lastPrintedAt: today })
    })
    document.body.classList.add('printing-qr-modal')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('printing-qr-modal')
    }, 1000)
  }

  // Direct PDF Generation (guarantees 100% exact vector layout & dimensions)
  const handleDownloadRoomPdf = async () => {
    try {
      setGeneratingPdf(true)
      const today = new Date().toISOString().split('T')[0]
      selectedRoomIds.forEach(id => {
        updateRoom(id, { lastPrintedAt: today })
      })
      const base = origin || window.location.origin
      await generateRoomPlacardsPdf(selectedRooms, buildings, campuses, base)
    } catch (err) {
      console.error('Failed to generate Room PDF:', err)
      alert('Error generating PDF document. Please try standard print.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleDownloadAssetPdf = async () => {
    try {
      setGeneratingPdf(true)
      const today = new Date().toISOString().split('T')[0]
      selectedAssetIds.forEach(id => {
        updateAsset(id, { lastPrintedAt: today })
      })
      const base = origin || window.location.origin
      await generateAssetLabelsPdf(selectedAssets, rooms, base)
    } catch (err) {
      console.error('Failed to generate Asset PDF:', err)
      alert('Error generating PDF document. Please try standard print.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  // Chunks for 4 QR codes per Landscape A4 page (2x2 grid)
  const selectedRooms = rooms.filter(r => selectedRoomIds.includes(r.id))
  const roomPages: typeof selectedRooms[] = []
  for (let i = 0; i < selectedRooms.length; i += 4) {
    roomPages.push(selectedRooms.slice(i, i + 4))
  }

  const selectedAssets = assets.filter(a => selectedAssetIds.includes(a.id))

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Utility' },
        { label: 'QR Code Dashboard' },
      ]}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              QR Code Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly segregated generation & bulk printing. Room QR cards fit 4 per Landscape A4 sheet; Asset QR labels print in precise 5cm × 5cm stickers.
            </p>
          </div>

          {/* Action Buttons for the active dashboard */}
          <div className="flex items-center gap-3">
            {activeTab === 'Room' ? (
              <button
                onClick={() => {
                  if (selectedRoomIds.length === 0) {
                    alert('Please select at least one Room to print.')
                    return
                  }
                  setShowRoomPrintModal(true)
                }}
                disabled={selectedRoomIds.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>Print Room QR ({selectedRoomIds.length}) — 4 per A4</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (selectedAssetIds.length === 0) {
                    alert('Please select at least one Asset to print.')
                    return
                  }
                  setShowAssetPrintModal(true)
                }}
                disabled={selectedAssetIds.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>Print Asset QR ({selectedAssetIds.length}) — 5cm × 5cm</span>
              </button>
            )}
          </div>
        </div>

        {/* Dashboard Main View (Hidden during print modal) */}
        <div className="print-dashboard-view space-y-6">
          {/* Separated Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab('Room')
                  setSearchQuery('')
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'Room'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <DoorOpen className="w-4 h-4" />
                <span>Room & Facility QR Codes ({rooms.length})</span>
              </button>

            <button
              onClick={() => {
                setActiveTab('Asset')
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'Asset'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Asset & Equipment QR Codes ({assets.length})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'Room'
                  ? 'Search rooms, numbers, or buildings...'
                  : 'Search asset name, code, model...'
              }
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: ROOM QR CODES DASHBOARD */}
        {/* ========================================================= */}
        {activeTab === 'Room' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-4">
            <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Room Format Specification:</strong> Designed for door and wall mounts. Exactly <strong>4 placards per Landscape A4 sheet (2×2 layout)</strong> with high-visibility codes and facility branding.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 font-medium">
                  Selected: <strong>{selectedRoomIds.length}</strong> / {filteredRooms.length}
                </span>
                <button
                  onClick={toggleSelectAllRooms}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100"
                >
                  {selectedRoomIds.length === filteredRooms.length && filteredRooms.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
            </div>

            {/* Rooms Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6 w-12">
                      <button
                        onClick={toggleSelectAllRooms}
                        className="text-slate-500 hover:text-amber-600"
                      >
                        {selectedRoomIds.length === filteredRooms.length && filteredRooms.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">QR Preview</th>
                    <th className="py-3.5 px-4">Room / Space Name</th>
                    <th className="py-3.5 px-4">Room Number</th>
                    <th className="py-3.5 px-4">Building & Campus</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Print Status</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <DoorOpen className="w-8 h-8 text-slate-300 stroke-1" />
                          <p className="text-xs font-semibold text-slate-600">No Matching Rooms Found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map(room => {
                      const isSelected = selectedRoomIds.includes(room.id)
                      const qrUrl = getRoomQrUrl(room.id)
                      const bld = buildings.find(b => b.id === room.buildingId)
                      const camp = bld ? campuses.find(c => c.id === bld.campusId) : undefined

                      return (
                        <tr key={room.id} className="hover:bg-amber-50/20 transition">
                          <td className="py-4 px-6">
                            <button
                              onClick={() => toggleSelectRoom(room.id)}
                              className="text-slate-400 hover:text-amber-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-12 h-12 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-center">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                  qrUrl
                                )}`}
                                alt="Room QR"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-bold text-slate-900">{room.name}</p>
                            <p className="text-[11px] text-slate-400">Floor: {room.floor || 'Ground'}</p>
                          </td>
                          <td className="py-4 px-4 font-mono font-bold text-amber-700">
                            {room.roomNumber}
                          </td>
                          <td className="py-4 px-4 text-slate-600">
                            <p className="font-medium">{bld?.name || 'Main Building'}</p>
                            <p className="text-[10px] text-slate-400">{camp?.name || 'Main Campus'}</p>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {room.type}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {room.lastPrintedAt ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Printed ({room.lastPrintedAt})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                Ready for Print
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedRoomIds([room.id])
                                  setShowRoomPrintModal(true)
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition inline-flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Print Placard</span>
                              </button>
                              <Link
                                href={`/qr?type=room&id=${room.id}`}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                title="Test Scan"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ASSET QR CODES DASHBOARD */}
        {/* ========================================================= */}
        {activeTab === 'Asset' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-4">
            <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-blue-950 font-medium">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Asset Tag Specification:</strong> Strict <strong>5cm × 5cm (50mm × 50mm) label stickers</strong> designed for equipment, machinery, and electrical panels.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 font-medium">
                  Selected: <strong>{selectedAssetIds.length}</strong> / {filteredAssets.length}
                </span>
                <button
                  onClick={toggleSelectAllAssets}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-blue-300 text-blue-800 rounded-lg hover:bg-blue-100"
                >
                  {selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
            </div>

            {/* Assets Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6 w-12">
                      <button
                        onClick={toggleSelectAllAssets}
                        className="text-slate-500 hover:text-blue-600"
                      >
                        {selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">QR Preview</th>
                    <th className="py-3.5 px-4">Asset Name</th>
                    <th className="py-3.5 px-4">Asset ID Code</th>
                    <th className="py-3.5 px-4">Room Location</th>
                    <th className="py-3.5 px-4">Manufacturer / Model</th>
                    <th className="py-3.5 px-4">Print Status</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Boxes className="w-8 h-8 text-slate-300 stroke-1" />
                          <p className="text-xs font-semibold text-slate-600">No Matching Assets Found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map(asset => {
                      const isSelected = selectedAssetIds.includes(asset.id)
                      const qrUrl = getAssetQrUrl(asset.id)
                      const room = rooms.find(r => r.id === asset.roomId)

                      return (
                        <tr key={asset.id} className="hover:bg-blue-50/20 transition">
                          <td className="py-4 px-6">
                            <button
                              onClick={() => toggleSelectAsset(asset.id)}
                              className="text-slate-400 hover:text-blue-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-4 px-4">
                            <div className="w-12 h-12 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-center">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                  qrUrl
                                )}`}
                                alt="Asset QR"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-bold text-slate-900">{asset.name}</p>
                            <p className="text-[10px] text-slate-400">{asset.status}</p>
                          </td>
                          <td className="py-4 px-4 font-mono font-bold text-blue-600">
                            {asset.assetId}
                          </td>
                          <td className="py-4 px-4 text-slate-600">
                            <p className="font-medium">{room?.name || 'General Campus'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Room {room?.roomNumber || 'N/A'}</p>
                          </td>
                          <td className="py-4 px-4 text-slate-600">
                            {asset.manufacturer || 'Standard'} {asset.modelNumber ? `(${asset.modelNumber})` : ''}
                          </td>
                          <td className="py-4 px-4">
                            {asset.lastPrintedAt ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Printed ({asset.lastPrintedAt})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                Ready for Print
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedAssetIds([asset.id])
                                  setShowAssetPrintModal(true)
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition inline-flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Print 5x5cm</span>
                              </button>
                              <Link
                                href={`/qr?type=asset&id=${asset.id}`}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                title="Test Scan"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>

        {/* ========================================================= */}
        {/* PRINT MODAL 1: ROOM QR PLACARDS (4 PER LANDSCAPE A4) */}
        {/* ========================================================= */}
        {showRoomPrintModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in print:p-0 print:static print:bg-white">
            <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl p-6 space-y-6 max-h-[92vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:p-0 print-area-active">
              {/* Modal UI Header (Hidden in Print) */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full">
                      Landscape A4 • 4 Placards per Sheet
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      Total: {selectedRoomIds.length} Placards ({roomPages.length} pages)
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Room QR Code Placards — Print Layout Preview
                  </h3>
                  <p className="text-xs text-slate-500">
                    Arranged in a 2×2 grid per page. When printing, choose <strong>Landscape</strong> orientation.
                  </p>
                </div>
                <button
                  onClick={() => setShowRoomPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Pages Container */}
              <div className="space-y-8 print:space-y-0">
                {roomPages.map((pageRooms, pageIdx) => (
                  <div
                    key={`page-${pageIdx}`}
                    className="p-6 bg-slate-50 rounded-2xl border border-slate-300 print:p-0 print:border-0 print:bg-white print-room-page"
                  >
                    <div className="text-[11px] text-slate-400 font-mono mb-2 print:hidden">
                      Page {pageIdx + 1} of {roomPages.length} (4 items max per page)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 print:grid print:grid-cols-2 print:gap-4 h-full">
                      {pageRooms.map(room => {
                        const qrUrl = getRoomQrUrl(room.id)
                        const bld = buildings.find(b => b.id === room.buildingId)
                        const camp = bld ? campuses.find(c => c.id === bld.campusId) : undefined

                        return (
                          <div
                            key={room.id}
                            className="bg-white p-5 rounded-2xl border-2 border-slate-800 shadow-2xs flex flex-col justify-between print-room-card"
                          >
                            {/* Card Top Branding */}
                            <div className="border-b-2 border-slate-800 pb-2 flex items-center justify-between">
                              <div>
                                <h4 className="text-[12px] font-black tracking-wider text-slate-900 uppercase">
                                  Hemraj Marines Facility Management
                                </h4>
                                <p className="text-[10px] text-slate-600 font-semibold">
                                  {camp?.name || 'Main Campus'} • {bld?.name || 'Building'}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-[11px] rounded">
                                {room.roomNumber}
                              </span>
                            </div>

                            {/* Card Body: Large QR & Identifiers */}
                            <div className="flex items-center gap-4 py-4">
                              <div className="w-28 h-28 shrink-0 bg-white p-1 rounded-xl border border-slate-300 flex items-center justify-center">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                                    qrUrl
                                  )}`}
                                  alt="Room QR Code"
                                  className="w-full h-full object-contain"
                                />
                              </div>

                              <div className="space-y-1.5 flex-1 min-w-0">
                                <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold uppercase">
                                  {room.type}
                                </span>
                                <h2 className="text-base font-black text-slate-900 leading-tight truncate">
                                  {room.name}
                                </h2>
                                <p className="text-[11px] text-slate-600">
                                  Floor: <strong>{room.floor || 'Ground'}</strong>
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 truncate">
                                  Tag: {room.qrCodeKey}
                                </p>
                              </div>
                            </div>

                            {/* Card Footer: Scan instructions */}
                            <div className="border-t-2 border-dashed border-slate-300 pt-2 flex items-center justify-between text-[10px] text-slate-600">
                              <span className="font-semibold text-slate-800">
                                📱 Scan with Phone Camera
                              </span>
                              <span>Check In • Service Requests • Reservation</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer Controls (Hidden in Print) */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 print:hidden">
                <p className="text-xs text-slate-500">
                  Tip: Set your printer or PDF export to <strong>Landscape</strong> and <strong>A4</strong> paper size.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowRoomPrintModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDownloadRoomPdf}
                    disabled={generatingPdf}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {generatingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    <span>Download PDF (4 per A4)</span>
                  </button>
                  <button
                    onClick={handlePrintRooms}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Browser Print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PRINT MODAL 2: ASSET QR LABELS (5CM X 5CM COMPACT TAGS) */}
        {/* ========================================================= */}
        {showAssetPrintModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in print:p-0 print:static print:bg-white">
            <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-6 space-y-6 max-h-[92vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:p-0 print-area-active">
              {/* Modal UI Header (Hidden in Print) */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full">
                      5cm × 5cm Equipment Sticker Labels
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      Total: {selectedAssetIds.length} Labels Selected
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Asset QR Labels — 5cm × 5cm Print Grid Preview
                  </h3>
                  <p className="text-xs text-slate-500">
                    Each sticker label is precisely 50mm × 50mm (5cm × 5cm). Aligned for continuous sticker rolls or A4 sticker sheets.
                  </p>
                </div>
                <button
                  onClick={() => setShowAssetPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Grid of 5cm x 5cm Labels */}
              <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 print:p-0 print:border-0 print:bg-white">
                <div className="flex flex-wrap gap-3.5 print-asset-grid">
                  {selectedAssets.map(asset => {
                    const qrUrl = getAssetQrUrl(asset.id)
                    const room = rooms.find(r => r.id === asset.roomId)

                    return (
                      <div
                        key={asset.id}
                        className="bg-white rounded-lg border-2 border-slate-900 shadow-2xs flex flex-col justify-between items-center text-center print-asset-label"
                        style={{
                          width: '50mm',
                          height: '50mm',
                          minWidth: '50mm',
                          minHeight: '50mm',
                          boxSizing: 'border-box',
                          padding: '2.5mm',
                        }}
                      >
                        {/* 5cm x 5cm Header */}
                        <div className="w-full border-b border-slate-300 pb-0.5 flex items-center justify-between text-[7px] font-black tracking-tight text-slate-800 uppercase">
                          <span>HEMRAJ MARINES</span>
                          <span className="text-blue-700 font-mono font-bold">AFMS TAG</span>
                        </div>

                        {/* Centered QR Code */}
                        <div className="my-0.5 w-[24mm] h-[24mm] flex items-center justify-center">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                              qrUrl
                            )}`}
                            alt="Asset Tag QR"
                            className="w-full h-full object-contain"
                          />
                        </div>

                        {/* 5cm x 5cm Footer Metadata */}
                        <div className="w-full border-t border-slate-300 pt-0.5 space-y-0.5">
                          <div className="text-[8px] font-black text-slate-900 truncate leading-tight">
                            {asset.name}
                          </div>
                          <div className="flex items-center justify-between text-[7px] font-mono font-bold text-blue-700">
                            <span>{asset.assetId}</span>
                            <span className="text-slate-500 font-sans font-semibold">
                              {room?.roomNumber ? `Rm ${room.roomNumber}` : 'General'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Modal Footer Controls (Hidden in Print) */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 print:hidden">
                <p className="text-xs text-slate-500">
                  Aligned to exact 50mm × 50mm standard sticker sheets or thermal label rolls.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAssetPrintModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDownloadAssetPdf}
                    disabled={generatingPdf}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {generatingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    <span>Download PDF (5cm × 5cm)</span>
                  </button>
                  <button
                    onClick={handlePrintAssets}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Browser Print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
