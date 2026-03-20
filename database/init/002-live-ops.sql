-- Live Ops tables for Unity Flux
-- Adds live_ops_events and battle_pass_tiers tables + extends activity types

-- Live Ops Events
CREATE TABLE live_ops_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('daily_login', 'flash_sale', 'limited_shop', 'tournament', 'season_pass', 'maintenance', 'world_boss', 'custom')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  config JSONB NOT NULL DEFAULT '{}',
  recurring TEXT CHECK (recurring IN ('daily', 'weekly', 'monthly') OR recurring IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_live_ops_events_project ON live_ops_events(project_id);
CREATE INDEX idx_live_ops_events_status ON live_ops_events(project_id, status);

-- Battle Pass Tiers
CREATE TABLE battle_pass_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES live_ops_events(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  xp_required INTEGER NOT NULL DEFAULT 0,
  free_reward TEXT NOT NULL DEFAULT '',
  premium_reward TEXT NOT NULL DEFAULT '',
  UNIQUE (event_id, tier)
);

CREATE INDEX idx_battle_pass_tiers_event ON battle_pass_tiers(event_id);

-- Auto-update triggers
CREATE TRIGGER trg_live_ops_events_updated BEFORE UPDATE ON live_ops_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Extend activity type constraint to include live-ops event types
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check CHECK (
  type IN (
    'publish', 'promote', 'rollback',
    'table_create', 'table_delete', 'table_update',
    'row_add', 'row_delete',
    'event_create', 'event_update', 'event_delete'
  )
);
