-- =====================================================
-- FIX: Message Activity Trigger - Complete Campaign Email Tracking
-- =====================================================
-- Issue: Campaign emails not being counted in analytics_metrics
-- Root Cause: trigger_log_message_activity doesn't check is_campaign flag
-- Solution: Update trigger to count campaign emails separately
-- =====================================================

BEGIN;

-- Update message trigger with COMPLETE campaign tracking
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
        IF NEW.role = 'ai' THEN
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

COMMENT ON FUNCTION trigger_log_message_activity IS 
    'FIXED: Campaign emails counted in BOTH general email metrics AND campaign-specific metrics. Checks conversations.is_campaign flag.';

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS trigger_messages_analytics ON messages;
CREATE TRIGGER trigger_messages_analytics
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_message_activity();

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Campaign Email Tracking - COMPLETE FIX';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Updated trigger_log_message_activity to:';
    RAISE NOTICE '  ✓ Check is_campaign flag on conversations table';
    RAISE NOTICE '  ✓ Increment campaign_emails_sent for outbound campaign emails';
    RAISE NOTICE '  ✓ Increment campaign_emails_received for inbound campaign replies';
    RAISE NOTICE '  ✓ Also count in general email metrics (emails_sent_total)';
    RAISE NOTICE '';
    RAISE NOTICE 'Campaign emails will now appear in analytics!';
    RAISE NOTICE '=====================================================';
END $$;
