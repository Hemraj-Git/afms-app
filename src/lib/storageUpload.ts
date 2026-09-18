// Shared Supabase Storage upload helper. Extracted from
// src/app/assets/create/page.tsx's original uploadToStorage (asset photo /
// asset-linked document upload), which already proved this pattern works.
// Uploads the given file to the given bucket and returns its public URL;
// returns null on any failure so the caller can fall back to something
// else (e.g. embedding the file as a base64 data URL) rather than losing
// the capture entirely.
import { supabase } from '@/lib/supabase'

export type StorageBucket = 'asset-images' | 'documents' | 'work-order-evidence' | 'facility-documents'

export async function uploadToStorage(file: File, bucket: StorageBucket): Promise<string | null> {
  try {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${Date.now()}_${cleanName}`
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { cacheControl: '3600', upsert: true })

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
