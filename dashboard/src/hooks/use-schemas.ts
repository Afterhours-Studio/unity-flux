import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/supabase-data'
import type { Schema, SchemaField } from '@/types/project'

export const schemaKeys = {
  byProject: (projectId: string) => ['schemas', projectId] as const,
  detail: (id: string) => ['schemas', 'detail', id] as const,
}

export function useSchemas(projectId: string) {
  return useQuery({
    queryKey: schemaKeys.byProject(projectId),
    queryFn: () => db.listSchemas(projectId),
    enabled: !!projectId,
  })
}

export function useSchema(id: string) {
  return useQuery({
    queryKey: schemaKeys.detail(id),
    queryFn: () => db.getSchema(id),
    enabled: !!id,
  })
}

export function useCreateSchema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, name, fields, mode }: {
      projectId: string; name: string; fields: SchemaField[]; mode?: Schema['mode']
    }) => db.createSchema(projectId, name, fields, mode),
    onSuccess: (schema) => {
      qc.invalidateQueries({ queryKey: schemaKeys.byProject(schema.projectId) })
    },
  })
}

export function useRenameSchema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      db.renameSchema(id, name),
    onSuccess: (schema) => {
      qc.invalidateQueries({ queryKey: schemaKeys.byProject(schema.projectId) })
    },
  })
}

export function useUpdateSchema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<Schema, 'name' | 'fields'>> }) =>
      db.updateSchema(id, updates),
    onSuccess: (schema) => {
      qc.invalidateQueries({ queryKey: schemaKeys.byProject(schema.projectId) })
      qc.invalidateQueries({ queryKey: schemaKeys.detail(schema.id) })
    },
  })
}

export function useDeleteSchema() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteSchema(id),
    onSuccess: (_, _id, ctx) => {
      // Invalidate all schema queries — we don't know the projectId after deletion
      qc.invalidateQueries({ queryKey: ['schemas'] })
      void ctx // avoid unused
    },
  })
}

// ─── Column mutations ─────────────────────────────────

export function useAddColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ schemaId, field }: { schemaId: string; field: SchemaField }) =>
      db.addColumn(schemaId, field),
    onSuccess: (schema) => {
      qc.invalidateQueries({ queryKey: schemaKeys.byProject(schema.projectId) })
    },
  })
}

export function useUpdateColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ schemaId, columnName, updates }: {
      schemaId: string; columnName: string; updates: Partial<SchemaField>
    }) => db.updateColumn(schemaId, columnName, updates),
    onSuccess: (schema) => {
      qc.invalidateQueries({ queryKey: schemaKeys.byProject(schema.projectId) })
    },
  })
}

export function useRemoveColumn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ schemaId, columnName }: { schemaId: string; columnName: string }) =>
      db.removeColumn(schemaId, columnName),
    onSuccess: (schema) => {
      qc.invalidateQueries({ queryKey: schemaKeys.byProject(schema.projectId) })
    },
  })
}
