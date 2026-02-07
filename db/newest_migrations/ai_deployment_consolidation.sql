-- =====================================================
-- AI Deployment Consolidation Migration
-- Created: 2026-02-05
-- Description: Adds tenant-level phone feature flag and prepares 
--              for deprecation of channel-based AI deployments
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Add Phone Feature Toggle at Tenant Level
-- =====================================================

-- Add is_phone_enabled column to tenant_phone_config
-- This allows disabling phone features entirely at tenant level
ALTER TABLE tenant_phone_config 
ADD COLUMN IF NOT EXISTS is_phone_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN tenant_phone_config.is_phone_enabled 
IS 'Master switch for phone calling feature at tenant level - must be true for AI phone deployments to work';

-- Create index for quick feature checks
CREATE INDEX IF NOT EXISTS idx_phone_config_tenant_enabled 
ON tenant_phone_config(tenant_id, is_phone_enabled) 
WHERE is_phone_enabled = true;

-- =====================================================
-- STEP 2: Ensure ai_deployment_resources indexes exist
-- =====================================================

-- These may already exist from schema 07, but ensuring they're present
CREATE INDEX IF NOT EXISTS idx_ai_deployment_resources_tenant 
ON ai_deployment_resources(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_deployment_resources_channel 
ON ai_deployment_resources(tenant_id, channel);

CREATE INDEX IF NOT EXISTS idx_ai_deployment_resources_enabled 
ON ai_deployment_resources(is_enabled) 
WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_ai_deployment_resources_inbound_email 
ON ai_deployment_resources(allowed_inbound_email_id) 
WHERE allowed_inbound_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_deployment_resources_phone 
ON ai_deployment_resources(phone_config_id) 
WHERE phone_config_id IS NOT NULL;

-- =====================================================
-- STEP 3: Mark old ai_agent_deployments as deprecated
-- =====================================================

-- Add deprecation notice comment
COMMENT ON TABLE ai_agent_deployments 
IS 'DEPRECATED: Use ai_deployment_resources instead. This table uses channel-level deployment which has been replaced by resource-specific deployment.';

-- =====================================================
-- STEP 4: Helper function for email-based AI check
-- =====================================================

-- Function to check if AI is enabled for a specific inbound email
CREATE OR REPLACE FUNCTION check_ai_enabled_for_email(
    p_tenant_id UUID,
    p_inbound_email TEXT
)
RETURNS TABLE (
    is_ai_enabled BOOLEAN,
    deployment_id UUID,
    welcome_message TEXT,
    handoff_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        adr.is_enabled,
        adr.id,
        adr.welcome_message,
        adr.handoff_message
    FROM ai_deployment_resources adr
    JOIN allowed_inbound_emails aie ON aie.id = adr.allowed_inbound_email_id
    WHERE aie.tenant_id = p_tenant_id
      AND aie.email_address = p_inbound_email
      AND adr.channel = 'email'
      AND aie.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_ai_enabled_for_email(UUID, TEXT) 
IS 'Helper function to check if AI deployment is enabled for a specific inbound email address';

-- =====================================================
-- STEP 5: Helper function for phone-based AI check
-- =====================================================

-- Function to check if AI is enabled for a specific phone number
CREATE OR REPLACE FUNCTION check_ai_enabled_for_phone(
    p_tenant_id UUID,
    p_phone_number TEXT
)
RETURNS TABLE (
    is_phone_feature_enabled BOOLEAN,
    is_ai_enabled BOOLEAN,
    deployment_id UUID,
    welcome_message TEXT,
    agent_instructions TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tpc.is_phone_enabled,
        COALESCE(adr.is_enabled, false),
        adr.id,
        adr.welcome_message,
        tpc.agent_instructions
    FROM tenant_phone_config tpc
    LEFT JOIN ai_deployment_resources adr 
        ON adr.phone_config_id = tpc.id 
        AND adr.channel = 'phone'
    WHERE tpc.tenant_id = p_tenant_id
      AND tpc.phone_number = p_phone_number
      AND tpc.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_ai_enabled_for_phone(UUID, TEXT)
IS 'Helper function to check if phone feature AND AI deployment are both enabled for a specific phone number';

-- =====================================================
-- STEP 6: Update existing phone configs
-- =====================================================



-- Set is_phone_enabled to true for all existing active phone configs
UPDATE tenant_phone_config 
SET is_phone_enabled = true 
WHERE is_active = true 
  AND is_phone_enabled IS NULL;

-- =====================================================
-- STEP 7: Fix Tenant Phone Config Schema
-- =====================================================

-- Remove UNIQUE constraint from tenant_id to allow multiple agents per tenant
ALTER TABLE tenant_phone_config DROP CONSTRAINT IF EXISTS tenant_phone_config_tenant_id_key;

-- Add assigned_user_id for RBAC
ALTER TABLE tenant_phone_config ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- VERIFICATION QUERIES (for manual testing)
-- =====================================================

-- Uncomment these to test after migration:

-- Test email AI check:
-- SELECT * FROM check_ai_enabled_for_email(
--     'your-tenant-id'::uuid, 
--     'support@company.com'
-- );

-- Test phone AI check:
-- SELECT * FROM check_ai_enabled_for_phone(
--     'your-tenant-id'::uuid, 
--     '+1-555-0100'
-- );

-- =====================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- =====================================================

-- To rollback this migration:
-- 1. DROP FUNCTION check_ai_enabled_for_email(UUID, TEXT);
-- 2. DROP FUNCTION check_ai_enabled_for_phone(UUID, TEXT);
-- 3. ALTER TABLE tenant_phone_config DROP COLUMN is_phone_enabled;
-- 4. Re-run previous migration if indexes were modified

COMMIT;

-- Migration completed successfully
DO $$
BEGIN
    RAISE NOTICE '✓ AI Deployment Consolidation Migration completed';
    RAISE NOTICE '  - Added is_phone_enabled to tenant_phone_config';
    RAISE NOTICE '  - Created helper functions for AI enablement checks';
    RAISE NOTICE '  - Marked ai_agent_deployments as deprecated';
END $$;
