import type { Asset, SlaPriority, SubCategory } from '@/types/afms'

// A Maintenance request against an asset is locked to how urgent a fault on
// that asset is: the asset's own SLA priority, set when it was added. An
// asset created before that field existed (or via the legacy Excel bulk
// import, which does not ask for one) has none, so its sub-category's own
// priority -- the single value every asset of that type used to share --
// is used instead. Neither set: the requester picks one themselves.
export interface LockedSlaPriority {
  priority: SlaPriority
  source: 'asset' | 'subCategory'
}

export function lockedSlaPriority(
  asset?: Pick<Asset, 'slaPriority'> | null,
  subCategory?: Pick<SubCategory, 'slaPriority'> | null
): LockedSlaPriority | undefined {
  if (asset?.slaPriority) return { priority: asset.slaPriority, source: 'asset' }
  if (subCategory?.slaPriority) return { priority: subCategory.slaPriority, source: 'subCategory' }
  return undefined
}
