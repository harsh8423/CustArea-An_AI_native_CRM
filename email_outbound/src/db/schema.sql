CREATE TABLE IF NOT EXISTS tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_ses_identities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  identity_type   text NOT NULL,       -- 'domain' or 'email'
  identity_value  text NOT NULL,       -- 'companyA.com' or 'support@companyA.com'

  verification_status text NOT NULL,   -- 'PENDING' | 'SUCCESS' | 'FAILED' | 'TEMPORARY_FAILURE'
  dkim_status         text,            -- 'PENDING', 'SUCCESS', etc.
  dkim_tokens         jsonb,           -- ["abc._domainkey.companyA.com", ...] or just tokens

  spf_instructions    text,           -- optional helper text
  last_checked_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, identity_type, identity_value)
);

CREATE TABLE IF NOT EXISTS tenant_allowed_from_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ses_identity_id uuid NOT NULL REFERENCES tenant_ses_identities(id) ON DELETE CASCADE,
  email_address   text NOT NULL,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email_address)
);

CREATE TABLE IF NOT EXISTS outbound_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_email        text NOT NULL,
  from_email      text NOT NULL,
  subject         text NOT NULL,
  body_html       text,
  body_text       text,
  status          text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  ses_message_id  text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
