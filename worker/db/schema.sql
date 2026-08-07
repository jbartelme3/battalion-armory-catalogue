-- Battalion Armory Catalogue schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS cadets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT NOT NULL CHECK (company IN ('A', 'B', 'C')),
  position TEXT NOT NULL DEFAULT 'New Cadet',
  rank TEXT,
  classman TEXT,
  is_honor_guard INTEGER NOT NULL DEFAULT 0 CHECK (is_honor_guard IN (0, 1)),
  hg_rank TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cadets_company ON cadets (company);
CREATE INDEX IF NOT EXISTS idx_cadets_name ON cadets (last_name, first_name);

CREATE TABLE IF NOT EXISTS equipment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (
    type IN ('infantry_rifle', 'honor_guard_rifle', 'bayonet', 'dress_jacket', 'dress_cover')
  ),
  tag TEXT NOT NULL,
  manual_condition TEXT NOT NULL DEFAULT 'green' CHECK (manual_condition IN ('green', 'yellow', 'red')),
  owner_cadet_id INTEGER REFERENCES cadets (id) ON DELETE SET NULL,
  has_sheath INTEGER CHECK (has_sheath IN (0, 1)),
  has_pompom INTEGER CHECK (has_pompom IN (0, 1)),
  size TEXT,
  is_ps_rifle INTEGER NOT NULL DEFAULT 0 CHECK (is_ps_rifle IN (0, 1)),
  is_black_sl_bayonet INTEGER NOT NULL DEFAULT 0 CHECK (is_black_sl_bayonet IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment_items (type);
CREATE INDEX IF NOT EXISTS idx_equipment_owner ON equipment_items (owner_cadet_id);

-- Tracks failed login attempts per IP for the shared-password gate. After 5
-- failed attempts, the IP is locked and a verification code is emailed to the
-- admin; only entering that code (POST /api/login/verify) clears the lock.
CREATE TABLE IF NOT EXISTS login_lockouts (
  ip TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TEXT,
  code_hash TEXT,
  code_expires_at TEXT,
  code_sent_at TEXT,
  code_attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
