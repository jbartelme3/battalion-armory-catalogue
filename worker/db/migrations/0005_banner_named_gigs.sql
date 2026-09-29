-- Individual cadets attached to a banner event's gigs, for tracking personal
-- performance. Attribution only: the event's per-company gig counts are
-- still what the banner is scored on, and a company's named gigs can never
-- exceed its count for that event. cadet_name/company are snapshotted so the
-- record survives the cadet's removal from the roster; cadet_id is NULL for
-- a name typed in that isn't on the roster. Safe to rerun.

CREATE TABLE IF NOT EXISTS banner_gigs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES banner_events (id) ON DELETE CASCADE,
  company TEXT NOT NULL CHECK (company IN ('A', 'B', 'C')),
  cadet_id INTEGER REFERENCES cadets (id) ON DELETE SET NULL,
  cadet_name TEXT NOT NULL,
  count REAL NOT NULL CHECK (count > 0),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_banner_gigs_event ON banner_gigs (event_id);
CREATE INDEX IF NOT EXISTS idx_banner_gigs_cadet ON banner_gigs (cadet_id);
