-- =====================================================
-- CustArea CRM - Core, Authentication & Tenants Schema
-- File 1 of 5: Foundation Layer
-- =====================================================
-- This file contains core authentication, multi-tenancy,
-- and system configuration tables.
-- 
-- Tables: 8
-- Dependencies: None (foundation layer)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. TENANTS (Multi-tenancy Foundation)
-- =====================================================

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,                 -- for subdomain / URLs
  status text NOT NULL DEFAULT 'active', -- active | suspended | trial | cancelled
  plan text,                        -- free | starter | pro | enterprise
  timezone text DEFAULT 'UTC',
  locale text DEFAULT 'en',
  ai_enabled boolean DEFAULT true,
  ai_mode text DEFAULT 'assist',    -- assist | auto | off
  max_users int,
  max_leads int,
  max_ai_tokens_per_month bigint,
  metadata jsonb,                   -- industry, size, custom flags
  email text,                       -- Primary contact email for the tenant
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. TENANT SETTINGS
-- =====================================================

CREATE TABLE tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  key text,
  value jsonb,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 3. USERS (Tenant Employees - Supabase Auth)
-- =====================================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  email text UNIQUE NOT NULL,
  name text,
  role text,                        -- owner | admin | manager | agent
  status text,                      -- active | invited | disabled
  
  -- Supabase authentication
  supabase_user_id uuid,
  auth_provider text DEFAULT 'supabase',
  
  created_at timestamptz DEFAULT now()
);

-- Create unique index on supabase_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_user_id 
    ON users(supabase_user_id) 
    WHERE supabase_user_id IS NOT NULL;

-- Create index on email for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- 4. PENDING SIGNUPS (OTP Signup Flow)
-- =====================================================

CREATE TABLE pending_signups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    company_name text NOT NULL,
    supabase_user_id uuid,
    verification_status text DEFAULT 'pending',  -- 'pending', 'verified', 'expired'
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
    created_at timestamptz NOT NULL DEFAULT now(),
    verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_supabase_user ON pending_signups(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_signups_status ON pending_signups(verification_status);

-- =====================================================
-- 5. FEATURES (Global Feature Registry)
-- =====================================================

CREATE TABLE features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key text UNIQUE NOT NULL,  -- 'ticketing', 'workflow', 'campaign', 'reports'
    display_name text NOT NULL,
    description text,
    icon text,                         -- Icon name for UI
    category text,                     -- 'core', 'optional', 'premium'
    is_default boolean DEFAULT false,  -- Auto-enabled for new tenants
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 6. TENANT FEATURES (Per-Tenant Feature Enablement)
-- =====================================================

CREATE TABLE tenant_features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_id uuid NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    feature_key text NOT NULL,         -- Denormalized for quick access
    is_enabled boolean DEFAULT true,
    enabled_at timestamptz DEFAULT now(),
    disabled_at timestamptz,
    settings jsonb,                    -- Feature-specific settings
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(tenant_id, feature_id),
    UNIQUE(tenant_id, feature_key)
);

-- Indexes for tenant_features
CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant 
    ON tenant_features(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_features_enabled 
    ON tenant_features(tenant_id, is_enabled) 
    WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_tenant_features_key 
    ON tenant_features(tenant_id, feature_key);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Reusable function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-enable default features for new tenants
CREATE OR REPLACE FUNCTION auto_enable_default_features()
RETURNS TRIGGER AS $$
BEGIN
    -- Enable all default features for the new tenant
    INSERT INTO tenant_features (tenant_id, feature_id, feature_key, is_enabled)
    SELECT 
        NEW.id,
        f.id,
        f.feature_key,
        true
    FROM features f
    WHERE f.is_default = true
    ON CONFLICT (tenant_id, feature_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_enable_features ON tenants;

CREATE TRIGGER trigger_auto_enable_features
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION auto_enable_default_features();

-- =====================================================
-- SEED DATA: Default Features
-- =====================================================

INSERT INTO features (feature_key, display_name, description, icon, category, is_default, sort_order) VALUES
    -- Core features (always enabled, not toggleable)
    ('dashboard', 'Dashboard', 'Overview and analytics dashboard', 'LayoutDashboard', 'core', true, 1),
    ('sales', 'Sales CRM', 'Contacts, leads, and pipeline management', 'Users', 'core', true, 2),
    ('conversation', 'Conversations', 'Unified inbox for all channels', 'MessageSquare', 'core', true, 3),
    ('ai_agent', 'AI Agent', 'Intelligent AI assistant and chatbot', 'Bot', 'core', true, 4),
    
    -- Optional features (can be enabled/disabled)
    ('ticketing', 'Ticketing', 'Customer support ticket management', 'Ticket', 'optional', false, 5),
    ('workflow', 'Workflow Automation', 'Automated workflows and triggers', 'GitBranch', 'optional', false, 6),
    ('campaign', 'Marketing Campaigns', 'Email and marketing campaign tools', 'Megaphone', 'optional', false, 7),
    ('reports', 'Reports & Analytics', 'Advanced reporting and insights', 'BarChart2', 'optional', false, 8)
ON CONFLICT (feature_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    is_default = EXCLUDED.is_default,
    sort_order = EXCLUDED.sort_order;

-- =====================================================
-- HELPER FUNCTION: Check if tenant has feature
-- =====================================================

CREATE OR REPLACE FUNCTION tenant_has_feature(
    p_tenant_id uuid,
    p_feature_key text
)
RETURNS boolean AS $$
DECLARE
    v_enabled boolean;
BEGIN
    SELECT is_enabled INTO v_enabled
    FROM tenant_features
    WHERE tenant_id = p_tenant_id 
    AND feature_key = p_feature_key;
    
    RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE tenants IS 'Multi-tenant foundation - one row per organization/company';
COMMENT ON TABLE users IS 'Tenant employees/agents - uses Supabase authentication';
COMMENT ON TABLE pending_signups IS 'Tracks OTP-based signup flows before tenant creation';
COMMENT ON TABLE features IS 'Global feature registry - defines available features/modules';
COMMENT ON TABLE tenant_features IS 'Per-tenant feature enablement/configuration';

-- =====================================================
-- END OF FILE 1: Core/Auth/Tenants
-- =====================================================
