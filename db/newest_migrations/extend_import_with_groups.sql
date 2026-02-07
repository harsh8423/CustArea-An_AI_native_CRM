-- =====================================================
-- Import Functionality Extension
-- Created: 2026-02-06
-- Description: Adds support for group creation/assignment during imports
-- Features:
--   - Track which group contacts should be added to
--   - Support creating new groups during import
--   - Store group name for created groups
-- =====================================================

BEGIN;

-- Add group tracking columns to import_jobs
ALTER TABLE import_jobs 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS create_group BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN import_jobs.group_id IS 'Group to assign imported contacts to (NULL if no group)';
COMMENT ON COLUMN import_jobs.create_group IS 'Whether a new group was created during this import';
COMMENT ON COLUMN import_jobs.group_name IS 'Name of the group (for created groups or reference)';

-- Create index for querying imports by group
CREATE INDEX IF NOT EXISTS idx_import_jobs_group ON import_jobs(group_id) WHERE group_id IS NOT NULL;

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Import Extension Migration Completed';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '✓ Added group_id column to import_jobs';
    RAISE NOTICE '✓ Added create_group flag to import_jobs';
    RAISE NOTICE '✓ Added group_name column to import_jobs';
    RAISE NOTICE '✓ Created index for group queries';
    RAISE NOTICE '';
    RAISE NOTICE 'Import system now supports:';
    RAISE NOTICE '  - Creating groups during import';
    RAISE NOTICE '  - Adding contacts to existing groups';
    RAISE NOTICE '  - Tracking group associations';
    RAISE NOTICE '=====================================================';
END $$;
