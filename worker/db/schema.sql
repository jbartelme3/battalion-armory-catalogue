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
  student_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cadets_company ON cadets (company);
CREATE INDEX IF NOT EXISTS idx_cadets_name ON cadets (last_name, first_name);
-- Whatever string an ID scan (or manual entry) produces for this cadet, used
-- to match them on Rifle Pickup day. Nullable/partial-unique: not every
-- cadet has one yet, but no two cadets may share the same value.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cadets_student_id ON cadets (student_id) WHERE student_id IS NOT NULL;

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

-- One row per equipment checkout/return. Denormalized (equipment type/tag,
-- cadet name/company snapshotted at the time) so accountability history
-- survives deletion of the cadet or equipment item it refers to. A row with
-- checked_in_at IS NULL is the item's current, still-active assignment.
CREATE TABLE IF NOT EXISTS equipment_assignment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER REFERENCES equipment_items (id) ON DELETE SET NULL,
  equipment_type TEXT NOT NULL,
  equipment_tag TEXT NOT NULL,
  cadet_id INTEGER REFERENCES cadets (id) ON DELETE SET NULL,
  cadet_first_name TEXT NOT NULL,
  cadet_last_name TEXT NOT NULL,
  cadet_company TEXT NOT NULL,
  checked_out_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_in_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_equipment ON equipment_assignment_history (equipment_id);
CREATE INDEX IF NOT EXISTS idx_history_cadet ON equipment_assignment_history (cadet_id);
CREATE INDEX IF NOT EXISTS idx_history_open ON equipment_assignment_history (equipment_id, checked_in_at);

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
