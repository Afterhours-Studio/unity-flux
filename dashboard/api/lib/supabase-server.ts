/**
 * Server-side Supabase data layer for Vercel serverless functions.
 * Uses service role key (bypass RLS) — for MCP admin tools only.
 */
import { createClient } from '@supabase/supabase-js'
import { isR2Configured, uploadConfigVersion, updateMasterVersion } from './r2.js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ─── Types ────────────────────────────────────────────

type Environment = 'development' | 'staging' | 'production'

interface Project {
  id: string; name: string; slug: string; description: string
  createdAt: string; updatedAt: string; apiKey: string; anonKey: string
  supabaseUrl: string; r2BucketUrl: string; environment: Environment
  dataSource: 'cloud' | 'local' | 'both'
}

interface SchemaField {
  name: string; type: string; required: boolean
  default?: string | number | boolean; min?: number; max?: number
  values?: string[]; configRef?: string
}

interface Schema {
  id: string; projectId: string; name: string
  mode: 'data' | 'config'; fields: SchemaField[]
  createdAt: string; updatedAt: string
}

interface DataEntry {
  id: string; schemaId: string; data: Record<string, unknown>
  environment: Environment; isActive: boolean
  createdAt: string; updatedAt: string
}

interface Version {
  id: string; projectId: string; versionTag: string
  environment: Environment; status: 'active' | 'superseded' | 'rolled_back'
  data: Record<string, Record<string, unknown>[]>
  tableCount: number; rowCount: number; r2Url: string | null; publishedAt: string
}

interface VersionTableDiff {
  tableName: string; status: 'added' | 'removed' | 'modified' | 'unchanged'
  addedRows: Record<string, unknown>[]; removedRows: Record<string, unknown>[]
  modifiedRows: { before: Record<string, unknown>; after: Record<string, unknown>; changedFields: string[] }[]
  unchangedRowCount: number
}

interface VersionDiff {
  v1Id: string; v2Id: string; tableDiffs: VersionTableDiff[]
  summary: { tablesAdded: number; tablesRemoved: number; tablesModified: number; totalRowsAdded: number; totalRowsRemoved: number; totalRowsModified: number }
}

interface ActivityLog {
  id: string; projectId: string; type: string; message: string
  meta?: Record<string, unknown>; createdAt: string
}

type LiveOpsEventType = 'daily_login' | 'flash_sale' | 'limited_shop' | 'tournament' | 'season_pass' | 'maintenance' | 'world_boss' | 'custom'
type LiveOpsStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'

interface LiveOpsEvent {
  id: string; projectId: string; name: string; description: string
  type: LiveOpsEventType; status: LiveOpsStatus
  startAt: string; endAt: string; color: string
  config: Record<string, unknown>; recurring: string | null
  createdAt: string; updatedAt: string
}

interface BattlePassTier {
  id: string; eventId: string; tier: number; xpRequired: number
  freeReward: string; premiumReward: string
}

interface FormulaVariable { name: string; type: 'int' | 'float'; defaultValue: number; description: string }

interface Formula {
  id: string; projectId: string; name: string; description: string
  expression: string; variables: FormulaVariable[]
  outputMode: 'method' | 'lookup'; previewInputs: Record<string, number[]>
  createdAt: string; updatedAt: string
}

// ─── ID Helpers ────────────────────────────────────────

function generateId(): string { return crypto.randomUUID() }

function generateProjectId(slug: string): string {
  const suffix = Math.random().toString(36).substring(2, 7)
  return `${slug}-${suffix}`
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let r = 'flux_'; for (let i = 0; i < 32; i++) r += chars.charAt(Math.floor(Math.random() * chars.length)); return r
}

function generateAnonKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let r = 'anon_'; for (let i = 0; i < 40; i++) r += chars.charAt(Math.floor(Math.random() * chars.length)); return r
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

