-- =====================================================
-- CONSOLIDATED MIGRATION 003: Contact Groups Management
-- Created: 2026-02-05
-- Description: Contact groups and user assignment system
--              Consolidates: 001_create_contact_groups, 
--              011_user_contact_group_assignments
-- =====================================================
-- This migration creates:
--   - Contact groups for organizing contacts
--   - Contact-group many-to-many memberships
--   - User-group assignments for access control
-- =====================================================

-- =====================================================
-- 1. CONTACT GROUPS
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Group metadata
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,  -- Optional: hex color for UI (e.g., '#3B82F6')
    
    -- Tracking
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique group names per tenant
    CONSTRAINT unique_group_name_per_tenant UNIQUE(tenant_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_groups_tenant ON contact_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_created_by ON contact_groups(created_by);

COMMENT ON TABLE contact_groups IS 'Named groups for organizing contacts with multi-membership support';
COMMENT ON COLUMN contact_groups.color IS 'Optional hex color code for UI display (e.g., #3B82F6)';

-- =====================================================
-- 2. CONTACT GROUP MEMBERSHIPS (Junction Table)
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_group_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
    
    -- Tracking
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT now(),
    
    -- Prevent duplicate memberships
    CONSTRAINT unique_contact_group_membership UNIQUE(contact_id, group_id)
);

-- Indexes for fast lookups in both directions
CREATE INDEX IF NOT EXISTS idx_contact_group_memberships_contact ON contact_group_memberships(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_memberships_group ON contact_group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_memberships_added_by ON contact_group_memberships(added_by);

COMMENT ON TABLE contact_group_memberships IS 'Many-to-many junction table linking contacts to groups';

-- =====================================================
-- 3. USER CONTACT GROUP ASSIGNMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS user_contact_group_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, contact_group_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ucga_user_id ON user_contact_group_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ucga_contact_group_id ON user_contact_group_assignments(contact_group_id);
CREATE INDEX IF NOT EXISTS idx_ucga_assigned_by ON user_contact_group_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_ucga_assigned_at ON user_contact_group_assignments(assigned_at);

COMMENT ON TABLE user_contact_group_assignments IS 'Maps users to contact groups they have access to';
COMMENT ON COLUMN user_contact_group_assignments.assigned_by IS 'The user who assigned this contact group access';
COMMENT ON COLUMN user_contact_group_assignments.assigned_at IS 'Timestamp when the assignment was made';

-- =====================================================
-- 4. TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_contact_groups_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_groups_updated_at ON contact_groups;
CREATE TRIGGER contact_groups_updated_at
    BEFORE UPDATE ON contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_groups_timestamp();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Contact Groups Migration Completed Successfully!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Created 3 tables:';
    RAISE NOTICE '  ✓ contact_groups - Named groups for organizing contacts';
    RAISE NOTICE '  ✓ contact_group_memberships - Contact-group relationships';
    RAISE NOTICE '  ✓ user_contact_group_assignments - User access control';
    RAISE NOTICE '';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  ✓ Multi-membership support (contacts can be in multiple groups)';
    RAISE NOTICE '  ✓ User-level group access control';
    RAISE NOTICE '  ✓ Unique group names per tenant';
    RAISE NOTICE '  ✓ Optional color coding for UI';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
