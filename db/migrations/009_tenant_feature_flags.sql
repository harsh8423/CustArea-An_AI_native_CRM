-- =====================================================
-- Tenant Feature Flags Migration
-- Enables/disables optional modules per tenant
-- =====================================================

-- ==================== STEP 1: Create Features Table ====================
-- Master list of all available features

CREATE TABLE IF NOT EXISTS features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key text UNIQUE NOT NULL,  -- 'ticketing', 'workflow', 'campaign', 'reports'
    display_name text NOT NULL,
    description text,
    icon text,  -- Icon name for UI
    category text,  -- 'core', 'optional', 'premium'
    is_default boolean DEFAULT false,  -- Auto-enabled for new tenants
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- ==================== STEP 2: Seed Features ====================

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

-- ==================== STEP 3: Tenant Features Table ====================
-- Per-tenant feature enablement

CREATE TABLE IF NOT EXISTS tenant_features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_id uuid NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    feature_key text NOT NULL,  -- Denormalized for quick access
    is_enabled boolean DEFAULT true,
    enabled_at timestamptz DEFAULT now(),
    disabled_at timestamptz,
    settings jsonb,  -- Feature-specific settings
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(tenant_id, feature_id),
    UNIQUE(tenant_id, feature_key)
);

-- ==================== STEP 4: Indexes ====================

CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant 
    ON tenant_features(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_features_enabled 
    ON tenant_features(tenant_id, is_enabled) 
    WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_tenant_features_key 
    ON tenant_features(tenant_id, feature_key);

-- ==================== STEP 5: Auto-enable Default Features ====================
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

-- ==================== STEP 6: Enable Features for Existing Tenants ====================
-- Backfill for existing tenants

DO $$
BEGIN
    INSERT INTO tenant_features (tenant_id, feature_id, feature_key, is_enabled)
    SELECT 
        t.id,
        f.id,
        f.feature_key,
        f.is_default  -- Enable default features, disable others
    FROM tenants t
    CROSS JOIN features f
    ON CONFLICT (tenant_id, feature_id) DO NOTHING;
    
    RAISE NOTICE '✅ Enabled default features for all existing tenants';
END $$;

-- ==================== STEP 7: Helper Function ====================
-- Function to check if tenant has feature enabled

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

-- ==================== VERIFICATION ====================

-- Show features
SELECT 
    feature_key,
    display_name,
    category,
    is_default,
    sort_order
FROM features
ORDER BY sort_order;

-- Show tenant feature counts
SELECT 
    t.id as tenant_id,
    t.company_name,
    COUNT(*) FILTER (WHERE tf.is_enabled = true) as enabled_features,
    COUNT(*) as total_features
FROM tenants t
LEFT JOIN tenant_features tf ON t.id = tf.tenant_id
GROUP BY t.id, t.company_name;

-- ==================== SUCCESS MESSAGE ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '✅ Tenant Feature Flags Migration Complete!';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Core Features (Always Enabled):';
    RAISE NOTICE '  - Dashboard';
    RAISE NOTICE '  - Sales CRM';
    RAISE NOTICE '  - Conversations';
    RAISE NOTICE '  - AI Agent';
    RAISE NOTICE '';
    RAISE NOTICE 'Optional Features (Can Toggle):';
    RAISE NOTICE '  - Ticketing';
    RAISE NOTICE '  - Workflow Automation';
    RAISE NOTICE '  - Marketing Campaigns';
    RAISE NOTICE '  - Reports & Analytics';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Create Settings → Integrations page';
    RAISE NOTICE '';
END $$;
