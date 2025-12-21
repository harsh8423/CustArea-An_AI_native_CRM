-- =====================================================
-- Multi-Trigger Workflow Support Migration
-- Allows workflows to have multiple trigger types
-- =====================================================

-- 1. Add trigger_types array column to workflows
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS trigger_types TEXT[] DEFAULT '{}';

-- 2. Migrate existing trigger_type to trigger_types array
UPDATE workflows 
SET trigger_types = ARRAY[trigger_type]
WHERE trigger_type IS NOT NULL 
  AND (trigger_types IS NULL OR trigger_types = '{}');

-- 3. Create GIN index for fast array containment checks
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_types 
ON workflows USING GIN (trigger_types) 
WHERE status = 'active';

-- 4. Add trigger_data column to workflow_runs to store trigger context
ALTER TABLE workflow_runs 
ADD COLUMN IF NOT EXISTS trigger_data jsonb DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN workflows.trigger_types IS 'Array of trigger node types in this workflow (e.g., whatsapp_message, email_received, manual_trigger)';
COMMENT ON COLUMN workflow_runs.trigger_data IS 'Full trigger context including sender info, message, channel, etc.';
