-- =====================================================
-- FIX: Resync Analytics with Real Data
-- =====================================================
-- Issue: Analytics shows bloated numbers (355) due to summing duplicates
-- Solution: Reset metrics and recalculate from source of truth (messages table)
-- =====================================================

BEGIN;

-- 1. Reset campaign email counts for today
UPDATE analytics_metrics
SET campaign_emails_sent = 0,
    emails_sent_total = 0, -- Will verify this too
    updated_at = now()
WHERE metric_date = CURRENT_DATE
  AND metric_period = 'daily';

-- 2. Recalculate Campaign Emails from Messages table
-- Update tenant-wide metrics (user_id IS NULL)
WITH real_counts AS (
    SELECT 
        c.tenant_id,
        COUNT(*) as real_count
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.channel = 'email' 
      AND m.direction = 'outbound'
      AND c.is_campaign = true
      AND m.created_at::DATE = CURRENT_DATE
    GROUP BY c.tenant_id
)
UPDATE analytics_metrics a
SET campaign_emails_sent = rc.real_count
FROM real_counts rc
WHERE a.tenant_id = rc.tenant_id
  AND a.metric_date = CURRENT_DATE
  AND a.metric_period = 'daily'
  AND a.user_id IS NULL;

-- 3. Recalculate Total Emails (Human + AI)
WITH total_counts AS (
    SELECT 
        c.tenant_id,
        COUNT(*) as real_total
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.channel = 'email' 
      AND m.direction = 'outbound'
      AND m.created_at::DATE = CURRENT_DATE
    GROUP BY c.tenant_id
)
UPDATE analytics_metrics a
SET emails_sent_total = tc.real_total
FROM total_counts tc
WHERE a.tenant_id = tc.tenant_id
  AND a.metric_date = CURRENT_DATE
  AND a.metric_period = 'daily'
  AND a.user_id IS NULL;

-- 4. Recalculate AI vs Human breakdown
WITH role_counts AS (
    SELECT 
        c.tenant_id,
        SUM(CASE WHEN m.role = 'ai' THEN 1 ELSE 0 END) as ai_count,
        SUM(CASE WHEN m.role != 'ai' THEN 1 ELSE 0 END) as human_count
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.channel = 'email' 
      AND m.direction = 'outbound'
      AND m.created_at::DATE = CURRENT_DATE
    GROUP BY c.tenant_id
)
UPDATE analytics_metrics a
SET emails_sent_by_ai = rc.ai_count,
    emails_sent_by_human = rc.human_count
FROM role_counts rc
WHERE a.tenant_id = rc.tenant_id
  AND a.metric_date = CURRENT_DATE
  AND a.metric_period = 'daily'
  AND a.user_id IS NULL;

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Analytics Resynced with Source of Truth';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Recalculated metrics from messages table.';
    RAISE NOTICE 'Campaign Emails Sent should now match real count (18).';
    RAISE NOTICE '=====================================================';
END $$;
