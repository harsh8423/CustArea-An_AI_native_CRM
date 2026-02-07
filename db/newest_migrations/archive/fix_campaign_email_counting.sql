-- =====================================================
-- FIX: Campaign Emails Should Count in BOTH General AND Campaign Metrics
-- =====================================================

BEGIN;

-- Update message trigger to count campaign emails in BOTH places
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
    'Updated: Campaign emails now count in BOTH general email metrics AND campaign-specific metrics';

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Campaign Email Counting Updated';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Campaign emails will now appear in:';
    RAISE NOTICE '  ✓ Total Emails Sent (general metric)';
    RAISE NOTICE '  ✓ Campaign Emails Sent (campaign-specific metric)';
    RAISE NOTICE '';
    RAISE NOTICE 'This provides visibility in both dashboards.';
    RAISE NOTICE '=====================================================';
END $$;
