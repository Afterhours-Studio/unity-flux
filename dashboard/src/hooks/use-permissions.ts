import { useAuthStore } from '@/stores/auth-store'
import * as permissions from '@/lib/permissions'
import type { Role } from '@/lib/permissions'

export function usePermissions() {
  const profile = useAuthStore((s) => s.profile)
  const role: Role = profile?.role ?? 'viewer'

  return {
    role,
    canEdit: permissions.canEdit(role),
    canDelete: permissions.canDelete(role),
    canPublish: permissions.canPublish(role),
    canImport: permissions.canImport(role),
    canManageUsers: permissions.canManageUsers(role),
    canManageProject: permissions.canManageProject(role),
    isViewer: role === 'viewer',
  }
}
