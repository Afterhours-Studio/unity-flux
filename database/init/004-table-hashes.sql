-- Add table_hashes column to versions for delta sync
ALTER TABLE versions ADD COLUMN IF NOT EXISTS table_hashes JSONB NOT NULL DEFAULT '{}';
