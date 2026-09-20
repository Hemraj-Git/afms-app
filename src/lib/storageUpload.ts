// Shared Supabase Storage upload helper. Extracted from
// src/app/assets/create/page.tsx's original uploadToStorage (asset photo /
// asset-linked document upload), which already proved this pattern works.
// Uploads the given file to the given bucket and returns its public URL;
// returns null on any failure so the caller can fall back to something
// else (e.g. embedding the file as a base64 data URL) rather than losing
// the capture entirely.
import { supabase } from '@/lib/supabase'

export type StorageBucket = 'asset-images' | 'documents' | 'work-order-evidence' | 'facility-documents'

const MB = 1024 * 1024
const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// Must match the limits the buckets themselves enforce server-side (migration
// 0030). The bucket is the real enforcement; these checks just give the user a
// clear message before a doomed upload starts.
export const BUCKET_RULES: Record<StorageBucket, { maxBytes: number; types: string[]; allowed: string }> = {
  'asset-images': { maxBytes: 5 * MB, types: ['image/jpeg', 'image/png', 'image/webp'], allowed: 'JPEG, PNG or WebP images' },
  'documents': { maxBytes: 25 * MB, types: [PDF, 'image/jpeg', 'image/png', 'image/webp', DOCX], allowed: 'PDF, JPEG, PNG, WebP or Word (.docx) files' },
  'facility-documents': { maxBytes: 25 * MB, types: [PDF, 'image/jpeg', 'image/png', 'image/webp'], allowed: 'PDF, JPEG, PNG or WebP files' },
  'work-order-evidence': { maxBytes: 15 * MB, types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], allowed: 'JPEG, PNG, WebP or HEIC photos' },
}

const EXTENSION_TYPES: Record<string, string> = {
  pdf: PDF, jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', docx: DOCX,
}

// Some browsers report an empty type for less common files (e.g. HEIC, .docx);
// fall back to the extension so those aren't rejected by mistake.
function resolveContentType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TYPES[ext] ?? ''
}

// Returns a user-facing message if the file can't be uploaded to this bucket,
// or null if it's fine. Callers should check this first and stop on a message
// -- uploadToStorage returning null would otherwise trigger their "embed the
// file as base64" fallback, which would store the rejected file in the database.
export function validateUpload(file: File, bucket: StorageBucket): string | null {
  const rule = BUCKET_RULES[bucket]
  if (file.size > rule.maxBytes) {
    const sizeMb = (file.size / MB).toFixed(1)
    return `That file is ${sizeMb} MB. The limit here is ${rule.maxBytes / MB} MB.`
  }
  if (!rule.types.includes(resolveContentType(file))) {
    return `That file type isn't allowed here. Use ${rule.allowed}.`
  }
  return null
}

export async function uploadToStorage(file: File, bucket: StorageBucket): Promise<string | null> {
  try {
    const invalid = validateUpload(file, bucket)
    if (invalid) {
      console.warn(`Upload to ${bucket} blocked:`, invalid)
      return null
    }
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    // Unique per upload (timestamp prefix), so never overwrite an existing file.
    const fileName = `${Date.now()}_${cleanName}`
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: resolveContentType(file) })

    if (error) {
      console.warn(`Supabase ${bucket} upload notice:`, error.message)
      return null
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return publicUrlData?.publicUrl || null
  } catch (err) {
    console.error(`Upload error to ${bucket}:`, err)
    return null
  }
}

// Fallback for when a real upload fails (or as the sole mechanism for
// callers that don't have Storage wired up) -- reads the file into a
// self-contained base64 data URL that survives a reload on its own,
// unlike a blob: URL.
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = event => {
      if (event.target?.result) resolve(event.target.result as string)
      else reject(new Error('Failed to read file'))
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
