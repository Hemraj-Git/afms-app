import type { AssetsTemplateContext } from './generateAssets'
import type { MastersData } from './validateMasters'

// Build the Assets workbook straight from a filled Masters workbook, with no
// database involved.
//
// Why: the Assets workbook is normally made from what the app already holds, so
// every tab can be stamped with its sub-category's database id. When the masters
// will only be loaded later (at deployment), those ids do not exist yet -- but
// the client still needs the equipment sheet to start filling in. Each tab
// therefore carries no id and is matched by "Category / Sub-category" instead
// (see subCategoryKey in generateAssets.ts and how validateAssets resolves it).
//
// The dropdowns offer exactly what is on the Masters file. An empty Vendors tab
// just means the two vendor columns have nothing to choose yet; both are
// optional, and a vendor can be set on an asset in the app afterwards.
export function assetsContextFromMasters(data: MastersData): AssetsTemplateContext {
  return {
    subCategories: data.subCategories.map(s => ({
      // Both are minted at load time, from the names below.
      id: '',
      code: '',
      name: s.name,
      categoryName: s.category,
      fields: s.fields,
    })),
    rooms: data.rooms.map(r => r.label),
    vendors: data.vendors.map(v => v.name),
  }
}
