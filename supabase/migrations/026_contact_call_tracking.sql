-- Call Log tracking per contact.
-- contact_status buckets the contact in the Call Log board:
--   not_contacted -> never reached out (default for every existing row)
--   follow_up     -> attempted (no answer) or scheduled for a callback
--   contacted     -> reached (answered call or message sent)
-- last_call_outcome/last_contacted_at/messaged capture the most recent
-- attempt; next_follow_up_at is the "contact them by" date.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS contact_status    TEXT NOT NULL DEFAULT 'not_contacted',
  ADD COLUMN IF NOT EXISTS last_call_outcome TEXT,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS messaged          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS next_follow_up_at DATE;

-- Idempotent CHECK constraints (drop-then-add so re-runs are safe).
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_contact_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_contact_status_check
  CHECK (contact_status IN ('not_contacted', 'contacted', 'follow_up'));

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_last_call_outcome_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_last_call_outcome_check
  CHECK (last_call_outcome IS NULL OR last_call_outcome IN ('answered', 'no_answer'));

-- Partial index to make the "follow-ups due" board column / dashboard
-- count cheap as the contact list grows.
CREATE INDEX IF NOT EXISTS contacts_follow_up_idx
  ON contacts (account_id, next_follow_up_at)
  WHERE contact_status = 'follow_up';
