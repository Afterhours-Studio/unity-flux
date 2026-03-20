-- 003-formulas.sql  –  Formula designer tables
-- Depends on: 001-schema.sql (projects table)

CREATE TABLE IF NOT EXISTS formulas (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    expression      TEXT NOT NULL,
    variables       JSONB NOT NULL DEFAULT '[]',
    output_mode     TEXT NOT NULL DEFAULT 'method'
                    CHECK (output_mode IN ('method', 'lookup')),
    preview_inputs  JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formulas_project ON formulas(project_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_formulas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_formulas_updated_at
    BEFORE UPDATE ON formulas
    FOR EACH ROW
    EXECUTE FUNCTION update_formulas_updated_at();
