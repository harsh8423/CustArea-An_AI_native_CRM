-- =====================================================
-- FIX: Analytics Metrics - Proper UNIQUE Constraint for NULL user_id
-- =====================================================
-- Issue: UNIQUE constraint allows multiple NULLs, creating duplicate rows
-- PostgreSQL treats NULL as unique, so UNIQUE(tenant, user, date, period)
-- allows infinite rows where user_id IS NULL
-- 
-- Solution: Replace with partial unique indexes that handle NULLs properly
-- =====================================================

BEGIN;

-- Drop the old constraint that doesn't handle NULLs properly
ALTER TABLE analytics_metrics 
DROP CONSTRAINT IF EXISTS unique_metric_record;

-- FIRST: Clean up existing duplicates by consolidating them
-- (Must happen BEFORE creating unique indexes!)
-- This merges all duplicate rows into one with summed values
WITH duplicates AS (
    SELECT 
        tenant_id,
        user_id,
        metric_date,
        metric_period,
        (array_agg(id ORDER BY created_at))[1] as keep_id,
        SUM(emails_sent_total) as sum_emails_sent_total,
        SUM(emails_sent_by_ai) as sum_emails_sent_by_ai,
        SUM(emails_sent_by_human) as sum_emails_sent_by_human,
        SUM(emails_received) as sum_emails_received,
        SUM(campaign_emails_sent) as sum_campaign_emails_sent,
        SUM(campaign_emails_received) as sum_campaign_emails_received,
        SUM(campaigns_created) as sum_campaigns_created,
        SUM(campaigns_launched) as sum_campaigns_launched,
        SUM(campaigns_paused) as sum_campaigns_paused,
        SUM(calls_total) as sum_calls_total,
        SUM(calls_by_ai) as sum_calls_by_ai,
        SUM(calls_by_human) as sum_calls_by_human,
        SUM(leads_created) as sum_leads_created,
        SUM(contacts_created) as sum_contacts_created,
        SUM(tickets_created) as sum_tickets_created,
        SUM(tickets_resolved) as sum_tickets_resolved,
        SUM(messages_sent) as sum_messages_sent,
        COUNT(*) as duplicate_count
    FROM analytics_metrics
    GROUP BY tenant_id, user_id, metric_date, metric_period
    HAVING COUNT(*) > 1
)
UPDATE analytics_metrics a
SET 
    emails_sent_total = d.sum_emails_sent_total,
    emails_sent_by_ai = d.sum_emails_sent_by_ai,
    emails_sent_by_human = d.sum_emails_sent_by_human,
    emails_received = d.sum_emails_received,
    campaign_emails_sent = d.sum_campaign_emails_sent,
    campaign_emails_received = d.sum_campaign_emails_received,
    campaigns_created = d.sum_campaigns_created,
    campaigns_launched = d.sum_campaigns_launched,
    campaigns_paused = d.sum_campaigns_paused,
    calls_total = d.sum_calls_total,
    calls_by_ai = d.sum_calls_by_ai,
    calls_by_human = d.sum_calls_by_human,
    leads_created = d.sum_leads_created,
    contacts_created = d.sum_contacts_created,
    tickets_created = d.sum_tickets_created,
    tickets_resolved = d.sum_tickets_resolved,
    messages_sent = d.sum_messages_sent,
    updated_at = now()
FROM duplicates d
WHERE a.id = d.keep_id;

-- Delete the duplicate rows (keep only the one we just updated)
DELETE FROM analytics_metrics a
USING (
    SELECT 
        tenant_id,
        user_id,
        metric_date,
        metric_period,
        (array_agg(id ORDER BY created_at))[1] as keep_id
    FROM analytics_metrics
    GROUP BY tenant_id, user_id, metric_date, metric_period
    HAVING COUNT(*) > 1
) d
WHERE a.tenant_id = d.tenant_id
  AND a.user_id IS NOT DISTINCT FROM d.user_id
  AND a.metric_date = d.metric_date
  AND a.metric_period = d.metric_period
  AND a.id != d.keep_id;

-- NOW: Create TWO separate unique indexes to prevent future duplicates
-- 1. For rows WITH user_id (normal unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique_with_user
ON analytics_metrics(tenant_id, user_id, metric_date, metric_period)
WHERE user_id IS NOT NULL;

-- 2. For rows WITHOUT user_id (NULL-safe unique constraint)
-- This prevents multiple NULL user_id rows for same tenant/date/period
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique_without_user
ON analytics_metrics(tenant_id, metric_date, metric_period)
WHERE user_id IS NULL;

-- =====================================================
-- 3. UPDATE FUNCTION TO USE NEW INDEXES
-- =====================================================

CREATE OR REPLACE FUNCTION increment_analytics_metric(
    p_tenant_id UUID,
    p_user_id UUID,
    p_metric_name TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
BEGIN
    -- 1. Handle User-Specific Metrics (if user_id provided)
    IF p_user_id IS NOT NULL THEN
        -- Insert record if not exists
        INSERT INTO analytics_metrics (
            tenant_id, 
            user_id, 
            metric_date, 
            metric_period
        )
        VALUES (p_tenant_id, p_user_id, v_today, 'daily')
        ON CONFLICT (tenant_id, user_id, metric_date, metric_period) 
        WHERE user_id IS NOT NULL
        DO NOTHING;
        
        -- Update the metric
        EXECUTE format(
            'UPDATE analytics_metrics 
             SET %I = COALESCE(%I, 0) + $1, 
                 updated_at = now()
             WHERE tenant_id = $2 
               AND user_id = $3 
               AND metric_date = $4 
               AND metric_period = ''daily''',
            p_metric_name, p_metric_name
        ) USING p_increment, p_tenant_id, p_user_id, v_today;
    END IF;
    
    -- 2. Handle Tenant-Wide Aggregates (user_id IS NULL)
    -- Insert record if not exists
    INSERT INTO analytics_metrics (
        tenant_id, 
        user_id, 
        metric_date, 
        metric_period
    )
    VALUES (p_tenant_id, NULL, v_today, 'daily')
    ON CONFLICT (tenant_id, metric_date, metric_period) 
    WHERE user_id IS NULL
    DO NOTHING;
    
    -- Update the metric
    EXECUTE format(
        'UPDATE analytics_metrics 
         SET %I = COALESCE(%I, 0) + $1, 
             updated_at = now()
         WHERE tenant_id = $2 
           AND user_id IS NULL 
           AND metric_date = $3 
           AND metric_period = ''daily''',
        p_metric_name, p_metric_name
    ) USING p_increment, p_tenant_id, v_today;
END;
$$ LANGUAGE plpgsql;

COMMIT;

DO $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- This won't work perfectly for row count of the DELETE 
    -- because we had multiple statements, but it's fine.
    
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Analytics Duplicates Fixed & Function Updated!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Actions taken:';
    RAISE NOTICE '  ✓ Cleaned up duplicate analytics rows';
    RAISE NOTICE '  ✓ Replaced faulty UNIQUE constraint with partial indexes';
    RAISE NOTICE '  ✓ Updated increment_analytics_metric() to use new indexes';
    RAISE NOTICE '=====================================================';
END $$;
