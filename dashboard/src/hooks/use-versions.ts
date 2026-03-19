import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/supabase-data'

export const versionKeys = {
  byProject: (projectId: string) => ['versions', projectId] as const,
}

export function useVersions(projectId: string) {
  return useQuery({
    queryKey: versionKeys.byProject(projectId),
    queryFn: () => db.listVersions(projectId),
    enabled: !!projectId,
  })
}

export function usePublishVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, environment }: {
      projectId: string
      environment: 'development' | 'staging' | 'production'
    }) => db.publishVersion(projectId, environment),
    onSuccess: (version) => {
      qc.invalidateQueries({ queryKey: versionKeys.byProject(version.projectId) })
      qc.invalidateQueries({ queryKey: ['activities', version.projectId] })
    },
  })
}

export function usePromoteVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ versionId, targetEnv }: {
      versionId: string
      targetEnv: 'development' | 'staging' | 'production'
    }) => db.promoteVersion(versionId, targetEnv),
    onSuccess: (version) => {
      qc.invalidateQueries({ queryKey: versionKeys.byProject(version.projectId) })
      qc.invalidateQueries({ queryKey: ['activities', version.projectId] })
    },
  })
}

export function useRollbackVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: string) => db.rollbackVersion(versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['versions'] })
      qc.invalidateQueries({ queryKey: ['activities'] })
    },
  })
}

export function useDeleteVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: string) => db.deleteVersion(versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['versions'] })
    },
  })
}

export function useCompareVersions(v1Id: string, v2Id: string) {
  return useQuery({
    queryKey: ['versionDiff', v1Id, v2Id],
    queryFn: () => db.compareVersions(v1Id, v2Id),
    enabled: !!v1Id && !!v2Id,
  })
}
