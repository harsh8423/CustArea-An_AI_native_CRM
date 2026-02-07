-- FIX: Analytics Trigger Update for Correct AI/Human Categorization
-- Problem: 'system' (worker) and 'agent' (AI service) roles are counted as 'human'
-- Solution: Update trigger to count 'ai', 'system', and 'agent' as AI-sent

CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_is_campaign BOOLEAN := FALSE;
BEGIN
    -- Only process email messages
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant, user, and campaign flag from conversation
    SELECT c.tenant_id, c.assigned_to, COALESCE(c.is_campaign, FALSE)
    INTO v_tenant_id, v_user_id, v_is_campaign
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    IF NEW.direction = 'outbound' THEN
        -- Outbound email - check if AI or human
        -- FIXED: Include 'system' (workers) and 'agent' (AI replies) as AI
        IF NEW.role IN ('ai', 'system', 'agent') THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
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

-- Re-create trigger to be safe (though function replacement is enough)
DROP TRIGGER IF EXISTS trigger_messages_analytics ON messages;
CREATE TRIGGER trigger_messages_analytics
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_message_activity();
