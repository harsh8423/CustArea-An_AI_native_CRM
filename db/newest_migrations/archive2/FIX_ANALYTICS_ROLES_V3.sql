-- FIX: Analytics Role Logic V3
-- Update trigger to treat 'agent' as HUMAN (for manual emails) and 'assistant' as AI
-- This fixes the issue where manual composed emails (role='agent') were counted as AI

BEGIN;

CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_is_campaign BOOLEAN := FALSE;
    v_campaign_id UUID;
    v_contact_id UUID;
BEGIN
    -- Only process email messages
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant, user, campaign info AND contact_id
    SELECT c.tenant_id, c.assigned_to, COALESCE(c.is_campaign, FALSE), c.campaign_id, c.contact_id
    INTO v_tenant_id, v_user_id, v_is_campaign, v_campaign_id, v_contact_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    IF NEW.direction = 'outbound' THEN
        -- Outbound logic REVISED:
        -- AI = 'assistant', 'ai'
        -- Human = 'agent' (manual), 'system' (automated), 'user', etc.
        
        IF NEW.role IN ('ai', 'assistant') THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
             IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_ai = emails_sent_by_ai + 1,
                    total_emails_sent = total_emails_sent + 1,
                    emails_sent_today = emails_sent_today + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        ELSE
            -- Treat 'agent' as Human
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
        -- Inbound logic (Unchanged)
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
        
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_received', 1);
            
            IF v_campaign_id IS NOT NULL AND v_contact_id IS NOT NULL THEN
                UPDATE campaign_contacts
                SET status = 'replied',
                    next_send_at = NULL,
                    updated_at = now()
                WHERE campaign_id = v_campaign_id
                  AND contact_id = v_contact_id
                  AND status != 'replied';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
