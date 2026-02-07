-- =====================================================
-- FIX: Analytics Metrics - Add Missing Campaign Columns
-- =====================================================
-- Issue: Triggers trying to increment non-existent columns:
--   - campaign_emails_received
-- Solution: Add missing columns to analytics_metrics table
-- =====================================================

BEGIN;

-- Add missing campaign-related columns to analytics_metrics
ALTER TABLE analytics_metrics 
ADD COLUMN IF NOT EXISTS campaign_emails_received INTEGER DEFAULT 0;

COMMENT ON COLUMN analytics_metrics.campaign_emails_received IS 'Number of emails received in campaign conversations';

-- Index for campaign metrics
CREATE INDEX IF NOT EXISTS idx_analytics_campaign_metrics 
    ON analytics_metrics(tenant_id, user_id, campaign_emails_sent, campaign_emails_received) 
    WHERE campaign_emails_sent > 0 OR campaign_emails_received > 0;

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '=====================================================';\r
    RAISE NOTICE 'Analytics Metrics Schema Updated';\r
    RAISE NOTICE '=====================================================';\r
    RAISE NOTICE '';\r
    RAISE NOTICE 'Added missing columns:';\r
    RAISE NOTICE '  ✓ campaign_emails_received';\r
    RAISE NOTICE '';\r
    RAISE NOTICE 'Lambda function will now work correctly.';\r
    RAISE NOTICE '=====================================================';\r
END $$;
