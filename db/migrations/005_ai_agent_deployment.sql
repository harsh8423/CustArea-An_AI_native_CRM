-- =====================================================
-- AI Agent Deployment Configuration
-- Run this AFTER 004_omnichannel_conversations.sql
-- =====================================================

-- AI Agent deployment configurations per channel
CREATE TABLE IF NOT EXISTS ai_agent_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,  -- 'email', 'whatsapp', 'widget', 'phone'
    
    -- Enable/disable
    is_enabled BOOLEAN DEFAULT false,
    
    -- Schedule configuration (when AI agent takes over)
    schedule_enabled BOOLEAN DEFAULT false,
    schedule_start_time TIME,  -- e.g., '18:00' (6 PM)
    schedule_end_time TIME,    -- e.g., '06:00' (6 AM next day)
    schedule_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    schedule_timezone TEXT DEFAULT 'UTC',
    
    -- Behavior settings
    auto_respond BOOLEAN DEFAULT true,
    handoff_enabled BOOLEAN DEFAULT true,
    max_messages_before_handoff INTEGER DEFAULT 10,
    
    -- Channel-specific messages
    welcome_message TEXT,
    handoff_message TEXT DEFAULT 'Let me connect you with a human agent who can help further.',
    away_message TEXT DEFAULT 'Our team is currently away. Our AI assistant will help you.',
    
    -- Priority settings
    priority_mode TEXT DEFAULT 'normal',  -- 'always_ai', 'always_human', 'normal', 'schedule'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure one config per channel per tenant
    UNIQUE(tenant_id, channel)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_ai_agent_deployments_tenant ON ai_agent_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_deployments_channel ON ai_agent_deployments(tenant_id, channel);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ai_agent_deployments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_agent_deployments_updated_at ON ai_agent_deployments;
CREATE TRIGGER ai_agent_deployments_updated_at
    BEFORE UPDATE ON ai_agent_deployments
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_agent_deployments_timestamp();

-- Insert default configurations for all channels
-- This will be done per tenant when they first access the AI Agent settings
