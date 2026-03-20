import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/supabase-data'
import type { Formula } from '@/types/project'

// ─── Query Keys ───────────────────────────────────────

export const formulaKeys = {
  byProject: (projectId: string) => ['formulas', projectId] as const,
}

// ─── Queries ──────────────────────────────────────────

export function useFormulas(projectId: string) {
  return useQuery({
    queryKey: formulaKeys.byProject(projectId),
    queryFn: () => db.listFormulas(projectId),
    enabled: !!projectId,
  })
}

// ─── Mutations ────────────────────────────────────────

export function useCreateFormula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      projectId,
      formula,
    }: {
      projectId: string
      formula: Omit<Formula, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
    }) => db.createFormula(projectId, formula),
    onSuccess: (formula) => {
      qc.invalidateQueries({ queryKey: formulaKeys.byProject(formula.projectId) })
    },
  })
}

export function useUpdateFormula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      projectId,
      updates,
    }: {
      id: string
      projectId: string
      updates: Partial<Omit<Formula, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
    }) => db.updateFormula(id, updates),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: formulaKeys.byProject(projectId) })
    },
  })
}

export function useDeleteFormula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteFormula(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['formulas'] })
    },
  })
}
