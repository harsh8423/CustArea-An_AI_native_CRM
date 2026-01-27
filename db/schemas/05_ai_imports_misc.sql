-- =====================================================
-- CustArea CRM - AI & Import System Schema
-- File 5 of 5: Additional Features Layer
-- =====================================================
-- This file contains AI agent deployment configuration
-- and the CSV/Excel import system.
-- 
-- Tables: 5
-- Dependencies: File 1 (tenants, users), File 2 (leads)
-- =====================================================

-- =====================================================
-- AI AGENT DEPLOYMENTS
-- =====================================================

CREATE TABLE ai_agent_deployments (
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

-- =====================================================
-- IMPORT SYSTEM (CSV/Excel Imports)
-- =====================================================

-- 1. IMPORT JOBS (One per CSV/Excel upload)
CREATE TABLE import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  source text,            -- csv | xlsx | google_sheets
  filename text,
  status text,            -- uploaded | parsed | mapped | applied | failed

  total_rows int DEFAULT 0,
  processed_rows int DEFAULT 0,
  error_rows int DEFAULT 0,

  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_by ON import_jobs(created_by);

-- 2. IMPORT COLUMNS (Dynamic schema)
CREATE TABLE import_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid REFERENCES import_jobs(id) ON DELETE CASCADE,

  original_name text,        -- column name in CSV
  normalized_name text,      -- snake_case
  detected_type text,        -- string | number | date | email | phone

  mapped_to text,            -- contact.email | lead.stage | custom
  is_custom boolean DEFAULT false,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_columns_job ON import_columns(import_job_id);

-- 3. IMPORT ROWS (Raw data storage)
-- Row-per-record JSONB storage approach
CREATE TABLE import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid REFERENCES import_jobs(id) ON DELETE CASCADE,

  row_index int,
  data jsonb,              -- {"Email":"x@a.com","Budget":"5000"}
  validation_errors jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_rows_job ON import_rows(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_job_index ON import_rows(import_job_id, row_index);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE ai_agent_deployments IS 'AI agent deployment configurations per channel per tenant';
COMMENT ON TABLE import_jobs IS 'Track CSV/Excel import jobs';
COMMENT ON TABLE import_columns IS 'Dynamic schema for each import - maps CSV columns to database fields';
COMMENT ON TABLE import_rows IS 'Raw import data storage before processing';

-- =====================================================
-- END OF FILE 5: AI/Imports/Misc
-- =====================================================
-- 
-- All 5 schema files complete!
-- Total Tables: 52
-- 
-- Execution Order:
--   1. 01_core_auth_tenants.sql       (8 tables)
--   2. 02_crm_contacts_leads.sql      (8 tables)
--   3. 03_messaging_channels.sql      (18 tables)
--   4. 04_ticketing_workflows.sql     (13 tables)
--   5. 05_ai_imports_misc.sql         (5 tables)
-- =====================================================
