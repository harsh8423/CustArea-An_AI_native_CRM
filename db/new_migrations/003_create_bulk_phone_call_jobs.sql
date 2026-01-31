-- =====================================================
-- Bulk Phone Call Jobs Migration
-- Version: 003
-- Description: Adds bulk phone calling functionality
--              with real-time progress tracking, pause/resume,
--              and call record management
-- =====================================================

-- Create bulk_phone_call_jobs table
CREATE TABLE IF NOT EXISTS bulk_phone_call_jobs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant & user context
    tenant_id UUID NOT NULL,
    created_by UUID,
    
    -- Group information
    group_id UUID NOT NULL,
    group_name TEXT NOT NULL,
    
    -- Call configuration
    caller_phone_number TEXT NOT NULL,
    call_mode TEXT NOT NULL DEFAULT 'ai' CHECK (call_mode IN ('ai', 'human')),
    custom_instruction TEXT,
    
    -- Job status & progress
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused', 'cancelled')),
    total_recipients INTEGER DEFAULT 0,
    calls_completed INTEGER DEFAULT 0,
    calls_failed INTEGER DEFAULT 0,
    calls_in_progress INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    
    -- Current call tracking
    current_contact_id UUID,
    current_contact_name TEXT,
    current_contact_phone TEXT,
    
    -- Call records (detailed history)
    call_records JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{ contactId, contactName, phone, status, duration, callSid, startedAt, endedAt, transcript, summary, error }]
    
    -- Failed calls list
    failed_calls JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{ contactId, contactName, phone, error, errorMessage, timestamp }]
    
    -- Timing & ETA
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    estimated_completion_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    
    -- Statistics
    total_call_duration_seconds INTEGER DEFAULT 0,
    average_call_duration_seconds INTEGER DEFAULT 0,
    
    -- Metadata
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_bulk_phone_jobs_tenant 
    ON bulk_phone_call_jobs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bulk_phone_jobs_status 
    ON bulk_phone_call_jobs(status);

CREATE INDEX IF NOT EXISTS idx_bulk_phone_jobs_created 
    ON bulk_phone_call_jobs(created_at DESC);

-- Composite index for common queries (tenant + status)
CREATE INDEX IF NOT EXISTS idx_bulk_phone_jobs_tenant_status 
    ON bulk_phone_call_jobs(tenant_id, status);

-- Group lookup
CREATE INDEX IF NOT EXISTS idx_bulk_phone_jobs_group 
    ON bulk_phone_call_jobs(group_id);

-- User lookup
CREATE INDEX IF NOT EXISTS idx_bulk_phone_jobs_created_by 
    ON bulk_phone_call_jobs(created_by);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bulk_phone_call_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bulk_phone_call_jobs_updated_at
    BEFORE UPDATE ON bulk_phone_call_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_phone_call_jobs_updated_at();

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE bulk_phone_call_jobs IS 'Tracks bulk phone call campaigns to contact groups with AI agents';
COMMENT ON COLUMN bulk_phone_call_jobs.call_mode IS 'Mode of calling: ai (AI agent) or human (manual calling)';
COMMENT ON COLUMN bulk_phone_call_jobs.status IS 'Job status: pending, processing, completed, failed, paused, cancelled';
COMMENT ON COLUMN bulk_phone_call_jobs.call_records IS 'Array of all call attempts with full details including transcripts';
COMMENT ON COLUMN bulk_phone_call_jobs.failed_calls IS 'Array of failed calls with error reasons';
COMMENT ON COLUMN bulk_phone_call_jobs.custom_instruction IS 'Optional per-job custom AI instructions';

-- =====================================================
-- Migration Complete
-- =====================================================

-- Verify table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'bulk_phone_call_jobs'
    ) THEN
        RAISE NOTICE '✅ Migration 003 completed successfully';
        RAISE NOTICE '✅ Table: bulk_phone_call_jobs created';
        RAISE NOTICE '✅ Indexes: 6 indexes created';
        RAISE NOTICE '✅ Triggers: updated_at trigger created';
    ELSE
        RAISE EXCEPTION '❌ Migration 003 failed - table not created';
    END IF;
END $$;