// ─── Row Mappers ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProject(r: any): Project {
  return { id: r.id, name: r.name, slug: r.slug, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at, apiKey: r.api_key, anonKey: r.anon_key, supabaseUrl: r.supabase_url, r2BucketUrl: r.r2_bucket_url, environment: r.environment, dataSource: r.data_source ?? 'cloud' }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSchema(r: any): Schema {
  return { id: r.id, projectId: r.project_id, name: r.name, mode: r.mode, fields: r.fields, createdAt: r.created_at, updatedAt: r.updated_at }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(r: any): DataEntry {
  return { id: r.id, schemaId: r.schema_id, data: r.data, environment: r.environment, isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVersion(r: any): Version {
  return { id: r.id, projectId: r.project_id, versionTag: r.version_tag, environment: r.environment, status: r.status, data: r.data, tableCount: r.table_count, rowCount: r.row_count, r2Url: r.r2_url ?? null, publishedAt: r.published_at }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toActivity(r: any): ActivityLog {
  return { id: r.id, projectId: r.project_id, type: r.type, message: r.message, meta: r.meta ?? undefined, createdAt: r.created_at }
}

async function insertActivity(projectId: string, type: string, message: string) {
  await supabase.from('activities').insert({ id: generateId(), project_id: projectId, type, message })
}

// ─── Admin user lookup ────────────────────────────────
// MCP runs as admin — get first admin user for project ownership
async function getAdminUserId(): Promise<string> {
  const { data } = await supabase.from('user_profiles').select('id').eq('role', 'admin').limit(1).single()
  if (data) return data.id
  // Fallback: get any user profile
  const { data: anyUser } = await supabase.from('user_profiles').select('id').limit(1).single()
  if (anyUser) return anyUser.id
  throw new Error('No admin user found')
}

// ─── Projects ─────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (error) throw error; return (data ?? []).map(toProject)
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) throw error; return data ? toProject(data) : null
}

export async function createProject(name: string, description: string): Promise<Project> {
  const userId = await getAdminUserId()
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = generateProjectId(slug)
  const { data, error } = await supabase.from('projects').insert({
    id, name, slug, description, api_key: generateApiKey(), anon_key: generateAnonKey(), user_id: userId,
  }).select().single()
  if (error) throw error; return toProject(data)
}

export async function updateProject(id: string, updates: Record<string, unknown>): Promise<Project> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.description !== undefined) row.description = updates.description
  if (updates.supabaseUrl !== undefined) row.supabase_url = updates.supabaseUrl
  if (updates.r2BucketUrl !== undefined) row.r2_bucket_url = updates.r2BucketUrl
  if (updates.environment !== undefined) row.environment = updates.environment
  if (Object.keys(row).length === 0) { const p = await getProject(id); if (!p) throw new Error(`Project not found: ${id}`); return p }
  const { data, error } = await supabase.from('projects').update(row).eq('id', id).select().single()
  if (error) throw error; return toProject(data)
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

// ─── Schemas ──────────────────────────────────────────

export async function listSchemas(projectId: string): Promise<Schema[]> {
  const { data, error } = await supabase.from('schemas').select('*').eq('project_id', projectId).order('created_at')
  if (error) throw error; return (data ?? []).map(toSchema)
}

export async function getSchema(id: string): Promise<Schema | null> {
  const { data, error } = await supabase.from('schemas').select('*').eq('id', id).maybeSingle()
  if (error) throw error; return data ? toSchema(data) : null
}

export async function createSchema(projectId: string, name: string, fields: SchemaField[], mode: 'data' | 'config' = 'data'): Promise<Schema> {
  const defaultConfigFields: SchemaField[] = [
    { name: 'parameter', type: 'string', required: true },
    { name: 'description', type: 'string', required: false },
    { name: 'type', type: 'config', required: true, configRef: 'value' },
    { name: 'value', type: 'string', required: false },
  ]
  const actualFields = fields.length > 0 ? fields : (mode === 'config' ? defaultConfigFields : fields)
  const id = generateId()
  const { data, error } = await supabase.from('schemas').insert({
    id, project_id: projectId, name, mode, fields: actualFields as unknown as Record<string, unknown>,
  }).select().single()
  if (error) throw error
  await insertActivity(projectId, 'table_create', `Created table "${name}"`)
  return toSchema(data)
}

export async function renameSchema(id: string, name: string): Promise<Schema> {
  const { data, error } = await supabase.from('schemas').update({ name }).eq('id', id).select().single()
  if (error) throw error; return toSchema(data)
}

export async function updateSchema(id: string, updates: { name?: string; fields?: SchemaField[] }): Promise<Schema> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.fields !== undefined) row.fields = updates.fields as unknown as Record<string, unknown>
  if (Object.keys(row).length === 0) { const s = await getSchema(id); if (!s) throw new Error(`Schema not found: ${id}`); return s }
  const { data, error } = await supabase.from('schemas').update(row).eq('id', id).select().single()
  if (error) throw error
  const schema = toSchema(data)
  await insertActivity(schema.projectId, 'table_update', `Updated table "${schema.name}"`)
  return schema
}

