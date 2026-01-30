-- Add Copilot Sessions Table
-- Tracks user interactions with the Copilot AI assistant

CREATE TABLE IF NOT EXISTS copilot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Session tracking
    session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_ended_at TIMESTAMPTZ,
    
    -- Conversation history with Copilot
    -- Structure: [{ role: 'user'|'assistant', content: string, timestamp: ISO8601 }]
    messages JSONB NOT NULL DEFAULT '[]',
    
    -- Context snapshot at session start (for analytics)
    context_snapshot JSONB,
    
    -- Analytics counters
    queries_count INT NOT NULL DEFAULT 0,
    replies_generated_count INT NOT NULL DEFAULT 0,
    summaries_requested_count INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_copilot_sessions_user ON copilot_sessions(user_id, created_at DESC);
CREATE INDEX idx_copilot_sessions_conversation ON copilot_sessions(conversation_id);
CREATE INDEX idx_copilot_sessions_tenant ON copilot_sessions(tenant_id);
CREATE INDEX idx_copilot_sessions_active ON copilot_sessions(user_id, conversation_id) 
    WHERE session_ended_at IS NULL;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_copilot_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_copilot_sessions_updated_at
    BEFORE UPDATE ON copilot_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_copilot_sessions_updated_at();

-- Add comment for documentation
COMMENT ON TABLE copilot_sessions IS 'Stores Copilot AI assistant session history and analytics for agent-facing assistance';
COMMENT ON COLUMN copilot_sessions.messages IS 'Conversation history between user and Copilot in chronological order';
COMMENT ON COLUMN copilot_sessions.context_snapshot IS 'Snapshot of conversation context when session started (for analytics)';
