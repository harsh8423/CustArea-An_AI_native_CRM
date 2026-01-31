-- Migration: Create Bulk Email Jobs Table
-- Description: Adds support for bulk email sending to contact groups
-- Version: 002
-- Date: 2026-01-31

-- ================================================
-- Create bulk_email_jobs table
-- ================================================

CREATE TABLE IF NOT EXISTS bulk_email_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Job details
    group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL,
    group_name VARCHAR(255), -- Cached group name in case group is deleted
    from_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    -- Possible values: queued, processing, completed, failed, cancelled
    
    total_recipients INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    
    -- Progress tracking
    progress_percent INTEGER DEFAULT 0,
    current_email VARCHAR(255),
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_completion_at TIMESTAMP,
    
    -- Error tracking
    error_message TEXT,
    failed_emails JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{ email: string, error: string, timestamp: string }]
    
    -- Metadata
    provider_type VARCHAR(50), -- ses, gmail, outlook
    delay_ms INTEGER DEFAULT 500,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- Create indexes for performance
-- ================================================

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_tenant 
    ON bulk_email_jobs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status 
    ON bulk_email_jobs(status);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created 
    ON bulk_email_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created_by 
    ON bulk_email_jobs(created_by);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_group 
    ON bulk_email_jobs(group_id) 
    WHERE group_id IS NOT NULL;

-- ================================================
-- Create trigger for updated_at
-- ================================================

CREATE OR REPLACE FUNCTION update_bulk_email_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bulk_email_jobs_updated_at
    BEFORE UPDATE ON bulk_email_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_bulk_email_jobs_updated_at();

-- ================================================
-- Add comments for documentation
-- ================================================

COMMENT ON TABLE bulk_email_jobs IS 'Tracks bulk email sending jobs to contact groups';
COMMENT ON COLUMN bulk_email_jobs.status IS 'Job status: queued, processing, completed, failed, cancelled';
COMMENT ON COLUMN bulk_email_jobs.failed_emails IS 'JSONB array of failed email attempts with error details';
COMMENT ON COLUMN bulk_email_jobs.delay_ms IS 'Delay in milliseconds between each email send (rate limiting)';
COMMENT ON COLUMN bulk_email_jobs.provider_type IS 'Email provider used: ses, gmail, or outlook';

-- ================================================
-- Success message
-- ================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 002 completed successfully!';
    RAISE NOTICE 'Created table: bulk_email_jobs';
    RAISE NOTICE 'Created 5 indexes for performance';
    RAISE NOTICE 'Created updated_at trigger';
END $$;
