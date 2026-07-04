-- 001_init.sql — Free Proxy Pool schema
-- Idempotent: every CREATE uses IF NOT EXISTS so it is safe to run
-- against an existing OmniRoute SQLite database.

CREATE TABLE IF NOT EXISTS free_proxies (
  id                    TEXT PRIMARY KEY,
  source                TEXT NOT NULL DEFAULT '1proxy',
  host                  TEXT NOT NULL,
  port                  INTEGER NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'http',
  country_code          TEXT,
  quality_score         REAL,
  latency_ms            REAL,
  anonymity             TEXT,
  last_validated        TEXT,
  in_pool               INTEGER NOT NULL DEFAULT 0,
  pool_proxy_id         TEXT,
  test_count            INTEGER NOT NULL DEFAULT 0,
  success_count         INTEGER NOT NULL DEFAULT 0,
  tier                  INTEGER NOT NULL DEFAULT 1,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_free_proxies_tier
  ON free_proxies(tier);
CREATE INDEX IF NOT EXISTS idx_free_proxies_source_host_port
  ON free_proxies(source, host, port);
CREATE INDEX IF NOT EXISTS idx_free_proxies_country
  ON free_proxies(country_code);
CREATE INDEX IF NOT EXISTS idx_free_proxies_in_pool
  ON free_proxies(in_pool);

CREATE TABLE IF NOT EXISTS proxy_registry (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'http',
  host        TEXT NOT NULL,
  port        INTEGER NOT NULL,
  username    TEXT NOT NULL DEFAULT '',
  password    TEXT NOT NULL DEFAULT '',
  region      TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  source      TEXT,
  quality_score REAL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proxy_registry_source
  ON proxy_registry(source);
CREATE INDEX IF NOT EXISTS idx_proxy_registry_status
  ON proxy_registry(status);

CREATE TABLE IF NOT EXISTS proxy_assignments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scope       TEXT NOT NULL,
  scope_id    TEXT NOT NULL,
  proxy_id    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE(scope, scope_id),
  FOREIGN KEY (proxy_id) REFERENCES proxy_registry(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_proxy_assignments_scope
  ON proxy_assignments(scope);
CREATE INDEX IF NOT EXISTS idx_proxy_assignments_proxy
  ON proxy_assignments(proxy_id);
