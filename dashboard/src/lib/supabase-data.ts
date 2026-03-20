/**
 * Supabase Data Access Layer
 * Mirrors database/src/store/postgres-store.ts but runs client-side via Supabase JS.
 */
import { supabase } from './supabase'
import type {
  Project, Schema, SchemaField, DataEntry, Version, VersionDiff,
  VersionTableDiff, ActivityLog,
  LiveOpsEvent, LiveOpsEventType, LiveOpsStatus, BattlePassTier,
  Formula, FormulaVariable,
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
    icon: r.icon ?? '',
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
    r2Url: r.r2_url ?? null,
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
  updates: Partial<Pick<Project, 'name' | 'description' | 'icon' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>>,
): Promise<Project> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.description !== undefined) row.description = updates.description
  if (updates.icon !== undefined) row.icon = updates.icon
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

export async function addColumns(schemaId: string, fields: SchemaField[]): Promise<Schema> {
  const schema = await getSchema(schemaId)
  if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  return updateSchema(schemaId, { fields: [...schema.fields, ...fields] })
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

export async function createEntries(
  schemaId: string, rows: Record<string, unknown>[], environment: Environment = 'development',
): Promise<DataEntry[]> {
  if (rows.length === 0) return []
  const inserts = rows.map(r => ({
    id: generateId(), schema_id: schemaId, data: r as unknown as Record<string, unknown>, environment,
  }))
  const { data, error } = await supabase.from('entries').insert(inserts).select()
  if (error) throw error
  const schema = await getSchema(schemaId)
  if (schema) {
    await insertActivity(schema.projectId, 'row_add', `Added ${rows.length} rows to "${schema.name}"`)
  }
  return (data ?? []).map(toEntry)
}

export async function updateEntry(id: string, data: Record<string, unknown>): Promise<DataEntry> {
  const { data: row, error } = await supabase
    .from('entries').update({ data: data as unknown as Record<string, unknown> }).eq('id', id).select().single()
  if (error) throw error
  return toEntry(row)
}

export async function updateEntries(updates: { id: string; data: Record<string, unknown> }[]): Promise<DataEntry[]> {
  if (updates.length === 0) return []
  const results: DataEntry[] = []
  for (const u of updates) {
    results.push(await updateEntry(u.id, u.data))
  }
  return results
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

  const version = toVersion(data)

  // R2 CDN upload (non-fatal, fire-and-forget from client)
  try {
    const project = await getProject(projectId)
    const { data: { session } } = await supabase.auth.getSession()
    if (project && session?.access_token) {
      fetch('/api/r2/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          projectId, versionId: version.id, projectSlug: project.slug,
          environment, versionTag, data: snapshot,
          tableCount: schemas.length, rowCount,
        }),
      }).catch(() => { /* R2 upload is non-fatal */ })
    }
  } catch { /* R2 upload is non-fatal */ }

  return version
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

  const version = toVersion(data)

  // R2 CDN upload (non-fatal)
  try {
    const project = await getProject(sourceVersion.projectId)
    const { data: { session } } = await supabase.auth.getSession()
    if (project && session?.access_token) {
      fetch('/api/r2/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          projectId: sourceVersion.projectId, versionId: version.id, projectSlug: project.slug,
          environment: targetEnv, versionTag,
          data: sourceVersion.data, tableCount: sourceVersion.tableCount, rowCount: sourceVersion.rowCount,
        }),
      }).catch(() => {})
    }
  } catch {}

  return version
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

  // R2 CDN pointer update (non-fatal)
  try {
    const project = await getProject(v.projectId)
    const { data: { session } } = await supabase.auth.getSession()
    if (project && session?.access_token) {
      fetch('/api/r2/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          projectSlug: project.slug, environment: v.environment,
          versionTag: v.versionTag, tableCount: v.tableCount, rowCount: v.rowCount,
        }),
      }).catch(() => {})
    }
  } catch {}
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

// ─── Live Ops Events ──────────────────────────────────

function toLiveOpsEvent(r: Record<string, unknown>): LiveOpsEvent {
  return {
    id: r.id as string, projectId: r.project_id as string,
    name: r.name as string, description: r.description as string,
    type: r.type as LiveOpsEventType, status: r.status as LiveOpsStatus,
    startAt: r.start_at as string, endAt: r.end_at as string,
    color: r.color as string, config: (r.config ?? {}) as Record<string, unknown>,
    recurring: (r.recurring as string | null) as LiveOpsEvent['recurring'],
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }
}

function toBattlePassTier(r: Record<string, unknown>): BattlePassTier {
  return {
    id: r.id as string, eventId: r.event_id as string,
    tier: r.tier as number, xpRequired: r.xp_required as number,
    freeReward: r.free_reward as string, premiumReward: r.premium_reward as string,
  }
}

export async function listLiveOpsEvents(projectId: string): Promise<LiveOpsEvent[]> {
  const { data, error } = await supabase
    .from('live_ops_events').select('*').eq('project_id', projectId).order('start_at')
  if (error) throw error
  return (data ?? []).map(toLiveOpsEvent)
}

export async function getLiveOpsEvent(id: string): Promise<LiveOpsEvent | null> {
  const { data, error } = await supabase
    .from('live_ops_events').select('*').eq('id', id).single()
  if (error) return null
  return toLiveOpsEvent(data)
}

