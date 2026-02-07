-- =====================================================
-- Migration: Add User ID and Voice Metadata to Phone Calls
-- Purpose: Fix missing user logging and store AI voice details
-- =====================================================

-- 1. Add columns to phone_calls table
ALTER TABLE phone_calls
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_voice_id TEXT,
ADD COLUMN IF NOT EXISTS ai_model TEXT,
ADD COLUMN IF NOT EXISTS ai_provider TEXT,
ADD COLUMN IF NOT EXISTS stt_provider TEXT,
ADD COLUMN IF NOT EXISTS tts_provider TEXT,
ADD COLUMN IF NOT EXISTS latency_mode TEXT; -- 'realtime' or 'legacy'

-- Index for user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_calls_user ON phone_calls(user_id);

-- 2. Update trigger_log_phone_call_activity to use user_id
CREATE OR REPLACE FUNCTION trigger_log_phone_call_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_ai BOOLEAN;
BEGIN
    -- Only log when call is completed (and not already logged)
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        
        -- Determine Tenant ID
        v_tenant_id := NEW.tenant_id;
        
        -- Determine User ID: Prefer direct user_id from call (Outbound/Dialer), fallback to conversation assignment
        IF NEW.user_id IS NOT NULL THEN
            v_user_id := NEW.user_id;
        ELSE
            -- Fallback: Get assigned user from conversation
            SELECT assigned_to INTO v_user_id
            FROM conversations
            WHERE id = NEW.conversation_id;
        END IF;

        -- Determine if AI - check metadata for realtime session or AI agent
        v_is_ai := (NEW.metadata ? 'realtime_session_id') OR 
                   (NEW.metadata ? 'ai_agent_id') OR
                   (NEW.method = 'realtime') OR 
                   (NEW.method = 'legacy' AND NEW.direction = 'inbound');
        
        -- Increment call metrics
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_total', 1);
        
        IF v_is_ai THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_ai', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_ai_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_human', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_human_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        
        -- Log activity (log_user_activity handles NULL user_id gracefully if needed, but now we have better coverage)
        PERFORM log_user_activity(
            v_tenant_id,
            v_user_id,
            'phone',
            'completed',
            'Call: ' || COALESCE(NEW.from_number, '') || ' → ' || COALESCE(NEW.to_number, ''),
            'phone_call',
            NEW.id,
            COALESCE(NEW.from_number, '') || ' → ' || COALESCE(NEW.to_number, '')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
