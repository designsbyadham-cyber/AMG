-- Lead temperature label per contact: Cold / Warm / Hot.
-- Nullable (unlabeled by default). CHECK permits only the three
-- known values; NULL passes the constraint so existing rows are fine.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_status TEXT
    CHECK (lead_status IN ('cold', 'warm', 'hot'));
