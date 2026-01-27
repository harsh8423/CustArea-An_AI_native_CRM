-- =====================================================
-- Flexible Email Provider Architecture
-- Run this migration to add multi-provider email support
-- =====================================================

-- 1. Email Providers lookup table (supported providers)
CREATE TABLE IF NOT EXISTS email_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type text UNIQUE NOT NULL,  -- 'ses', 'gmail', 'outlook', 'workspace', 'smtp'
    display_name text NOT NULL,
    description text,
    requires_oauth boolean NOT NULL DEFAULT false,
    requires_domain_verification boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default providers
INSERT INTO email_providers (provider_type, display_name, description, requires_oauth, requires_domain_verification) VALUES
    ('ses', 'Amazon SES', 'AWS Simple Email Service for domain-based email', false, true),
    ('gmail', 'Gmail', 'Personal or business Gmail account via OAuth', true, false),
    ('outlook', 'Outlook', 'Microsoft Outlook/Office 365 via OAuth', true, false),
    ('workspace', 'Google Workspace', 'Google Workspace domain with service account', false, true),
    ('smtp', 'Custom SMTP', 'Custom SMTP server configuration', false, false)
ON CONFLICT (provider_type) DO NOTHING;

-- 2. Tenant Email Connections (per-tenant email account with credentials)
CREATE TABLE IF NOT EXISTS tenant_email_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id uuid NOT NULL REFERENCES email_providers(id),
    provider_type text NOT NULL,           -- denormalized for quick access
    
    -- Connection identity
    email_address text NOT NULL,           -- The email address for this connection
    display_name text,                     -- Optional display name for outbound emails
    
    -- Encrypted credentials (OAuth tokens, API keys, SMTP passwords, etc.)
    credentials_encrypted jsonb,           -- Encrypted JSON with provider-specific credentials
    
    -- OAuth specific (if applicable)
    oauth_scopes text[],                   -- Scopes granted ['gmail.send', 'gmail.readonly']
    oauth_expires_at timestamptz,          -- When access token expires
    
    -- Status
    is_active boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,  -- Default connection for sending
    last_sync_at timestamptz,              -- Last time we synced emails from this connection
    last_error text,                       -- Last error message if connection failed
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, email_address, provider_type)
);

-- 3. Add provider tracking to outbound_emails
ALTER TABLE outbound_emails 
    ADD COLUMN IF NOT EXISTS provider_type text,
    ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES tenant_email_connections(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS provider_message_id text;  -- Provider-specific message ID

-- 4. Add provider tracking to inbound_emails
ALTER TABLE inbound_emails 
    ADD COLUMN IF NOT EXISTS provider_type text,
    ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES tenant_email_connections(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS provider_message_id text;  -- Provider-specific message ID (e.g., Gmail message ID)

-- 5. Migrate existing SES data to new structure
-- Create a 'legacy-ses' connection for existing SES identities
DO $$
DECLARE
    ses_provider_id uuid;
    tenant_record RECORD;
    identity_record RECORD;
BEGIN
    -- Get SES provider ID
    SELECT id INTO ses_provider_id FROM email_providers WHERE provider_type = 'ses';
    
    -- For each tenant with SES identities, create connections
    FOR tenant_record IN 
        SELECT DISTINCT tenant_id FROM tenant_ses_identities WHERE verification_status = 'SUCCESS'
    LOOP
        -- For each verified identity, create a connection
        FOR identity_record IN 
            SELECT * FROM tenant_ses_identities 
            WHERE tenant_id = tenant_record.tenant_id 
            AND verification_status = 'SUCCESS'
        LOOP
            -- Create connection for this identity
            INSERT INTO tenant_email_connections (
                tenant_id,
                provider_id,
                provider_type,
                email_address,
                display_name,
                is_active,
                created_at
            )
            SELECT 
                identity_record.tenant_id,
                ses_provider_id,
                'ses',
                identity_record.identity_value,
                'SES - ' || identity_record.identity_value,
                true,
                identity_record.created_at
            ON CONFLICT (tenant_id, email_address, provider_type) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 6. Update existing outbound_emails to reference SES provider
UPDATE outbound_emails 
SET provider_type = 'ses'
WHERE provider_type IS NULL;

-- 7. Update existing inbound_emails to reference SES provider
UPDATE inbound_emails 
SET provider_type = 'ses'
WHERE provider_type IS NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_connections_tenant ON tenant_email_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_provider ON tenant_email_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_active ON tenant_email_connections(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_email_connections_default ON tenant_email_connections(tenant_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_outbound_provider ON outbound_emails(provider_type);
CREATE INDEX IF NOT EXISTS idx_outbound_connection ON outbound_emails(connection_id);
CREATE INDEX IF NOT EXISTS idx_inbound_provider ON inbound_emails(provider_type);
CREATE INDEX IF NOT EXISTS idx_inbound_connection ON inbound_emails(connection_id);

-- Add updated_at trigger for tenant_email_connections
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenant_email_connections_updated_at 
    BEFORE UPDATE ON tenant_email_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
