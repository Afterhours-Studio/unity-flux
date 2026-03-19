import { useQuery } from '@tanstack/react-query'
import * as db from '@/lib/supabase-data'

export const activityKeys = {
  byProject: (projectId: string) => ['activities', projectId] as const,
}

export function useActivities(projectId: string, limit?: number) {
  return useQuery({
    queryKey: [...activityKeys.byProject(projectId), limit],
    queryFn: () => db.listActivity(projectId, limit),
    enabled: !!projectId,
  })
}
