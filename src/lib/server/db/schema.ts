/** Schema definition, inlined so the production bundle needs no file reads. */

export const SCHEMA_SQL = `
-- 2See Podcast — database schema
--
-- Applied in order by src/lib/server/db/migrate.ts. Each migration records its
-- version so upgrades never re-apply and never lose data.

-- journal_mode is deliberately absent: it cannot be changed inside a
-- transaction, and migrations run in one. The connection sets it after opening.
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Migration bookkeeping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);

-- ---------------------------------------------------------------------------
-- The single administrative account
--
-- The constraint below is enforced by the database itself: there is a
-- UNIQUE index on \`singleton\` and exactly one row can hold the value 1, so no
-- code path — form action, API route, script, or future bug — can insert a
-- second administrator without failing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  hash_params  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  last_login_at TEXT,
  password_changed_at TEXT,
  singleton     INTEGER NOT NULL DEFAULT 1 CHECK (singleton = 1),
  CONSTRAINT single_admin_row UNIQUE (singleton)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_single ON admins (singleton);

-- ---------------------------------------------------------------------------
-- Publisher sessions
--
-- Sessions are opaque 256-bit tokens. Only a SHA-256 hash of the token is
-- stored, so a database leak does not grant access. \`nonce_b\` is unused
-- placeholder for rotation bookkeeping.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  admin_id     INTEGER NOT NULL REFERENCES admins (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions (revoked_at, expires_at);

-- ---------------------------------------------------------------------------
-- Login throttling
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  succeeded    INTEGER NOT NULL DEFAULT 0,
  ip_address   TEXT,
  username     TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address, attempted_at);

-- ---------------------------------------------------------------------------
-- Stories (editorial articles) — manually authored
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stories (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  subtitle         TEXT NOT NULL DEFAULT '',
  summary          TEXT NOT NULL DEFAULT '',
  body_markdown    TEXT NOT NULL DEFAULT '',
  body_html        TEXT NOT NULL DEFAULT '',
  cover_image_url  TEXT NOT NULL DEFAULT '',
  cover_alt        TEXT NOT NULL DEFAULT '',
  cover_caption    TEXT NOT NULL DEFAULT '',
  category         TEXT NOT NULL DEFAULT '',
  tags             TEXT NOT NULL DEFAULT '',
  author           TEXT NOT NULL DEFAULT '',
  state            TEXT NOT NULL CHECK (state IN ('draft','published')),
  published_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  featured         INTEGER NOT NULL DEFAULT 0,
  word_count       INTEGER NOT NULL DEFAULT 0,
  reading_minutes  INTEGER NOT NULL DEFAULT 0,
  meta_title       TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_stories_state_pub ON stories (state, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories (slug);

-- ---------------------------------------------------------------------------
-- Episodes — the canonical YouTube video ID prevents duplicates
--
-- \`youtube_id\` is UNIQUE at the database level, which is the authoritative
-- guard against duplicate publication. Sync is idempotent because every write
-- is an UPSERT keyed on that column.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS episodes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_id       TEXT NOT NULL UNIQUE,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  original_title   TEXT NOT NULL DEFAULT '',
  summary          TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  guests           TEXT NOT NULL DEFAULT '',
  host_names       TEXT NOT NULL DEFAULT '',
  series           TEXT NOT NULL DEFAULT '',
  episode_number   INTEGER,
  category         TEXT NOT NULL DEFAULT '',
  tags             TEXT NOT NULL DEFAULT '',
  thumbnail_url    TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER,
  published_at     TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  state            TEXT NOT NULL CHECK (state IN ('draft','published')),
  language         TEXT NOT NULL CHECK (language IN ('fa','en')) DEFAULT 'fa',
  format           TEXT NOT NULL CHECK (format IN ('episode','brief','short')) DEFAULT 'episode',
  featured         INTEGER NOT NULL DEFAULT 0,
  meta_title       TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  sync_source      TEXT,
  synced_at        TEXT,
  manually_edited  INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_youtube_id ON episodes (youtube_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_slug ON episodes (slug);
CREATE INDEX IF NOT EXISTS idx_episodes_state_pub ON episodes (state, published_at DESC);

-- ---------------------------------------------------------------------------
-- Controlled vocabulary for categories and tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxonomies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('category','tag')),
  slug       TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (kind, slug)
);

-- ---------------------------------------------------------------------------
-- Site settings — a single row
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_settings (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  site_title   TEXT NOT NULL,
  tagline      TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  channel_url  TEXT NOT NULL DEFAULT '',
  about_body   TEXT NOT NULL DEFAULT '',
  contact_note TEXT NOT NULL DEFAULT '',
  social_links TEXT NOT NULL DEFAULT '',
  hosts        TEXT NOT NULL DEFAULT '',
  footer_note  TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);

-- ---------------------------------------------------------------------------
-- Synchronisation state — one row
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_state (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  last_run_at        TEXT,
  last_success_at    TEXT,
  last_status        TEXT NOT NULL CHECK (last_status IN ('never','running','ok','partial','error')) DEFAULT 'never',
  last_message       TEXT NOT NULL DEFAULT '',
  last_found_count   INTEGER NOT NULL DEFAULT 0,
  last_created_count INTEGER NOT NULL DEFAULT 0,
  last_updated_count INTEGER NOT NULL DEFAULT 0,
  total_synced_count INTEGER NOT NULL DEFAULT 0,
  source             TEXT,
  playlist_cursor    TEXT,
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);

-- ---------------------------------------------------------------------------
-- Cache invalidation journal
--
-- Every publish/unpublish/delete appends a row. Public read paths compare the
-- newest row timestamp against their cached response so a stale cached page is
-- never served after content changes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT NOT NULL CHECK (entity IN ('story','episode','settings')),
  entity_id  INTEGER,
  action     TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_entity ON content_revisions (entity, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- One-time setup consumption
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS setup_runs (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);
`;
