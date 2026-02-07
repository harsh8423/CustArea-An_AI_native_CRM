-- =====================================================
-- CONSOLIDATED DATA FIXES
-- Generated at: 2026-02-07
-- Combines fixes from:
--  - FIX_CAMPAIGN_DATA_FINAL.sql
--  - FIX_CAMPAIGN_REPLIES.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CAMPAIGN ANALYTICS BACKFILL
-- =====================================================

-- 1.1 Reset counts to ensure clean slate
UPDATE campaign_analytics
SET total_emails_sent = 0,
    emails_sent_by_ai = 0,
    emails_sent_by_human = 0,
    emails_sent_today = 0;

-- 1.2 Recalculate with robust logic (Human = Total - AI)
WITH stats AS (
    SELECT 
        c.campaign_id,
        -- Total Count of outbound emails
        COUNT(*) as total_sent,
        
        -- AI Count (Explicit 'ai' or 'assistant' per V3 Logic)
        -- Note: We include 'agent' here if historical data used 'agent' for AI.
        -- Given proper V3 Logic says Agent=Human, we should adhere to that.
        -- BUT if previous Campaign Worker sent as 'agent', and we want that to be AI?
        -- The user fixed the campaign worker to use 'system'.
        -- Let's stick to the "Correct" definition: AI = ai, assistant.
        -- Human = everything else (user, agent, system).
        SUM(CASE WHEN m.role IN ('ai', 'assistant') THEN 1 ELSE 0 END) as ai_count,
        
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
    emails_sent_by_human = (stats.total_sent - stats.ai_count),
    emails_sent_today = stats.today_count,
    last_updated_at = now()
FROM stats
WHERE ca.campaign_id = stats.campaign_id;

-- =====================================================
-- 2. REPLY STATUS BACKFILL
-- =====================================================

-- 2.1 Mark existing contacts as 'replied' if they have inbound messages
UPDATE campaign_contacts cc
SET status = 'replied',
    next_send_at = NULL,
    updated_at = now()
WHERE cc.status != 'replied'
AND EXISTS (
    SELECT 1 
    FROM conversations c
    JOIN messages m ON c.id = m.conversation_id
    WHERE c.campaign_id = cc.campaign_id
      AND c.contact_id = cc.contact_id
      AND m.direction = 'inbound'
      AND m.channel = 'email'
);

-- 2.2 Force Refresh Campaign Analytics (Update total_replies)
UPDATE campaign_analytics ca
SET
    total_replies = (
        SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = ca.campaign_id AND status = 'replied'
    ),
    last_updated_at = now();

COMMIT;
