-- =====================================================
-- FIX: Phone Analytics AI Attribution & Trigger Logic
-- Created: 2026-02-06
-- Description: Updates trigger_log_phone_call_activity to correctly identify 
--              AI calls using the 'method' column instead of metadata, which
--              was populated inconsistently.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION trigger_log_phone_call_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_ai BOOLEAN;
BEGIN
    -- Only log when call is completed (and not already logged/processed)
    -- We check if status CHANGED to 'completed' or 'missed' to capture the end event
    IF (NEW.status = 'completed' OR NEW.status = 'missed') AND (OLD IS NULL OR OLD.status != NEW.status) THEN
        
        -- Get tenant and assigned user from conversation
        SELECT c.tenant_id, c.assigned_to 
        INTO v_tenant_id, v_user_id
        FROM conversations c
        WHERE c.id = NEW.conversation_id;
        
        -- If no conversation linked yet, use tenant_id from call record
        IF v_tenant_id IS NULL THEN
            v_tenant_id := NEW.tenant_id;
        END IF;
        
        -- FIX: Determine if AI based on 'method' column
        -- 'realtime', 'ai', 'convrelay' are AI methods
        -- 'browser', 'device' are Human methods
        v_is_ai := (NEW.method = 'realtime') OR 
                   (NEW.method = 'ai') OR 
                   (NEW.method = 'convrelay');
        
        -- Increment total calls metric
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_total', 1);
        
        IF v_is_ai THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_ai', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_ai_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_human', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_human_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        END IF;
        
        -- Track total duration
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        
        -- Log activity in activity_logs
        PERFORM log_user_activity(
            v_tenant_id,
            v_user_id,
            'phone',
            NEW.status, -- 'completed' or 'missed'
            'Call: ' || COALESCE(NEW.from_number, 'Unknown') || ' → ' || COALESCE(NEW.to_number, 'Unknown'),
            'phone_call',
            NEW.id,
            COALESCE(NEW.from_number, '') || ' → ' || COALESCE(NEW.to_number, '')
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notify success
DO $$
BEGIN
    RAISE NOTICE 'Fixed trigger_log_phone_call_activity to use method column for AI detection.';
END $$;

COMMIT;
