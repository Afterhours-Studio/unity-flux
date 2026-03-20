export interface Project {
  id: string
  name: string
  slug: string
  description: string
  icon: string // emoji or image URL
  createdAt: string
  updatedAt: string
  // Keys & tokens for Unity SDK integration
  apiKey: string
  anonKey: string
  supabaseUrl: string
  r2BucketUrl: string
  environment: 'development' | 'staging' | 'production'
  dataSource: 'cloud' | 'local' | 'both'
}

export interface SchemaField {
  name: string
  type: 'string' | 'integer' | 'float' | 'boolean' | 'enum' | 'list' | 'color' | 'config'
  required: boolean
  default?: string | number | boolean
  min?: number
  max?: number
  values?: string[] // for enum and list types
  configRef?: string // for config type — references another column name
}

export interface Schema {
  id: string
  projectId: string
  name: string
  mode: 'data' | 'config'
  fields: SchemaField[]
  createdAt: string
  updatedAt: string
}

export interface DataEntry {
  id: string
  schemaId: string
  data: Record<string, unknown>
  environment: 'development' | 'staging' | 'production'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ActivityLog {
  id: string
  projectId: string
  type:
    | 'publish'
    | 'promote'
    | 'rollback'
    | 'table_create'
    | 'table_delete'
    | 'table_update'
    | 'row_add'
    | 'row_delete'
    | 'event_create'
    | 'event_update'
    | 'event_delete'
  message: string
  meta?: Record<string, unknown>
  createdAt: string
}

export interface Version {
  id: string
  projectId: string
  versionTag: string
  environment: 'development' | 'staging' | 'production'
  status: 'active' | 'superseded' | 'rolled_back'
  data: Record<string, Record<string, unknown>[]>
  tableHashes: Record<string, string>
  tableCount: number
  rowCount: number
  r2Url: string | null
  publishedAt: string
}

export interface VersionTableDiff {
  tableName: string
  status: 'added' | 'removed' | 'modified' | 'unchanged'
  addedRows: Record<string, unknown>[]
  removedRows: Record<string, unknown>[]
  modifiedRows: {
    before: Record<string, unknown>
    after: Record<string, unknown>
    changedFields: string[]
  }[]
  unchangedRowCount: number
}

export interface VersionDiff {
  v1Id: string
  v2Id: string
  tableDiffs: VersionTableDiff[]
  summary: {
    tablesAdded: number
    tablesRemoved: number
    tablesModified: number
    totalRowsAdded: number
    totalRowsRemoved: number
    totalRowsModified: number
  }
}

// ─── Live Ops ─────────────────────────────────────────

export type LiveOpsEventType = 'daily_login' | 'flash_sale' | 'limited_shop' | 'tournament' | 'season_pass' | 'maintenance' | 'world_boss' | 'custom'
export type LiveOpsStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'

export interface LiveOpsEvent {
  id: string
  projectId: string
  name: string
  description: string
  type: LiveOpsEventType
  status: LiveOpsStatus
  startAt: string
  endAt: string
  color: string
  config: Record<string, unknown>
  recurring: 'daily' | 'weekly' | 'monthly' | null
  createdAt: string
  updatedAt: string
}

export interface BattlePassTier {
  id: string
  eventId: string
  tier: number
  xpRequired: number
  freeReward: string
  premiumReward: string
}

/* ── Formulas ── */

export interface FormulaVariable {
  name: string
  type: 'int' | 'float'
  defaultValue: number
  description: string
}

export interface Formula {
  id: string
  projectId: string
  name: string
  description: string
  expression: string
  variables: FormulaVariable[]
  outputMode: 'method' | 'lookup'
  previewInputs: Record<string, number[]>
  createdAt: string
  updatedAt: string
}
