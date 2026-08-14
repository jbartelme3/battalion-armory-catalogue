-- Adds a company designation to Infantry Rifle catalogue rows so Rifle
-- Pickup can assign from each company's own numbered pool (e.g. tags "01A"
-- through "53A" belong to Company A) instead of one shared pool. Nullable:
-- every other equipment type has no per-company pool and keeps this NULL,
-- and the CHECK constraint only applies when a value is actually set.
-- Safe to rerun: ALTER TABLE ADD COLUMN is the only statement here, and it's
-- only ever going to fail (harmlessly) on a rerun once already applied.

ALTER TABLE equipment_items ADD COLUMN company TEXT CHECK (company IN ('A', 'B', 'C'));

CREATE INDEX IF NOT EXISTS idx_equipment_company ON equipment_items (type, company, owner_cadet_id);