export async function deleteSchema(id: string): Promise<void> {
  const schema = await getSchema(id)
  const { error } = await supabase.from('schemas').delete().eq('id', id)
  if (error) throw error
  if (schema) await insertActivity(schema.projectId, 'table_delete', `Deleted table "${schema.name}"`)
}

export async function addColumn(schemaId: string, field: SchemaField): Promise<Schema> {
  const schema = await getSchema(schemaId); if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  return updateSchema(schemaId, { fields: [...schema.fields, field] })
}

export async function addColumns(schemaId: string, fields: SchemaField[]): Promise<Schema> {
  const schema = await getSchema(schemaId); if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  return updateSchema(schemaId, { fields: [...schema.fields, ...fields] })
}

export async function updateColumn(schemaId: string, columnName: string, updates: Partial<SchemaField>): Promise<Schema> {
  const schema = await getSchema(schemaId); if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  if (!schema.fields.some(f => f.name === columnName)) throw new Error(`Column not found: ${columnName}`)
  return updateSchema(schemaId, { fields: schema.fields.map(f => f.name === columnName ? { ...f, ...updates } : f) })
}

export async function removeColumn(schemaId: string, columnName: string): Promise<Schema> {
  const schema = await getSchema(schemaId); if (!schema) throw new Error(`Schema not found: ${schemaId}`)
  return updateSchema(schemaId, { fields: schema.fields.filter(f => f.name !== columnName) })
}

// ─── Entries ──────────────────────────────────────────

export async function listEntries(schemaId: string): Promise<DataEntry[]> {
  const { data, error } = await supabase.from('entries').select('*').eq('schema_id', schemaId).order('created_at')
  if (error) throw error; return (data ?? []).map(toEntry)
}

export async function getEntry(id: string): Promise<DataEntry | null> {
  const { data, error } = await supabase.from('entries').select('*').eq('id', id).maybeSingle()
  if (error) throw error; return data ? toEntry(data) : null
}

export async function createEntry(schemaId: string, entryData: Record<string, unknown>, environment: Environment = 'development'): Promise<DataEntry> {
  const id = generateId()
  const { data, error } = await supabase.from('entries').insert({
    id, schema_id: schemaId, data: entryData as unknown as Record<string, unknown>, environment,
  }).select().single()
  if (error) throw error
  const schema = await getSchema(schemaId)
  if (schema) await insertActivity(schema.projectId, 'row_add', `Added row to "${schema.name}"`)
  return toEntry(data)
}

