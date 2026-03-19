import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/supabase-data'

export const entryKeys = {
  bySchema: (schemaId: string) => ['entries', schemaId] as const,
}

export function useEntries(schemaId: string) {
  return useQuery({
    queryKey: entryKeys.bySchema(schemaId),
    queryFn: () => db.listEntries(schemaId),
    enabled: !!schemaId,
  })
}

export function useCreateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ schemaId, data, environment }: {
      schemaId: string
      data: Record<string, unknown>
      environment?: 'development' | 'staging' | 'production'
    }) => db.createEntry(schemaId, data, environment),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: entryKeys.bySchema(entry.schemaId) })
    },
  })
}

export function useUpdateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      db.updateEntry(id, data),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: entryKeys.bySchema(entry.schemaId) })
    },
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteEntry(id),
    onSuccess: () => {
      // Invalidate all entry queries since we don't know schemaId after deletion
      qc.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}
