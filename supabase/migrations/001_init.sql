-- ============================================================
-- hidden-trump-10 — Supabase Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Players table (replaces db_fallback.json players map)
CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  avatar       TEXT NOT NULL DEFAULT 'avatar_1',
  card_back    TEXT NOT NULL DEFAULT 'classic_blue',
  table_skin   TEXT NOT NULL DEFAULT 'green_felt',
  coins        INT  NOT NULL DEFAULT 500,
  mmr          INT  NOT NULL DEFAULT 1000,
  rank_name    TEXT NOT NULL DEFAULT 'Bronze',
  is_bot       BOOLEAN NOT NULL DEFAULT FALSE,
  connected    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Leaderboard view (top 50 non-bot players by MMR)
CREATE OR REPLACE VIEW leaderboard AS
  SELECT id, username, mmr, rank_name
  FROM players
  WHERE is_bot = FALSE
  ORDER BY mmr DESC
  LIMIT 50;

-- ============================================================
-- RLS: Disabled for server-only access via service-role key
-- The Express server is the only writer — no client direct access
-- ============================================================
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
