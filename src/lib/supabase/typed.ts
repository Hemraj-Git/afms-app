import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type PublicTables = Database['public']['Tables']

export type TableRow<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TableInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TableUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']

// The same browser client every other file uses, seen through the generated
// schema types: table names, column names and insert/update shapes are checked
// at compile time. New query code (src/lib/queries) uses this; the older code in
// AFMSContext keeps the untyped `supabase` export until each entity is migrated
// (typing the shared client outright breaks ~46 call sites inside that file).
export const db = supabase as unknown as SupabaseClient<Database>
