-- FIX: Campaign Data Backfill - FINAL ROBUST VERSION
-- Reason: Previous backfill probably failed to count 'human' correctly due to NULL roles
--         or strict 'NOT IN' behavior.
-- Fix: Calculate Human count as (Total - AI) to guarantee they sum up to Total.

BEGIN;

-- 1. Reset counts
UPDATE campaign_analytics
SET total_emails_sent = 0,
    emails_sent_by_ai = 0,
    emails_sent_by_human = 0,
    emails_sent_today = 0;

-- 2. Recalculate with robust logic
WITH stats AS (
    SELECT 
        c.campaign_id,
        -- Total Count of outbound emails
        COUNT(*) as total_sent,
        
        -- AI Count (Explicit 'ai' or 'agent')
        SUM(CASE WHEN m.role IN ('ai', 'agent') THEN 1 ELSE 0 END) as ai_count,
        
        -- Today Count
        SUM(CASE WHEN m.created_at >= CURRENT_DATE::timestamp 
                  AND m.created_at < (CURRENT_DATE + INTERVAL '1 day')::timestamp 
             THEN 1 ELSE 0 END) as today_count
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.is_campaign = true
      AND c.campaign_id IS NOT NULL
      AND m.direction = 'outbound' 
      AND m.channel = 'email'
    GROUP BY c.campaign_id
)
UPDATE campaign_analytics ca
SET 
    total_emails_sent = stats.total_sent,
    emails_sent_by_ai = stats.ai_count,
    -- Human = Total - AI (Implicitly handles 'system', 'user', and NULLs as Human)
    emails_sent_by_human = (stats.total_sent - stats.ai_count),
    
    emails_sent_today = stats.today_count,
    last_updated_at = now()
FROM stats
WHERE ca.campaign_id = stats.campaign_id;

COMMIT;
