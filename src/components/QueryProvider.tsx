'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Server-state cache for the entities migrated off AFMSContext (see
// src/lib/queries). Created once per browser tab; rendered above AFMSProvider so
// the context can use the query hooks.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Reads are cheap and RLS-scoped; refetch on focus keeps a
            // long-open tab honest without a Realtime channel per entity.
            staleTime: 30_000,
            retry: 1,
          },
          // A failed write must surface immediately (toast + rollback), never retry silently.
          mutations: { retry: 0 },
        },
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
