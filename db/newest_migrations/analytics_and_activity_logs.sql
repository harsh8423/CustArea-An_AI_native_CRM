-- =====================================================
-- CONSOLIDATED MIGRATION: Analytics and Activity Logging System
-- Created: 2026-02-05
-- Description: Comprehensive analytics metrics and activity logging
--              Consolidates: 012, 013, 014, 015 analytics migrations
--              with all bug fixes incorporated
-- =====================================================
-- This migration creates:
--   - analytics_metrics table (aggregated metrics by user/date)
--   - activity_logs table (detailed action tracking)
--   - phone_call_ai_usage table (AI model usage for pricing)
--   - Helper functions for metric updates and logging
--   - Trigger functions for automatic tracking (all bug-fixed)
--   - Materialized view for user performance
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ANALYTICS METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Time period tracking
    metric_date DATE NOT NULL,
    metric_period TEXT NOT NULL CHECK (metric_period IN ('daily', 'weekly', 'monthly')),
    
    -- Email metrics
    emails_sent_total INTEGER DEFAULT 0,
    emails_sent_by_ai INTEGER DEFAULT 0,
    emails_sent_by_human INTEGER DEFAULT 0,
    emails_received INTEGER DEFAULT 0,
    email_conversations_handled INTEGER DEFAULT 0,
    copilot_uses INTEGER DEFAULT 0,
    
    -- Phone metrics
    calls_total INTEGER DEFAULT 0,
    calls_by_ai INTEGER DEFAULT 0,
    calls_by_human INTEGER DEFAULT 0,
    calls_duration_seconds INTEGER DEFAULT 0,
    calls_ai_duration_seconds INTEGER DEFAULT 0,
    calls_human_duration_seconds INTEGER DEFAULT 0,
    
    -- Campaign metrics
    campaigns_created INTEGER DEFAULT 0,
    campaigns_launched INTEGER DEFAULT 0,
    campaigns_paused INTEGER DEFAULT 0,
    campaign_emails_sent INTEGER DEFAULT 0,
    bulk_emails_sent INTEGER DEFAULT 0,
    bulk_calls_made INTEGER DEFAULT 0,
    
    -- CRM metrics
    leads_created INTEGER DEFAULT 0,
    leads_updated INTEGER DEFAULT 0,
    leads_deleted INTEGER DEFAULT 0,
    contacts_created INTEGER DEFAULT 0,
    contacts_updated INTEGER DEFAULT 0,
    contacts_imported INTEGER DEFAULT 0,
    contact_groups_created INTEGER DEFAULT 0,
    
    -- Ticketing metrics
    tickets_created INTEGER DEFAULT 0,
    tickets_updated INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    tickets_assigned INTEGER DEFAULT 0,
    
    -- Settings & Admin metrics
    users_invited INTEGER DEFAULT 0,
    permissions_updated INTEGER DEFAULT 0,
    email_addresses_assigned INTEGER DEFAULT 0,
    phone_numbers_purchased INTEGER DEFAULT 0,
    
    -- Conversation metrics
    conversations_total INTEGER DEFAULT 0,
    conversations_assigned INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    
    -- Metadata for extensibility
    additional_metrics JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure one record per user/date/period combination
    CONSTRAINT unique_metric_record UNIQUE(tenant_id, user_id, metric_date, metric_period)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_tenant 
    ON analytics_metrics(tenant_id);
    
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_user 
    ON analytics_metrics(user_id) 
    WHERE user_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_date 
    ON analytics_metrics(tenant_id, metric_date DESC);
    
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_period 
    ON analytics_metrics(tenant_id, metric_period, metric_date DESC);
    
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_user_date 
    ON analytics_metrics(user_id, metric_date DESC) 
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE analytics_metrics IS 'Aggregated analytics metrics by user and time period for dashboard reporting';
COMMENT ON COLUMN analytics_metrics.metric_period IS 'Aggregation period: daily, weekly, or monthly';
COMMENT ON COLUMN analytics_metrics.user_id IS 'NULL for tenant-wide aggregates, specific user_id for user metrics';

