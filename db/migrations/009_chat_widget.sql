-- =====================================================
-- Chat Widget Schema Additions
-- Run this AFTER 008_browser_calling.sql
-- Uses existing tenant_widget_config table from 004
-- =====================================================

-- Widget Sessions (anonymous visitors before they provide contact info)
-- Links to tenant_widget_config via site_id
CREATE TABLE IF NOT EXISTS widget_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES tenant_widget_config(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Anonymous identifier (from browser localStorage)
    external_id TEXT NOT NULL,
    
    -- Link to contact when email/phone provided
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Visitor info
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_widget_sessions_site_external 
    ON widget_sessions(site_id, external_id);
CREATE INDEX IF NOT EXISTS idx_widget_sessions_tenant ON widget_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_widget_sessions_contact ON widget_sessions(contact_id);