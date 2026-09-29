-- Weekly Battalion Banner (Sergeant Major section). Companies A, B and C
-- compete across 12 categories; see worker/lib/bannerScoring.ts for how a
-- week is scored. Safe to rerun: every statement is IF NOT EXISTS.

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
