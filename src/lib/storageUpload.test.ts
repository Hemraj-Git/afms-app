import { describe, expect, it, vi } from 'vitest'

// The module builds a browser Supabase client on import; validateUpload never uses it.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { BUCKET_RULES, validateUpload } from './storageUpload'

const MB = 1024 * 1024

// A File of a given size without allocating that many bytes.
function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('validateUpload', () => {
  it('accepts a file of an allowed type within the size limit', () => {
    expect(validateUpload(fakeFile('a.jpg', 'image/jpeg', 1 * MB), 'asset-images')).toBeNull()
    expect(validateUpload(fakeFile('a.pdf', 'application/pdf', 20 * MB), 'documents')).toBeNull()
  })

  it('accepts a file exactly at the limit and rejects one byte over', () => {
    const limit = BUCKET_RULES['asset-images'].maxBytes
    expect(validateUpload(fakeFile('a.png', 'image/png', limit), 'asset-images')).toBeNull()
    expect(validateUpload(fakeFile('a.png', 'image/png', limit + 1), 'asset-images')).toMatch(/limit here is 5 MB/)
  })

  it('applies a different limit per bucket', () => {
    const tenMb = 10 * MB
    expect(validateUpload(fakeFile('a.jpg', 'image/jpeg', tenMb), 'asset-images')).not.toBeNull()
    expect(validateUpload(fakeFile('a.jpg', 'image/jpeg', tenMb), 'work-order-evidence')).toBeNull()
  })

  it('rejects a type the bucket does not allow', () => {
    const msg = validateUpload(fakeFile('a.exe', 'application/x-msdownload', 1000), 'documents')
    expect(msg).toMatch(/isn't allowed/)
    expect(validateUpload(fakeFile('a.pdf', 'application/pdf', 1000), 'asset-images')).not.toBeNull()
  })

  it('falls back to the extension when the browser reports no type', () => {
    expect(validateUpload(fakeFile('photo.HEIC', '', 1000), 'work-order-evidence')).toBeNull()
    expect(validateUpload(fakeFile('notes.docx', '', 1000), 'documents')).toBeNull()
    expect(validateUpload(fakeFile('mystery.bin', '', 1000), 'documents')).not.toBeNull()
  })
})
