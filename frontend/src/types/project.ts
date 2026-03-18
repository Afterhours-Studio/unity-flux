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
  type: 'string' | 'integer' | 'float' | 'boolean' | 'enum' | 'color'
  required: boolean
  default?: string | number | boolean
  min?: number
  max?: number
  values?: string[] // for enum type
}

export interface Schema {
  id: string
  projectId: string
  name: string
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

export interface Version {
  id: string
  projectId: string
  versionTag: string
  contentHash: string
  fileUrl: string
  publishedBy: string
  environment: 'development' | 'staging' | 'production'
  status: 'active' | 'superseded' | 'rolled_back'
  publishedAt: string
}
