-- One-off migration to bring an *already-existing* database (created before
-- the Rifle Pickup / equipment history feature) up to date. Safe to rerun:
-- every statement here is idempotent except the final ALTER TABLE, which is
-- ordered last so a rerun only ever fails (harmlessly) on that one line once
-- it has already been applied. Brand-new databases don't need this file —
-- schema.sql already includes all of it.

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

ALTER TABLE cadets ADD COLUMN student_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cadets_student_id ON cadets (student_id) WHERE student_id IS NOT NULL;
