-- =====================================================
-- FRESH START MIGRATION - Database Cleanup & Consolidation
-- =====================================================
-- This migration:
-- 1. Deletes ALL data except features & workflow_node_definitions
-- 2. Removes redundant/duplicate tables
-- 3. Consolidates email provider architecture
-- 4. Ensures clean schema for fresh start
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: DELETE ALL DATA (except specified tables)
-- =====================================================

-- Delete in correct order (respecting foreign keys)
TRUNCATE TABLE ticket_tag_assignments CASCADE;
TRUNCATE TABLE ticket_tags CASCADE;
TRUNCATE TABLE ticket_notes CASCADE;
TRUNCATE TABLE ticket_macros CASCADE;
TRUNCATE TABLE ticket_activities CASCADE;
TRUNCATE TABLE tickets CASCADE;

TRUNCATE TABLE attachments CASCADE;
TRUNCATE TABLE message_phone_metadata CASCADE;
TRUNCATE TABLE message_widget_metadata CASCADE;
TRUNCATE TABLE message_whatsapp_metadata CASCADE;
TRUNCATE TABLE message_email_metadata CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE conversations CASCADE;

TRUNCATE TABLE widget_visitors CASCADE;
TRUNCATE TABLE contact_merge_history CASCADE;
TRUNCATE TABLE contact_identifiers CASCADE;
TRUNCATE TABLE contacts CASCADE;

TRUNCATE TABLE lead_assignments CASCADE;
TRUNCATE TABLE accounts CASCADE;
TRUNCATE TABLE leads CASCADE;

-- ⚠️ PRESERVE workflow_node_definitions - contains hardcoded workflow nodes
-- ⚠️ PRESERVE features - contains feature flags configuration
TRUNCATE TABLE workflow_executions CASCADE;
TRUNCATE TABLE workflow_step_logs CASCADE;
TRUNCATE TABLE workflow_triggers CASCADE;
TRUNCATE TABLE workflows CASCADE;
-- DO NOT TRUNCATE: workflow_node_definitions

-- Phone call data
TRUNCATE TABLE phone_calls CASCADE;
TRUNCATE TABLE twilio_call_logs CASCADE;

-- Import history
TRUNCATE TABLE import_results CASCADE;
TRUNCATE TABLE imports CASCADE;

-- Email-related data (LEGACY TABLES - will be deprecated)
TRUNCATE TABLE inbound_attachments CASCADE;
TRUNCATE TABLE inbound_emails CASCADE;
TRUNCATE TABLE outbound_emails CASCADE;
TRUNCATE TABLE tenant_allowed_from_emails CASCADE;
TRUNCATE TABLE allowed_inbound_emails CASCADE;
TRUNCATE TABLE tenant_ses_identities CASCADE;

-- Email provider connections (NEW SYSTEM)
TRUNCATE TABLE tenant_email_connections CASCADE;

-- Channel configurations
TRUNCATE TABLE tenant_whatsapp_accounts CASCADE;
TRUNCATE TABLE tenant_widget_config CASCADE;
TRUNCATE TABLE tenant_phone_config CASCADE;

-- Pipeline data
TRUNCATE TABLE pipeline_stages CASCADE;
TRUNCATE TABLE pipelines CASCADE;

-- AI/Agent data
TRUNCATE TABLE agent_deployments CASCADE;

-- Tenant settings
TRUNCATE TABLE tenant_settings CASCADE;

-- Users
TRUNCATE TABLE users CASCADE;

-- Tenants (this will cascade to everything)
-- DO NOT TRUNCATE: features table
TRUNCATE TABLE tenants CASCADE;

RAISE NOTICE '✅ All data deleted (except features and workflow_node_definitions)';

-- =====================================================
-- STEP 2: DROP REDUNDANT/DUPLICATE TABLES
-- =====================================================

