import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { Room, Asset, Building, Campus } from '@/types/afms'
import { getLocalDateStr } from '@/lib/dateUtils'

/**
 * Generate a PDF for Room QR Placards
 * Layout: Exactly 4 placards per Landscape A4 sheet (2 columns x 2 rows)
 * Sheet size: A4 Landscape is 297mm x 210mm
 */
export async function generateRoomPlacardsPdf(
  rooms: Room[],
  buildings: Building[],
  campuses: Campus[],
  baseUrl: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = 297
  const pageHeight = 210
  const margin = 10
  const gap = 8

  // 2 columns, 2 rows
  const cardWidth = (pageWidth - margin * 2 - gap) / 2 // ~134.5 mm
  const cardHeight = (pageHeight - margin * 2 - gap) / 2 // ~91 mm

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i]
    const bld = buildings.find(b => b.id === room.buildingId)
    const camp = bld ? campuses.find(c => c.id === bld.campusId) : undefined

    const cardIndexOnPage = i % 4

    if (i > 0 && cardIndexOnPage === 0) {
      doc.addPage('a4', 'landscape')
    }

    const col = cardIndexOnPage % 2
    const row = Math.floor(cardIndexOnPage / 2)

    const x = margin + col * (cardWidth + gap)
    const y = margin + row * (cardHeight + gap)

    // Draw outer card border
    doc.setDrawColor(15, 23, 42)
    doc.setLineWidth(0.8)
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'S')

    // Header strip
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x + 0.5, y + 0.5, cardWidth - 1, 15, 2, 2, 'F')
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.4)
    doc.line(x, y + 16, x + cardWidth, y + 16)

    // Facility Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text('HEMRAJ MARINES FACILITY MANAGEMENT', x + 4, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    const locationText = `${camp?.name || 'Main Campus'} • ${bld?.name || 'Main Building'}`
    doc.text(locationText, x + 4, y + 11)

    // Room Number Tag on right header
    doc.setFillColor(15, 23, 42)
    doc.roundedRect(x + cardWidth - 28, y + 3, 24, 9, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(room.roomNumber, x + cardWidth - 16, y + 8.5, { align: 'center' })

    // Generate QR Code Data URL
    const qrUrl = `${baseUrl}/qr?type=room&id=${room.id}`
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 300,
      color: { dark: '#000000', light: '#ffffff' },
    })

    // QR Image: 48mm x 48mm
    const qrSize = 48
    const qrX = x + 6
    const qrY = y + 21

    // QR Border frame
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 'S')
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

    // Details beside QR
    const infoX = qrX + qrSize + 6
    const infoWidth = cardWidth - (infoX - x) - 4

    // Room Type badge
    doc.setFillColor(254, 243, 199)
    doc.roundedRect(infoX, y + 21, 28, 6, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(146, 64, 14)
    doc.text(room.type.toUpperCase(), infoX + 14, y + 25, { align: 'center' })

    // Room Name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    const roomNameLines = doc.splitTextToSize(room.name, infoWidth)
    doc.text(roomNameLines, infoX, y + 33)

    // Floor & Tag
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text(`Floor: ${room.floor || 'Ground'}`, infoX, y + 43)

    doc.setFont('courier', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(`Tag: ${room.qrCodeKey}`, infoX, y + 49)

    // Footer instruction strip
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(x, y + cardHeight - 12, x + cardWidth, y + cardHeight - 12)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(30, 41, 59)
    doc.text('Scan with Phone Camera', x + 5, y + cardHeight - 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Check In • Service Requests • Reservation', x + cardWidth - 5, y + cardHeight - 5, { align: 'right' })
  }

  const filename = `Room-Placards-${getLocalDateStr()}.pdf`
  doc.save(filename)
}

/**
 * Generate a PDF for Equipment & Asset Stickers
 * Layout: Standard 5cm x 5cm (50mm x 50mm) label grid on Portrait A4
 * A4 is 210mm width x 297mm height
 * Grid: 3 columns x 5 rows = 15 labels per page (with margin 15mm, gap 5mm)
 * Label is strictly 50mm x 50mm
 */
export async function generateAssetLabelsPdf(
  assets: Asset[],
  rooms: Room[],
  baseUrl: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const labelSize = 50 // 50mm = 5cm
  const cols = 3
  const rows = 5
  const labelsPerPage = cols * rows

  const leftMargin = (210 - (cols * labelSize + (cols - 1) * 8)) / 2
  const topMargin = (297 - (rows * labelSize + (rows - 1) * 6)) / 2
  const gapX = 8
  const gapY = 6

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    const room = rooms.find(r => r.id === asset.roomId)

    const labelIndexOnPage = i % labelsPerPage

    if (i > 0 && labelIndexOnPage === 0) {
      doc.addPage('a4', 'portrait')
    }

    const col = labelIndexOnPage % cols
    const row = Math.floor(labelIndexOnPage / cols)

    const x = leftMargin + col * (labelSize + gapX)
    const y = topMargin + row * (labelSize + gapY)

    // Outer 5cm x 5cm border
    doc.setDrawColor(15, 23, 42)
    doc.setLineWidth(0.6)
    doc.roundedRect(x, y, labelSize, labelSize, 2, 2, 'S')

    // Header strip
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(x + 0.3, y + 0.3, labelSize - 0.6, 6, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(15, 23, 42)
    doc.text('HEMRAJ MARINES', x + 2.5, y + 4.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(29, 78, 216)
    doc.text('AFMS TAG', x + labelSize - 2.5, y + 4.5, { align: 'right' })

    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.3)
    doc.line(x, y + 6.5, x + labelSize, y + 6.5)

    // Centered QR Code
    const qrUrl = `${baseUrl}/qr?type=asset&id=${asset.id}`
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 250,
      color: { dark: '#000000', light: '#ffffff' },
    })

    const qrSize = 25 // 25mm x 25mm QR
    const qrX = x + (labelSize - qrSize) / 2
    const qrY = y + 8

    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

    // Divider line above footer
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.3)
    doc.line(x, y + 35.5, x + labelSize, y + 35.5)

    // Asset Name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(15, 23, 42)
    const nameTruncated = doc.splitTextToSize(asset.name, labelSize - 4)
    doc.text(nameTruncated[0] || asset.name, x + 2.5, y + 39.5)

    // Bottom row: Asset Code & Room
    doc.setFont('courier', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(29, 78, 216)
    doc.text(asset.assetId, x + 2.5, y + 45)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.setTextColor(100, 116, 139)
    const locText = room?.roomNumber ? `Rm ${room.roomNumber}` : 'General'
    doc.text(locText, x + labelSize - 2.5, y + 45, { align: 'right' })
  }

  const filename = `Asset-Labels-5x5cm-${getLocalDateStr()}.pdf`
  doc.save(filename)
}
