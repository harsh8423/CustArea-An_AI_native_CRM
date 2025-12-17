-- =====================================================
-- Phone Calls Table
-- Run this AFTER 006_contact_identifiers.sql
-- =====================================================

-- Tracks call-level data (one record per phone call)
CREATE TABLE IF NOT EXISTS phone_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Twilio identifiers
    call_sid text UNIQUE NOT NULL,
    stream_sid text,
    
    -- Call details
    direction text NOT NULL,              -- 'inbound' | 'outbound'
    method text NOT NULL,                 -- 'realtime' | 'legacy' | 'convrelay'
    status text NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'failed' | 'no-answer'
    
    -- Phone numbers
    from_number text,
    to_number text,
    
    -- Timing
    started_at timestamptz NOT NULL DEFAULT now(),
    answered_at timestamptz,
    ended_at timestamptz,
    duration_seconds int,
    
    -- Transcript stats
    message_count int DEFAULT 0,
    
    -- Recording (if enabled)
    recording_url text,
    recording_sid text,
    
    -- Metadata
    metadata jsonb DEFAULT '{}',
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phone_calls_tenant ON phone_calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_conversation ON phone_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_contact ON phone_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_call_sid ON phone_calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_phone_calls_status ON phone_calls(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_phone_calls_started ON phone_calls(tenant_id, started_at DESC);

-- =====================================================
-- Add default_call_method to tenant_phone_config
-- =====================================================

ALTER TABLE tenant_phone_config 
ADD COLUMN IF NOT EXISTS default_call_method text DEFAULT 'realtime';

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE phone_calls IS 'Stores phone call records with transcript references';
COMMENT ON COLUMN phone_calls.call_sid IS 'Twilio Call SID - unique identifier for the call';
COMMENT ON COLUMN phone_calls.method IS 'Voice processing method: realtime (OpenAI), legacy (Azure), convrelay (Twilio)';
COMMENT ON COLUMN phone_calls.conversation_id IS 'Links to omnichannel conversation for message storage';
