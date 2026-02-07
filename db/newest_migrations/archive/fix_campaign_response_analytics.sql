-- =====================================================
-- FIX: Campaign Response Analytics (AI vs Human)
-- Created: 2026-02-06
-- Description: Adds columns to track who sent campaign messages (AI vs Human)
--              and a trigger to update them automatically.
-- =====================================================

BEGIN;

-- 1. Add columns to campaign_analytics
ALTER TABLE campaign_analytics
ADD COLUMN IF NOT EXISTS total_sent_by_ai INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sent_by_human INT DEFAULT 0;

-- 2. Create Trigger Function
CREATE OR REPLACE FUNCTION trigger_log_campaign_response()
RETURNS TRIGGER AS $$
DECLARE
    v_campaign_id UUID;
BEGIN
    -- Only care about OUTBOUND messages
    IF NEW.direction != 'outbound' THEN
        RETURN NEW;
    END IF;

    -- Check if this conversation is part of a campaign
    SELECT campaign_id INTO v_campaign_id
    FROM conversations
    WHERE id = NEW.conversation_id AND is_campaign = true;

    -- If not a campaign conversation, exit
    IF v_campaign_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Ensure analytics record exists
    INSERT INTO campaign_analytics (id, campaign_id)
    VALUES (v_campaign_id, v_campaign_id)
    ON CONFLICT (campaign_id) DO NOTHING;

    -- Update counts based on role
    IF NEW.role = 'assistant' THEN
        -- AI Response
        UPDATE campaign_analytics
        SET total_sent_by_ai = total_sent_by_ai + 1,
            last_updated_at = now()
        WHERE campaign_id = v_campaign_id;
    ELSIF NEW.role = 'agent' OR NEW.role = 'system' THEN
        -- Human Response (Includes Automated Campaign Steps & Manual Replies)
        UPDATE campaign_analytics
        SET total_sent_by_human = total_sent_by_human + 1,
            last_updated_at = now()
        WHERE campaign_id = v_campaign_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger (After Insert on messages)
DROP TRIGGER IF EXISTS trigger_campaign_response_logging ON messages;
CREATE TRIGGER trigger_campaign_response_logging
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_campaign_response();

-- 4. Backfill existing data (Optional, but good for immediate visibility)
--    We can approximate: 
--    - 'assistant' messages in campaign conversations = AI
--    - 'agent' messages in campaign conversations = Human
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, campaign_id FROM campaign_analytics LOOP
        -- Count AI
        UPDATE campaign_analytics
        SET total_sent_by_ai = (
            SELECT COUNT(*) 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.campaign_id = r.campaign_id
              AND m.direction = 'outbound'
              AND m.role = 'assistant'
        )
        WHERE campaign_id = r.campaign_id;

        -- Count Human
        UPDATE campaign_analytics
        SET total_sent_by_human = (
            SELECT COUNT(*) 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.campaign_id = r.campaign_id
              AND m.direction = 'outbound'
              AND (m.role = 'agent' OR m.role = 'system')
        )
        WHERE campaign_id = r.campaign_id;
    END LOOP;
END $$;

COMMIT;