-- Drop setup_gmail_tables.sql redundant structures (superseded by 004_flexible_email_providers.sql)
-- The email_providers table stays (it's part of the consolidated system)
-- tenant_email_connections stays (it's the main connection table)

-- Drop 007_fix_credentials_column_type.sql (redundant with 008_gmail_outlook_oauth_integration.sql)
-- No tables to drop, just fixes column type which is already in 008

-- Mark LEGACY email tables as deprecated (DO NOT DROP - keep for reference)
COMMENT ON TABLE inbound_emails IS 'DEPRECATED: Use messages table + message_email_metadata instead. Kept for historical reference only.';
COMMENT ON TABLE outbound_emails IS 'DEPRECATED: Use messages table + message_email_metadata instead. Kept for historical reference only.';
COMMENT ON TABLE inbound_attachments IS 'DEPRECATED: Use attachments table instead. Kept for historical reference only.';
COMMENT ON TABLE tenant_ses_identities IS 'SES-specific table. Used by emailController.js for domain verification.';
COMMENT ON TABLE tenant_allowed_from_emails IS 'SES-specific table. Used by emailController.js for allowed sender addresses.';
COMMENT ON TABLE allowed_inbound_emails IS 'SES-specific table. Used by emailController.js for inbound routing.';

RAISE NOTICE '✅ Legacy email tables marked as deprecated';

-- =====================================================
-- STEP 3: SCHEMA IMPROVEMENTS FOR CONVERSATION SYSTEM
-- =====================================================

-- Add sender information fields to conversations table
-- These fields allow displaying unknown senders without creating contacts
DO $$
BEGIN
    -- Add sender_display_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'sender_display_name'
    ) THEN
        ALTER TABLE conversations ADD COLUMN sender_display_name text;
        RAISE NOTICE '✅ Added sender_display_name to conversations';
    END IF;

    -- Add sender_identifier_type if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'sender_identifier_type'
    ) THEN
        ALTER TABLE conversations ADD COLUMN sender_identifier_type text;
        COMMENT ON COLUMN conversations.sender_identifier_type IS 'Type of identifier: email, phone, whatsapp, visitor_id';
        RAISE NOTICE '✅ Added sender_identifier_type to conversations';
    END IF;

    -- Add sender_identifier_value if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'sender_identifier_value'
    ) THEN
        ALTER TABLE conversations ADD COLUMN sender_identifier_value text;
        COMMENT ON COLUMN conversations.sender_identifier_value IS 'Actual identifier value (email address, phone number, etc)';
        RAISE NOTICE '✅ Added sender_identifier_value to conversations';
    END IF;
END $$;

-- Create index for quick sender lookups
CREATE INDEX IF NOT EXISTS idx_conversations_sender_identifier 
    ON conversations(tenant_id, sender_identifier_type, sender_identifier_value);

RAISE NOTICE '✅ Conversation schema improvements applied';

-- =====================================================
-- STEP 4: ENSURE EMAIL PROVIDER CONSOLIDATION
-- =====================================================

-- Ensure email_providers table has all providers
INSERT INTO email_providers (provider_type, display_name, description, requires_oauth, requires_domain_verification) VALUES
    ('ses', 'Amazon SES', 'AWS Simple Email Service for domain-based email', false, true),
    ('gmail', 'Gmail', 'Personal or business Gmail account via OAuth', true, false),
    ('outlook', 'Outlook', 'Microsoft Outlook/Office 365 via OAuth', true, false),
    ('workspace', 'Google Workspace', 'Google Workspace domain with service account', false, true),
    ('smtp', 'Custom SMTP', 'Custom SMTP server configuration', false, false)
ON CONFLICT (provider_type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    requires_oauth = EXCLUDED.requires_oauth,
    requires_domain_verification = EXCLUDED.requires_domain_verification;

RAISE NOTICE '✅ Email providers consolidated';

-- =====================================================
-- STEP 5: VERIFY CRITICAL TABLES EXIST
-- =====================================================

-- Verify features table exists (should be preserved)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'features') THEN
        RAISE EXCEPTION 'CRITICAL: features table does not exist!';
    END IF;
    RAISE NOTICE '✅ Features table verified';
