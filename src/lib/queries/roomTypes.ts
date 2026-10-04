import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase/typed'

// The room types list, one for everyone, in the database (0056). Admins add
// types and remove ones no room uses; the database refuses anyone else.

export const roomTypesKey = ['room_types'] as const

export function useRoomTypes(enabled: boolean) {
  return useQuery({
    queryKey: roomTypesKey,
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await db.from('room_types').select('name')
      if (error) throw new Error(error.message)
      return (data ?? []).map(r => r.name).sort((a, b) => a.localeCompare(b))
    },
  })
}

export async function insertRoomType(name: string): Promise<void> {
  const { error } = await db.from('room_types').insert({ name: name.trim() })
  if (error) {
    // Unique (case-insensitive) clash: it is already there.
    if (error.code === '23505') throw new Error(`"${name.trim()}" is already a room type.`)
    throw new Error(error.message)
  }
}

export async function deleteRoomTypeRow(name: string): Promise<void> {
  const { data, error } = await db.from('room_types').delete().eq('name', name).select('name')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Only an Admin can remove a room type.')
}
