-- Multi-select service options per contact ("select all that apply").
-- Keeps the legacy single service_type column for backward compatibility
-- and backfills the new array from it so existing records render
-- unchanged.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS service_types TEXT[];

UPDATE contacts
  SET service_types = ARRAY[service_type]
  WHERE service_type IS NOT NULL
    AND service_type <> ''
    AND (service_types IS NULL OR cardinality(service_types) = 0);
