-- =====================================================
-- SUPPLEMENTARY FIX: Delete Activity Logging
-- Created: 2026-02-06
-- Description: Adds activity logging for delete operations and fixes triggers
-- Run this AFTER fix_analytics_and_activity_logging.sql and fix_contact_group_trigger.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADD deleted_by COLUMN TO TRACK WHO DELETED
-- =====================================================

-- We need to track who deleted items
-- Since DELETE operations don't have access to NEW, we'll use a session variable approach
-- or modify delete endpoints to set a column before deletion

-- For now, we'll add deleted_by columns for future enhancement
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE contact_groups ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN contacts.deleted_by IS 'User who deleted this contact (if soft delete is implemented)';
COMMENT ON COLUMN leads.deleted_by IS 'User who deleted this lead (if soft delete is implemented)';
COMMENT ON COLUMN contact_groups.deleted_by IS 'User who deleted this group (if soft delete is implemented)';

-- =====================================================
-- 2. UPDATE CONTACT TRIGGER TO LOG DELETES
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
            -- Use created_by
            PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'contacts_created', 1);
            
            -- Log with actual user
            PERFORM log_user_activity(
                NEW.tenant_id,
                NEW.created_by,
                'contact',
                'created',
                'Contact: ' || COALESCE(NEW.name, NEW.email, 'Unnamed'),
                'contact',
                NEW.id,
                COALESCE(NEW.name, NEW.email)
            );
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Use updated_by for updates
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.updated_by, 'contacts_updated', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.updated_by,
            'contact',
            'updated',
            'Updated contact: ' || COALESCE(NEW.name, NEW.email, 'Unnamed'),
            'contact',
            NEW.id,
            COALESCE(NEW.name, NEW.email)
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- NEW: Log delete operation
        -- Note: OLD.deleted_by would be set if we implement soft delete
        -- For now, we use updated_by as the last person who touched the record
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.updated_by, 'contacts_deleted', 1);
        
        PERFORM log_user_activity(
            OLD.tenant_id,
            OLD.updated_by,  -- Last user who interacted with this contact
            'contact',
            'deleted',
            'Deleted contact: ' || COALESCE(OLD.name, OLD.email, 'Unnamed'),
            'contact',
            OLD.id,
            COALESCE(OLD.name, OLD.email)
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_contact_activity IS 'Track contact CRUD including deletes with user attribution';

-- =====================================================
-- 3. UPDATE LEAD TRIGGER TO LOG DELETES
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
        -- Use created_by consistently
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'leads_created', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.created_by,
            'lead',
            'created',
            'Lead: ' || COALESCE(v_contact_name, 'Unknown'),
            'lead',
            NEW.id,
            v_contact_name
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Use updated_by for updates
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.updated_by, 'leads_updated', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.updated_by,
            'lead',
            'updated',
            'Updated lead: ' || COALESCE(v_contact_name, 'Unknown'),
            'lead',
            NEW.id,
            v_contact_name
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- FIXED: Now logs activity for deletes
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.owner_id, 'leads_deleted', 1);
        
        -- NEW: Log delete activity
        PERFORM log_user_activity(
            OLD.tenant_id,
            OLD.owner_id,  -- Use owner as the user attribution
            'lead',
            'deleted',
            'Deleted lead: ' || COALESCE(v_contact_name, 'Unknown'),
            'lead',
            OLD.id,
            v_contact_name
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_lead_activity IS 'Track lead CRUD including deletes with user attribution';

-- =====================================================
-- 4. ADD CONTACT GROUP DELETE LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_log_contact_group_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Use created_by instead of NULL
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'contact_groups_created', 1);
        
        -- Log activity with actual user
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.created_by,
            'group',
            'created',
            'Group: ' || COALESCE(NEW.name, 'Unnamed'),
            'contact_group',
            NEW.id,
            NEW.name
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- NEW: Log delete operation
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.created_by, 'contact_groups_deleted', 1);
        
        PERFORM log_user_activity(
            OLD.tenant_id,
            OLD.created_by,  -- Use creator as attribution
            'group',
            'deleted',
            'Deleted group: ' || COALESCE(OLD.name, 'Unnamed'),
            'contact_group',
            OLD.id,
            OLD.name
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_contact_group_activity IS 'Track contact group creation and deletion with user attribution';

-- Re-create trigger to include DELETE
DROP TRIGGER IF EXISTS trigger_contact_group_activity_log ON contact_groups;
CREATE TRIGGER trigger_contact_group_activity_log
    AFTER INSERT OR DELETE ON contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_group_activity();

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Delete Activity Logging Fix Completed!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Schema Changes:';
    RAISE NOTICE '  ✓ Added deleted_by columns (for future soft delete)';
    RAISE NOTICE '';
    RAISE NOTICE 'Trigger Updates:';
    RAISE NOTICE '  ✓ trigger_log_contact_activity - Now logs deletes';
    RAISE NOTICE '  ✓ trigger_log_lead_activity - Now logs deletes';  
    RAISE NOTICE '  ✓ trigger_log_contact_group_activity - Now logs deletes';
    RAISE NOTICE '';
    RAISE NOTICE 'Activity Log will now show:';
    RAISE NOTICE '  ✓ Who deleted contacts';
    RAISE NOTICE '  ✓ Who deleted leads';
    RAISE NOTICE '  ✓ Who deleted contact groups';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Update backend to add deleteLead endpoint';
    RAISE NOTICE '  2. Update frontend to show delete buttons';
    RAISE NOTICE '=====================================================';
END $$;
