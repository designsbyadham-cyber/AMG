-- AMG Operations: add vehicle-specific fields to contacts
-- and track when a deal was collected for the 10-day QC check.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS car_brand       TEXT,
  ADD COLUMN IF NOT EXISTS car_model       TEXT,
  ADD COLUMN IF NOT EXISTS car_year        INTEGER,
  ADD COLUMN IF NOT EXISTS car_trim        TEXT,
  ADD COLUMN IF NOT EXISTS vin             TEXT,
  ADD COLUMN IF NOT EXISTS plate_number    TEXT,
  ADD COLUMN IF NOT EXISTS service_type    TEXT,
  ADD COLUMN IF NOT EXISTS job_description TEXT;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
