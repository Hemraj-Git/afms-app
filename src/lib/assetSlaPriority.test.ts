import { describe, expect, it } from 'vitest'
import { lockedSlaPriority } from './assetSlaPriority'

describe('lockedSlaPriority', () => {
  it('prefers the asset\'s own priority', () => {
    expect(lockedSlaPriority({ slaPriority: 'Critical' }, { slaPriority: 'Low' })).toEqual({
      priority: 'Critical', source: 'asset',
    })
  })

  it('falls back to the sub-category\'s priority when the asset has none', () => {
    expect(lockedSlaPriority({ slaPriority: undefined }, { slaPriority: 'High' })).toEqual({
      priority: 'High', source: 'subCategory',
    })
    expect(lockedSlaPriority(undefined, { slaPriority: 'High' })).toEqual({
      priority: 'High', source: 'subCategory',
    })
  })

  it('is undefined when neither has one, so the requester picks', () => {
    expect(lockedSlaPriority({ slaPriority: undefined }, { slaPriority: undefined })).toBeUndefined()
    expect(lockedSlaPriority(null, null)).toBeUndefined()
    expect(lockedSlaPriority()).toBeUndefined()
  })
})
