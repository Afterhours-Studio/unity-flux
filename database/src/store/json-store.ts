import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
import type { DataStore } from './data-store.js'
import type { StoreData, Project, Schema, SchemaField, DataEntry, Version, VersionDiff, VersionTableDiff, ActivityLog, Environment, WebhookRegistration } from './types.js'
import { generateId, generateProjectId, generateApiKey, generateAnonKey } from '../util/id.js'
import { nextVersionTag } from '../util/version-tag.js'

function computeTableHashes(data: Record<string, Record<string, unknown>[]>): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const [tableName, rows] of Object.entries(data)) {
    const json = JSON.stringify(rows)
    hashes[tableName] = createHash('sha256').update(json).digest('hex')
  }
  return hashes
}

function makeActivity(projectId: string, type: ActivityLog['type'], message: string): ActivityLog {
  return { id: generateId(), projectId, type, message, createdAt: new Date().toISOString() }
}

export class JsonStore implements DataStore {
  constructor(private filePath: string) {}

  private read(): StoreData {
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8'))
    } catch {
      return { projects: [], schemas: [], entries: [], versions: [], activities: [], webhooks: [] }
    }
  }

  private write(data: StoreData): void {
    const tmp = this.filePath + '.tmp'
    writeFileSync(tmp, JSON.stringify(data, null, 2))
    renameSync(tmp, this.filePath)
  }

  // === PROJECTS ===

  async listProjects() {
    return this.read().projects
  }

  async getProject(id: string) {
    return this.read().projects.find(p => p.id === id) ?? null
  }

  async createProject(name: string, description: string) {
    const data = this.read()
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
    data.projects.push(project)
    this.write(data)
    return project
  }

  async updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>>) {
    const data = this.read()
    const idx = data.projects.findIndex(p => p.id === id)
    if (idx === -1) throw new Error(`Project not found: ${id}`)
    data.projects[idx] = { ...data.projects[idx], ...updates, updatedAt: new Date().toISOString() }
    this.write(data)
    return data.projects[idx]
  }

  async regenerateApiKey(id: string) {
    const data = this.read()
    const idx = data.projects.findIndex(p => p.id === id)
    if (idx === -1) throw new Error(`Project not found: ${id}`)
    data.projects[idx] = { ...data.projects[idx], apiKey: generateApiKey(), updatedAt: new Date().toISOString() }
    this.write(data)
    return data.projects[idx]
  }

  async deleteProject(id: string) {
    const data = this.read()
    const schemaIds = data.schemas.filter(s => s.projectId === id).map(s => s.id)
    data.projects = data.projects.filter(p => p.id !== id)
    data.schemas = data.schemas.filter(s => s.projectId !== id)
    data.entries = data.entries.filter(e => !schemaIds.includes(e.schemaId))
    data.versions = data.versions.filter(v => v.projectId !== id)
    data.activities = data.activities.filter(a => a.projectId !== id)
    if (data.webhooks) data.webhooks = data.webhooks.filter(w => w.projectId !== id)
    this.write(data)
  }

  // === SCHEMAS (tables) ===

  async listSchemas(projectId: string) {
    return this.read().schemas.filter(s => s.projectId === projectId)
  }

  async getSchema(id: string) {
    return this.read().schemas.find(s => s.id === id) ?? null
  }

  async createSchema(projectId: string, name: string, fields: SchemaField[], mode: Schema['mode'] = 'data') {
    const data = this.read()
    const now = new Date().toISOString()
    const defaultConfigFields: SchemaField[] = [
      { name: 'parameter', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'type', type: 'config', required: true, configRef: 'value' },
      { name: 'value', type: 'string', required: false },
    ]
    const actualFields: SchemaField[] =
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
    data.schemas.push(schema)
    data.activities.push(makeActivity(projectId, 'table_create', `Created table "${name}"`))
    this.write(data)
    return schema
  }

  async renameSchema(id: string, name: string) {
    const data = this.read()
    const idx = data.schemas.findIndex(s => s.id === id)
    if (idx === -1) throw new Error(`Schema not found: ${id}`)
    data.schemas[idx] = { ...data.schemas[idx], name, updatedAt: new Date().toISOString() }
    this.write(data)
    return data.schemas[idx]
  }

  async updateSchema(id: string, updates: Partial<Pick<Schema, 'name' | 'fields'>>) {
    const data = this.read()
    const idx = data.schemas.findIndex(s => s.id === id)
    if (idx === -1) throw new Error(`Schema not found: ${id}`)
    if (updates.name !== undefined) data.schemas[idx].name = updates.name
    if (updates.fields !== undefined) data.schemas[idx].fields = updates.fields
    data.schemas[idx].updatedAt = new Date().toISOString()
    this.write(data)
    return data.schemas[idx]
  }

  async deleteSchema(id: string) {
    const data = this.read()
    const schema = data.schemas.find(s => s.id === id)
    data.schemas = data.schemas.filter(s => s.id !== id)
    data.entries = data.entries.filter(e => e.schemaId !== id)
    if (schema) {
      data.activities.push(makeActivity(schema.projectId, 'table_delete', `Deleted table "${schema.name}"`))
    }
    this.write(data)
  }

  // === COLUMNS ===

  async addColumn(schemaId: string, field: SchemaField) {
    const data = this.read()
    const idx = data.schemas.findIndex(s => s.id === schemaId)
    if (idx === -1) throw new Error(`Schema not found: ${schemaId}`)
    data.schemas[idx].fields.push(field)
    data.schemas[idx].updatedAt = new Date().toISOString()
    data.activities.push(makeActivity(data.schemas[idx].projectId, 'table_update', `Updated table "${data.schemas[idx].name}"`))
    this.write(data)
    return data.schemas[idx]
  }

  async updateColumn(schemaId: string, columnName: string, updates: Partial<SchemaField>) {
    const data = this.read()
    const idx = data.schemas.findIndex(s => s.id === schemaId)
    if (idx === -1) throw new Error(`Schema not found: ${schemaId}`)
    const fieldIdx = data.schemas[idx].fields.findIndex(f => f.name === columnName)
    if (fieldIdx === -1) throw new Error(`Column not found: ${columnName}`)
    data.schemas[idx].fields[fieldIdx] = { ...data.schemas[idx].fields[fieldIdx], ...updates }
    data.schemas[idx].updatedAt = new Date().toISOString()
    data.activities.push(makeActivity(data.schemas[idx].projectId, 'table_update', `Updated table "${data.schemas[idx].name}"`))
    this.write(data)
    return data.schemas[idx]
  }

  async removeColumn(schemaId: string, columnName: string) {
    const data = this.read()
    const idx = data.schemas.findIndex(s => s.id === schemaId)
    if (idx === -1) throw new Error(`Schema not found: ${schemaId}`)
    data.schemas[idx].fields = data.schemas[idx].fields.filter(f => f.name !== columnName)
    data.schemas[idx].updatedAt = new Date().toISOString()
    data.activities.push(makeActivity(data.schemas[idx].projectId, 'table_update', `Updated table "${data.schemas[idx].name}"`))
    this.write(data)
    return data.schemas[idx]
  }

  // === ENTRIES (rows) ===

  async listEntries(schemaId: string) {
    return this.read().entries.filter(e => e.schemaId === schemaId)
  }

  async getEntry(id: string) {
    return this.read().entries.find(e => e.id === id) ?? null
  }

  async createEntry(schemaId: string, entryData: Record<string, unknown>, environment: Environment = 'development') {
    const data = this.read()
    const now = new Date().toISOString()
    const entry: DataEntry = {
      id: generateId(),
      schemaId,
      data: entryData,
      environment,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
    data.entries.push(entry)
    const schema = data.schemas.find(s => s.id === schemaId)
    if (schema) {
      data.activities.push(makeActivity(schema.projectId, 'row_add', `Added row to "${schema.name}"`))
    }
    this.write(data)
    return entry
  }

  async updateEntry(id: string, entryData: Record<string, unknown>) {
    const data = this.read()
    const idx = data.entries.findIndex(e => e.id === id)
    if (idx === -1) throw new Error(`Entry not found: ${id}`)
    data.entries[idx] = { ...data.entries[idx], data: entryData, updatedAt: new Date().toISOString() }
    const schema = data.schemas.find(s => s.id === data.entries[idx].schemaId)
    if (schema) {
      data.activities.push(makeActivity(schema.projectId, 'row_update', `Updated row in "${schema.name}"`))
    }
    this.write(data)
    return data.entries[idx]
  }

  async deleteEntry(id: string) {
    const data = this.read()
    const entry = data.entries.find(e => e.id === id)
    const schema = entry ? data.schemas.find(s => s.id === entry.schemaId) : undefined
    data.entries = data.entries.filter(e => e.id !== id)
    if (schema) {
      data.activities.push(makeActivity(schema.projectId, 'row_delete', `Deleted row from "${schema.name}"`))
    }
    this.write(data)
  }

  async createEntries(schemaId: string, rows: Record<string, unknown>[], environment: Environment = 'development') {
    const data = this.read()
    const now = new Date().toISOString()
    const entries: DataEntry[] = rows.map(row => ({
      id: generateId(),
      schemaId,
      data: row,
      environment,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }))
    data.entries.push(...entries)
    const schema = data.schemas.find(s => s.id === schemaId)
    if (schema) {
      data.activities.push(makeActivity(schema.projectId, 'row_add', `Added ${rows.length} rows to "${schema.name}"`))
    }
    this.write(data)
    return entries
  }

  async deleteEntries(ids: string[]) {
    const data = this.read()
    const idSet = new Set(ids)
    data.entries = data.entries.filter(e => !idSet.has(e.id))
    this.write(data)
  }

  // === VERSIONS ===

  async listVersions(projectId: string) {
    return this.read().versions
      .filter(v => v.projectId === projectId)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  }

  async publishVersion(projectId: string, environment: Environment) {
    const data = this.read()
    const projectSchemas = data.schemas.filter(s => s.projectId === projectId)

    // Build data snapshot
    const snapshot: Record<string, Record<string, unknown>[]> = {}
    let rowCount = 0
    for (const schema of projectSchemas) {
      const rows = data.entries
        .filter(e => e.schemaId === schema.id)
        .map(e => e.data)
      snapshot[schema.name] = rows
      rowCount += rows.length
    }

    // Compute table hashes for delta sync
    const tableHashes = computeTableHashes(snapshot)

    // Auto-generate version tag
    const versionTag = nextVersionTag(data.versions, projectId, environment)

    // Mark previous active versions for same env as superseded
    for (const v of data.versions) {
      if (v.projectId === projectId && v.environment === environment && v.status === 'active') {
        v.status = 'superseded'
      }
    }

    const version: Version = {
      id: generateId(),
      projectId,
      versionTag,
      environment,
      status: 'active',
      data: snapshot,
      tableHashes,
      tableCount: projectSchemas.length,
      rowCount,
      publishedAt: new Date().toISOString(),
    }

    data.versions.push(version)
    data.activities.push(makeActivity(projectId, 'publish', `Published ${versionTag} to ${environment}`))
    this.write(data)
    return version
  }

  async promoteVersion(versionId: string, targetEnv: Environment) {
    const data = this.read()
    const source = data.versions.find(v => v.id === versionId)
    if (!source) throw new Error(`Version not found: ${versionId}`)

    const versionTag = nextVersionTag(data.versions, source.projectId, targetEnv)

    // Mark previous active versions for target env as superseded
    for (const v of data.versions) {
      if (v.projectId === source.projectId && v.environment === targetEnv && v.status === 'active') {
        v.status = 'superseded'
      }
    }

    const promotedData = JSON.parse(JSON.stringify(source.data))
    const version: Version = {
      id: generateId(),
      projectId: source.projectId,
      versionTag,
      environment: targetEnv,
      status: 'active',
      data: promotedData,
      tableHashes: computeTableHashes(promotedData),
      tableCount: source.tableCount,
      rowCount: source.rowCount,
      publishedAt: new Date().toISOString(),
    }

    data.versions.push(version)
    data.activities.push(makeActivity(source.projectId, 'promote', `Promoted ${source.versionTag} → ${targetEnv} as ${versionTag}`))
    this.write(data)
    return version
  }

  async rollbackVersion(versionId: string) {
    const data = this.read()
    const target = data.versions.find(v => v.id === versionId)
    if (!target) return

    for (const v of data.versions) {
      if (v.id === versionId) {
        v.status = 'active'
      } else if (v.projectId === target.projectId && v.environment === target.environment && v.status === 'active') {
        v.status = 'rolled_back'
      }
    }

    data.activities.push(makeActivity(target.projectId, 'rollback', `Rolled back to ${target.versionTag} in ${target.environment}`))
    this.write(data)
  }

  async deleteVersion(versionId: string) {
    const data = this.read()
    data.versions = data.versions.filter(v => v.id !== versionId)
    this.write(data)
  }

  async compareVersions(v1Id: string, v2Id: string) {
    const data = this.read()
    const v1 = data.versions.find(v => v.id === v1Id)
    const v2 = data.versions.find(v => v.id === v2Id)
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
      const keyCol = keyCols.find(k => allCols.includes(k))

      const addedRows: Record<string, unknown>[] = []
      const removedRows: Record<string, unknown>[] = []
      const modifiedRows: VersionTableDiff['modifiedRows'] = []
      let unchangedRowCount = 0

      if (keyCol) {
        const map1 = new Map(rows1.map(r => [String(r[keyCol]), r]))
        const map2 = new Map(rows2.map(r => [String(r[keyCol]), r]))
        for (const [key, row] of map2) {
          const old = map1.get(key)
          if (!old) { addedRows.push(row); continue }
          const changedFields = Object.keys(row).filter(f => JSON.stringify(row[f]) !== JSON.stringify(old[f]))
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
          const changedFields = Object.keys(rows2[i]).filter(f => JSON.stringify(rows2[i][f]) !== JSON.stringify(rows1[i][f]))
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
  }

  // === ACTIVITY ===

  async listActivity(projectId: string, limit?: number) {
    const activities = this.read().activities
      .filter(a => a.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return limit ? activities.slice(0, limit) : activities
  }

  // === WEBHOOKS ===

  async listWebhooks(projectId: string) {
    const data = this.read()
    if (!data.webhooks) data.webhooks = []
    return data.webhooks.filter(w => w.projectId === projectId)
  }

  async createWebhook(projectId: string, url: string, secret: string, events: string[]) {
    const data = this.read()
    if (!data.webhooks) data.webhooks = []
    const webhook: WebhookRegistration = {
      id: generateId(),
      projectId,
      url,
      secret,
      events: events as ActivityLog['type'][],
      active: true,
      createdAt: new Date().toISOString(),
    }
    data.webhooks.push(webhook)
    this.write(data)
    return webhook
  }

  async deleteWebhook(id: string) {
    const data = this.read()
    if (!data.webhooks) data.webhooks = []
    data.webhooks = data.webhooks.filter(w => w.id !== id)
    this.write(data)
  }
}
