-- =====================================================
-- Contact Groups Migration
-- Created: 2026-01-31
-- Description: Add contact groups feature for organizing contacts
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

-- =====================================================
-- 3. TRIGGERS FOR UPDATED_AT
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
-- COMMENTS
-- =====================================================

COMMENT ON TABLE contact_groups IS 'Named groups for organizing contacts with multi-membership support';
COMMENT ON TABLE contact_group_memberships IS 'Many-to-many junction table linking contacts to groups';
COMMENT ON COLUMN contact_groups.color IS 'Optional hex color code for UI display (e.g., #3B82F6)';

-- =====================================================
-- EXAMPLE USAGE (For Testing)
-- =====================================================
-- To create a sample group:
-- INSERT INTO contact_groups (tenant_id, name, description, created_by)
-- VALUES ('your-tenant-id', 'VIP Customers', 'High-value customers requiring priority support', 'your-user-id');
--
-- To add contacts to a group:
-- INSERT INTO contact_group_memberships (contact_id, group_id, added_by)
-- VALUES ('contact-id', 'group-id', 'user-id');

-- =====================================================
-- END OF MIGRATION
-- =====================================================