export async function createEntries(schemaId: string, rows: Record<string, unknown>[], environment: Environment = 'development'): Promise<DataEntry[]> {
  if (rows.length === 0) return []
  const inserts = rows.map(r => ({ id: generateId(), schema_id: schemaId, data: r as unknown as Record<string, unknown>, environment }))
  const { data, error } = await supabase.from('entries').insert(inserts).select()
  if (error) throw error
  const schema = await getSchema(schemaId)
  if (schema) await insertActivity(schema.projectId, 'row_add', `Added ${rows.length} rows to "${schema.name}"`)
  return (data ?? []).map(toEntry)
}

export async function updateEntry(id: string, entryData: Record<string, unknown>): Promise<DataEntry> {
  const { data, error } = await supabase.from('entries').update({ data: entryData as unknown as Record<string, unknown> }).eq('id', id).select().single()
  if (error) throw error; return toEntry(data)
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
  if (entry) { const schema = await getSchema(entry.schemaId); if (schema) await insertActivity(schema.projectId, 'row_delete', `Deleted row from "${schema.name}"`) }
}

// ─── Versions ─────────────────────────────────────────

export async function listVersions(projectId: string): Promise<Version[]> {
  const { data, error } = await supabase.from('versions').select('*').eq('project_id', projectId).order('published_at', { ascending: false })
  if (error) throw error; return (data ?? []).map(toVersion)
}

export async function publishVersion(projectId: string, environment: Environment): Promise<Version> {
  const schemas = await listSchemas(projectId)
  const snapshot: Record<string, Record<string, unknown>[]> = {}
  let rowCount = 0
  for (const schema of schemas) { const entries = await listEntries(schema.id); snapshot[schema.name] = entries.map(e => e.data); rowCount += entries.length }
  const versions = await listVersions(projectId)
  const versionTag = nextVersionTag(versions, projectId, environment)
  await supabase.from('versions').update({ status: 'superseded' }).eq('project_id', projectId).eq('environment', environment).eq('status', 'active')
  const id = generateId()
  const { data, error } = await supabase.from('versions').insert({
    id, project_id: projectId, version_tag: versionTag, environment, status: 'active',
    data: snapshot as unknown as Record<string, unknown>, table_count: schemas.length, row_count: rowCount,
  }).select().single()
  if (error) throw error
  await insertActivity(projectId, 'publish', `Published ${versionTag} to ${environment}`)

  // R2 CDN upload (non-fatal)
  if (isR2Configured()) {
    try {
      const project = await getProject(projectId)
      if (project) {
        const { r2Url } = await uploadConfigVersion({
          slug: project.slug, name: project.name, environment, versionTag,
          snapshot, tableCount: schemas.length, rowCount,
        })
        await supabase.from('versions').update({ r2_url: r2Url }).eq('id', id)
        if (!project.r2BucketUrl) {
          await supabase.from('projects').update({ r2_bucket_url: process.env.R2_PUBLIC_URL || 'https://cdn.h1dr0n.org' }).eq('id', projectId)
        }
        data.r2_url = r2Url
      }
    } catch (r2Err) {
      console.error('R2 upload failed (non-fatal):', r2Err)
    }
  }

  return toVersion(data)
}

export async function promoteVersion(versionId: string, targetEnv: Environment): Promise<Version> {
  const { data: source, error: fetchErr } = await supabase.from('versions').select('*').eq('id', versionId).single()
  if (fetchErr || !source) throw new Error(`Version not found: ${versionId}`)
  const sv = toVersion(source)
  const versions = await listVersions(sv.projectId)
  const versionTag = nextVersionTag(versions, sv.projectId, targetEnv)
  await supabase.from('versions').update({ status: 'superseded' }).eq('project_id', sv.projectId).eq('environment', targetEnv).eq('status', 'active')
  const id = generateId()
  const { data, error } = await supabase.from('versions').insert({
    id, project_id: sv.projectId, version_tag: versionTag, environment: targetEnv, status: 'active',
    data: sv.data as unknown as Record<string, unknown>, table_count: sv.tableCount, row_count: sv.rowCount,
  }).select().single()
  if (error) throw error
  await insertActivity(sv.projectId, 'promote', `Promoted ${sv.versionTag} → ${targetEnv} as ${versionTag}`)

  // R2 CDN upload (non-fatal)
  if (isR2Configured()) {
    try {
      const project = await getProject(sv.projectId)
      if (project) {
        const { r2Url } = await uploadConfigVersion({
          slug: project.slug, name: project.name, environment: targetEnv, versionTag,
          snapshot: sv.data, tableCount: sv.tableCount, rowCount: sv.rowCount,
        })
        await supabase.from('versions').update({ r2_url: r2Url }).eq('id', id)
        data.r2_url = r2Url
      }
    } catch (r2Err) {
      console.error('R2 promote upload failed (non-fatal):', r2Err)
    }
  }

  return toVersion(data)
}

