import type { Version, Environment } from '../store/types.js'

export function nextVersionTag(versions: Version[], projectId: string, environment: Environment): string {
  const envVersions = versions.filter(v => v.projectId === projectId && v.environment === environment)
  let maxPatch = 0
  for (const v of envVersions) {
    const match = v.versionTag.match(/v(\d+)\.(\d+)\.(\d+)/)
    if (match) maxPatch = Math.max(maxPatch, parseInt(match[3], 10))
  }
  const prefix = environment === 'production' ? 'v' : `${environment}-v`
  const major = environment === 'production' ? 1 : 0
  return `${prefix}${major}.0.${maxPatch + 1}`
}
