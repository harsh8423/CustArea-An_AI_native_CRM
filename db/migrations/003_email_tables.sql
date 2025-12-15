-- =====================================================
-- AWS SES Email Integration Tables
-- Run this migration to add email functionality
-- =====================================================

-- 1. SES Identities (domains/emails verified in SES)
CREATE TABLE IF NOT EXISTS tenant_ses_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    identity_type text NOT NULL,           -- 'domain' or 'email'
    identity_value text NOT NULL,          -- 'companyA.com' or 'support@companyA.com'
    verification_status text NOT NULL DEFAULT 'PENDING',  -- 'PENDING' | 'SUCCESS' | 'FAILED' | 'TEMPORARY_FAILURE'
    dkim_status text,                      -- 'PENDING', 'SUCCESS', etc.
    dkim_tokens jsonb,                     -- ["abc._domainkey.companyA.com", ...] tokens
    spf_instructions text,                 -- optional helper text for SPF
    last_checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, identity_type, identity_value)
);

-- 2. Allowed outbound sender emails per tenant
CREATE TABLE IF NOT EXISTS tenant_allowed_from_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ses_identity_id uuid NOT NULL REFERENCES tenant_ses_identities(id) ON DELETE CASCADE,
    email_address text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email_address)
);

-- 3. Outbound email log (sent emails)
CREATE TABLE IF NOT EXISTS outbound_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    to_email text NOT NULL,
    from_email text NOT NULL,
    subject text NOT NULL,
    body_html text,
    body_text text,
    status text NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'failed'
    ses_message_id text,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Inbound emails (received via SES)
CREATE TABLE IF NOT EXISTS inbound_emails (
    id bigserial PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mailbox_key text,                      -- optional mailbox identifier
    inbound_address text NOT NULL,         -- the address that received the email
    raw_message_id text,                   -- SES raw message ID
    s3_key text,                           -- S3 key if storing raw email
    from_json jsonb,                       -- {email, name} of sender
    to_json jsonb,                         -- [{email, name}] recipients
    cc_json jsonb,
    bcc_json jsonb,
    subject text,
    text_body text,
    html_body text,
    ses_metadata jsonb,                    -- any additional SES metadata
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Inbound email attachments
CREATE TABLE IF NOT EXISTS inbound_attachments (
    id bigserial PRIMARY KEY,
    email_id bigint NOT NULL REFERENCES inbound_emails(id) ON DELETE CASCADE,
    filename text,
    content_type text,
    size int,
    cid text,                              -- content-id for inline attachments
    s3_key text,                           -- S3 key for the attachment
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Allowed inbound emails (emails that can forward to tenant)
CREATE TABLE IF NOT EXISTS allowed_inbound_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_address text NOT NULL,           -- e.g. support@tenant-domain.com
    description text,                      -- optional description/label
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email_address)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ses_identities_tenant ON tenant_ses_identities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_allowed_from_tenant ON tenant_allowed_from_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbound_tenant ON outbound_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbound_status ON outbound_emails(status);
CREATE INDEX IF NOT EXISTS idx_inbound_tenant ON inbound_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_address ON inbound_emails(inbound_address);
CREATE INDEX IF NOT EXISTS idx_inbound_attachments_email ON inbound_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_allowed_inbound_tenant ON allowed_inbound_emails(tenant_id);