export async function rollbackVersion(versionId: string): Promise<void> {
  const { data: target } = await supabase.from('versions').select('*').eq('id', versionId).single()
  if (!target) return; const v = toVersion(target)
  await supabase.from('versions').update({ status: 'rolled_back' }).eq('project_id', v.projectId).eq('environment', v.environment).eq('status', 'active')
  await supabase.from('versions').update({ status: 'active' }).eq('id', versionId)
  await insertActivity(v.projectId, 'rollback', `Rolled back to ${v.versionTag} in ${v.environment}`)

  // R2 CDN pointer update (non-fatal)
  if (isR2Configured()) {
    try {
      const project = await getProject(v.projectId)
      if (project) {
        await updateMasterVersion({
          slug: project.slug, name: project.name, environment: v.environment,
          versionTag: v.versionTag, tableCount: v.tableCount, rowCount: v.rowCount,
        })
      }
    } catch (r2Err) {
      console.error('R2 rollback pointer update failed (non-fatal):', r2Err)
    }
  }
}

export async function deleteVersion(versionId: string): Promise<void> {
  const { error } = await supabase.from('versions').delete().eq('id', versionId)
  if (error) throw error
}

export async function compareVersions(v1Id: string, v2Id: string): Promise<VersionDiff> {
  const { data: r1 } = await supabase.from('versions').select('*').eq('id', v1Id).single()
  const { data: r2 } = await supabase.from('versions').select('*').eq('id', v2Id).single()
  if (!r1 || !r2) throw new Error('Version not found')
  const v1 = toVersion(r1), v2 = toVersion(r2)
  const allTables = new Set([...Object.keys(v1.data), ...Object.keys(v2.data)])
  const tableDiffs: VersionTableDiff[] = []
  const summary = { tablesAdded: 0, tablesRemoved: 0, tablesModified: 0, totalRowsAdded: 0, totalRowsRemoved: 0, totalRowsModified: 0 }
  for (const table of allTables) {
    const rows1 = v1.data[table] ?? [], rows2 = v2.data[table] ?? []
    if (!v1.data[table]) { summary.tablesAdded++; summary.totalRowsAdded += rows2.length; tableDiffs.push({ tableName: table, status: 'added', addedRows: rows2, removedRows: [], modifiedRows: [], unchangedRowCount: 0 }); continue }
    if (!v2.data[table]) { summary.tablesRemoved++; summary.totalRowsRemoved += rows1.length; tableDiffs.push({ tableName: table, status: 'removed', addedRows: [], removedRows: rows1, modifiedRows: [], unchangedRowCount: 0 }); continue }
    const keyCols = ['id', 'key', 'parameter', 'name']
    const allCols = rows1.length > 0 ? Object.keys(rows1[0]) : []
    const keyCol = keyCols.find(k => allCols.includes(k))
    const addedRows: Record<string, unknown>[] = [], removedRows: Record<string, unknown>[] = []
    const modifiedRows: VersionTableDiff['modifiedRows'] = []; let unchangedRowCount = 0
    if (keyCol) {
      const map1 = new Map(rows1.map(r => [String(r[keyCol]), r])), map2 = new Map(rows2.map(r => [String(r[keyCol]), r]))
      for (const [key, row] of map2) { const old = map1.get(key); if (!old) { addedRows.push(row); continue }; const cf = Object.keys(row).filter(f => JSON.stringify(row[f]) !== JSON.stringify(old[f])); if (cf.length > 0) modifiedRows.push({ before: old, after: row, changedFields: cf }); else unchangedRowCount++ }
      for (const [key] of map1) { if (!map2.has(key)) removedRows.push(map1.get(key)!) }
    } else {
      const maxLen = Math.max(rows1.length, rows2.length)
      for (let i = 0; i < maxLen; i++) { if (i >= rows1.length) { addedRows.push(rows2[i]); continue }; if (i >= rows2.length) { removedRows.push(rows1[i]); continue }; const cf = Object.keys(rows2[i]).filter(f => JSON.stringify(rows2[i][f]) !== JSON.stringify(rows1[i][f])); if (cf.length > 0) modifiedRows.push({ before: rows1[i], after: rows2[i], changedFields: cf }); else unchangedRowCount++ }
    }
    const hasChanges = addedRows.length > 0 || removedRows.length > 0 || modifiedRows.length > 0
    if (hasChanges) summary.tablesModified++; summary.totalRowsAdded += addedRows.length; summary.totalRowsRemoved += removedRows.length; summary.totalRowsModified += modifiedRows.length
    tableDiffs.push({ tableName: table, status: hasChanges ? 'modified' : 'unchanged', addedRows, removedRows, modifiedRows, unchangedRowCount })
  }
  return { v1Id, v2Id, tableDiffs, summary }
}

