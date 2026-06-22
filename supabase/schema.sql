-- HabitFlow — Supabase schema
-- Run this once in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/bfrhmdaxxcezudnazlrg/sql

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habits (
  id           TEXT        PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('daily', 'volume')),
  target_count INTEGER     NOT NULL DEFAULT 1,
  emoji        TEXT,
  color        TEXT,
  streak       INTEGER     NOT NULL DEFAULT 0,
  best_streak  INTEGER     NOT NULL DEFAULT 0,
  created_at   TEXT        NOT NULL,
  reminder     JSONB
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id        TEXT    PRIMARY KEY,
  user_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id  TEXT    NOT NULL,  -- soft ref to habits.id (no FK, avoids parallel-upsert ordering issues)
  date      TEXT    NOT NULL,  -- YYYY-MM-DD
  count     INTEGER NOT NULL DEFAULT 0
);

-- One kickstart challenge per user (user_id is the PK)
CREATE TABLE IF NOT EXISTS user_challenges (
  user_id      UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date   TEXT    NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 3,
  rewarded     BOOLEAN NOT NULL DEFAULT FALSE,
  habit_ids    TEXT[]  NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS custom_challenges (
  id            TEXT    PRIMARY KEY,
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 7,
  start_date    TEXT    NOT NULL,
  rewarded      BOOLEAN NOT NULL DEFAULT FALSE,
  habit_ids     TEXT[]  NOT NULL DEFAULT '{}'
);

-- One settings row per user (user_id is the PK)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id                  UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_complete      BOOLEAN NOT NULL DEFAULT FALSE,
  notifications_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  display_name             TEXT,
  avatar_url               TEXT,
  inactivity_timeout_mins  INTEGER DEFAULT 30,
  push_token               TEXT    -- Expo push token; set when notifications_enabled + permission granted
);

-- Migration for pre-existing user_settings tables (safe no-op if column already exists)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS push_token TEXT;

-- AI-generated coaching nudges (one row per generation; latest = most recent created_at)
CREATE TABLE IF NOT EXISTS ai_nudges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'push')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration for pre-existing ai_nudges tables (safe no-op if column already exists)
ALTER TABLE ai_nudges ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';

-- AI-generated weekly/monthly reports. One row per user/period/start — regenerating overwrites.
CREATE TABLE IF NOT EXISTS ai_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type  TEXT        NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start TEXT        NOT NULL, -- YYYY-MM-DD
  period_end   TEXT        NOT NULL, -- YYYY-MM-DD
  summary      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_type, period_start)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES  (skip if table already has them)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS habits_user_id_idx        ON habits (user_id);
CREATE INDEX IF NOT EXISTS habit_logs_user_id_idx    ON habit_logs (user_id);
CREATE INDEX IF NOT EXISTS habit_logs_habit_id_idx   ON habit_logs (habit_id);
CREATE INDEX IF NOT EXISTS habit_logs_date_idx       ON habit_logs (user_id, date);
CREATE INDEX IF NOT EXISTS custom_challenges_user_idx ON custom_challenges (user_id);
CREATE INDEX IF NOT EXISTS ai_nudges_user_created_idx  ON ai_nudges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_reports_user_idx         ON ai_reports (user_id, period_type, period_start DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Users can only read/write their own rows.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE habits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_nudges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports       ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before re-creating (safe to re-run)
DROP POLICY IF EXISTS "habits_own"             ON habits;
DROP POLICY IF EXISTS "habit_logs_own"         ON habit_logs;
DROP POLICY IF EXISTS "user_challenges_own"    ON user_challenges;
DROP POLICY IF EXISTS "custom_challenges_own"  ON custom_challenges;
DROP POLICY IF EXISTS "user_settings_own"      ON user_settings;
DROP POLICY IF EXISTS "ai_nudges_own"          ON ai_nudges;
DROP POLICY IF EXISTS "ai_reports_own"         ON ai_reports;

CREATE POLICY "habits_own"            ON habits            USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habit_logs_own"        ON habit_logs        USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_challenges_own"   ON user_challenges   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_challenges_own" ON custom_challenges USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_own"     ON user_settings     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_nudges_own"         ON ai_nudges         USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_reports_own"        ON ai_reports        USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE — avatar images
-- Run this only if the "avatars" bucket doesn't exist yet.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES ('avatars', 'avatars', true, ARRAY['image/jpeg', 'image/png', 'image/webp'], 5242880) -- 5 MB
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read"   ON storage.objects;

CREATE POLICY "avatars_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
