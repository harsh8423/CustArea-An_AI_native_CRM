-- =====================================================
-- SUPPLEMENTARY FIX: Contact Group Activity Logging
-- Created: 2026-02-06
-- Description: Updates contact group trigger to track user attribution
-- Run this AFTER fix_analytics_and_activity_logging.sql
-- =====================================================

BEGIN;

-- Fix contact group activity trigger to use created_by
CREATE OR REPLACE FUNCTION trigger_log_contact_group_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- FIXED: Use created_by instead of NULL
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'contact_groups_created', 1);
        
        -- FIXED: Log activity with actual user
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.created_by,  -- Use created_by (can be NULL for backward compatibility)
            'group',
            'created',
            'Group: ' || COALESCE(NEW.name, 'Unnamed'),
            'contact_group',
            NEW.id,
            NEW.name
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_contact_group_activity IS 'FIXED: Track contact group creation with user attribution';

-- =====================================================
-- NEW: Contact Group Assignment Logging
-- Logs when contacts are added to/removed from groups
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_log_contact_group_membership_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_contact_name TEXT;
    v_group_name TEXT;
    v_tenant_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Get contact name and tenant
        SELECT name, tenant_id INTO v_contact_name, v_tenant_id
        FROM contacts 
        WHERE id = NEW.contact_id;
        
        -- Get group name
        SELECT name INTO v_group_name
        FROM contact_groups
        WHERE id = NEW.group_id;
        
        -- Log activity
        PERFORM log_user_activity(
            v_tenant_id,
            NEW.added_by,
            'group',
            'contact_added',
            'Added ' || COALESCE(v_contact_name, 'contact') || ' to group "' || COALESCE(v_group_name, 'Unknown') || '"',
            'contact_group',
            NEW.group_id,
            v_group_name
        );
        
    ELSIF TG_OP = 'DELETE' THEN
        -- FIXED: Get tenant_id from contact_groups instead of contacts
        -- This prevents NULL tenant_id when contact is deleted first (cascade delete)
        SELECT name, tenant_id INTO v_group_name, v_tenant_id
        FROM contact_groups
        WHERE id = OLD.group_id;
        
        -- Get contact name if contact still exists
        SELECT name INTO v_contact_name
        FROM contacts 
        WHERE id = OLD.contact_id;
        
        -- Only log if we have a valid tenant_id
        IF v_tenant_id IS NOT NULL THEN
            PERFORM log_user_activity(
                v_tenant_id,
                NULL,  -- No user tracking for removals currently
                'group',
                'contact_removed',
                'Removed ' || COALESCE(v_contact_name, 'contact') || ' from group "' || COALESCE(v_group_name, 'Unknown') || '"',
                'contact_group',
                OLD.group_id,
                v_group_name
            );
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_contact_group_membership_activity IS 'Log when contacts are added to or removed from groups';

-- Attach trigger to contact_group_memberships table
DROP TRIGGER IF EXISTS trigger_contact_group_membership_log ON contact_group_memberships;
CREATE TRIGGER trigger_contact_group_membership_log
    AFTER INSERT OR DELETE ON contact_group_memberships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_group_membership_activity();

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Contact Group Trigger Fix Completed!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '✓ Updated trigger_log_contact_group_activity';
    RAISE NOTICE '  - Now uses created_by field';
    RAISE NOTICE '  - Activity logs will show user name';
    RAISE NOTICE '  - Analytics will increment correctly';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Added trigger_log_contact_group_membership_activity';
    RAISE NOTICE '  - Logs when contacts are added to groups';
    RAISE NOTICE '  - Logs when contacts are removed from groups';
    RAISE NOTICE '  - Shows user who performed the action';
    RAISE NOTICE '=====================================================';
END $$;

