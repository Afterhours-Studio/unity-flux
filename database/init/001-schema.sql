-- Unity Flux - Local Database Schema
-- Auto-executed on first `docker compose up`

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL,
  anon_key TEXT NOT NULL,
  supabase_url TEXT NOT NULL DEFAULT '',
  r2_bucket_url TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'development' CHECK (environment IN ('development', 'staging', 'production')),
  storage_provider TEXT NOT NULL DEFAULT 'local' CHECK (storage_provider IN ('local', 'cloud')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tables (schemas)
CREATE TABLE schemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'data' CHECK (mode IN ('data', 'config')),
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schemas_project ON schemas(project_id);

-- Rows (entries)
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schema_id UUID NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  environment TEXT NOT NULL DEFAULT 'development' CHECK (environment IN ('development', 'staging', 'production')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entries_schema ON entries(schema_id);

-- Versions
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'rolled_back')),
  data JSONB NOT NULL DEFAULT '{}',
  table_count INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_versions_project ON versions(project_id);
CREATE INDEX idx_versions_env ON versions(project_id, environment, status);

-- Activity logs
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('publish', 'promote', 'rollback', 'table_create', 'table_delete', 'table_update', 'row_add', 'row_delete')),
  message TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_project ON activities(project_id);
CREATE INDEX idx_activities_created ON activities(project_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schemas_updated BEFORE UPDATE ON schemas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_entries_updated BEFORE UPDATE ON entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
