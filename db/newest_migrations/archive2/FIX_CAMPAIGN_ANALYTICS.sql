-- FIX: Campaign Analytics Quota and AI/Human Tracking
-- 1. Add missing AI/Human tracking columns to campaign_analytics
-- 2. Fix daily sent quota calculation (emails_sent_today)
-- 3. Update message trigger to track AI vs Human stats per campaign

BEGIN;

-- 1. Add columns to campaign_analytics
ALTER TABLE campaign_analytics 
ADD COLUMN IF NOT EXISTS emails_sent_by_ai INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_sent_by_human INT DEFAULT 0;

-- 2. Fix Campaign Analytics Trigger (on campaign_contacts)
-- This handles the "Daily Quota" calculation correctly
CREATE OR REPLACE FUNCTION update_campaign_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the analytics for this campaign
    INSERT INTO campaign_analytics (id, campaign_id)
    VALUES (NEW.campaign_id, NEW.campaign_id)
    ON CONFLICT (campaign_id) DO NOTHING;
    
    UPDATE campaign_analytics
    SET
        total_contacts_enrolled = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id
        ),
        total_contacts_skipped = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'skipped_no_email'
        ),
        total_contacts_valid = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status != 'skipped_no_email'
        ),
        total_emails_sent = (
            SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id
        ),
        total_replies = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied'
        ),
        -- FIXED: Correctly calculate emails sent TODAY for quota enforcement
        emails_sent_today = (
            SELECT COUNT(*) FROM campaign_contacts 
            WHERE campaign_id = NEW.campaign_id 
            AND last_sent_at >= CURRENT_DATE::timestamp 
            AND last_sent_at < (CURRENT_DATE + INTERVAL '1 day')::timestamp
        ),
        today_date = CURRENT_DATE,
        
        -- Update rates
        delivery_rate = CASE 
            WHEN (SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) > 0
            THEN (((SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) 
                   - (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'bounced'))::DECIMAL 
                  / (SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) * 100)
            ELSE 0
        END,
        reply_rate = CASE 
            WHEN (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status != 'skipped_no_email') > 0
            THEN ((SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied')::DECIMAL 
                  / (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status != 'skipped_no_email') * 100)
            ELSE 0
        END,
        skip_rate = CASE 
            WHEN (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) > 0
            THEN ((SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'skipped_no_email')::DECIMAL 
                  / (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) * 100)
            ELSE 0
        END,
        last_updated_at = now()
    WHERE campaign_id = NEW.campaign_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 3. Fix Message Activity Trigger
-- This handles incrementing the AI vs Human counts in campaign_analytics
CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_is_campaign BOOLEAN := FALSE;
    v_campaign_id UUID;
BEGIN
    -- Only process email messages
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant, user, campaign flag AND campaign_id from conversation
    SELECT c.tenant_id, c.assigned_to, COALESCE(c.is_campaign, FALSE), c.campaign_id
    INTO v_tenant_id, v_user_id, v_is_campaign, v_campaign_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    IF NEW.direction = 'outbound' THEN
        -- Outbound email - check if AI or human
        -- Includes 'system' (workers) and 'agent' (AI replies) as AI
        IF NEW.role IN ('ai', 'system', 'agent') THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
            
            -- Increment Campaign specific AI count
            IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_ai = emails_sent_by_ai + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
            
            -- Increment Campaign specific Human count
             IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_human = emails_sent_by_human + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        END IF;
        
        -- ALWAYS increment general total emails sent
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
        
        -- ALSO increment campaign-specific metric if this is a campaign email
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_sent', 1);
        END IF;
        
    ELSIF NEW.direction = 'inbound' THEN
        -- Inbound email - ALWAYS count in general metrics
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
        
        -- Also count in campaign metrics if this is a campaign conversation
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_received', 1);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
