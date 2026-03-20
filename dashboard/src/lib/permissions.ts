export type Role = 'admin' | 'editor' | 'viewer'

export function canEdit(role: Role): boolean {
  return role === 'admin' || role === 'editor'
}

export function canDelete(role: Role): boolean {
  return role === 'admin' || role === 'editor'
}

export function canPublish(role: Role): boolean {
  return role === 'admin' || role === 'editor'
}

export function canImport(role: Role): boolean {
  return role === 'admin' || role === 'editor'
}

export function canManageUsers(role: Role): boolean {
  return role === 'admin'
}

export function canManageProject(role: Role): boolean {
  return role === 'admin'
}
