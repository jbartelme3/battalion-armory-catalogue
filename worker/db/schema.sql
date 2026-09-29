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
  -- Which company's numbered pool this item belongs to (Infantry Rifles
  -- only, e.g. tag "01A" -> company 'A'). NULL for every other type.
  company TEXT CHECK (company IN ('A', 'B', 'C')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment_items (type);
CREATE INDEX IF NOT EXISTS idx_equipment_owner ON equipment_items (owner_cadet_id);
CREATE INDEX IF NOT EXISTS idx_equipment_company ON equipment_items (type, company, owner_cadet_id);

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

-- Weekly Battalion Banner (Sergeant Major section); scoring lives in
-- worker/lib/bannerScoring.ts.

-- One evaluation period. Weeks run start_date afternoon -> end_date morning
-- (Sunday -> Sunday in 1st/3rd make, Wednesday -> Wednesday in 2nd make), so
-- both boundary dates belong to the week. strength_* is each company's
-- headcount that week, the default denominator for per-cadet categories.
-- Once finalized, the standings as announced are frozen in announced_json so
-- a later recalculation can never silently rewrite a past result.
CREATE TABLE IF NOT EXISTS banner_weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  strength_a INTEGER NOT NULL CHECK (strength_a > 0),
  strength_b INTEGER NOT NULL CHECK (strength_b > 0),
  strength_c INTEGER NOT NULL CHECK (strength_c > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'final')),
  announced_json TEXT,
  finalized_at TEXT,
  finalized_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_banner_weeks_start ON banner_weeks (start_date);

-- One scored event (an inspection, a formation, a night's bed checks...).
-- All three companies are recorded together on one row, so an event can
-- never exist for one company and be silently missing for another.
-- inspected_* overrides the week's strength for per-cadet categories when
-- only part of a company was inspected (e.g. one squad at a BRC).
CREATE TABLE IF NOT EXISTS banner_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES banner_weeks (id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  event_date TEXT NOT NULL,
  gigs_a REAL NOT NULL CHECK (gigs_a >= 0),
  gigs_b REAL NOT NULL CHECK (gigs_b >= 0),
  gigs_c REAL NOT NULL CHECK (gigs_c >= 0),
  inspected_a INTEGER CHECK (inspected_a > 0),
  inspected_b INTEGER CHECK (inspected_b > 0),
  inspected_c INTEGER CHECK (inspected_c > 0),
  note TEXT,
  entered_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_banner_events_week ON banner_events (week_id, category);

-- Append-only record of every change to banner data: who, when, what it was
-- before and after, and (for reopening a finalized week) why. Not tied to
-- banner_events by foreign key so entries survive the event's deletion.
CREATE TABLE IF NOT EXISTS banner_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  event_id INTEGER,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_banner_audit_week ON banner_audit (week_id, created_at);
