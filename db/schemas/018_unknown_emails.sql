-- =====================================================
-- CustArea CRM - Unknown Emails Table
-- Migration: 018_unknown_emails.sql
-- =====================================================

CREATE TABLE unknown_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inbound_address text,
    from_address text,
    subject text,
    text_body text,
    html_body text,
    raw_message_id text,
    s3_key text,
    reason text, -- 'tenant_not_found', 'forwarder_not_allowed', etc.
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unknown_emails_created_at ON unknown_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unknown_emails_inbound ON unknown_emails(inbound_address);

COMMENT ON TABLE unknown_emails IS 'Stores inbound emails that could not be linked to a valid tenant or authorized forwarder';
