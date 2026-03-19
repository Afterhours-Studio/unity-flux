/**
 * Supabase Data Access Layer
 * Mirrors database/src/store/postgres-store.ts but runs client-side via Supabase JS.
 */
import { supabase } from './supabase'
import type {
  Project, Schema, SchemaField, DataEntry, Version, VersionDiff,
  VersionTableDiff, ActivityLog,
} from '@/types/project'

type Environment = Project['environment']

// ─── ID Helpers ────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID()
}

function generateProjectId(slug: string): string {
  const suffix = Math.random().toString(36).substring(2, 7)
  return `${slug}-${suffix}`
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'flux_'
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

function generateAnonKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'anon_'
  for (let i = 0; i < 40; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

function nextVersionTag(versions: Version[], projectId: string, environment: Environment): string {
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

// ─── Row Mappers (snake_case DB → camelCase TS) ───────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProject(r: any): Project {
  return {
    id: r.id, name: r.name, slug: r.slug, description: r.description,
    createdAt: r.created_at, updatedAt: r.updated_at,
    apiKey: r.api_key, anonKey: r.anon_key,
    supabaseUrl: r.supabase_url, r2BucketUrl: r.r2_bucket_url,
    environment: r.environment,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSchema(r: any): Schema {
  return {
    id: r.id, projectId: r.project_id, name: r.name,
    mode: r.mode, fields: r.fields as SchemaField[],
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(r: any): DataEntry {
  return {
    id: r.id, schemaId: r.schema_id,
    data: r.data as Record<string, unknown>,
    environment: r.environment, isActive: r.is_active,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVersion(r: any): Version {
  return {
    id: r.id, projectId: r.project_id, versionTag: r.version_tag,
    environment: r.environment, status: r.status,
    data: r.data as Record<string, Record<string, unknown>[]>,
    tableCount: r.table_count, rowCount: r.row_count,
    publishedAt: r.published_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toActivity(r: any): ActivityLog {
  return {
    id: r.id, projectId: r.project_id,
    type: r.type, message: r.message,
    meta: r.meta ?? undefined, createdAt: r.created_at,
  }
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

async function insertActivity(projectId: string, type: ActivityLog['type'], message: string): Promise<void> {
  await supabase.from('activities').insert({
    id: generateId(), project_id: projectId, type, message,
  })
}

// ─── Projects ─────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toProject)
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toProject(data) : null
}

export async function createProject(name: string, description: string): Promise<Project> {
  const userId = await getUserId()
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = generateProjectId(slug)
  const { data, error } = await supabase
    .from('projects').insert({
      id, name, slug, description,
      api_key: generateApiKey(), anon_key: generateAnonKey(),
      user_id: userId,
    }).select().single()
  if (error) throw error
  return toProject(data)
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>>,
): Promise<Project> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.description !== undefined) row.description = updates.description
  if (updates.supabaseUrl !== undefined) row.supabase_url = updates.supabaseUrl
  if (updates.r2BucketUrl !== undefined) row.r2_bucket_url = updates.r2BucketUrl
  if (updates.environment !== undefined) row.environment = updates.environment
  if (Object.keys(row).length === 0) {
    const p = await getProject(id)
    if (!p) throw new Error(`Project not found: ${id}`)
    return p
  }
  const { data, error } = await supabase
    .from('projects').update(row).eq('id', id).select().single()
  if (error) throw error
  return toProject(data)
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

export async function regenerateApiKey(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects').update({ api_key: generateApiKey() }).eq('id', id).select().single()
  if (error) throw error
  return toProject(data)
}

// ─── Schemas (tables) ─────────────────────────────────

export async function listSchemas(projectId: string): Promise<Schema[]> {
  const { data, error } = await supabase
    .from('schemas').select('*').eq('project_id', projectId).order('created_at')
  if (error) throw error
  return (data ?? []).map(toSchema)
}

export async function getSchema(id: string): Promise<Schema | null> {
  const { data, error } = await supabase
    .from('schemas').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toSchema(data) : null
}

export async function createSchema(
  projectId: string, name: string, fields: SchemaField[], mode: Schema['mode'] = 'data',
): Promise<Schema> {
  const defaultConfigFields: SchemaField[] = [
    { name: 'parameter', type: 'string', required: true },
    { name: 'description', type: 'string', required: false },
    { name: 'type', type: 'config', required: true, configRef: 'value' },
    { name: 'value', type: 'string', required: false },
  ]
  const actualFields = fields.length > 0 ? fields : (mode === 'config' ? defaultConfigFields : fields)
  const id = generateId()
  const { data, error } = await supabase
    .from('schemas').insert({
      id, project_id: projectId, name, mode, fields: actualFields as unknown as Record<string, unknown>,
    }).select().single()
  if (error) throw error
  await insertActivity(projectId, 'table_create', `Created table "${name}"`)
  return toSchema(data)
}

export async function renameSchema(id: string, name: string): Promise<Schema> {
  const { data, error } = await supabase
    .from('schemas').update({ name }).eq('id', id).select().single()
  if (error) throw error
  return toSchema(data)
}

export async function updateSchema(id: string, updates: Partial<Pick<Schema, 'name' | 'fields'>>): Promise<Schema> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.fields !== undefined) row.fields = updates.fields as unknown as Record<string, unknown>
  if (Object.keys(row).length === 0) {
    const s = await getSchema(id)
    if (!s) throw new Error(`Schema not found: ${id}`)
    return s
  }
  const { data, error } = await supabase
    .from('schemas').update(row).eq('id', id).select().single()
  if (error) throw error
  const schema = toSchema(data)
  await insertActivity(schema.projectId, 'table_update', `Updated table "${schema.name}"`)
  return schema
}

export async function deleteSchema(id: string): Promise<void> {
  const schema = await getSchema(id)
  const { error } = await supabase.from('schemas').delete().eq('id', id)
  if (error) throw error
  if (schema) {
    await insertActivity(schema.projectId, 'table_delete', `Deleted table "${schema.name}"`)
  }
}

// ─── Columns ──────────────────────────────────────────

export async function addColumn(schemaId: string, field: SchemaField): Promise<Schema> {
  const schema = await getSchema(schemaId)
  if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  return updateSchema(schemaId, { fields: [...schema.fields, field] })
}

export async function updateColumn(schemaId: string, columnName: string, updates: Partial<SchemaField>): Promise<Schema> {
  const schema = await getSchema(schemaId)
  if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  if (!schema.fields.some(f => f.name === columnName)) throw new Error(`Column not found: ${columnName}`)
  const fields = schema.fields.map(f => f.name === columnName ? { ...f, ...updates } : f)
  return updateSchema(schemaId, { fields })
}

export async function removeColumn(schemaId: string, columnName: string): Promise<Schema> {
  const schema = await getSchema(schemaId)
  if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  return updateSchema(schemaId, { fields: schema.fields.filter(f => f.name !== columnName) })
}

// ─── Entries (rows) ───────────────────────────────────

export async function listEntries(schemaId: string): Promise<DataEntry[]> {
  const { data, error } = await supabase
    .from('entries').select('*').eq('schema_id', schemaId).order('created_at')
  if (error) throw error
  return (data ?? []).map(toEntry)
}

export async function getEntry(id: string): Promise<DataEntry | null> {
  const { data, error } = await supabase
    .from('entries').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toEntry(data) : null
}

export async function createEntry(
  schemaId: string, data: Record<string, unknown>, environment: Environment = 'development',
): Promise<DataEntry> {
  const id = generateId()
  const { data: row, error } = await supabase
    .from('entries').insert({
      id, schema_id: schemaId, data: data as unknown as Record<string, unknown>, environment,
    }).select().single()
  if (error) throw error
  const schema = await getSchema(schemaId)
  if (schema) {
    await insertActivity(schema.projectId, 'row_add', `Added row to "${schema.name}"`)
  }
  return toEntry(row)
}

export async function updateEntry(id: string, data: Record<string, unknown>): Promise<DataEntry> {
  const { data: row, error } = await supabase
    .from('entries').update({ data: data as unknown as Record<string, unknown> }).eq('id', id).select().single()
  if (error) throw error
  return toEntry(row)
}

export async function deleteEntry(id: string): Promise<void> {
  const entry = await getEntry(id)
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
  if (entry) {
    const schema = await getSchema(entry.schemaId)
    if (schema) {
      await insertActivity(schema.projectId, 'row_delete', `Deleted row from "${schema.name}"`)
    }
  }
}

// ─── Versions ─────────────────────────────────────────

export async function listVersions(projectId: string): Promise<Version[]> {
  const { data, error } = await supabase
    .from('versions').select('*').eq('project_id', projectId).order('published_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toVersion)
}

export async function publishVersion(projectId: string, environment: Environment): Promise<Version> {
  // Build snapshot
  const schemas = await listSchemas(projectId)
  const snapshot: Record<string, Record<string, unknown>[]> = {}
  let rowCount = 0
  for (const schema of schemas) {
    const entries = await listEntries(schema.id)
    snapshot[schema.name] = entries.map(e => e.data)
    rowCount += entries.length
  }

  // Get version tag
  const versions = await listVersions(projectId)
  const versionTag = nextVersionTag(versions, projectId, environment)

  // Supersede previous active
  await supabase
    .from('versions')
    .update({ status: 'superseded' })
    .eq('project_id', projectId)
    .eq('environment', environment)
    .eq('status', 'active')

  // Insert new version
  const id = generateId()
  const { data, error } = await supabase
    .from('versions').insert({
      id, project_id: projectId, version_tag: versionTag,
      environment, status: 'active',
      data: snapshot as unknown as Record<string, unknown>,
      table_count: schemas.length, row_count: rowCount,
    }).select().single()
  if (error) throw error

  await insertActivity(projectId, 'publish', `Published ${versionTag} to ${environment}`)
  return toVersion(data)
}

export async function promoteVersion(versionId: string, targetEnv: Environment): Promise<Version> {
  const { data: source, error: fetchErr } = await supabase
    .from('versions').select('*').eq('id', versionId).single()
  if (fetchErr || !source) throw new Error(`Version not found: ${versionId}`)
  const sourceVersion = toVersion(source)

  const versions = await listVersions(sourceVersion.projectId)
  const versionTag = nextVersionTag(versions, sourceVersion.projectId, targetEnv)

  // Supersede previous active
  await supabase
    .from('versions')
    .update({ status: 'superseded' })
    .eq('project_id', sourceVersion.projectId)
    .eq('environment', targetEnv)
    .eq('status', 'active')

  const id = generateId()
  const { data, error } = await supabase
    .from('versions').insert({
      id, project_id: sourceVersion.projectId, version_tag: versionTag,
      environment: targetEnv, status: 'active',
      data: sourceVersion.data as unknown as Record<string, unknown>,
      table_count: sourceVersion.tableCount, row_count: sourceVersion.rowCount,
    }).select().single()
  if (error) throw error

  await insertActivity(sourceVersion.projectId, 'promote', `Promoted ${sourceVersion.versionTag} → ${targetEnv} as ${versionTag}`)
  return toVersion(data)
}

export async function rollbackVersion(versionId: string): Promise<void> {
  const { data: target } = await supabase
    .from('versions').select('*').eq('id', versionId).single()
  if (!target) return
  const v = toVersion(target)

  // Roll back current active
  await supabase
    .from('versions')
    .update({ status: 'rolled_back' })
    .eq('project_id', v.projectId)
    .eq('environment', v.environment)
    .eq('status', 'active')

  // Reactivate target
  await supabase.from('versions').update({ status: 'active' }).eq('id', versionId)
  await insertActivity(v.projectId, 'rollback', `Rolled back to ${v.versionTag} in ${v.environment}`)
}

export async function deleteVersion(versionId: string): Promise<void> {
  const { error } = await supabase.from('versions').delete().eq('id', versionId)
  if (error) throw error
}

export async function compareVersions(v1Id: string, v2Id: string): Promise<VersionDiff> {
  const { data: r1 } = await supabase.from('versions').select('*').eq('id', v1Id).single()
  const { data: r2 } = await supabase.from('versions').select('*').eq('id', v2Id).single()
  if (!r1 || !r2) throw new Error('Version not found')
  const v1 = toVersion(r1)
  const v2 = toVersion(r2)

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
      for (const [key] of map1) {
        if (!map2.has(key)) removedRows.push(map1.get(key)!)
      }
    } else {
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

// ─── Activity ─────────────────────────────────────────

export async function listActivity(projectId: string, limit?: number): Promise<ActivityLog[]> {
  let query = supabase
    .from('activities').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toActivity)
}
