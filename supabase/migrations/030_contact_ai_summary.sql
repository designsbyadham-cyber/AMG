-- Cache for the AI-generated customer summary.
--
-- The free-tier model budget is shared across the whole account, so
-- re-opening a customer must not spend a request. The summary is
-- regenerated only when someone asks for it explicitly; `ai_summary_at`
-- lets the UI show how stale it is.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ai_summary    TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_at TIMESTAMPTZ;