export async function createLiveOpsEvent(
  projectId: string,
  event: Omit<LiveOpsEvent, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
): Promise<LiveOpsEvent> {
  const id = generateId()
  const { data, error } = await supabase
    .from('live_ops_events')
    .insert({
      id, project_id: projectId, name: event.name, description: event.description,
      type: event.type, status: event.status, start_at: event.startAt, end_at: event.endAt,
      color: event.color, config: event.config, recurring: event.recurring,
    })
    .select().single()
  if (error) throw error
  await insertActivity(projectId, 'event_create', `Created event "${event.name}"`)
  return toLiveOpsEvent(data)
}

export async function updateLiveOpsEvent(
  id: string,
  updates: Partial<Pick<LiveOpsEvent, 'name' | 'description' | 'status' | 'startAt' | 'endAt' | 'color' | 'config' | 'recurring'>>,
): Promise<LiveOpsEvent> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.startAt !== undefined) dbUpdates.start_at = updates.startAt
  if (updates.endAt !== undefined) dbUpdates.end_at = updates.endAt
  if (updates.color !== undefined) dbUpdates.color = updates.color
  if (updates.config !== undefined) dbUpdates.config = updates.config
  if (updates.recurring !== undefined) dbUpdates.recurring = updates.recurring

  const { data, error } = await supabase
    .from('live_ops_events').update(dbUpdates).eq('id', id).select().single()
  if (error) throw error
  const event = toLiveOpsEvent(data)
  await insertActivity(event.projectId, 'event_update', `Updated event "${event.name}"`)
  return event
}

export async function deleteLiveOpsEvent(id: string): Promise<void> {
  const event = await getLiveOpsEvent(id)
  const { error } = await supabase.from('live_ops_events').delete().eq('id', id)
  if (error) throw error
  if (event) await insertActivity(event.projectId, 'event_delete', `Deleted event "${event.name}"`)
}

// ─── Battle Pass Tiers ────────────────────────────────

export async function listBattlePassTiers(eventId: string): Promise<BattlePassTier[]> {
  const { data, error } = await supabase
    .from('battle_pass_tiers').select('*').eq('event_id', eventId).order('tier')
  if (error) throw error
  return (data ?? []).map(toBattlePassTier)
}

export async function createBattlePassTier(
  eventId: string,
  tier: Omit<BattlePassTier, 'id' | 'eventId'>,
): Promise<BattlePassTier> {
  const id = generateId()
  const { data, error } = await supabase
    .from('battle_pass_tiers')
    .insert({ id, event_id: eventId, tier: tier.tier, xp_required: tier.xpRequired, free_reward: tier.freeReward, premium_reward: tier.premiumReward })
    .select().single()
  if (error) throw error
  return toBattlePassTier(data)
}

export async function updateBattlePassTier(
  id: string,
  updates: Partial<Pick<BattlePassTier, 'tier' | 'xpRequired' | 'freeReward' | 'premiumReward'>>,
): Promise<BattlePassTier> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.tier !== undefined) dbUpdates.tier = updates.tier
  if (updates.xpRequired !== undefined) dbUpdates.xp_required = updates.xpRequired
  if (updates.freeReward !== undefined) dbUpdates.free_reward = updates.freeReward
  if (updates.premiumReward !== undefined) dbUpdates.premium_reward = updates.premiumReward

  const { data, error } = await supabase
    .from('battle_pass_tiers').update(dbUpdates).eq('id', id).select().single()
  if (error) throw error
  return toBattlePassTier(data)
}

export async function deleteBattlePassTier(id: string): Promise<void> {
  const { error } = await supabase.from('battle_pass_tiers').delete().eq('id', id)
  if (error) throw error
}

/* ═══════════════════════════════════════════════
   Formulas
   ═══════════════════════════════════════════════ */

function toFormula(r: Record<string, unknown>): Formula {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    description: (r.description as string) ?? '',
    expression: r.expression as string,
    variables: (r.variables as FormulaVariable[]) ?? [],
    outputMode: (r.output_mode as 'method' | 'lookup') ?? 'method',
    previewInputs: (r.preview_inputs as Record<string, number[]>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export async function listFormulas(projectId: string): Promise<Formula[]> {
  const { data, error } = await supabase
    .from('formulas').select('*').eq('project_id', projectId).order('created_at')
  if (error) throw error
  return (data ?? []).map(toFormula)
}

export async function createFormula(
  projectId: string,
  formula: Omit<Formula, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
): Promise<Formula> {
  const { data, error } = await supabase
    .from('formulas')
    .insert({
      project_id: projectId,
      name: formula.name,
      description: formula.description,
      expression: formula.expression,
      variables: formula.variables as unknown as Record<string, unknown>[],
      output_mode: formula.outputMode,
      preview_inputs: formula.previewInputs as unknown as Record<string, unknown>,
    })
    .select().single()
  if (error) throw error
  return toFormula(data)
}

export async function updateFormula(
  id: string,
  updates: Partial<Omit<Formula, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>,
): Promise<Formula> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.expression !== undefined) dbUpdates.expression = updates.expression
  if (updates.variables !== undefined) dbUpdates.variables = updates.variables
  if (updates.outputMode !== undefined) dbUpdates.output_mode = updates.outputMode
  if (updates.previewInputs !== undefined) dbUpdates.preview_inputs = updates.previewInputs

  const { data, error } = await supabase
    .from('formulas').update(dbUpdates).eq('id', id).select().single()
  if (error) throw error
  return toFormula(data)
}

export async function deleteFormula(id: string): Promise<void> {
  const { error } = await supabase.from('formulas').delete().eq('id', id)
  if (error) throw error
}