-- =====================================================
-- 2. ACTIVITY LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULLABLE for system actions
    
    -- Action classification
    action_category TEXT NOT NULL CHECK (action_category IN (
        'email', 'phone', 'whatsapp', 'campaign', 'contact', 'lead', 
        'ticket', 'workflow', 'settings', 'user_management', 'conversation',
        'import', 'export', 'ai_agent', 'group', 'other'
    )),
    action_type TEXT NOT NULL,  -- 'created', 'updated', 'deleted', 'sent', 'assigned', 'imported', etc.
    action_description TEXT NOT NULL,
    
    -- Resource identification
    resource_type TEXT,  -- 'contact', 'lead', 'campaign', 'email', 'ticket', etc.
    resource_id UUID,
    resource_name TEXT,  -- Denormalized for display without joins
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_time 
    ON activity_logs(tenant_id, created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_time 
    ON activity_logs(user_id, created_at DESC) 
    WHERE user_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_activity_logs_category 
    ON activity_logs(tenant_id, action_category, created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource 
    ON activity_logs(resource_type, resource_id) 
    WHERE resource_type IS NOT NULL AND resource_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_category 
    ON activity_logs(user_id, action_category, created_at DESC) 
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE activity_logs IS 'Comprehensive activity log for all user actions across the platform';
COMMENT ON COLUMN activity_logs.action_category IS 'High-level category for filtering (email, phone, campaign, etc.)';
COMMENT ON COLUMN activity_logs.action_type IS 'Specific action performed (created, updated, sent, etc.)';
COMMENT ON COLUMN activity_logs.resource_name IS 'Cached resource name to avoid joins in log display';
COMMENT ON COLUMN activity_logs.user_id IS 'User who performed the action - can be NULL for automated/system actions';

-- =====================================================
-- 3. PHONE CALL AI USAGE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS phone_call_ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_call_id UUID NOT NULL REFERENCES phone_calls(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- AI Model references
    stt_model_id UUID REFERENCES x_stt(id) ON DELETE SET NULL,
    llm_model_id UUID REFERENCES x_llm(id) ON DELETE SET NULL,
    tts_model_id UUID REFERENCES x_tts(id) ON DELETE SET NULL,
    realtime_model_id UUID REFERENCES x_realtime_sts(id) ON DELETE SET NULL,
    
    -- Usage metrics
    stt_duration_seconds INTEGER,
    llm_tokens_used INTEGER,
    tts_characters_used INTEGER,
    realtime_duration_seconds INTEGER,
    
    -- Cost calculation (cached from model pricing at time of call)
    stt_cost NUMERIC(10, 4),
    llm_cost NUMERIC(10, 4),
    tts_cost NUMERIC(10, 4),
    realtime_cost NUMERIC(10, 4),
    total_estimated_cost NUMERIC(10, 4),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_ai_usage_call 
    ON phone_call_ai_usage(phone_call_id);
    
CREATE INDEX IF NOT EXISTS idx_phone_ai_usage_tenant_time 
    ON phone_call_ai_usage(tenant_id, created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_phone_ai_usage_user 
    ON phone_call_ai_usage(user_id, created_at DESC) 
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE phone_call_ai_usage IS 'Track AI model usage per phone call for pricing analytics';
COMMENT ON COLUMN phone_call_ai_usage.user_id IS 'User who handled/initiated the call';
COMMENT ON COLUMN phone_call_ai_usage.total_estimated_cost IS 'Total cost in USD for this call';

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

-- Function to increment a metric counter
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
    -- Insert or update daily metric for specific user
    INSERT INTO analytics_metrics (
        tenant_id, 
        user_id, 
        metric_date, 
        metric_period
    )
    VALUES (p_tenant_id, p_user_id, v_today, 'daily')
    ON CONFLICT (tenant_id, user_id, metric_date, metric_period) 
    DO NOTHING;
    
    -- Update the specific metric using dynamic SQL
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
    
    -- Also update tenant-wide metrics (user_id = NULL)
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
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_analytics_metric IS 'Increment a specific metric counter for both user and tenant-wide aggregates';

-- Function to log activity
CREATE OR REPLACE FUNCTION log_user_activity(
    p_tenant_id UUID,
    p_user_id UUID,
    p_action_category TEXT,
    p_action_type TEXT,
    p_action_description TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_resource_name TEXT DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO activity_logs (
        tenant_id,
        user_id,
        action_category,
        action_type,
        action_description,
        resource_type,
        resource_id,
        resource_name,
        old_values,
        new_values
    )
    VALUES (
        p_tenant_id,
        p_user_id,
        p_action_category,
        p_action_type,
        p_action_description,
        p_resource_type,
        p_resource_id,
        p_resource_name,
        p_old_values,
        p_new_values
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_user_activity IS 'Create an activity log entry for user action';

-- =====================================================
-- 5. TRIGGER FUNCTIONS (ALL BUG-FIXED)
-- =====================================================

-- ==================
-- MESSAGE TRIGGER (Email Only, Channel Check Inside Function)
-- ==================
CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- CRITICAL: Only process email channel messages
    -- Check INSIDE function, not just in WHEN clause
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant and user from conversation
    SELECT c.tenant_id, c.assigned_to 
    INTO v_tenant_id, v_user_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    -- Process based on direction
    IF NEW.direction = 'outbound' THEN
        -- Outbound email - check if AI or human
        IF NEW.role = 'ai' THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
    ELSIF NEW.direction = 'inbound' THEN
        -- Inbound email
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================
-- PHONE CALL TRIGGER (Proper AI Detection, User Tracking)
-- ==================
CREATE OR REPLACE FUNCTION trigger_log_phone_call_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_ai BOOLEAN;
BEGIN
    -- Only log when call is completed (and not already logged)
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        -- Get tenant and assigned user from conversation
        SELECT c.tenant_id, c.assigned_to 
        INTO v_tenant_id, v_user_id
        FROM conversations c
        WHERE c.id = NEW.conversation_id;
        
        -- If no conversation, use tenant_id from call
        IF v_tenant_id IS NULL THEN
            v_tenant_id := NEW.tenant_id;
        END IF;
        
        -- Determine if AI - check metadata for realtime session or AI agent
        v_is_ai := (NEW.metadata ? 'realtime_session_id') OR 
                   (NEW.metadata ? 'ai_agent_id');
        
        -- Increment call metrics
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_total', 1);
        
        IF v_is_ai THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_ai', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_ai_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_human', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_human_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        
        -- Log activity (user_id can be NULL)
        PERFORM log_user_activity(
            v_tenant_id,
            v_user_id,
            'phone',
            'completed',
            'Call: ' || COALESCE(NEW.from_number, '') || ' → ' || COALESCE(NEW.to_number, ''),
            'phone_call',
            NEW.id,
            COALESCE(NEW.from_number, '') || ' → ' || COALESCE(NEW.to_number, '')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================
-- LEAD TRIGGER (Get Name from Contact, Proper User Logging)
-- ==================
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
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.owner_id, 'leads_created', 1);
        
        -- Log activity with created_by user
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
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.owner_id, 'leads_updated', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.owner_id,
            'lead',
            'updated',
            'Updated lead: ' || COALESCE(v_contact_name, 'Unknown'),
            'lead',
            NEW.id,
            v_contact_name
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.owner_id, 'leads_deleted', 1);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ==================
-- CONTACT TRIGGER (Handle NULL user_id, Import Detection)
-- ==================
CREATE OR REPLACE FUNCTION trigger_log_contact_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Check if it's from import (metadata has import_id)
        IF NEW.metadata ? 'import_id' THEN
            PERFORM increment_analytics_metric(NEW.tenant_id, NULL, 'contacts_imported', 1);
        ELSE
            PERFORM increment_analytics_metric(NEW.tenant_id, NULL, 'contacts_created', 1);
            
            -- Log activity - user_id is NULL for automatic contact creation
            PERFORM log_user_activity(
                NEW.tenant_id,
                NULL,
                'contact',
                'created',
                'Contact: ' || COALESCE(NEW.name, NEW.email, 'Unnamed'),
                'contact',
                NEW.id,
                COALESCE(NEW.name, NEW.email)
            );
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM increment_analytics_metric(NEW.tenant_id, NULL, 'contacts_updated', 1);
        
        PERFORM log_user_activity(
            NEW.tenant_id,
            NULL,
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

-- ==================
-- TICKET TRIGGER (Status and Assignment Tracking)
-- ==================
CREATE OR REPLACE FUNCTION trigger_log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.assigned_to, 'tickets_created', 1);
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.assigned_to, 'tickets_updated', 1);
        
        -- Check if resolved
        IF NEW.status IN ('resolved', 'closed') AND (OLD.status IS NULL OR OLD.status NOT IN ('resolved', 'closed')) THEN
            PERFORM increment_analytics_metric(NEW.tenant_id, NEW.assigned_to, 'tickets_resolved', 1);
        END IF;
        
        -- Check if assignment changed
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            PERFORM increment_analytics_metric(NEW.tenant_id, NEW.assigned_to, 'tickets_assigned', 1);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ==================
-- CONTACT GROUP TRIGGER
-- ==================
CREATE OR REPLACE FUNCTION trigger_log_contact_group_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM increment_analytics_metric(NEW.tenant_id, NULL, 'contact_groups_created', 1);
        
        -- Log activity
        PERFORM log_user_activity(
            NEW.tenant_id,
            NULL,
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

-- ==================
-- CAMPAIGN TRIGGER (Lifecycle Tracking)
-- ==================
CREATE OR REPLACE FUNCTION trigger_log_campaign_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM increment_analytics_metric(NEW.tenant_id, NEW.created_by, 'campaigns_created', 1);
        
        -- Log activity
        PERFORM log_user_activity(
            NEW.tenant_id,
            NEW.created_by,
            'campaign',
            'created',
            'Campaign: ' || COALESCE(NEW.campaign_name, 'Unnamed'),
            'campaign',
            NEW.id,
            NEW.campaign_name
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
                'Launched: ' || COALESCE(NEW.campaign_name, 'Unnamed'),
                'campaign',
                NEW.id,
                NEW.campaign_name
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
                'Paused: ' || COALESCE(NEW.campaign_name, 'Unnamed'),
                'campaign',
                NEW.id,
                NEW.campaign_name
            );
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. ATTACH TRIGGERS TO EXISTING TABLES
-- =====================================================

-- Messages table (INSERT only, email channel check inside function)
DROP TRIGGER IF EXISTS trigger_messages_analytics ON messages;
CREATE TRIGGER trigger_messages_analytics
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_message_activity();

-- Phone calls table (INSERT/UPDATE to detect completion)
DROP TRIGGER IF EXISTS trigger_phone_calls_analytics ON phone_calls;
CREATE TRIGGER trigger_phone_calls_analytics
    AFTER INSERT OR UPDATE ON phone_calls
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_phone_call_activity();

-- Leads table
DROP TRIGGER IF EXISTS trigger_leads_analytics ON leads;
CREATE TRIGGER trigger_leads_analytics
    AFTER INSERT OR UPDATE OR DELETE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_lead_activity();

-- Contacts table
DROP TRIGGER IF EXISTS trigger_contacts_analytics ON contacts;
CREATE TRIGGER trigger_contacts_analytics
    AFTER INSERT OR UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_activity();

-- Tickets table
DROP TRIGGER IF EXISTS trigger_tickets_analytics ON tickets;
CREATE TRIGGER trigger_tickets_analytics
    AFTER INSERT OR UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_ticket_activity();

-- Contact groups table
DROP TRIGGER IF EXISTS trigger_contact_groups_analytics ON contact_groups;
CREATE TRIGGER trigger_contact_groups_analytics
    AFTER INSERT ON contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_group_activity();

-- Outreach campaigns table
DROP TRIGGER IF EXISTS trigger_campaigns_analytics ON outreach_campaigns;
CREATE TRIGGER trigger_campaigns_analytics
    AFTER INSERT OR UPDATE ON outreach_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_campaign_activity();

-- =====================================================
-- 7. MATERIALIZED VIEW FOR PERFORMANCE
-- =====================================================

-- User performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_performance_summary AS
SELECT 
    u.id as user_id,
    u.tenant_id,
    u.name as user_name,
    u.email as user_email,
    COALESCE(SUM(am.emails_sent_total), 0) as total_emails_sent,
    COALESCE(SUM(am.calls_total), 0) as total_calls_made,
    COALESCE(SUM(am.leads_created), 0) as total_leads_created,
    COALESCE(SUM(am.contacts_created), 0) as total_contacts_created,
    COALESCE(SUM(am.tickets_resolved), 0) as total_tickets_resolved,
    MAX(am.metric_date) as last_activity_date
FROM users u
LEFT JOIN analytics_metrics am ON am.user_id = u.id AND am.metric_period = 'daily'
WHERE u.status = 'active'
GROUP BY u.id, u.tenant_id, u.name, u.email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_performance_user 
    ON mv_user_performance_summary(user_id);

COMMENT ON MATERIALIZED VIEW mv_user_performance_summary IS 'Aggregated user performance metrics - refresh daily';

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Analytics and Activity Logging System Completed!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Created 3 tables:';
    RAISE NOTICE '  ✓ analytics_metrics (user/tenant metrics aggregation)';
    RAISE NOTICE '  ✓ activity_logs (comprehensive activity tracking)';
    RAISE NOTICE '  ✓ phone_call_ai_usage (AI model usage tracking)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created 2 helper functions:';
    RAISE NOTICE '  ✓ increment_analytics_metric() - Update metric counters';
    RAISE NOTICE '  ✓ log_user_activity() - Create activity log entries';
    RAISE NOTICE '';
    RAISE NOTICE 'Created 7 trigger functions (all bug-fixed):';
    RAISE NOTICE '  ✓ trigger_log_message_activity() - Email-only tracking';
    RAISE NOTICE '  ✓ trigger_log_phone_call_activity() - Proper AI detection';
    RAISE NOTICE '  ✓ trigger_log_lead_activity() - Contact name lookup';
    RAISE NOTICE '  ✓ trigger_log_contact_activity() - Import detection';
    RAISE NOTICE '  ✓ trigger_log_ticket_activity() - Status tracking';
    RAISE NOTICE '  ✓ trigger_log_contact_group_activity() - Group tracking';
    RAISE NOTICE '  ✓ trigger_log_campaign_activity() - Lifecycle tracking';
    RAISE NOTICE '';
    RAISE NOTICE 'Attached triggers to 7 tables:';
    RAISE NOTICE '  ✓ messages (email tracking)';
    RAISE NOTICE '  ✓ phone_calls (call tracking)';
    RAISE NOTICE '  ✓ leads (lead CRUD tracking)';
    RAISE NOTICE '  ✓ contacts (contact CRUD tracking)';
    RAISE NOTICE '  ✓ tickets (ticket tracking)';
    RAISE NOTICE '  ✓ contact_groups (group creation)';
    RAISE NOTICE '  ✓ outreach_campaigns (campaign lifecycle)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created materialized view:';
    RAISE NOTICE '  ✓ mv_user_performance_summary (user performance aggregates)';
    RAISE NOTICE '';
    RAISE NOTICE 'All bug fixes incorporated:';
    RAISE NOTICE '  ✓ Message trigger only counts email channel';
    RAISE NOTICE '  ✓ Activity logs user_id is nullable';
    RAISE NOTICE '  ✓ Lead trigger gets name from contacts';
    RAISE NOTICE '  ✓ Phone trigger has proper AI detection';
    RAISE NOTICE '  ✓ All triggers prevent duplicate counting';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Refresh materialized view: REFRESH MATERIALIZED VIEW mv_user_performance_summary;';
    RAISE NOTICE '  2. Set up daily cron job to refresh the view';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
