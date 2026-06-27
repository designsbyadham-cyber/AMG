-- Deal enhancements: start/delivery dates and deposit tracking.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS start_date         DATE,
  ADD COLUMN IF NOT EXISTS delivery_date      DATE,
  ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5,2) DEFAULT 25,
  ADD COLUMN IF NOT EXISTS deposit_paid       BOOLEAN NOT NULL DEFAULT FALSE;
