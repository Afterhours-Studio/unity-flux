import pg from 'pg'
import { createHash } from 'node:crypto'
import type { DataStore } from './data-store.js'
import type { Project, Schema, SchemaField, DataEntry, Version, VersionDiff, VersionTableDiff, ActivityLog, Environment, WebhookRegistration } from './types.js'
import { generateId, generateProjectId, generateApiKey, generateAnonKey } from '../util/id.js'
import { nextVersionTag } from '../util/version-tag.js'

const { Pool } = pg

function computeTableHashes(data: Record<string, Record<string, unknown>[]>): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const [tableName, rows] of Object.entries(data)) {
    const json = JSON.stringify(rows)
    hashes[tableName] = createHash('sha256').update(json).digest('hex')
  }
  return hashes
}

export class PostgresStore implements DataStore {
  private pool: pg.Pool

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString ?? 'postgresql://flux:flux_local_dev@localhost:5432/unity_flux',
    })
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  // ─── Helpers ──────────────────────────────────────────

  private async query<T extends pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, params)
  }

  private async one<T extends pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T | null> {
    const { rows } = await this.query<T>(text, params)
    return rows[0] ?? null
  }

  private async insertActivity(projectId: string, type: ActivityLog['type'], message: string): Promise<void> {
    await this.query(
      'INSERT INTO activities (id, project_id, type, message) VALUES ($1, $2, $3, $4)',
      [generateId(), projectId, type, message],
    )
  }

  // Map DB row → Project
  private toProject(r: Record<string, unknown>): Project {
    return {
      id: r.id as string, name: r.name as string, slug: r.slug as string,
      description: r.description as string, createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(), apiKey: r.api_key as string,
      anonKey: r.anon_key as string, supabaseUrl: r.supabase_url as string,
      r2BucketUrl: r.r2_bucket_url as string, environment: r.environment as Environment,
    }
  }

  private toSchema(r: Record<string, unknown>): Schema {
    return {
      id: r.id as string, projectId: r.project_id as string, name: r.name as string,
      mode: r.mode as Schema['mode'], fields: r.fields as SchemaField[],
      createdAt: (r.created_at as Date).toISOString(), updatedAt: (r.updated_at as Date).toISOString(),
    }
  }

  private toEntry(r: Record<string, unknown>): DataEntry {
    return {
      id: r.id as string, schemaId: r.schema_id as string,
      data: r.data as Record<string, unknown>, environment: r.environment as Environment,
      isActive: r.is_active as boolean,
      createdAt: (r.created_at as Date).toISOString(), updatedAt: (r.updated_at as Date).toISOString(),
    }
  }

  private toVersion(r: Record<string, unknown>): Version {
    return {
      id: r.id as string, projectId: r.project_id as string, versionTag: r.version_tag as string,
      environment: r.environment as Environment, status: r.status as Version['status'],
      data: r.data as Record<string, Record<string, unknown>[]>,
      tableHashes: (r.table_hashes as Record<string, string>) ?? {},
      tableCount: r.table_count as number, rowCount: r.row_count as number,
      publishedAt: (r.published_at as Date).toISOString(),
    }
  }

  private toActivity(r: Record<string, unknown>): ActivityLog {
    return {
      id: r.id as string, projectId: r.project_id as string,
      type: r.type as ActivityLog['type'], message: r.message as string,
      meta: r.meta as Record<string, unknown> | undefined,
      createdAt: (r.created_at as Date).toISOString(),
    }
  }

  // ─── Projects ─────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    const { rows } = await this.query('SELECT * FROM projects ORDER BY created_at DESC')
    return rows.map(r => this.toProject(r))
  }

  async getProject(id: string): Promise<Project | null> {
    const r = await this.one('SELECT * FROM projects WHERE id = $1', [id])
    return r ? this.toProject(r) : null
  }

  async createProject(name: string, description: string): Promise<Project> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = generateProjectId(slug)
    const { rows } = await this.query(
      `INSERT INTO projects (id, name, slug, description, api_key, anon_key)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, name, slug, description, generateApiKey(), generateAnonKey()],
    )
    return this.toProject(rows[0])
  }

  async updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>>): Promise<Project> {
    const sets: string[] = []
    const vals: unknown[] = []
    let n = 1
    if (updates.name !== undefined) { sets.push(`name = $${n++}`); vals.push(updates.name) }
    if (updates.description !== undefined) { sets.push(`description = $${n++}`); vals.push(updates.description) }
    if (updates.supabaseUrl !== undefined) { sets.push(`supabase_url = $${n++}`); vals.push(updates.supabaseUrl) }
    if (updates.r2BucketUrl !== undefined) { sets.push(`r2_bucket_url = $${n++}`); vals.push(updates.r2BucketUrl) }
    if (updates.environment !== undefined) { sets.push(`environment = $${n++}`); vals.push(updates.environment) }
    if (sets.length === 0) {
      const p = await this.getProject(id)
      if (!p) throw new Error(`Project not found: ${id}`)
      return p
    }
    vals.push(id)
    const { rows } = await this.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${n} RETURNING *`, vals,
    )
    if (rows.length === 0) throw new Error(`Project not found: ${id}`)
    return this.toProject(rows[0])
  }

  async deleteProject(id: string): Promise<void> {
    await this.query('DELETE FROM projects WHERE id = $1', [id])
  }

  async regenerateApiKey(id: string): Promise<Project> {
    const { rows } = await this.query(
      'UPDATE projects SET api_key = $1 WHERE id = $2 RETURNING *',
      [generateApiKey(), id],
    )
    if (rows.length === 0) throw new Error(`Project not found: ${id}`)
    return this.toProject(rows[0])
  }

  // ─── Schemas ──────────────────────────────────────────

  async listSchemas(projectId: string): Promise<Schema[]> {
    const { rows } = await this.query('SELECT * FROM schemas WHERE project_id = $1 ORDER BY created_at', [projectId])
    return rows.map(r => this.toSchema(r))
  }

  async getSchema(id: string): Promise<Schema | null> {
    const r = await this.one('SELECT * FROM schemas WHERE id = $1', [id])
    return r ? this.toSchema(r) : null
  }

  async createSchema(projectId: string, name: string, fields: SchemaField[], mode: Schema['mode'] = 'data'): Promise<Schema> {
    const defaultConfigFields: SchemaField[] = [
      { name: 'parameter', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'type', type: 'config', required: true, configRef: 'value' },
      { name: 'value', type: 'string', required: false },
    ]
    const actualFields = fields.length > 0 ? fields : (mode === 'config' ? defaultConfigFields : fields)
    const id = generateId()
    const { rows } = await this.query(
      `INSERT INTO schemas (id, project_id, name, mode, fields)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, projectId, name, mode, JSON.stringify(actualFields)],
    )
    await this.insertActivity(projectId, 'table_create', `Created table "${name}"`)
    return this.toSchema(rows[0])
  }

  async renameSchema(id: string, name: string): Promise<Schema> {
    const { rows } = await this.query(
      'UPDATE schemas SET name = $1 WHERE id = $2 RETURNING *', [name, id],
    )
    if (rows.length === 0) throw new Error(`Schema not found: ${id}`)
    return this.toSchema(rows[0])
  }

  async updateSchema(id: string, updates: Partial<Pick<Schema, 'name' | 'fields'>>): Promise<Schema> {
    const sets: string[] = []
    const vals: unknown[] = []
    let n = 1
    if (updates.name !== undefined) { sets.push(`name = $${n++}`); vals.push(updates.name) }
    if (updates.fields !== undefined) { sets.push(`fields = $${n++}`); vals.push(JSON.stringify(updates.fields)) }
    if (sets.length === 0) {
      const s = await this.getSchema(id)
      if (!s) throw new Error(`Schema not found: ${id}`)
      return s
    }
    vals.push(id)
    const { rows } = await this.query(
      `UPDATE schemas SET ${sets.join(', ')} WHERE id = $${n} RETURNING *`, vals,
    )
    if (rows.length === 0) throw new Error(`Schema not found: ${id}`)
    const schema = this.toSchema(rows[0])
    await this.insertActivity(schema.projectId, 'table_update', `Updated table "${schema.name}"`)
    return schema
  }

  async deleteSchema(id: string): Promise<void> {
    const schema = await this.getSchema(id)
    await this.query('DELETE FROM schemas WHERE id = $1', [id])
    if (schema) {
      await this.insertActivity(schema.projectId, 'table_delete', `Deleted table "${schema.name}"`)
    }
  }

  // ─── Columns ──────────────────────────────────────────

  async addColumn(schemaId: string, field: SchemaField): Promise<Schema> {
    const schema = await this.getSchema(schemaId)
    if (!schema) throw new Error(`Schema not found: ${schemaId}`)
    const fields = [...schema.fields, field]
    return this.updateSchema(schemaId, { fields })
  }

  async updateColumn(schemaId: string, columnName: string, updates: Partial<SchemaField>): Promise<Schema> {
    const schema = await this.getSchema(schemaId)
    if (!schema) throw new Error(`Schema not found: ${schemaId}`)
    const fields = schema.fields.map(f => f.name === columnName ? { ...f, ...updates } : f)
    if (!schema.fields.some(f => f.name === columnName)) throw new Error(`Column not found: ${columnName}`)
    return this.updateSchema(schemaId, { fields })
  }

  async removeColumn(schemaId: string, columnName: string): Promise<Schema> {
    const schema = await this.getSchema(schemaId)
    if (!schema) throw new Error(`Schema not found: ${schemaId}`)
    return this.updateSchema(schemaId, { fields: schema.fields.filter(f => f.name !== columnName) })
  }

  // ─── Entries ──────────────────────────────────────────

  async listEntries(schemaId: string): Promise<DataEntry[]> {
    const { rows } = await this.query('SELECT * FROM entries WHERE schema_id = $1 ORDER BY created_at', [schemaId])
    return rows.map(r => this.toEntry(r))
  }

  async getEntry(id: string): Promise<DataEntry | null> {
    const r = await this.one('SELECT * FROM entries WHERE id = $1', [id])
    return r ? this.toEntry(r) : null
  }

  async createEntry(schemaId: string, data: Record<string, unknown>, environment: Environment = 'development'): Promise<DataEntry> {
    const id = generateId()
    const { rows } = await this.query(
      `INSERT INTO entries (id, schema_id, data, environment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, schemaId, JSON.stringify(data), environment],
    )
    // Log activity
    const schema = await this.getSchema(schemaId)
    if (schema) {
      await this.insertActivity(schema.projectId, 'row_add', `Added row to "${schema.name}"`)
    }
    return this.toEntry(rows[0])
  }

  async updateEntry(id: string, data: Record<string, unknown>): Promise<DataEntry> {
    const { rows } = await this.query(
      'UPDATE entries SET data = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(data), id],
    )
    if (rows.length === 0) throw new Error(`Entry not found: ${id}`)
    const entry = this.toEntry(rows[0])
    const schema = await this.getSchema(entry.schemaId)
    if (schema) {
      await this.insertActivity(schema.projectId, 'row_update', `Updated row in "${schema.name}"`)
    }
    return entry
  }

  async deleteEntry(id: string): Promise<void> {
    const entry = await this.getEntry(id)
    await this.query('DELETE FROM entries WHERE id = $1', [id])
    if (entry) {
      const schema = await this.getSchema(entry.schemaId)
      if (schema) {
        await this.insertActivity(schema.projectId, 'row_delete', `Deleted row from "${schema.name}"`)
      }
    }
  }

  async createEntries(schemaId: string, rows: Record<string, unknown>[], environment: Environment = 'development'): Promise<DataEntry[]> {
    const schema = await this.getSchema(schemaId)
    const entries: DataEntry[] = []
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      for (const row of rows) {
        const id = generateId()
        const { rows: inserted } = await client.query(
          `INSERT INTO entries (id, schema_id, data, environment)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [id, schemaId, JSON.stringify(row), environment],
        )
        entries.push(this.toEntry(inserted[0]))
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    if (schema) {
      await this.insertActivity(schema.projectId, 'row_add', `Added ${rows.length} rows to "${schema.name}"`)
    }
    return entries
  }

  async deleteEntries(ids: string[]): Promise<void> {
    await this.query('DELETE FROM entries WHERE id = ANY($1)', [ids])
  }

  // ─── Versions ─────────────────────────────────────────

  async listVersions(projectId: string): Promise<Version[]> {
    const { rows } = await this.query(
      'SELECT * FROM versions WHERE project_id = $1 ORDER BY published_at DESC', [projectId],
    )
    return rows.map(r => this.toVersion(r))
  }

  async publishVersion(projectId: string, environment: Environment): Promise<Version> {
    // Build snapshot
    const schemas = await this.listSchemas(projectId)
    const snapshot: Record<string, Record<string, unknown>[]> = {}
    let rowCount = 0
    for (const schema of schemas) {
      const entries = await this.listEntries(schema.id)
      snapshot[schema.name] = entries.map(e => e.data)
      rowCount += entries.length
    }

    // Compute table hashes for delta sync
    const tableHashes = computeTableHashes(snapshot)

    // Get version tag
    const versions = await this.listVersions(projectId)
    const rawVersions: Version[] = versions // already typed
    const versionTag = nextVersionTag(rawVersions, projectId, environment)

    // Supersede previous active
    await this.query(
      `UPDATE versions SET status = 'superseded'
       WHERE project_id = $1 AND environment = $2 AND status = 'active'`,
      [projectId, environment],
    )

    const id = generateId()
    const { rows } = await this.query(
      `INSERT INTO versions (id, project_id, version_tag, environment, status, data, table_hashes, table_count, row_count)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8) RETURNING *`,
      [id, projectId, versionTag, environment, JSON.stringify(snapshot), JSON.stringify(tableHashes), schemas.length, rowCount],
    )

    await this.insertActivity(projectId, 'publish', `Published ${versionTag} to ${environment}`)
    return this.toVersion(rows[0])
  }

  async promoteVersion(versionId: string, targetEnv: Environment): Promise<Version> {
    const source = await this.one('SELECT * FROM versions WHERE id = $1', [versionId])
    if (!source) throw new Error(`Version not found: ${versionId}`)
    const sourceVersion = this.toVersion(source)

    const versions = await this.listVersions(sourceVersion.projectId)
    const versionTag = nextVersionTag(versions, sourceVersion.projectId, targetEnv)

    // Supersede previous active
    await this.query(
      `UPDATE versions SET status = 'superseded'
       WHERE project_id = $1 AND environment = $2 AND status = 'active'`,
      [sourceVersion.projectId, targetEnv],
    )

    const id = generateId()
    const promotedData = JSON.parse(JSON.stringify(sourceVersion.data))
    const tableHashes = computeTableHashes(promotedData)
    const { rows } = await this.query(
      `INSERT INTO versions (id, project_id, version_tag, environment, status, data, table_hashes, table_count, row_count)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8) RETURNING *`,
      [id, sourceVersion.projectId, versionTag, targetEnv, JSON.stringify(promotedData), JSON.stringify(tableHashes), sourceVersion.tableCount, sourceVersion.rowCount],
    )

    await this.insertActivity(sourceVersion.projectId, 'promote', `Promoted ${sourceVersion.versionTag} → ${targetEnv} as ${versionTag}`)
    return this.toVersion(rows[0])
  }

  async rollbackVersion(versionId: string): Promise<void> {
    const target = await this.one('SELECT * FROM versions WHERE id = $1', [versionId])
    if (!target) return
    const v = this.toVersion(target)

    // Roll back current active
    await this.query(
      `UPDATE versions SET status = 'rolled_back'
       WHERE project_id = $1 AND environment = $2 AND status = 'active'`,
      [v.projectId, v.environment],
    )
    // Reactivate target
    await this.query("UPDATE versions SET status = 'active' WHERE id = $1", [versionId])
    await this.insertActivity(v.projectId, 'rollback', `Rolled back to ${v.versionTag} in ${v.environment}`)
  }

  async deleteVersion(versionId: string): Promise<void> {
    await this.query('DELETE FROM versions WHERE id = $1', [versionId])
  }

  async compareVersions(v1Id: string, v2Id: string): Promise<VersionDiff> {
    const r1 = await this.one('SELECT * FROM versions WHERE id = $1', [v1Id])
    const r2 = await this.one('SELECT * FROM versions WHERE id = $1', [v2Id])
    if (!r1 || !r2) throw new Error('Version not found')
    const v1 = this.toVersion(r1)
    const v2 = this.toVersion(r2)

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

  async listActivity(projectId: string, limit?: number): Promise<ActivityLog[]> {
    const q = limit
      ? 'SELECT * FROM activities WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2'
      : 'SELECT * FROM activities WHERE project_id = $1 ORDER BY created_at DESC'
    const { rows } = await this.query(q, limit ? [projectId, limit] : [projectId])
    return rows.map(r => this.toActivity(r))
  }

  // ─── Webhooks ───────────────────────────────────────────

  private toWebhook(r: Record<string, unknown>): WebhookRegistration {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      url: r.url as string,
      secret: r.secret as string,
      events: r.events as ActivityLog['type'][],
      active: r.active as boolean,
      createdAt: (r.created_at as Date).toISOString(),
    }
  }

  async listWebhooks(projectId: string): Promise<WebhookRegistration[]> {
    const { rows } = await this.query('SELECT * FROM webhooks WHERE project_id = $1', [projectId])
    return rows.map(r => this.toWebhook(r))
  }

  async createWebhook(projectId: string, url: string, secret: string, events: string[]): Promise<WebhookRegistration> {
    const id = generateId()
    const { rows } = await this.query(
      `INSERT INTO webhooks (id, project_id, url, secret, events)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, projectId, url, secret, JSON.stringify(events)],
    )
    return this.toWebhook(rows[0])
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.query('DELETE FROM webhooks WHERE id = $1', [id])
  }
}
