-- =====================================================
-- Contact Identifiers for Cross-Channel Deduplication
-- Run this AFTER 005_ai_agent_deployment.sql
-- =====================================================

-- Contact identifiers table for storing multiple identifiers per contact
CREATE TABLE IF NOT EXISTS contact_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Identifier info
    identifier_type TEXT NOT NULL,  -- 'email', 'phone', 'whatsapp', 'visitor_id'
    identifier_value TEXT NOT NULL,
    
    -- Verification & confidence
    is_verified BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,  -- Primary identifier for this type
    confidence DECIMAL(3,2) DEFAULT 1.00,  -- 1.00 = confirmed, 0.5 = guessed from context
    
    -- Source tracking
    source TEXT,  -- 'whatsapp', 'email', 'widget', 'manual', 'import'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique identifier per tenant
    UNIQUE(tenant_id, identifier_type, identifier_value)
);

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_contact_identifiers_tenant ON contact_identifiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_identifiers_contact ON contact_identifiers(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_identifiers_lookup ON contact_identifiers(tenant_id, identifier_type, identifier_value);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_contact_identifiers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_identifiers_updated_at ON contact_identifiers;
CREATE TRIGGER contact_identifiers_updated_at
    BEFORE UPDATE ON contact_identifiers
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_identifiers_timestamp();

-- =====================================================
-- Migrate existing contact data to identifiers table
-- =====================================================

-- Migrate existing emails
INSERT INTO contact_identifiers (tenant_id, contact_id, identifier_type, identifier_value, is_primary, source)
SELECT 
    tenant_id, 
    id, 
    'email', 
    LOWER(email),
    true,
    COALESCE(source, 'migrated')
FROM contacts 
WHERE email IS NOT NULL AND email != ''
ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING;

-- Migrate existing phones
INSERT INTO contact_identifiers (tenant_id, contact_id, identifier_type, identifier_value, is_primary, source)
SELECT 
    tenant_id, 
    id, 
    'phone', 
    phone,
    true,
    COALESCE(source, 'migrated')
FROM contacts 
WHERE phone IS NOT NULL AND phone != ''
ON CONFLICT (tenant_id, identifier_type, identifier_value) DO NOTHING;

-- =====================================================
-- Contact merge history (for audit trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS contact_merge_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Merge info
    primary_contact_id UUID NOT NULL,  -- Contact that remains
    merged_contact_id UUID NOT NULL,   -- Contact that was merged into primary
    
    -- What was merged
    merged_data JSONB,  -- Snapshot of merged contact before deletion
    merge_reason TEXT,  -- 'auto_dedup', 'manual', 'import'
    
    -- Who merged
    merged_by UUID,  -- User ID if manual
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_merge_history_tenant ON contact_merge_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_merge_history_primary ON contact_merge_history(primary_contact_id);
