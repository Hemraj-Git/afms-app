import * as XLSX from 'xlsx'
import { Asset, Category, SubCategory, Campus, Building, Room, Vendor } from '@/types/afms'
import { getLocalDateStr } from '@/lib/dateUtils'

export interface ParsedAssetRow {
  rowNumber: number
  rawData: Record<string, any>
  name: string
  subCategoryNameOrCode: string
  matchedSubCategory?: SubCategory
  campusName?: string
  buildingName?: string
  roomNameOrNumber: string
  matchedRoom?: Room
  manufacturer?: string
  modelNumber?: string
  serialNumber?: string
  price?: number
  purchaseDate?: string
  installationDate?: string
  warrantyTill?: string
  status: Asset['status']
  maintenanceBy: 'In House' | 'Vendor'
  maintenanceVendorName?: string
  matchedMaintenanceVendor?: Vendor
  purchaseVendorName?: string
  matchedPurchaseVendor?: Vendor
  notes?: string
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Normalizes date inputs from Excel (Date objects, strings, Excel date serial numbers).
 */
function normalizeDateString(val: any): string | undefined {
  if (!val) return undefined
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return undefined
    return getLocalDateStr(val)
  }
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    try {
      const parsedDate = new Date(Math.round((val - 25569) * 86400 * 1000))
      if (!isNaN(parsedDate.getTime())) {
        return getLocalDateStr(parsedDate)
      }
    } catch {
      return undefined
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return undefined
    // Match YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    // Match DD/MM/YYYY or MM/DD/YYYY
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return getLocalDateStr(parsed)
    }
  }
  return undefined
}

import ExcelJS from 'exceljs'

/**
 * Downloads a structured Excel template for Bulk Asset Upload with sample data,
 * reference lookup sheets, and native Excel dropdown menus (data validation) for
 * Category, Sub-Category, Room/Area, Status, and Maintenance Provider.
 */
