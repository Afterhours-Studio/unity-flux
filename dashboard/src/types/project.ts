export interface Project {
  id: string
  name: string
  slug: string
  description: string
  createdAt: string
  updatedAt: string
  // Keys & tokens for Unity SDK integration
  apiKey: string
  anonKey: string
  supabaseUrl: string
  r2BucketUrl: string
  environment: 'development' | 'staging' | 'production'
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
  tableCount: number
  rowCount: number
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