END $$;

-- Verify workflow_node_definitions table exists (should be preserved)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workflow_node_definitions') THEN
        RAISE EXCEPTION 'CRITICAL: workflow_node_definitions table does not exist!';
    END IF;
    RAISE NOTICE '✅ workflow_node_definitions table verified';
END $$;

-- =====================================================
-- STEP 6: CLEANUP FILE NOTES
-- =====================================================

-- Files to REMOVE (now redundant):
-- ❌ db/setup_gmail_tables.sql - Redundant with 004_flexible_email_providers.sql
-- ❌ db/migrations/007_fix_credentials_column_type.sql - Redundant with 008_gmail_outlook_oauth_integration.sql (lines 10-26)

-- Files to KEEP:
-- ✅ db/schema.sql - Base schema
-- ✅ db/migrations/003_email_tables.sql - Creates SES tables (tenant_ses_identities, etc)
-- ✅ db/migrations/004_flexible_email_providers.sql - Multi-provider architecture
-- ✅ db/migrations/004_omnichannel_conversations.sql - Core conversation system
-- ✅ db/migrations/006_contact_identifiers.sql - Contact deduplication
-- ✅ db/migrations/008_gmail_outlook_oauth_integration.sql - OAuth providers setup
-- ✅ db/migrations/010_support_tickets.sql - Ticket system
-- ✅ db/migrations/011_workflows.sql - Workflow system

-- =====================================================
-- STEP 7: SUMMARY
-- =====================================================

DO $$
DECLARE
    feature_count int;
    workflow_node_count int;
BEGIN
    -- Count preserved data
    SELECT COUNT(*) INTO feature_count FROM features;
    SELECT COUNT(*) INTO workflow_node_count FROM workflow_node_definitions;

    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ FRESH START MIGRATION COMPLETE!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Data Preserved:';
    RAISE NOTICE '  • features: % rows', feature_count;
    RAISE NOTICE '  • workflow_node_definitions: % rows', workflow_node_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Schema Improvements:';
    RAISE NOTICE '  • Added sender_* fields to conversations table';
    RAISE NOTICE '  • Marked legacy email tables as deprecated';
    RAISE NOTICE '  • Consolidated email provider architecture';
    RAISE NOTICE '';
    RAISE NOTICE 'Legacy Tables (Deprecated but Kept):';
    RAISE NOTICE '  • inbound_emails → Use: messages + message_email_metadata';
    RAISE NOTICE '  • outbound_emails → Use: messages + message_email_metadata';
    RAISE NOTICE '  • inbound_attachments → Use: attachments';
    RAISE NOTICE '';
    RAISE NOTICE 'SES Tables (Still Active):';
    RAISE NOTICE '  • tenant_ses_identities - Domain verification';
    RAISE NOTICE '  • tenant_allowed_from_emails - Sender addresses';
    RAISE NOTICE '  • allowed_inbound_emails - Inbound routing';
    RAISE NOTICE '';
    RAISE NOTICE 'Files to Remove Manually:';
    RAISE NOTICE '  ❌ db/setup_gmail_tables.sql';
    RAISE NOTICE '  ❌ db/migrations/007_fix_credentials_column_type.sql';
    RAISE NOTICE '';
    RAISE NOTICE 'Database is now clean and ready for fresh start! 🎉';
    RAISE NOTICE '';
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =====================================================

-- Run these queries after migration to verify:

-- Check preserved data
SELECT 'features' as table_name, COUNT(*) as row_count FROM features
UNION ALL
SELECT 'workflow_node_definitions', COUNT(*) FROM workflow_node_definitions;

-- Check all other tables are empty
SELECT 'tenants' as table_name, COUNT(*) as row_count FROM tenants
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'leads', COUNT(*) FROM leads
UNION ALL
SELECT 'tickets', COUNT(*) FROM tickets;

-- Verify email providers are set up
SELECT * FROM email_providers ORDER BY provider_type;
