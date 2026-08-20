-- Knowledge OS: unified sources store (videos, AI-chat exports, RSS/links).
-- Idempotent; safe to run on every deploy (matches init_db convention).

CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'video',
    title TEXT NOT NULL,
    source_name TEXT,
    url TEXT,
    thumbnail TEXT,
    raw_content TEXT,
    processed_content TEXT,
    tags TEXT[] DEFAULT '{}',
    dedupe_key TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_type ON sources (type);
CREATE INDEX IF NOT EXISTS idx_sources_created ON sources (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_tags ON sources USING GIN (tags);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_dedupe ON sources (dedupe_key);