// ─── Activity ─────────────────────────────────────────

export async function listActivity(projectId: string, limit?: number): Promise<ActivityLog[]> {
  let query = supabase.from('activities').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error; return (data ?? []).map(toActivity)
}

// ─── Live Ops Events ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLiveOpsEvent(r: any): LiveOpsEvent {
  return {
    id: r.id, projectId: r.project_id, name: r.name, description: r.description ?? '',
    type: r.type, status: r.status,
    startAt: r.start_at, endAt: r.end_at,
    color: r.color ?? '', config: r.config ?? {},
    recurring: r.recurring ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBattlePassTier(r: any): BattlePassTier {
  return { id: r.id, eventId: r.event_id, tier: r.tier, xpRequired: r.xp_required, freeReward: r.free_reward ?? '', premiumReward: r.premium_reward ?? '' }
}

export async function listLiveOpsEvents(projectId: string): Promise<LiveOpsEvent[]> {
  const { data, error } = await supabase.from('live_ops_events').select('*').eq('project_id', projectId).order('start_at')
  if (error) throw error; return (data ?? []).map(toLiveOpsEvent)
}

export async function getLiveOpsEvent(id: string): Promise<LiveOpsEvent | null> {
  const { data, error } = await supabase.from('live_ops_events').select('*').eq('id', id).single()
  if (error) return null; return toLiveOpsEvent(data)
}

export async function createLiveOpsEvent(projectId: string, event: Omit<LiveOpsEvent, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>): Promise<LiveOpsEvent> {
  const id = generateId()
  const { data, error } = await supabase.from('live_ops_events')
    .insert({ id, project_id: projectId, name: event.name, description: event.description, type: event.type, status: event.status, start_at: event.startAt, end_at: event.endAt, color: event.color, config: event.config, recurring: event.recurring })
    .select().single()
  if (error) throw error
  await insertActivity(projectId, 'event_create', `Created event "${event.name}"`)
  return toLiveOpsEvent(data)
}

export async function updateLiveOpsEvent(id: string, updates: Partial<Pick<LiveOpsEvent, 'name' | 'description' | 'status' | 'startAt' | 'endAt' | 'color' | 'config' | 'recurring'>>): Promise<LiveOpsEvent> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.startAt !== undefined) dbUpdates.start_at = updates.startAt
  if (updates.endAt !== undefined) dbUpdates.end_at = updates.endAt
  if (updates.color !== undefined) dbUpdates.color = updates.color
  if (updates.config !== undefined) dbUpdates.config = updates.config
  if (updates.recurring !== undefined) dbUpdates.recurring = updates.recurring
  const { data, error } = await supabase.from('live_ops_events').update(dbUpdates).eq('id', id).select().single()
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

