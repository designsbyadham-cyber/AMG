-- Opt-in / consent tracking and WhatsApp OTP support.
-- Applied directly to the DB on 2026-06-22; this file reconstructs
-- that migration so the local folder stays in sync.

-- ── Opt-in columns on contacts ──────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS opt_in_status      TEXT,
  ADD COLUMN IF NOT EXISTS opt_in_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_in_source      TEXT;

-- ── consent_audit_log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_audit_log (
  id              UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  actor_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  previous_status TEXT,
  new_status      TEXT,
  metadata        JSONB       DEFAULT '{}'::jsonb,
  phone_number_id TEXT,
  waba_id         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE consent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_consent_audit_log_account_id
  ON consent_audit_log (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_audit_log_contact_id
  ON consent_audit_log (contact_id)
  WHERE contact_id IS NOT NULL;

CREATE POLICY "Account members can view consent audit log"
  ON consent_audit_log FOR SELECT
  USING (
    account_id IN (
      SELECT profiles.account_id FROM profiles WHERE profiles.user_id = auth.uid()
    )
  );

-- ── whatsapp_otp ────────────────────────────────────────────────
-- Server-side only (service role); RLS enabled with no SELECT policy
-- so anon/authenticated roles cannot read OTP hashes directly.
CREATE TABLE IF NOT EXISTS whatsapp_otp (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone       TEXT        NOT NULL,
  hashed_code TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_otp ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS whatsapp_otp_phone_idx ON whatsapp_otp (phone);
