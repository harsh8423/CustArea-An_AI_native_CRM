-- FIX: Restore Reply Detection & Pending Calculation
-- 1. Updates trigger to mark campaign_contacts as 'replied' on inbound email
-- 2. Corrects historical data (marks contacts as 'replied' if they have inbound messages)

BEGIN;

-- 1. Update Message Trigger to handle Contact Status Updates
CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_is_campaign BOOLEAN := FALSE;
    v_campaign_id UUID;
    v_contact_id UUID; -- Added to track contact
BEGIN
    -- Only process email messages
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant, user, campaign info AND contact_id from conversation
    SELECT c.tenant_id, c.assigned_to, COALESCE(c.is_campaign, FALSE), c.campaign_id, c.contact_id
    INTO v_tenant_id, v_user_id, v_is_campaign, v_campaign_id, v_contact_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    IF NEW.direction = 'outbound' THEN
        -- Outbound logic (unchanged from V2)
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
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
             IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_human = emails_sent_by_human + 1,
                    total_emails_sent = total_emails_sent + 1,
                    emails_sent_today = emails_sent_today + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_sent', 1);
        END IF;
        
    ELSIF NEW.direction = 'inbound' THEN
        -- Inbound logic
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
        
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_received', 1);
            
            -- FIX: Mark Contact as REPLIED
            -- This ensures the 'Replied' count and 'Pending' calculation works
            IF v_campaign_id IS NOT NULL AND v_contact_id IS NOT NULL THEN
                UPDATE campaign_contacts
                SET status = 'replied',
                    -- Stop the sequence
                    next_send_at = NULL,
                    updated_at = now()
                WHERE campaign_id = v_campaign_id
                  AND contact_id = v_contact_id
                  AND status != 'replied'; -- Only update if not already replied
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Backfill: Mark existing contacts as 'replied' if they have inbound messages
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

-- 3. Force Refresh Campaign Analytics (to update total_replies count)
-- We trigger an update by touching campaign_contacts (or just running the calc directly)
-- The UPDATE above triggers 'update_campaign_analytics' automatically for affected rows.
-- But to be safe, let's recalibrate everything one last time.

UPDATE campaign_analytics ca
SET
    total_replies = (
        SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = ca.campaign_id AND status = 'replied'
    ),
    last_updated_at = now();

COMMIT;