// ─── Battle Pass Tiers ───────────────────────────────

export async function listBattlePassTiers(eventId: string): Promise<BattlePassTier[]> {
  const { data, error } = await supabase.from('battle_pass_tiers').select('*').eq('event_id', eventId).order('tier')
  if (error) throw error; return (data ?? []).map(toBattlePassTier)
}

export async function createBattlePassTier(eventId: string, tier: Omit<BattlePassTier, 'id' | 'eventId'>): Promise<BattlePassTier> {
  const id = generateId()
  const { data, error } = await supabase.from('battle_pass_tiers')
    .insert({ id, event_id: eventId, tier: tier.tier, xp_required: tier.xpRequired, free_reward: tier.freeReward, premium_reward: tier.premiumReward })
    .select().single()
  if (error) throw error; return toBattlePassTier(data)
}

export async function updateBattlePassTier(id: string, updates: Partial<Pick<BattlePassTier, 'tier' | 'xpRequired' | 'freeReward' | 'premiumReward'>>): Promise<BattlePassTier> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.tier !== undefined) dbUpdates.tier = updates.tier
  if (updates.xpRequired !== undefined) dbUpdates.xp_required = updates.xpRequired
  if (updates.freeReward !== undefined) dbUpdates.free_reward = updates.freeReward
  if (updates.premiumReward !== undefined) dbUpdates.premium_reward = updates.premiumReward
  const { data, error } = await supabase.from('battle_pass_tiers').update(dbUpdates).eq('id', id).select().single()
  if (error) throw error; return toBattlePassTier(data)
}

export async function deleteBattlePassTier(id: string): Promise<void> {
  const { error } = await supabase.from('battle_pass_tiers').delete().eq('id', id)
  if (error) throw error
}

// ─── Formulas ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFormula(r: any): Formula {
  return {
    id: r.id, projectId: r.project_id, name: r.name,
    description: r.description ?? '', expression: r.expression,
    variables: r.variables ?? [], outputMode: r.output_mode ?? 'method',
    previewInputs: r.preview_inputs ?? {},
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export async function listFormulas(projectId: string): Promise<Formula[]> {
  const { data, error } = await supabase.from('formulas').select('*').eq('project_id', projectId).order('created_at')
  if (error) throw error; return (data ?? []).map(toFormula)
}

export async function createFormula(projectId: string, formula: Omit<Formula, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>): Promise<Formula> {
  const id = generateId()
  const { data, error } = await supabase.from('formulas')
    .insert({ id, project_id: projectId, name: formula.name, description: formula.description, expression: formula.expression, variables: formula.variables as unknown as Record<string, unknown>[], output_mode: formula.outputMode, preview_inputs: formula.previewInputs as unknown as Record<string, unknown> })
    .select().single()
  if (error) throw error; return toFormula(data)
}

export async function updateFormula(id: string, updates: Partial<Omit<Formula, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>): Promise<Formula> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.expression !== undefined) dbUpdates.expression = updates.expression
  if (updates.variables !== undefined) dbUpdates.variables = updates.variables
  if (updates.outputMode !== undefined) dbUpdates.output_mode = updates.outputMode
  if (updates.previewInputs !== undefined) dbUpdates.preview_inputs = updates.previewInputs
  const { data, error } = await supabase.from('formulas').update(dbUpdates).eq('id', id).select().single()
  if (error) throw error; return toFormula(data)
}

export async function deleteFormula(id: string): Promise<void> {
  const { error } = await supabase.from('formulas').delete().eq('id', id)
  if (error) throw error
}