export async function downloadAssetExcelTemplate({
  categories,
  subCategories,
  campuses,
  buildings,
  rooms,
  vendors,
}: {
  categories: Category[]
  subCategories: SubCategory[]
  campuses: Campus[]
  buildings: Building[]
  rooms: Room[]
  vendors: Vendor[]
}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AFMS Asset Management'
  workbook.created = new Date()

  // 1. Create Main Import Sheet
  const ws = workbook.addWorksheet('Asset Import Template', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // 2. Create Reference / Lookups Sheet
  const refWs = workbook.addWorksheet('Lookups & Reference Data', {
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  // Setup Reference Data
  refWs.columns = [
    { header: 'Category Code', key: 'catCode', width: 18 },
    { header: 'Category Name', key: 'catName', width: 28 },
    { header: 'SubCategory Code', key: 'subCode', width: 22 },
    { header: 'SubCategory Name', key: 'subName', width: 32 },
    { header: 'Campus Name', key: 'campusName', width: 24 },
    { header: 'Building Name', key: 'bldgName', width: 26 },
    { header: 'Room Number', key: 'roomNum', width: 18 },
    { header: 'Room Name', key: 'roomName', width: 30 },
    { header: 'Room Full Label', key: 'roomLabel', width: 36 },
    { header: 'Vendor Name', key: 'vendorName', width: 30 },
  ]

  // Add Reference Rows
  const maxRows = Math.max(
    categories.length,
    subCategories.length,
    rooms.length,
    vendors.length,
    campuses.length,
    buildings.length,
    1
  )

  for (let i = 0; i < maxRows; i++) {
    const cat = categories[i]
    const sub = subCategories[i]
    const r = rooms[i]
    const bldg = r ? buildings.find(b => b.id === r.buildingId) : undefined
    const campus = bldg ? campuses.find(c => c.id === bldg.campusId) : undefined
    const v = vendors[i]

    refWs.addRow({
      catCode: cat?.code || '',
      catName: cat?.name || '',
      subCode: sub?.code || '',
      subName: sub?.name || '',
      campusName: campuses[i]?.name || '',
      bldgName: buildings[i]?.name || '',
      roomNum: r?.roomNumber || '',
      roomName: r?.name || '',
      roomLabel: r ? `${r.name} (${r.roomNumber})` : '',
      vendorName: v?.name || '',
    })
  }

  // Format Reference Sheet Header
  refWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  refWs.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
  }

  // Setup Columns in Main Template Sheet
  ws.columns = [
    { header: 'Asset Name *', key: 'name', width: 32 },
    { header: 'Category Name or Code', key: 'category', width: 24 },
    { header: 'Sub-Category Name or Code *', key: 'subCategory', width: 32 },
    { header: 'Campus Name', key: 'campus', width: 24 },
    { header: 'Building Name', key: 'building', width: 26 },
    { header: 'Room / Area Name or Number *', key: 'room', width: 34 },
    { header: 'Manufacturer', key: 'manufacturer', width: 22 },
    { header: 'Model Number', key: 'model', width: 22 },
    { header: 'Serial Number', key: 'serial', width: 22 },
    { header: 'Unit Cost (USD)', key: 'price', width: 18 },
    { header: 'Purchase Date (YYYY-MM-DD)', key: 'purchaseDate', width: 26 },
    { header: 'Installation Date (YYYY-MM-DD)', key: 'installDate', width: 28 },
    { header: 'Warranty Till (YYYY-MM-DD)', key: 'warrantyTill', width: 26 },
    { header: 'Status', key: 'status', width: 24 },
    { header: 'Maintenance Provider', key: 'maintenanceBy', width: 24 },
    { header: 'Maintenance Vendor Name', key: 'maintenanceVendor', width: 28 },
    { header: 'Purchase Vendor Name', key: 'purchaseVendor', width: 28 },
    { header: 'Notes / Description', key: 'notes', width: 45 },
  ]

  // Style Header Row
  const headerRow = ws.getRow(1)
  headerRow.height = 28
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Teal-700
  }

  // Add Sample Rows
  const sampleSub = subCategories[0] || { name: 'Air Handling Units', code: 'HVAC-AHU' }
  const sampleCat = categories.find(c => c.id === sampleSub.categoryId) || categories[0] || { name: 'HVAC', code: 'HVAC' }
  const sampleRoom = rooms[0] || { roomNumber: 'B101', name: 'Server Room 101' }
  const sampleBldg = buildings.find(b => b.id === sampleRoom.buildingId) || buildings[0] || { name: 'Engineering Block A' }
  const sampleCampus = campuses.find(c => c.id === sampleBldg.campusId) || campuses[0] || { name: 'Main Tech Campus' }
  const sampleVendor = vendors[0]?.name || 'Apex Facilities Services'

  ws.addRow({
    name: 'Chilled Water Pump #1',
    category: sampleCat.name,
    subCategory: sampleSub.name,
    campus: sampleCampus.name,
    building: sampleBldg.name,
    room: sampleRoom.name,
    manufacturer: 'Grundfos',
    model: 'NB 65-200/219',
    serial: 'SN-GR-889012',
    price: 4500,
    purchaseDate: '2024-01-15',
    installDate: '2024-01-20',
    warrantyTill: '2027-01-20',
    status: 'Operational',
    maintenanceBy: 'In House',
    maintenanceVendor: '',
    purchaseVendor: sampleVendor,
    notes: 'Primary pump for chiller loop circuit A. Mounted on vibration isolators.',
  })

  ws.addRow({
    name: 'Server Rack Smart UPS 10kVA',
    category: 'Electrical Systems',
    subCategory: 'Power Backup & UPS',
    campus: sampleCampus.name,
    building: sampleBldg.name,
    room: sampleRoom.name,
    manufacturer: 'Schneider APC',
    model: 'SRT10KXLI',
    serial: 'SN-APC-33019',
    price: 3200,
    purchaseDate: '2023-11-10',
    installDate: '2023-11-15',
    warrantyTill: '2026-11-15',
    status: 'Operational',
    maintenanceBy: 'Vendor',
    maintenanceVendor: sampleVendor,
    purchaseVendor: sampleVendor,
    notes: 'Equipped with network management card for real-time SNMP telemetry.',
  })

  // Apply Excel Native Data Validations (Dropdowns) to Rows 2 through 500
  const catEndRow = Math.max(categories.length + 1, 2)
  const subEndRow = Math.max(subCategories.length + 1, 2)
  const roomEndRow = Math.max(rooms.length + 1, 2)
  const vendorEndRow = Math.max(vendors.length + 1, 2)

  const catFormula = `'Lookups & Reference Data'!$B$2:$B$${catEndRow}`
  const subFormula = `'Lookups & Reference Data'!$D$2:$D$${subEndRow}`
  const roomFormula = `'Lookups & Reference Data'!$H$2:$H$${roomEndRow}`
  const vendorFormula = `'Lookups & Reference Data'!$J$2:$J$${vendorEndRow}`

  for (let r = 2; r <= 500; r++) {
    // 1. Category Dropdown (Column B)
    ws.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [catFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: 'Please select a registered Category from the dropdown list.',
    }

    // 2. Sub-Category Dropdown (Column C)
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [subFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Sub-Category',
      error: 'Please select an active Sub-Category from the dropdown list.',
    }

    // 3. Room / Area Dropdown (Column F)
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [roomFormula],
      showErrorMessage: true,
      errorTitle: 'Invalid Room / Area',
      error: 'Please select a valid Room / Area from the dropdown list.',
    }

    // 4. Status Dropdown (Column N)
    ws.getCell(`N${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Operational,Under Maintenance,In Storage,Retired"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Status',
      error: 'Please select Operational, Under Maintenance, In Storage, or Retired.',
    }

    // 5. Maintenance Provider Dropdown (Column O)
    ws.getCell(`O${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"In House,Vendor"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Provider',
      error: 'Please select "In House" or "Vendor".',
    }

    // 6. Vendor Dropdowns (Columns P & Q)
    if (vendors.length > 0) {
      ws.getCell(`P${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [vendorFormula],
      }
      ws.getCell(`Q${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [vendorFormula],
      }
    }
  }

  // Generate binary Excel file buffer and trigger download in browser
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'AFMS_Asset_Bulk_Upload_Template.xlsx'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Parses an uploaded Excel or CSV file buffer and validates each row against AFMS master data.
 */
export async function parseAssetExcelFile(
  file: File,
  categories: Category[],
  subCategories: SubCategory[],
  campuses: Campus[],
  buildings: Building[],
  rooms: Room[],
  vendors: Vendor[]
): Promise<ParsedAssetRow[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  // Use the first sheet
  const firstSheetName = wb.SheetNames[0]
  const worksheet = wb.Sheets[firstSheetName]

  if (!worksheet) {
    throw new Error('No valid worksheet found in the uploaded workbook.')
  }

  // Convert to JSON array of objects
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  })

  if (rawRows.length === 0) {
    throw new Error('The uploaded sheet is empty or contains no data rows.')
  }

  const results: ParsedAssetRow[] = []

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2 // Considering header row is row 1
    const errors: string[] = []
    const warnings: string[] = []

    // Helper to find value from row with flexible key names
    const getVal = (possibleKeys: string[]): string => {
      for (const pk of possibleKeys) {
        // Exact match
        if (row[pk] !== undefined && String(row[pk]).trim() !== '') {
          return String(row[pk]).trim()
        }
        // Case-insensitive / fuzzy key lookup
        const foundKey = Object.keys(row).find(k => 
          k.toLowerCase().replace(/[^a-z0-9]/g, '') === pk.toLowerCase().replace(/[^a-z0-9]/g, '')
        )
        if (foundKey && row[foundKey] !== undefined && String(row[foundKey]).trim() !== '') {
          return String(row[foundKey]).trim()
        }
      }
      return ''
    }

    // Extract fields
    const name = getVal(['Asset Name *', 'Asset Name', 'asset_name', 'name', 'AssetName', 'Title'])
    const categoryNameOrCode = getVal(['Category Name or Code', 'Category', 'category_name', 'category_code', 'category'])
    const subCategoryNameOrCode = getVal(['Sub-Category Name or Code *', 'Sub-Category', 'SubCategory', 'subcategory_name', 'sub_category', 'subcategory_code', 'Sub Category'])
    const campusName = getVal(['Campus Name', 'Campus', 'campus_name', 'campus'])
    const buildingName = getVal(['Building Name', 'Building', 'building_name', 'building'])
    const roomNameOrNumber = getVal(['Room / Area Name or Number *', 'Room / Area', 'Room', 'Room Number', 'room_name', 'room_number', 'room', 'Area'])
    const manufacturer = getVal(['Manufacturer', 'Make', 'Brand', 'manufacturer'])
    const modelNumber = getVal(['Model Number', 'Model', 'model_number', 'model'])
    const serialNumber = getVal(['Serial Number', 'Serial', 'serial_number', 'serial', 'SN'])
    const priceStr = getVal(['Unit Cost (USD)', 'Unit Cost', 'Cost', 'Price', 'price', 'unit_cost', 'Purchase Cost'])
    const purchaseDateRaw = getVal(['Purchase Date (YYYY-MM-DD)', 'Purchase Date', 'purchase_date', 'PurchaseDate'])
    const installationDateRaw = getVal(['Installation Date (YYYY-MM-DD)', 'Installation Date', 'installation_date', 'Install Date'])
    const warrantyTillRaw = getVal(['Warranty Till (YYYY-MM-DD)', 'Warranty Till', 'warranty_till', 'Warranty Expiry', 'Warranty Date'])
    const statusRaw = getVal(['Status (Operational / Under Maintenance / In Storage / Retired)', 'Status', 'status'])
    const maintenanceByRaw = getVal(['Maintenance Provider (In House / Vendor)', 'Maintenance Provider', 'Maintenance By', 'maintenance_by'])
    const maintenanceVendorName = getVal(['Maintenance Vendor Name', 'Maintenance Vendor', 'maintenance_vendor'])
    const purchaseVendorName = getVal(['Purchase Vendor Name', 'Purchase Vendor', 'purchase_vendor', 'Vendor Name', 'Vendor'])
    const notes = getVal(['Notes / Description', 'Notes', 'Description', 'notes', 'remarks'])

    // Skip totally empty rows
    if (!name && !subCategoryNameOrCode && !roomNameOrNumber && !manufacturer) {
      return
    }

    // 1. Validate Asset Name (Required)
    if (!name) {
      errors.push('Asset Name is required.')
    }

    // 2. Validate & Match SubCategory (Required)
    let matchedSubCategory: SubCategory | undefined
    if (!subCategoryNameOrCode) {
      errors.push('Sub-Category is required.')
    } else {
      const searchTarget = subCategoryNameOrCode.toLowerCase()
      matchedSubCategory = subCategories.find(s => 
        s.id.toLowerCase() === searchTarget ||
        s.code.toLowerCase() === searchTarget ||
        s.name.toLowerCase() === searchTarget
      )

      if (!matchedSubCategory) {
        // Partial name search
        matchedSubCategory = subCategories.find(s => 
          s.name.toLowerCase().includes(searchTarget) || searchTarget.includes(s.name.toLowerCase())
        )
      }

      if (!matchedSubCategory) {
        errors.push(`Sub-Category "${subCategoryNameOrCode}" could not be found in active categories.`)
      }
    }

    // 3. Validate & Match Room (Required)
    let matchedRoom: Room | undefined
    if (!roomNameOrNumber) {
      errors.push('Room / Area is required.')
    } else {
      const roomTarget = roomNameOrNumber.toLowerCase()
      // First try exact roomNumber or name match
      matchedRoom = rooms.find(r => 
        r.roomNumber.toLowerCase() === roomTarget ||
        r.name.toLowerCase() === roomTarget ||
        r.id.toLowerCase() === roomTarget
      )

      // If building specified, narrow down
      if (buildingName) {
        const bTarget = buildingName.toLowerCase()
        const matchedBldg = buildings.find(b => 
          b.name.toLowerCase() === bTarget || b.code.toLowerCase() === bTarget || b.name.toLowerCase().includes(bTarget)
        )
        if (matchedBldg) {
          const roomInBldg = rooms.find(r => 
            r.buildingId === matchedBldg.id && 
            (r.roomNumber.toLowerCase() === roomTarget || r.name.toLowerCase() === roomTarget || r.name.toLowerCase().includes(roomTarget))
          )
          if (roomInBldg) matchedRoom = roomInBldg
        }
      }

      // If still not matched, try substring match
      if (!matchedRoom) {
        matchedRoom = rooms.find(r => 
          r.name.toLowerCase().includes(roomTarget) || roomTarget.includes(r.name.toLowerCase())
        )
      }

      if (!matchedRoom) {
        errors.push(`Room / Area "${roomNameOrNumber}" could not be matched with any registered facility room.`)
      }
    }

    // 4. Validate & Match Vendors
    let matchedMaintenanceVendor: Vendor | undefined
    if (maintenanceVendorName) {
      const vTarget = maintenanceVendorName.toLowerCase()
      matchedMaintenanceVendor = vendors.find(v => 
        v.name.toLowerCase() === vTarget || v.id.toLowerCase() === vTarget || v.name.toLowerCase().includes(vTarget)
      )
      if (!matchedMaintenanceVendor) {
        warnings.push(`Maintenance Vendor "${maintenanceVendorName}" was not found; will record name in notes.`)
      }
    }

    let matchedPurchaseVendor: Vendor | undefined
    if (purchaseVendorName) {
      const vTarget = purchaseVendorName.toLowerCase()
      matchedPurchaseVendor = vendors.find(v => 
        v.name.toLowerCase() === vTarget || v.id.toLowerCase() === vTarget || v.name.toLowerCase().includes(vTarget)
      )
      if (!matchedPurchaseVendor) {
        warnings.push(`Purchase Vendor "${purchaseVendorName}" was not found; will record name in notes.`)
      }
    }

    // 5. Parse Dates
    const purchaseDate = normalizeDateString(purchaseDateRaw)
    const installationDate = normalizeDateString(installationDateRaw) || purchaseDate || getLocalDateStr()
    const warrantyTill = normalizeDateString(warrantyTillRaw)

    if (purchaseDateRaw && !purchaseDate) {
      warnings.push(`Invalid purchase date format "${purchaseDateRaw}". Expected YYYY-MM-DD.`)
    }
    if (warrantyTillRaw && !warrantyTill) {
      warnings.push(`Invalid warranty date format "${warrantyTillRaw}". Expected YYYY-MM-DD.`)
    }

    // 6. Parse Cost
    let price: number | undefined
    if (priceStr) {
      const cleanNum = parseFloat(priceStr.replace(/[^0-9.-]+/g, ''))
      if (!isNaN(cleanNum) && cleanNum >= 0) {
        price = cleanNum
      } else {
        warnings.push(`Unit cost "${priceStr}" is not a valid number.`)
      }
    }

    // 7. Parse Status
    let status: Asset['status'] = 'Operational'
    if (statusRaw) {
      const sTarget = statusRaw.toLowerCase()
      if (sTarget.includes('maint')) status = 'Under Maintenance'
      else if (sTarget.includes('stor') || sTarget.includes('spare')) status = 'In Storage'
      else if (sTarget.includes('retir') || sTarget.includes('decomm')) status = 'Retired'
      else status = 'Operational'
    }

    // 8. Parse Maintenance Provider
    let maintenanceBy: 'In House' | 'Vendor' = 'In House'
    if (maintenanceByRaw) {
      const mTarget = maintenanceByRaw.toLowerCase()
      if (mTarget.includes('vendor') || mTarget.includes('external') || mTarget.includes('oem')) {
        maintenanceBy = 'Vendor'
      } else {
        maintenanceBy = 'In House'
      }
    } else if (matchedMaintenanceVendor) {
      maintenanceBy = 'Vendor'
    }

    results.push({
      rowNumber,
      rawData: row,
      name,
      subCategoryNameOrCode,
      matchedSubCategory,
      campusName,
      buildingName,
      roomNameOrNumber,
      matchedRoom,
      manufacturer,
      modelNumber,
      serialNumber,
      price,
      purchaseDate,
      installationDate,
      warrantyTill,
      status,
      maintenanceBy,
      maintenanceVendorName,
      matchedMaintenanceVendor,
      purchaseVendorName,
      matchedPurchaseVendor,
      notes,
      isValid: errors.length === 0,
      errors,
      warnings,
    })
  })

  return results
}
