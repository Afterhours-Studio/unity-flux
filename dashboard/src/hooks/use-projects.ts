import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/supabase-data'
import type { Project } from '@/types/project'

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: db.listProjects,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => db.getProject(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      db.createProject(name, description),
    onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.all }) },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<Project, 'name' | 'description' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>> }) =>
      db.updateProject(id, updates),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: projectKeys.all })
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteProject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.all }) },
  })
}

export function useRegenerateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.regenerateApiKey(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) })
    },
  })
}
