import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/supabase-data'
import type { LiveOpsEvent, BattlePassTier } from '@/types/project'

// ─── Query Keys ───────────────────────────────────────

export const liveOpsKeys = {
  byProject: (projectId: string) => ['live-ops', projectId] as const,
  detail: (id: string) => ['live-ops', 'detail', id] as const,
}

export const battlePassKeys = {
  byEvent: (eventId: string) => ['battle-pass', eventId] as const,
}

// ─── Event Queries ────────────────────────────────────

export function useLiveOpsEvents(projectId: string) {
  return useQuery({
    queryKey: liveOpsKeys.byProject(projectId),
    queryFn: () => db.listLiveOpsEvents(projectId),
    enabled: !!projectId,
  })
}

export function useCreateLiveOpsEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      projectId,
      event,
    }: {
      projectId: string
      event: Omit<LiveOpsEvent, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
    }) => db.createLiveOpsEvent(projectId, event),
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: liveOpsKeys.byProject(event.projectId) })
      qc.invalidateQueries({ queryKey: ['activities'] })
    },
  })
}

export function useUpdateLiveOpsEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Pick<LiveOpsEvent, 'name' | 'description' | 'status' | 'startAt' | 'endAt' | 'color' | 'config' | 'recurring'>>
    }) => db.updateLiveOpsEvent(id, updates),
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: liveOpsKeys.byProject(event.projectId) })
      qc.invalidateQueries({ queryKey: liveOpsKeys.detail(event.id) })
      qc.invalidateQueries({ queryKey: ['activities'] })
    },
  })
}

export function useDeleteLiveOpsEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteLiveOpsEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-ops'] })
      qc.invalidateQueries({ queryKey: ['activities'] })
    },
  })
}

// ─── Battle Pass Queries ──────────────────────────────

export function useBattlePassTiers(eventId: string) {
  return useQuery({
    queryKey: battlePassKeys.byEvent(eventId),
    queryFn: () => db.listBattlePassTiers(eventId),
    enabled: !!eventId,
  })
}

export function useCreateBattlePassTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventId,
      tier,
    }: {
      eventId: string
      tier: Omit<BattlePassTier, 'id' | 'eventId'>
    }) => db.createBattlePassTier(eventId, tier),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: battlePassKeys.byEvent(t.eventId) })
    },
  })
}

export function useUpdateBattlePassTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      eventId,
      updates,
    }: {
      id: string
      eventId: string
      updates: Partial<Pick<BattlePassTier, 'tier' | 'xpRequired' | 'freeReward' | 'premiumReward'>>
    }) => db.updateBattlePassTier(id, updates),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: battlePassKeys.byEvent(vars.eventId) })
    },
  })
}

export function useDeleteBattlePassTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, eventId }: { id: string; eventId: string }) =>
      db.deleteBattlePassTier(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: battlePassKeys.byEvent(vars.eventId) })
    },
  })
}
