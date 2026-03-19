import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Schema, DataEntry, Version, VersionDiff, VersionTableDiff, ActivityLog } from '@/types/project'

function generateId(): string {
  return crypto.randomUUID()
}

function makeActivity(
  projectId: string,
  type: ActivityLog['type'],
  message: string,
  meta?: Record<string, unknown>,
): ActivityLog {
  return { id: generateId(), projectId, type, message, meta, createdAt: new Date().toISOString() }
}

function generateProjectId(slug: string): string {
  const suffix = Math.random().toString(36).substring(2, 7)
  return `${slug}-${suffix}`
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'flux_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function nextVersionTag(
  versions: Version[],
  projectId: string,
  environment: Version['environment'],
): string {
  const envVersions = versions.filter(
    (v) => v.projectId === projectId && v.environment === environment,
  )
  // Parse existing patch numbers from tags like "development-v0.0.3"
  let maxPatch = 0
  for (const v of envVersions) {
    const match = v.versionTag.match(/v(\d+)\.(\d+)\.(\d+)/)
    if (match) {
      maxPatch = Math.max(maxPatch, parseInt(match[3], 10))
    }
  }
  const prefix = environment === 'production' ? 'v' : `${environment}-v`
  const major = environment === 'production' ? 1 : 0
  return `${prefix}${major}.0.${maxPatch + 1}`
}

function generateAnonKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'anon_'
  for (let i = 0; i < 40; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

interface ProjectStore {
  projects: Project[]
  schemas: Schema[]
  entries: DataEntry[]
  versions: Version[]
  activities: ActivityLog[]

  // Project CRUD
  addProject: (name: string, description: string) => Project
  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>>) => void
  deleteProject: (id: string) => void
  getProject: (id: string) => Project | undefined
  regenerateApiKey: (id: string) => void

  // Schema CRUD
  addSchema: (projectId: string, name: string, fields: Schema['fields'], mode?: Schema['mode']) => Schema
  updateSchema: (id: string, updates: Partial<Pick<Schema, 'name' | 'fields'>>) => void
  deleteSchema: (id: string) => void
  getSchemasByProject: (projectId: string) => Schema[]

  // Entry CRUD
  addEntry: (schemaId: string, data: Record<string, unknown>, environment: DataEntry['environment']) => DataEntry
  updateEntry: (id: string, data: Record<string, unknown>) => void
  deleteEntry: (id: string) => void
  getEntriesBySchema: (schemaId: string) => DataEntry[]

  // Version / Publish
  publishVersion: (projectId: string, environment: Version['environment']) => Version
  getVersionsByProject: (projectId: string) => Version[]
  promoteVersion: (versionId: string, targetEnv: Version['environment']) => Version
  rollbackVersion: (versionId: string) => void
  deleteVersion: (versionId: string) => void
  compareVersions: (v1Id: string, v2Id: string) => VersionDiff

  // Activity
  getActivitiesByProject: (projectId: string) => ActivityLog[]
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      schemas: [],
      entries: [],
      versions: [],
      activities: [],

      addProject: (name, description) => {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const now = new Date().toISOString()
        const project: Project = {
          id: generateProjectId(slug),
          name,
          slug,
          description,
          createdAt: now,
          updatedAt: now,
          apiKey: generateApiKey(),
          anonKey: generateAnonKey(),
          supabaseUrl: '',
          r2BucketUrl: '',
          environment: 'development',
        }
        set((state) => ({ projects: [...state.projects, project] }))
        return project
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
          ),
        }))
      },

      deleteProject: (id) => {
        set((state) => {
          const schemaIds = state.schemas.filter((s) => s.projectId === id).map((s) => s.id)
          return {
            projects: state.projects.filter((p) => p.id !== id),
            schemas: state.schemas.filter((s) => s.projectId !== id),
            entries: state.entries.filter((e) => !schemaIds.includes(e.schemaId)),
            versions: state.versions.filter((v) => v.projectId !== id),
            activities: state.activities.filter((a) => a.projectId !== id),
          }
        })
      },

      getProject: (id) => get().projects.find((p) => p.id === id),

      regenerateApiKey: (id) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, apiKey: generateApiKey(), updatedAt: new Date().toISOString() } : p,
          ),
        }))
      },

      addSchema: (projectId, name, fields, mode = 'data') => {
        const now = new Date().toISOString()
        const defaultConfigFields: Schema['fields'] = [
          { name: 'parameter', type: 'string', required: true },
          { name: 'description', type: 'string', required: false },
          { name: 'type', type: 'config', required: true, configRef: 'value' },
          { name: 'value', type: 'string', required: false },
        ]
        // Use provided fields if non-empty, otherwise use defaults for config mode
        const actualFields: Schema['fields'] =
          fields.length > 0 ? fields : (mode === 'config' ? defaultConfigFields : fields)
        const schema: Schema = {
          id: generateId(),
          projectId,
          name,
          mode,
          fields: actualFields,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          schemas: [...state.schemas, schema],
          activities: [...state.activities, makeActivity(projectId, 'table_create', `Created table "${name}"`)],
        }))
        return schema
      },

      updateSchema: (id, updates) => {
        set((state) => {
          const schema = state.schemas.find((s) => s.id === id)
          const acts = schema && updates.fields
            ? [makeActivity(schema.projectId, 'table_update', `Updated table "${schema.name}"`)]
            : []
          return {
            schemas: state.schemas.map((s) =>
              s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s,
            ),
            activities: [...state.activities, ...acts],
          }
        })
      },

      deleteSchema: (id) => {
        set((state) => {
          const schema = state.schemas.find((s) => s.id === id)
          return {
            schemas: state.schemas.filter((s) => s.id !== id),
            entries: state.entries.filter((e) => e.schemaId !== id),
            activities: schema
              ? [...state.activities, makeActivity(schema.projectId, 'table_delete', `Deleted table "${schema.name}"`)]
              : state.activities,
          }
        })
      },

      getSchemasByProject: (projectId) => get().schemas.filter((s) => s.projectId === projectId),

      addEntry: (schemaId, data, environment) => {
        const now = new Date().toISOString()
        const entry: DataEntry = {
          id: generateId(),
          schemaId,
          data,
          environment,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => {
          const schema = state.schemas.find((s) => s.id === schemaId)
          return {
            entries: [...state.entries, entry],
            activities: schema
              ? [...state.activities, makeActivity(schema.projectId, 'row_add', `Added row to "${schema.name}"`)]
              : state.activities,
          }
        })
        return entry
      },

      updateEntry: (id, data) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, data, updatedAt: new Date().toISOString() } : e,
          ),
        }))
      },

      deleteEntry: (id) => {
        set((state) => {
          const entry = state.entries.find((e) => e.id === id)
          const schema = entry ? state.schemas.find((s) => s.id === entry.schemaId) : undefined
          return {
            entries: state.entries.filter((e) => e.id !== id),
            activities: schema
              ? [...state.activities, makeActivity(schema.projectId, 'row_delete', `Deleted row from "${schema.name}"`)]
              : state.activities,
          }
        })
      },

      getEntriesBySchema: (schemaId) => get().entries.filter((e) => e.schemaId === schemaId),

      publishVersion: (projectId, environment) => {
        const state = get()
        const projectSchemas = state.schemas.filter((s) => s.projectId === projectId)

        // Build data snapshot
        const data: Record<string, Record<string, unknown>[]> = {}
        let rowCount = 0
        projectSchemas.forEach((schema) => {
          const rows = state.entries
            .filter((e) => e.schemaId === schema.id)
            .map((e) => e.data)
          data[schema.name] = rows
          rowCount += rows.length
        })

        // Auto-generate version tag
        const versionTag = nextVersionTag(state.versions, projectId, environment)

        // Mark previous active versions for same env as superseded
        const updatedVersions = state.versions.map((v) =>
          v.projectId === projectId && v.environment === environment && v.status === 'active'
            ? { ...v, status: 'superseded' as const }
            : v,
        )

        const version: Version = {
          id: generateId(),
          projectId,
          versionTag,
          environment,
          status: 'active',
          data,
          tableCount: projectSchemas.length,
          rowCount,
          publishedAt: new Date().toISOString(),
        }

        set((s) => ({
          versions: [...updatedVersions, version],
          activities: [...s.activities, makeActivity(projectId, 'publish', `Published ${versionTag} to ${environment}`)],
        }))
        return version
      },

      getVersionsByProject: (projectId) =>
        get()
          .versions.filter((v) => v.projectId === projectId)
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),

      promoteVersion: (versionId, targetEnv) => {
        const state = get()
        const source = state.versions.find((v) => v.id === versionId)
        if (!source) throw new Error('Version not found')

        const versionTag = nextVersionTag(state.versions, source.projectId, targetEnv)

        const updatedVersions = state.versions.map((v) =>
          v.projectId === source.projectId && v.environment === targetEnv && v.status === 'active'
            ? { ...v, status: 'superseded' as const }
            : v,
        )

        const version: Version = {
          id: generateId(),
          projectId: source.projectId,
          versionTag,
          environment: targetEnv,
          status: 'active',
          data: JSON.parse(JSON.stringify(source.data)),
          tableCount: source.tableCount,
          rowCount: source.rowCount,
          publishedAt: new Date().toISOString(),
        }

        set({
          versions: [...updatedVersions, version],
          activities: [...state.activities, makeActivity(source.projectId, 'promote', `Promoted ${source.versionTag} → ${targetEnv} as ${versionTag}`)],
        })
        return version
      },

      rollbackVersion: (versionId) => {
        const state = get()
        const target = state.versions.find((v) => v.id === versionId)
        if (!target) return

        set({
          versions: state.versions.map((v) => {
            if (v.id === versionId) return { ...v, status: 'active' as const }
            if (
              v.projectId === target.projectId &&
              v.environment === target.environment &&
              v.status === 'active'
            )
              return { ...v, status: 'rolled_back' as const }
            return v
          }),
          activities: [...state.activities, makeActivity(target.projectId, 'rollback', `Rolled back to ${target.versionTag} in ${target.environment}`)],
        })
      },

      deleteVersion: (versionId) => {
        set((state) => ({
          versions: state.versions.filter((v) => v.id !== versionId),
        }))
      },

      compareVersions: (v1Id, v2Id) => {
        const state = get()
        const v1 = state.versions.find((v) => v.id === v1Id)
        const v2 = state.versions.find((v) => v.id === v2Id)
        if (!v1 || !v2) throw new Error('Version not found')

        const allTables = new Set([...Object.keys(v1.data), ...Object.keys(v2.data)])
        const tableDiffs: VersionTableDiff[] = []
        const summary = {
          tablesAdded: 0, tablesRemoved: 0, tablesModified: 0,
          totalRowsAdded: 0, totalRowsRemoved: 0, totalRowsModified: 0,
        }

        for (const table of allTables) {
          const rows1 = v1.data[table] ?? []
          const rows2 = v2.data[table] ?? []

          if (!v1.data[table]) {
            summary.tablesAdded++
            summary.totalRowsAdded += rows2.length
            tableDiffs.push({ tableName: table, status: 'added', addedRows: rows2, removedRows: [], modifiedRows: [], unchangedRowCount: 0 })
            continue
          }
          if (!v2.data[table]) {
            summary.tablesRemoved++
            summary.totalRowsRemoved += rows1.length
            tableDiffs.push({ tableName: table, status: 'removed', addedRows: [], removedRows: rows1, modifiedRows: [], unchangedRowCount: 0 })
            continue
          }

          // Find a key column for matching
          const keyCols = ['id', 'key', 'parameter', 'name']
          const allCols = rows1.length > 0 ? Object.keys(rows1[0]) : []
          const keyCol = keyCols.find((k) => allCols.includes(k))

          const addedRows: Record<string, unknown>[] = []
          const removedRows: Record<string, unknown>[] = []
          const modifiedRows: VersionTableDiff['modifiedRows'] = []
          let unchangedRowCount = 0

          if (keyCol) {
            const map1 = new Map(rows1.map((r) => [String(r[keyCol]), r]))
            const map2 = new Map(rows2.map((r) => [String(r[keyCol]), r]))
            for (const [key, row] of map2) {
              const old = map1.get(key)
              if (!old) { addedRows.push(row); continue }
              const changedFields = Object.keys(row).filter((f) => JSON.stringify(row[f]) !== JSON.stringify(old[f]))
              if (changedFields.length > 0) modifiedRows.push({ before: old, after: row, changedFields })
              else unchangedRowCount++
            }
            for (const [key, row] of map1) {
              if (!map2.has(key)) removedRows.push(row)
            }
          } else {
            // Positional comparison
            const maxLen = Math.max(rows1.length, rows2.length)
            for (let i = 0; i < maxLen; i++) {
              if (i >= rows1.length) { addedRows.push(rows2[i]); continue }
              if (i >= rows2.length) { removedRows.push(rows1[i]); continue }
              const changedFields = Object.keys(rows2[i]).filter((f) => JSON.stringify(rows2[i][f]) !== JSON.stringify(rows1[i][f]))
              if (changedFields.length > 0) modifiedRows.push({ before: rows1[i], after: rows2[i], changedFields })
              else unchangedRowCount++
            }
          }

          const hasChanges = addedRows.length > 0 || removedRows.length > 0 || modifiedRows.length > 0
          if (hasChanges) summary.tablesModified++
          summary.totalRowsAdded += addedRows.length
          summary.totalRowsRemoved += removedRows.length
          summary.totalRowsModified += modifiedRows.length
          tableDiffs.push({
            tableName: table,
            status: hasChanges ? 'modified' : 'unchanged',
            addedRows, removedRows, modifiedRows, unchangedRowCount,
          })
        }

        return { v1Id, v2Id, tableDiffs, summary }
      },

      getActivitiesByProject: (projectId) =>
        get()
          .activities.filter((a) => a.projectId === projectId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }),
    {
      name: 'unity-flux-store',
    },
  ),
)
