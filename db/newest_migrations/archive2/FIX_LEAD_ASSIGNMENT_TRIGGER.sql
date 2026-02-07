-- Fix trigger_log_lead_assignment_activity to use correct column name (user_id instead of assigned_to)

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
        SELECT name INTO v_assigned_to_name FROM users WHERE id = NEW.user_id;
        
        -- Log assignment activity
        PERFORM log_user_activity(
            (SELECT tenant_id FROM leads WHERE id = NEW.lead_id),
            NEW.assigned_by,
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

-- Ensure trigger is applied
DROP TRIGGER IF EXISTS trigger_lead_assignment_log ON user_lead_assignments;
CREATE TRIGGER trigger_lead_assignment_log
    AFTER INSERT ON user_lead_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_lead_assignment_activity();
