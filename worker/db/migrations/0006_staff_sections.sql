-- Battalion staff sections: Adjutant, Operations Officer, Supply records,
-- and the Adjutant's New Cadet System tracker. Safe to rerun.

-- One row per staff record (an order, a morale report, a training event, a
-- laundry notice, a work order, a police area). The fields live in
-- data_json and are defined/validated in worker/lib/staffKinds.ts; title,
-- date, company and status are copied into columns for sorting/filtering.
-- Deletion is soft (deleted_at) so the record and its history survive.
CREATE TABLE IF NOT EXISTS staff_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  record_date TEXT,
  company TEXT CHECK (company IN ('A', 'B', 'C')),
  status TEXT,
  data_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_records_kind ON staff_records (kind, deleted_at, record_date);

-- New Cadet System progress per new cadet (CMA 3-2.2): phases I Orientation,
-- II Basic Formation, III Advanced Formation, IV Boards, V Recognition.
CREATE TABLE IF NOT EXISTS ncs_progress (
  cadet_id INTEGER PRIMARY KEY REFERENCES cadets (id) ON DELETE CASCADE,
  phase INTEGER NOT NULL DEFAULT 2 CHECK (phase BETWEEN 1 AND 5),
  black_striper INTEGER NOT NULL DEFAULT 0 CHECK (black_striper IN (0, 1)),
  specialty_test_date TEXT,
  boards_book_date TEXT,
  boards_invited_date TEXT,
  boards_passed_date TEXT,
  notes TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Append-only change log for staff records and NCS progress: who changed
-- what, when, with before/after snapshots. record_id is the staff record id,
-- or the cadet id when kind = 'ncs'.
CREATE TABLE IF NOT EXISTS staff_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_record ON staff_audit (kind, record_id, created_at);
