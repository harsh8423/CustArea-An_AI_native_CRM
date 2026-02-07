-- =====================================================
-- FIX: Analytics AI vs Human Attribution
-- Created: 2026-02-06
-- Description: Updates the message logging trigger to correctly classify 
--              'assistant' role as AI (previously only checked 'ai').
-- =====================================================

BEGIN;

-- Redefine the trigger function with corrected logic
CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- CRITICAL: Only process email channel messages
    -- Check INSIDE function, not just in WHEN clause
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant and user from conversation
    SELECT c.tenant_id, c.assigned_to 
    INTO v_tenant_id, v_user_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    -- Process based on direction
    IF NEW.direction = 'outbound' THEN
        -- Outbound email - check if AI or human
        -- FIX: Added check for 'assistant' role (used by AI agent)
        IF NEW.role = 'ai' OR NEW.role = 'assistant' THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
    ELSIF NEW.direction = 'inbound' THEN
        -- Inbound email
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notify success
DO $$
BEGIN
    RAISE NOTICE 'Fixed trigger_log_message_activity to include ''assistant'' role as AI.';
END $$;

COMMIT;
