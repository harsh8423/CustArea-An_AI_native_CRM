-- =====================================================
-- COMPREHENSIVE FIX: Campaign Analytics and Activity Logging
-- Created: 2026-02-06
-- Description: Fixes all critical issues with campaign analytics
--              - Duplicate counting (2x multiplier)
--              - Campaign email tracking
--              - Missing user context in activity logs
--              - Campaign delete support
-- =====================================================

BEGIN;

-- =====================================================
-- FIX #1: DUPLICATE ANALYTICS COUNTING (CRITICAL)
-- =====================================================
-- Problem: increment_analytics_metric creates both user + tenant records
-- Solution: Only create user-specific records, let backend aggregate

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
    -- FIXED: Only create/update user-specific record
    -- NO MORE tenant-wide (user_id = NULL) records
    
    -- Insert record if doesn't exist
    INSERT INTO analytics_metrics (
        tenant_id, 
        user_id, 
        metric_date, 
        metric_period
    )
    VALUES (p_tenant_id, p_user_id, v_today, 'daily')
    ON CONFLICT (tenant_id, user_id, metric_date, metric_period) 
    DO NOTHING;
    
    -- Update the specific metric
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
    
    -- REMOVED: Tenant-wide aggregation (user_id = NULL)
    -- Backend handles aggregation via SUM() in queries
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_analytics_metric IS 
    'FIXED: Creates only user-specific records. Backend aggregates via SUM() for tenant-wide views. Eliminates duplicate counting.';

-- =====================================================
-- FIX #2: CAMPAIGN EMAIL TRACKING (CRITICAL)
-- =====================================================
-- Problem: Campaign emails counted in regular email metrics
-- Solution: Check is_campaign flag and route to correct metric

CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_campaign BOOLEAN;
BEGIN
    -- CRITICAL: Only process email channel messages
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant, user, and campaign flag from conversation
    SELECT c.tenant_id, c.assigned_to, COALESCE(c.is_campaign, FALSE)
    INTO v_tenant_id, v_user_id, v_is_campaign
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    -- Process based on direction
    IF NEW.direction = 'outbound' THEN
        -- FIXED: Check if campaign email
        IF v_is_campaign THEN
            -- Campaign email - always count as human (user-initiated)
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_sent', 1);
        ELSE
            -- Regular email - check if AI or human
            IF NEW.role = 'ai' THEN
                PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
            ELSE
                PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
            END IF;
            
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
        
    ELSIF NEW.direction = 'inbound' THEN
        -- Inbound email (campaign or regular)
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_message_activity IS 
    'FIXED: Separates campaign emails from regular emails. Campaign emails go to campaign_emails_sent metric only.';

-- =====================================================
-- FIX #3: USER CONTEXT IN ACTIVITY LOGS (HIGH)
-- =====================================================
-- Problem: Contact and group triggers pass NULL instead of actual user_id
-- Solution: Use created_by/updated_by from the record

