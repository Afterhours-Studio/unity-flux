import type { Project, Schema, SchemaField, DataEntry, Version, VersionDiff, ActivityLog, Environment, WebhookRegistration } from './types.js'

/**
 * Abstract DataStore interface — implemented by JsonStore (file) and PostgresStore (database).
 * Both MCP tools and REST API use this interface.
 */
export interface DataStore {
  // Projects
  listProjects(): Promise<Project[]>
  getProject(id: string): Promise<Project | null>
  createProject(name: string, description: string): Promise<Project>
  updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>>): Promise<Project>
  deleteProject(id: string): Promise<void>
  regenerateApiKey(id: string): Promise<Project>

  // Schemas (tables)
  listSchemas(projectId: string): Promise<Schema[]>
  getSchema(id: string): Promise<Schema | null>
  createSchema(projectId: string, name: string, fields: SchemaField[], mode?: Schema['mode']): Promise<Schema>
  renameSchema(id: string, name: string): Promise<Schema>
  updateSchema(id: string, updates: Partial<Pick<Schema, 'name' | 'fields'>>): Promise<Schema>
  deleteSchema(id: string): Promise<void>

  // Columns
  addColumn(schemaId: string, field: SchemaField): Promise<Schema>
  updateColumn(schemaId: string, columnName: string, updates: Partial<SchemaField>): Promise<Schema>
  removeColumn(schemaId: string, columnName: string): Promise<Schema>

  // Entries (rows)
  listEntries(schemaId: string): Promise<DataEntry[]>
  getEntry(id: string): Promise<DataEntry | null>
  createEntry(schemaId: string, data: Record<string, unknown>, environment?: Environment): Promise<DataEntry>
  updateEntry(id: string, data: Record<string, unknown>): Promise<DataEntry>
  deleteEntry(id: string): Promise<void>
  createEntries(schemaId: string, rows: Record<string, unknown>[], environment?: Environment): Promise<DataEntry[]>
  deleteEntries(ids: string[]): Promise<void>

  // Versions
  listVersions(projectId: string): Promise<Version[]>
  publishVersion(projectId: string, environment: Environment): Promise<Version>
  promoteVersion(versionId: string, targetEnv: Environment): Promise<Version>
  rollbackVersion(versionId: string): Promise<void>
  deleteVersion(versionId: string): Promise<void>
  compareVersions(v1Id: string, v2Id: string): Promise<VersionDiff>

  // Activity
  listActivity(projectId: string, limit?: number): Promise<ActivityLog[]>

  // Webhooks
  listWebhooks(projectId: string): Promise<WebhookRegistration[]>
  createWebhook(projectId: string, url: string, secret: string, events: string[]): Promise<WebhookRegistration>
  deleteWebhook(id: string): Promise<void>
}
