-- =====================================================
-- Migration: Add Conversation Activities Table
-- Created: 2026-02-06
-- Description: Adds the missing conversation_activities table
--              required by the conversation forwarding feature.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS conversation_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_activities_conversation 
    ON conversation_activities(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_activities_user 
    ON conversation_activities(user_id);

COMMENT ON TABLE conversation_activities IS 'Tracks specific activities within a conversation like forwarding or assignment changes';

COMMIT;