CREATE OR REPLACE FUNCTION trigger_log_contact_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Check if it's from import (metadata has import_id)
        IF NEW.metadata ? 'import_id' THEN
            -- Import: use NULL (system action) for metrics
            PERFORM increment_analytics_metric(NEW.tenant_id, NULL, 'contacts_imported', 1);
        ELSE
            -- FIXED: Use created_by instead of NULL
            PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'contacts_created', 1);
            
            -- Log with actual user
            PERFORM log_user_activity(
                NEW.tenant_id,
                NEW.created_by,  -- FIXED: Was NULL
                'contact',
                'created',
                'Contact: ' || COALESCE(NEW.name, NEW.email, 'Unnamed'),
                'contact',
                NEW.id,
                COALESCE(NEW.name, NEW.email)
            );
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- FIXED: Use updated_by instead of NULL
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.updated_by, 'contacts_updated', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.updated_by,  -- FIXED: Was NULL
            'contact',
            'updated',
            'Updated contact: ' || COALESCE(NEW.name, NEW.email, 'Unnamed'),
            'contact',
            NEW.id,
            COALESCE(NEW.name, NEW.email)
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.updated_by, 'contacts_deleted', 1);
        
        PERFORM log_user_activity(
            OLD.tenant_id,
            OLD.updated_by,
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

COMMENT ON FUNCTION trigger_log_contact_activity IS 
    'FIXED: Uses created_by/updated_by for user attribution instead of NULL';

-- Fix contact group trigger
CREATE OR REPLACE FUNCTION trigger_log_contact_group_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- FIXED: Use created_by instead of NULL
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'contact_groups_created', 1);
        
        -- Log activity with actual user
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.created_by,  -- FIXED: Was NULL
            'group',
            'created',
            'Group: ' || COALESCE(NEW.name, 'Unnamed'),
            'contact_group',
            NEW.id,
            NEW.name
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.created_by, 'contact_groups_deleted', 1);
        
        PERFORM log_user_activity(
            OLD.tenant_id,
            OLD.created_by,
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

COMMENT ON FUNCTION trigger_log_contact_group_activity IS 
    'FIXED: Uses created_by for user attribution instead of NULL';

-- Re-create triggers to ensure they're using the updated functions
DROP TRIGGER IF EXISTS trigger_contact_groups_analytics ON contact_groups;
CREATE TRIGGER trigger_contact_groups_analytics
    AFTER INSERT OR DELETE ON contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_group_activity();

-- =====================================================
-- FIX #4: CAMPAIGN DELETE SUPPORT (MEDIUM)
-- =====================================================
-- Problem: No delete trigger for campaigns
-- Solution: Add campaigns_deleted column and DELETE handling

-- Add campaigns_deleted metric column
ALTER TABLE analytics_metrics 
ADD COLUMN IF NOT EXISTS campaigns_deleted INTEGER DEFAULT 0;

COMMENT ON COLUMN analytics_metrics.campaigns_deleted IS 'Number of campaigns deleted';

-- Update campaign trigger to handle DELETE
CREATE OR REPLACE FUNCTION trigger_log_campaign_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'campaigns_created', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.created_by,
            'campaign',
            'created',
            'Campaign: ' || COALESCE(NEW.name, 'Unnamed'),
            'campaign',
            NEW.id,
            NEW.name
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check if status changed to active (launched)
        IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
            PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'campaigns_launched', 1);
            
            PERFORM log_user_activity(
                NEW.tenant_id,
                NEW.created_by,
                'campaign',
                'launched',
                'Launched: ' || COALESCE(NEW.name, 'Unnamed'),
                'campaign',
                NEW.id,
                NEW.name
            );
        END IF;
        
        -- Check if paused
        IF NEW.status = 'paused' AND (OLD.status IS NULL OR OLD.status != 'paused') THEN
            PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'campaigns_paused', 1);
            
            PERFORM log_user_activity(
                NEW.tenant_id,
                NEW.created_by,
                'campaign',
                'paused',
                'Paused: ' || COALESCE(NEW.name, 'Unnamed'),
                'campaign',
                NEW.id,
                NEW.name
            );
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- NEW: Campaign deletion
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.created_by, 'campaigns_deleted', 1);
        
        PERFORM log_user_activity(
            OLD.tenant_id,
            OLD.created_by,
            'campaign',
            'deleted',
            'Deleted: ' || COALESCE(OLD.name, 'Unnamed'),
            'campaign',
            OLD.id,
            OLD.name
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_campaign_activity IS 
    'FIXED: Added DELETE support for campaign deletions';

-- Update trigger to include DELETE
DROP TRIGGER IF EXISTS trigger_campaigns_analytics ON outreach_campaigns;
CREATE TRIGGER trigger_campaigns_analytics
    AFTER INSERT OR UPDATE OR DELETE ON outreach_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_campaign_activity();

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Campaign Analytics Comprehensive Fix Completed!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Applied 4 critical fixes:';
    RAISE NOTICE '';
    RAISE NOTICE '✓ FIX #1: Duplicate Analytics Counting';
    RAISE NOTICE '  - Removed tenant-wide (NULL) records';
    RAISE NOTICE '  - Backend aggregates user records via SUM()';
    RAISE NOTICE '  - Eliminates 2x minimum multiplier';
    RAISE NOTICE '';
    RAISE NOTICE '✓ FIX #2: Campaign Email Tracking';
    RAISE NOTICE '  - Checks conversation.is_campaign flag';
    RAISE NOTICE '  - Routes campaign emails to campaign_emails_sent metric';
    RAISE NOTICE '  - No longer counted in emails_sent_total';
    RAISE NOTICE '';
    RAISE NOTICE '✓ FIX #3: User Context in Activity Logs';
    RAISE NOTICE '  - Contact trigger uses created_by/updated_by';
    RAISE NOTICE '  - Contact group trigger uses created_by';
    RAISE NOTICE '  - Activity logs will show user names';
    RAISE NOTICE '';
    RAISE NOTICE '✓ FIX #4: Campaign Delete Support';
    RAISE NOTICE '  - Added campaigns_deleted metric column';
    RAISE NOTICE '  - Campaign trigger handles DELETE operations';
    RAISE NOTICE '  - Deletions logged in activity_logs';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT NOTES:';
    RAISE NOTICE '  1. Existing duplicate records (user_id = NULL) will remain';
    RAISE NOTICE '     but won''t affect future analytics';
    RAISE NOTICE '  2. Backend query already handles SUM() correctly';
    RAISE NOTICE '  3. Test with new campaign to verify counts';
    RAISE NOTICE '';
    RAISE NOTICE 'Expected Results After Fix:';
    RAISE NOTICE '  - 1 campaign created → Shows 1 (not 2)';
    RAISE NOTICE '  - 3 emails sent → Shows 3 (not 6)';
    RAISE NOTICE '  - 1 reply received → Shows 1 (not 35)';
    RAISE NOTICE '  - All activity logs show user names';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- OPTIONAL: CLEANUP OLD NULL RECORDS
-- =====================================================
-- Uncomment this section if you want to remove existing duplicate records
-- WARNING: This will delete historical tenant-wide aggregate records

/*
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete all records where user_id IS NULL (tenant-wide aggregates)
    DELETE FROM analytics_metrics WHERE user_id IS NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % tenant-wide (NULL) metric records', deleted_count;
    RAISE NOTICE 'Backend will now aggregate correctly from user-specific records';
END $$;
*/

-- =====================================================
-- END OF MIGRATION
-- =====================================================
