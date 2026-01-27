-- =====================================================
-- Gmail & Outlook OAuth Integration Migration
-- Run this in Supabase SQL Editor
-- This script is idempotent (safe to run multiple times)
-- =====================================================

-- ==================== STEP 1: Fix Credentials Column Type ====================
-- Change credentials_encrypted from JSONB to TEXT (needed for encrypted strings)

DO $$ 
BEGIN
    -- Check if column exists and is JSONB type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_email_connections' 
        AND column_name = 'credentials_encrypted'
        AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE tenant_email_connections 
        ALTER COLUMN credentials_encrypted TYPE TEXT;
        
        RAISE NOTICE '✅ Changed credentials_encrypted column type from JSONB to TEXT';
    ELSE
        RAISE NOTICE '✓ credentials_encrypted column already correct type or doesn''t exist';
    END IF;
END $$;

-- ==================== STEP 2: Verify Email Providers Table ====================

-- Create email_providers table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type text UNIQUE NOT NULL,
    display_name text NOT NULL,
    description text,
    requires_oauth boolean NOT NULL DEFAULT false,
    requires_domain_verification boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert required providers (Gmail, Outlook, SES)
INSERT INTO email_providers (provider_type, display_name, description, requires_oauth, requires_domain_verification) VALUES
    ('gmail', 'Gmail', 'Personal or business Gmail account via OAuth', true, false),
    ('outlook', 'Outlook', 'Microsoft Outlook/Office 365 via OAuth', true, false),
    ('ses', 'Amazon SES', 'AWS Simple Email Service for domain-based email', false, true)
ON CONFLICT (provider_type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    requires_oauth = EXCLUDED.requires_oauth,
    requires_domain_verification = EXCLUDED.requires_domain_verification;

-- ==================== STEP 3: Verify Tenant Email Connections Table ====================

CREATE TABLE IF NOT EXISTS tenant_email_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id uuid NOT NULL REFERENCES email_providers(id),
    provider_type text NOT NULL,
    
    -- Connection identity
    email_address text NOT NULL,
    display_name text,
    
    -- Encrypted credentials (OAuth tokens, API keys, etc.)
    credentials_encrypted text,  -- ✅ TEXT not JSONB for encrypted strings
    
    -- OAuth specific
    oauth_scopes text[],
    oauth_expires_at timestamptz,
    
    -- Status
    is_active boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,
    last_sync_at timestamptz,
    last_error text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, email_address, provider_type)
);

-- ==================== STEP 4: Create Indexes ====================

CREATE INDEX IF NOT EXISTS idx_email_connections_tenant 
    ON tenant_email_connections(tenant_id);

CREATE INDEX IF NOT EXISTS idx_email_connections_provider 
    ON tenant_email_connections(provider_id);

CREATE INDEX IF NOT EXISTS idx_email_connections_active 
    ON tenant_email_connections(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_email_connections_default 
    ON tenant_email_connections(tenant_id, is_default) 
    WHERE is_default = true;

-- ==================== STEP 5: Create/Update Triggers ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for tenant_email_connections
DROP TRIGGER IF EXISTS update_tenant_email_connections_updated_at ON tenant_email_connections;

CREATE TRIGGER update_tenant_email_connections_updated_at 
    BEFORE UPDATE ON tenant_email_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== STEP 6: Add Provider Tracking to Email Tables ====================

-- Add columns to outbound_emails if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'outbound_emails' AND column_name = 'provider_type'
    ) THEN
        ALTER TABLE outbound_emails 
            ADD COLUMN provider_type text,
            ADD COLUMN connection_id uuid REFERENCES tenant_email_connections(id) ON DELETE SET NULL,
            ADD COLUMN provider_message_id text;
        
        RAISE NOTICE '✅ Added provider columns to outbound_emails';
    ELSE
        RAISE NOTICE '✓ outbound_emails already has provider columns';
    END IF;
END $$;

-- Add columns to inbound_emails if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inbound_emails' AND column_name = 'provider_type'
    ) THEN
        ALTER TABLE inbound_emails 
            ADD COLUMN provider_type text,
            ADD COLUMN connection_id uuid REFERENCES tenant_email_connections(id) ON DELETE SET NULL,
            ADD COLUMN provider_message_id text;
        
        RAISE NOTICE '✅ Added provider columns to inbound_emails';
    ELSE
        RAISE NOTICE '✓ inbound_emails already has provider columns';
    END IF;
END $$;

-- ==================== VERIFICATION ====================

-- Show results
SELECT 
    '🎉 Migration Complete!' as status,
    (SELECT COUNT(*) FROM email_providers WHERE provider_type IN ('gmail', 'outlook')) as providers_ready,
    (SELECT data_type FROM information_schema.columns 
     WHERE table_name = 'tenant_email_connections' 
     AND column_name = 'credentials_encrypted') as credentials_type,
    (SELECT COUNT(*) FROM tenant_email_connections) as existing_connections;

-- Show available providers
SELECT 
    provider_type,
    display_name,
    requires_oauth,
    is_active
FROM email_providers
ORDER BY provider_type;

-- ==================== SUCCESS MESSAGE ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ Gmail & Outlook OAuth Integration Migration Complete!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Add environment variables to your backend:';
    RAISE NOTICE '   - GOOGLE_OAUTH_CLIENT_ID';
    RAISE NOTICE '   - GOOGLE_OAUTH_CLIENT_SECRET';
    RAISE NOTICE '   - MICROSOFT_OAUTH_CLIENT_ID';
    RAISE NOTICE '   - MICROSOFT_OAUTH_CLIENT_SECRET';
    RAISE NOTICE '';
    RAISE NOTICE '2. Restart your backend server';
    RAISE NOTICE '3. Go to Settings → Email to connect accounts';
    RAISE NOTICE '';
END $$;
