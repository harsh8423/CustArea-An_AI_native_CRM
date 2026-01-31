-- =====================================================
-- MIGRATION: Voice Agents and Phone Number Provisioning
-- Date: 2026-01-30
-- Description: 
--   1. Create tenants_allowed_phones table for phone number management
--   2. Modify tenant_phone_config to remove twiml_app_sid and add voice agent fields
--   3. Add foreign key constraint for phone numbers
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Create tenants_allowed_phones Table
-- =====================================================

CREATE TABLE IF NOT EXISTS tenants_allowed_phones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number text NOT NULL UNIQUE,
    country_code text NOT NULL,              -- e.g., 'US', 'GB', 'IN'
    country_name text NOT NULL,              -- e.g., 'United States', 'India'
    phone_type text NOT NULL,                -- 'local' | 'toll-free'
    monthly_cost numeric(10, 2),             -- Cost per month in USD
    is_granted boolean NOT NULL DEFAULT false,
    requested_at timestamptz NOT NULL DEFAULT now(),
    granted_at timestamptz,
    granted_by uuid REFERENCES users(id) ON DELETE SET NULL,  -- Admin who granted
    notes text,                              -- Admin notes
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_phone_type CHECK (phone_type IN ('local', 'toll-free'))
);

CREATE INDEX IF NOT EXISTS idx_allowed_phones_tenant ON tenants_allowed_phones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_allowed_phones_granted ON tenants_allowed_phones(is_granted);
CREATE INDEX IF NOT EXISTS idx_allowed_phones_number ON tenants_allowed_phones(phone_number);

COMMENT ON TABLE tenants_allowed_phones IS 'Phone numbers available to tenants (requested and granted)';
COMMENT ON COLUMN tenants_allowed_phones.is_granted IS 'Whether the phone number request has been approved by admin';
COMMENT ON COLUMN tenants_allowed_phones.monthly_cost IS 'Monthly cost in USD for this phone number';

-- =====================================================
-- STEP 2: Modify tenant_phone_config Table
-- =====================================================

-- Remove twiml_app_sid (moved to .env)
ALTER TABLE tenant_phone_config 
DROP COLUMN IF EXISTS twiml_app_sid;

-- Add voice agent identification fields
ALTER TABLE tenant_phone_config 
ADD COLUMN IF NOT EXISTS voice_agent_name text NOT NULL DEFAULT 'Default Agent',
ADD COLUMN IF NOT EXISTS welcome_message text,
ADD COLUMN IF NOT EXISTS agent_instructions text;

-- Update comments
COMMENT ON COLUMN tenant_phone_config.voice_agent_name IS 'Display name for this voice agent';
COMMENT ON COLUMN tenant_phone_config.welcome_message IS 'Custom welcome message when call starts';
COMMENT ON COLUMN tenant_phone_config.agent_instructions IS 'Custom instructions for AI agent';

-- Add check constraint to ensure phone_number exists in tenants_allowed_phones
-- Note: This will be added after ensuring data consistency

-- =====================================================
-- STEP 3: Create Trigger for updated_at
-- =====================================================

-- Ensure trigger function exists (from previous migration)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenants_allowed_phones_updated_at ON tenants_allowed_phones;
CREATE TRIGGER update_tenants_allowed_phones_updated_at 
    BEFORE UPDATE ON tenants_allowed_phones 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 4: Seed Sample Phone Pricing Data (for reference)
-- =====================================================

-- Create a pricing reference table for common countries
CREATE TABLE IF NOT EXISTS x_phone_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code text NOT NULL UNIQUE,
    country_name text NOT NULL,
    local_monthly_cost numeric(10, 2),       -- Cost for local number
    tollfree_monthly_cost numeric(10, 2),    -- Cost for toll-free number
    setup_fee numeric(10, 2) DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_pricing_country ON x_phone_pricing(country_code);
CREATE INDEX IF NOT EXISTS idx_phone_pricing_active ON x_phone_pricing(is_active);

COMMENT ON TABLE x_phone_pricing IS 'Reference pricing for phone numbers by country';

-- Insert sample pricing for common countries (based on Twilio pricing)
INSERT INTO x_phone_pricing (country_code, country_name, local_monthly_cost, tollfree_monthly_cost) VALUES
    ('US', 'United States', 1.15, 2.00),
    ('GB', 'United Kingdom', 1.15, 4.25),
    ('CA', 'Canada', 1.00, 2.00),
    ('AU', 'Australia', 2.00, 15.00),
    ('IN', 'India', 2.00, NULL),
    ('DE', 'Germany', 1.25, 4.25),
    ('FR', 'France', 1.25, 4.25),
    ('JP', 'Japan', 8.00, NULL),
    ('SG', 'Singapore', 6.00, NULL),
    ('NL', 'Netherlands', 2.50, NULL)
ON CONFLICT (country_code) DO NOTHING;

DROP TRIGGER IF EXISTS update_x_phone_pricing_updated_at ON x_phone_pricing;
CREATE TRIGGER update_x_phone_pricing_updated_at 
    BEFORE UPDATE ON x_phone_pricing 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after migration to verify:

-- Check new tables
-- SELECT * FROM tenants_allowed_phones;
-- SELECT * FROM x_phone_pricing;

-- Check tenant_phone_config modifications
-- \d tenant_phone_config

-- Check available phone numbers for a tenant
-- SELECT * FROM tenants_allowed_phones WHERE tenant_id = 'YOUR_TENANT_ID' AND is_granted = true;

-- Check pricing for a country
-- SELECT * FROM x_phone_pricing WHERE country_code = 'US';
