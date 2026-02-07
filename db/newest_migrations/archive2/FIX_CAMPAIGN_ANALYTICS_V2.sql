-- FIX: Campaign Analytics - ALIGNMENT WITH USER EXPECTATIONS
-- 1. 'system' role (Initial/Follow-up) is now counted as HUMAN (not AI)
-- 2. 'agent'/'ai' role is counted as AI
-- 3. 'emails_sent_today' and 'total_emails_sent' now tracked via Message Trigger (includes AI replies)
-- 4. Removes overwriting of email counts by contact trigger

BEGIN;

-- 1. Update Campaign Analytics Trigger (on campaign_contacts)
-- REMOVED total_emails_sent and emails_sent_today calculations from here
-- because they miss AI replies. Now only tracks Contact-based metrics.
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
        total_replies = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied'
        ),
        -- RATES (Calculated using the new total_emails_sent column which is maintained by Message Trigger)
        -- Note: We use the existing value of total_emails_sent in the table
        delivery_rate = CASE 
            WHEN total_emails_sent > 0
            THEN ((total_emails_sent - (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'bounced'))::DECIMAL 
                  / total_emails_sent * 100)
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


-- 2. Update Message Activity Trigger
-- This now OWNS the Email Counts (Total, Today, AI, Human)
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
        
        -- LOGIC CHANGE: 
        -- 'ai', 'agent' -> Sent by AI
        -- 'system', 'user' -> Sent by Human (Initial/Follow-up/Manual)
        
        IF NEW.role IN ('ai', 'agent') THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
            
            IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_ai = emails_sent_by_ai + 1,
                    total_emails_sent = total_emails_sent + 1,
                    emails_sent_today = emails_sent_today + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        ELSE
            -- system, user, etc.
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
            
             IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_human = emails_sent_by_human + 1,
                    total_emails_sent = total_emails_sent + 1,
                    emails_sent_today = emails_sent_today + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        END IF;
        
        -- ALWAYS increment general total emails sent
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
        
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_sent', 1);
        END IF;
        
    ELSIF NEW.direction = 'inbound' THEN
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
        
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_received', 1);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
