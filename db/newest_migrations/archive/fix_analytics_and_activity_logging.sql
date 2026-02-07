-- =====================================================
-- MIGRATION: Fix Analytics and Activity Logging
-- Created: 2026-02-06
-- Description: Fixes incorrect analytics counts and missing user information
--              in activity logs. Adds user tracking columns and updates triggers.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADD MISSING COLUMNS (with backward compatibility)
-- =====================================================

-- Add created_by and updated_by to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add updated_by to leads table (created_by already exists)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_by ON contacts(updated_by);
CREATE INDEX IF NOT EXISTS idx_leads_updated_by ON leads(updated_by);

-- Add comments
COMMENT ON COLUMN contacts.created_by IS 'User who created this contact';
COMMENT ON COLUMN contacts.updated_by IS 'User who last updated this contact';
COMMENT ON COLUMN leads.updated_by IS 'User who last updated this lead';

-- =====================================================
-- 2. FIX INCREMENT_ANALYTICS_METRIC FUNCTION
--    (Eliminate double-counting)
-- =====================================================

CREATE OR REPLACE FUNCTION increment_analytics_metric(
    p_tenant_id UUID,
    p_user_id UUID,
    p_metric_name TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
BEGIN
    -- FIXED: Only create ONE record based on whether user_id is provided
    -- This eliminates double-counting issue
    
    IF p_user_id IS NOT NULL THEN
        -- User-specific metric
        INSERT INTO analytics_metrics (
            tenant_id, 
            user_id, 
            metric_date, 
            metric_period
        )
        VALUES (p_tenant_id, p_user_id, v_today, 'daily')
        ON CONFLICT (tenant_id, user_id, metric_date, metric_period) 
        DO NOTHING;
        
        EXECUTE format(
            'UPDATE analytics_metrics 
             SET %I = COALESCE(%I, 0) + $1, 
                 updated_at = now()
             WHERE tenant_id = $2 
               AND user_id = $3 
               AND metric_date = $4 
               AND metric_period = ''daily''',
            p_metric_name, p_metric_name
        ) USING p_increment, p_tenant_id, p_user_id, v_today;
    ELSE
        -- Tenant-wide metric (for system/automated actions only)
        INSERT INTO analytics_metrics (
            tenant_id, 
            user_id, 
            metric_date, 
            metric_period
        )
        VALUES (p_tenant_id, NULL, v_today, 'daily')
        ON CONFLICT (tenant_id, user_id, metric_date, metric_period) 
        DO NOTHING;
        
        EXECUTE format(
            'UPDATE analytics_metrics 
             SET %I = COALESCE(%I, 0) + $1, 
                 updated_at = now()
             WHERE tenant_id = $2 
               AND user_id IS NULL 
               AND metric_date = $3 
               AND metric_period = ''daily''',
            p_metric_name, p_metric_name
        ) USING p_increment, p_tenant_id, v_today;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_analytics_metric IS 'FIXED: Increment metric counter - creates only ONE record (user-specific OR tenant-wide, not both)';

-- =====================================================
-- 3. FIX CONTACT ACTIVITY TRIGGER
--    (Use created_by/updated_by instead of NULL)
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_log_contact_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Check if it's from import (metadata has import_id)
        IF NEW.metadata ? 'import_id' THEN
            -- Import: use NULL (system action)
            PERFORM increment_analytics_metric(NEW.tenant_id, NULL, 'contacts_imported', 1);
        ELSE
            -- FIXED: Use created_by (may be NULL for backward compatibility)
            PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'contacts_created', 1);
            
            -- FIXED: Log with actual user
            PERFORM log_user_activity(
                NEW.tenant_id,
                NEW.created_by,  -- Use created_by (can be NULL)
                'contact',
                'created',
                'Contact: ' || COALESCE(NEW.name, NEW.email, 'Unnamed'),
                'contact',
                NEW.id,
                COALESCE(NEW.name, NEW.email)
            );
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- FIXED: Use updated_by for updates
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.updated_by, 'contacts_updated', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.updated_by,  -- Use updated_by (can be NULL)
            'contact',
            'updated',
            'Updated contact: ' || COALESCE(NEW.name, NEW.email, 'Unnamed'),
            'contact',
            NEW.id,
            COALESCE(NEW.name, NEW.email)
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_contact_activity IS 'FIXED: Track contact CRUD with actual user attribution';

-- =====================================================
-- 4. FIX LEAD ACTIVITY TRIGGER
--    (Use created_by/updated_by consistently)
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_log_lead_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_contact_name TEXT;
BEGIN
    -- Get contact name (leads table has no name field)
    SELECT name INTO v_contact_name 
    FROM contacts 
    WHERE id = COALESCE(NEW.contact_id, OLD.contact_id);
    
    IF TG_OP = 'INSERT' THEN
        -- FIXED: Use created_by consistently
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'leads_created', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.created_by,  -- Consistent with metrics
            'lead',
            'created',
            'Lead: ' || COALESCE(v_contact_name, 'Unknown'),
            'lead',
            NEW.id,
            v_contact_name
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- FIXED: Use updated_by for updates
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.updated_by, 'leads_updated', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.updated_by,  -- Use updated_by
            'lead',
            'updated',
            'Updated lead: ' || COALESCE(v_contact_name, 'Unknown'),
            'lead',
            NEW.id,
            v_contact_name
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- For deletes, use owner_id since no updated_by available
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.owner_id, 'leads_deleted', 1);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_lead_activity IS 'FIXED: Track lead CRUD with consistent user attribution';

