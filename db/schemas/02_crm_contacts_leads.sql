-- =====================================================
-- CustArea CRM - Contacts, Leads & Pipeline Schema
-- File 2 of 5: CRM Layer
-- =====================================================
-- This file contains CRM core tables for managing contacts,
-- leads, pipelines, and customer accounts.
-- 
-- Tables: 8
-- Dependencies: File 1 (tenants, users)
-- =====================================================

-- =====================================================
-- 1. CONTACTS (Identity Only)
-- =====================================================

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text,                 -- person | company
  name text,
  email text,
  phone text,
  company_name text,
  source text,               -- website, import, whatsapp, campaign
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(tenant_id, phone) WHERE phone IS NOT NULL;

-- =====================================================
-- 2. CONTACT IDENTIFIERS (Cross-Channel Deduplication)
-- =====================================================

CREATE TABLE contact_identifiers (
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
-- 3. CONTACT MERGE HISTORY (Audit Trail)
-- =====================================================

CREATE TABLE contact_merge_history (
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

-- =====================================================
-- 4. PIPELINES & STAGES
-- =====================================================

CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text,
  is_default boolean
);

CREATE TABLE pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  name text,
  order_index int,
  is_terminal boolean
);

CREATE INDEX IF NOT EXISTS idx_pipelines_tenant ON pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

-- =====================================================
-- 5. LEADS (Pipeline + Ownership)
-- =====================================================

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id),
  stage_id uuid NOT NULL REFERENCES pipeline_stages(id),
  owner_id uuid REFERENCES users(id),   -- assigned agent
  created_by uuid REFERENCES users(id),
  status text,           -- open | won | lost | disqualified
  score int DEFAULT 0 CHECK (score >= 0 AND score <= 5),
  expected_value numeric,
  last_activity_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline ON leads(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(tenant_id, status);

-- =====================================================
-- 6. LEAD ASSIGNMENTS (History)
-- =====================================================

CREATE TABLE lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users(id),
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_user ON lead_assignments(assigned_to);

-- =====================================================
-- 7. ACCOUNTS (Post-Conversion Customers)
-- =====================================================

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id),
  lead_id uuid REFERENCES leads(id),
  lifecycle_stage text,    -- active | churned | paused
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_contact ON accounts(contact_id);
CREATE INDEX IF NOT EXISTS idx_accounts_lead ON accounts(lead_id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE contacts IS 'Contact identity records - deduplication via contact_identifiers table';
COMMENT ON TABLE contact_identifiers IS 'Multi-channel identifiers for cross-channel deduplication';
COMMENT ON TABLE contact_merge_history IS 'Audit trail for contact merges/deduplication';
COMMENT ON TABLE leads IS 'Sales leads with pipeline tracking and ownership';
COMMENT ON TABLE accounts IS 'Post-conversion customer accounts';

-- =====================================================
-- END OF FILE 2: CRM/Contacts/Leads
-- =====================================================