-- =====================================================
-- 5. ADD ASSIGNMENT ACTIVITY LOGGING
--    (New triggers for contact/lead assignments)
-- =====================================================

-- Trigger for contact assignments
CREATE OR REPLACE FUNCTION trigger_log_contact_assignment_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_contact_name TEXT;
    v_assigned_by_name TEXT;
    v_assigned_to_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Get contact name
        SELECT name INTO v_contact_name 
        FROM contacts 
        WHERE id = NEW.contact_id;
        
        -- Get user names
        SELECT name INTO v_assigned_by_name FROM users WHERE id = NEW.assigned_by;
        SELECT name INTO v_assigned_to_name FROM users WHERE id = NEW.user_id;
        
        -- Log assignment activity
        PERFORM log_user_activity(
            (SELECT tenant_id FROM contacts WHERE id = NEW.contact_id),
            NEW.assigned_by,  -- User who performed the assignment
            'contact',
            'assigned',
            'Assigned contact "' || COALESCE(v_contact_name, 'Unknown') || '" to ' || COALESCE(v_assigned_to_name, 'user'),
            'contact',
            NEW.contact_id,
            v_contact_name
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lead assignments
CREATE OR REPLACE FUNCTION trigger_log_lead_assignment_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_contact_name TEXT;
    v_assigned_by_name TEXT;
    v_assigned_to_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Get contact name through lead
        SELECT c.name INTO v_contact_name 
        FROM leads l
        JOIN contacts c ON c.id = l.contact_id
        WHERE l.id = NEW.lead_id;
        
        -- Get user names
        SELECT name INTO v_assigned_by_name FROM users WHERE id = NEW.assigned_by;
        SELECT name INTO v_assigned_to_name FROM users WHERE id = NEW.assigned_to;
        
        -- Log assignment activity
        PERFORM log_user_activity(
            (SELECT tenant_id FROM leads WHERE id = NEW.lead_id),
            NEW.assigned_by,  -- User who performed the assignment
            'lead',
            'assigned',
            'Assigned lead "' || COALESCE(v_contact_name, 'Unknown') || '" to ' || COALESCE(v_assigned_to_name, 'user'),
            'lead',
            NEW.lead_id,
            v_contact_name
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to assignment tables
DROP TRIGGER IF EXISTS trigger_contact_assignment_log ON user_contact_assignments;
CREATE TRIGGER trigger_contact_assignment_log
    AFTER INSERT ON user_contact_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_assignment_activity();

DROP TRIGGER IF EXISTS trigger_lead_assignment_log ON user_lead_assignments;
CREATE TRIGGER trigger_lead_assignment_log
    AFTER INSERT ON user_lead_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_lead_assignment_activity();

COMMENT ON FUNCTION trigger_log_contact_assignment_activity IS 'Log contact assignment activities';
COMMENT ON FUNCTION trigger_log_lead_assignment_activity IS 'Log lead assignment activities';

-- =====================================================
-- 6. DATA CLEANUP (Optional - Remove Duplicates)
-- =====================================================

-- This section removes any duplicate analytics records created by the old logic
-- Only keeps the most recent record for each tenant/user/date/period combination

DO $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY tenant_id, COALESCE(user_id::TEXT, 'NULL'), metric_date, metric_period 
                   ORDER BY updated_at DESC, id DESC
               ) as rn
        FROM analytics_metrics
    )
    DELETE FROM analytics_metrics
    WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
    );
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count > 0 THEN
        RAISE NOTICE 'Cleaned up % duplicate analytics records', v_deleted_count;
    ELSE
        RAISE NOTICE 'No duplicate analytics records found';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Analytics and Activity Logging Fix Completed!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Schema Changes:';
    RAISE NOTICE '  ✓ Added created_by, updated_by to contacts';
    RAISE NOTICE '  ✓ Added updated_by to leads';
    RAISE NOTICE '  ✓ Created indexes for performance';
    RAISE NOTICE '';
    RAISE NOTICE 'Trigger Fixes:';
    RAISE NOTICE '  ✓ increment_analytics_metric - Eliminated double-counting';
    RAISE NOTICE '  ✓ trigger_log_contact_activity - Uses created_by/updated_by';
    RAISE NOTICE '  ✓ trigger_log_lead_activity - Uses created_by/updated_by';
    RAISE NOTICE '  ✓ trigger_log_contact_assignment_activity - NEW';
    RAISE NOTICE '  ✓ trigger_log_lead_assignment_activity - NEW';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Update backend code to pass user_id to database operations';
    RAISE NOTICE '  2. Test contact creation - should show correct count';
    RAISE NOTICE '  3. Test lead creation - should show user in activity log';
    RAISE NOTICE '  4. Test assignments - should appear in activity log';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- VERIFICATION QUERIES (Run these after migration)
-- =====================================================

-- Uncomment to verify schema changes:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'contacts' AND column_name IN ('created_by', 'updated_by');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'updated_by';

-- Uncomment to verify no duplicate analytics records:
-- SELECT tenant_id, user_id, metric_date, metric_period, COUNT(*) as count
-- FROM analytics_metrics
-- GROUP BY tenant_id, user_id, metric_date, metric_period
-- HAVING COUNT(*) > 1;
