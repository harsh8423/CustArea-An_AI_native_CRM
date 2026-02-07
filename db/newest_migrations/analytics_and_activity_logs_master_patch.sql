-- =====================================================
-- MASTER PATCH: Analytics and Activity Logging System
-- Created: 2026-02-06
-- Description: Comprehensive patch that supersedes ALL individual fix files
--              Apply this AFTER analytics_and_activity_logs.sql
-- 
-- This patch consolidates 16 individual fixes:
--   - fix_analytics_and_activity_logging.sql
--   - fix_analytics_null_user.sql
--   - fix_analytics_unique_constraint.sql
--   - fix_campaign_analytics_comprehensive.sql
--   - fix_ai_attribution.sql
--   - fix_campaign_email_counting.sql
--   - fix_campaign_email_tracking_complete.sql
--   - fix_analytics_duplication.sql
--   - fix_campaign_analytics_v2.sql
--   - fix_campaign_analytics_v3.sql
--   - fix_campaign_response_analytics.sql
--   - fix_phone_analytics_trigger.sql
--   - fix_contact_group_trigger.sql
--   - add_delete_activity_logging.sql
--   - add_missing_analytics_columns.sql
--   - resync_analytics_real_data.sql
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: SCHEMA ALTERATIONS
-- =====================================================

-- 1.1 Add user tracking columns to contacts
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 1.2 Add user tracking columns to leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 1.3 Add deleted_by to contact_groups
ALTER TABLE contact_groups 
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 1.4 Add missing analytics columns
ALTER TABLE analytics_metrics 
ADD COLUMN IF NOT EXISTS campaign_emails_received INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS campaigns_deleted INTEGER DEFAULT 0;

-- 1.5 Add campaign response tracking columns
ALTER TABLE campaign_analytics
ADD COLUMN IF NOT EXISTS total_sent_by_ai INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sent_by_human INT DEFAULT 0;

-- 1.6 Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_by ON contacts(updated_by);
CREATE INDEX IF NOT EXISTS idx_leads_updated_by ON leads(updated_by);
CREATE INDEX IF NOT EXISTS idx_analytics_campaign_metrics 
    ON analytics_metrics(tenant_id, user_id, campaign_emails_sent, campaign_emails_received) 
    WHERE campaign_emails_sent > 0 OR campaign_emails_received > 0;

-- 1.7 Add unique constraint to prevent duplicate messages
DO $$
BEGIN
    -- Clean up existing duplicates first
    DELETE FROM messages a USING (
        SELECT MIN(ctid) as ctid, provider_message_id, tenant_id
        FROM messages 
        WHERE provider_message_id IS NOT NULL
        GROUP BY provider_message_id, tenant_id
        HAVING COUNT(*) > 1
    ) b
    WHERE a.provider_message_id = b.provider_message_id 
    AND a.tenant_id = b.tenant_id 
    AND a.ctid <> b.ctid;
    
    -- Add constraint
    ALTER TABLE messages 
    ADD CONSTRAINT unique_message_provider_id 
    UNIQUE (tenant_id, provider_message_id);
EXCEPTION
    WHEN duplicate_object THEN NULL; -- Constraint already exists
END $$;

-- 1.8 Comments for new columns
COMMENT ON COLUMN contacts.created_by IS 'User who created this contact';
COMMENT ON COLUMN contacts.updated_by IS 'User who last updated this contact';
COMMENT ON COLUMN contacts.deleted_by IS 'User who deleted this contact (if soft delete is implemented)';
COMMENT ON COLUMN leads.updated_by IS 'User who last updated this lead';
COMMENT ON COLUMN leads.deleted_by IS 'User who deleted this lead (if soft delete is implemented)';
COMMENT ON COLUMN contact_groups.deleted_by IS 'User who deleted this group (if soft delete is implemented)';
COMMENT ON COLUMN analytics_metrics.campaign_emails_received IS 'Number of emails received in campaign conversations';
COMMENT ON COLUMN analytics_metrics.campaigns_deleted IS 'Number of campaigns deleted';

-- =====================================================
-- PART 2: FIX UNIQUE CONSTRAINTS
-- =====================================================

-- 2.1 Drop old constraint that doesn't handle NULLs properly
ALTER TABLE analytics_metrics DROP CONSTRAINT IF EXISTS unique_metric_record;

-- 2.2 Consolidate duplicate records before creating unique indexes
WITH duplicates AS (
    SELECT 
        tenant_id,
        user_id,
        metric_date,
        metric_period,
        (array_agg(id ORDER BY created_at))[1] as keep_id,
        SUM(emails_sent_total) as sum_emails_sent_total,
        SUM(emails_sent_by_ai) as sum_emails_sent_by_ai,
        SUM(emails_sent_by_human) as sum_emails_sent_by_human,
        SUM(emails_received) as sum_emails_received,
        SUM(campaign_emails_sent) as sum_campaign_emails_sent,
        SUM(campaign_emails_received) as sum_campaign_emails_received,
        SUM(campaigns_created) as sum_campaigns_created,
        SUM(campaigns_launched) as sum_campaigns_launched,
        SUM(campaigns_paused) as sum_campaigns_paused,
        SUM(calls_total) as sum_calls_total,
        SUM(calls_by_ai) as sum_calls_by_ai,
        SUM(calls_by_human) as sum_calls_by_human,
        SUM(leads_created) as sum_leads_created,
        SUM(contacts_created) as sum_contacts_created,
        SUM(tickets_created) as sum_tickets_created,
        SUM(tickets_resolved) as sum_tickets_resolved,
        SUM(messages_sent) as sum_messages_sent,
        COUNT(*) as duplicate_count
    FROM analytics_metrics
    GROUP BY tenant_id, user_id, metric_date, metric_period
    HAVING COUNT(*) > 1
)
UPDATE analytics_metrics a
SET 
    emails_sent_total = d.sum_emails_sent_total,
    emails_sent_by_ai = d.sum_emails_sent_by_ai,
    emails_sent_by_human = d.sum_emails_sent_by_human,
    emails_received = d.sum_emails_received,
    campaign_emails_sent = d.sum_campaign_emails_sent,
    campaign_emails_received = d.sum_campaign_emails_received,
    campaigns_created = d.sum_campaigns_created,
    campaigns_launched = d.sum_campaigns_launched,
    campaigns_paused = d.sum_campaigns_paused,
    calls_total = d.sum_calls_total,
    calls_by_ai = d.sum_calls_by_ai,
    calls_by_human = d.sum_calls_by_human,
    leads_created = d.sum_leads_created,
    contacts_created = d.sum_contacts_created,
    tickets_created = d.sum_tickets_created,
    tickets_resolved = d.sum_tickets_resolved,
    messages_sent = d.sum_messages_sent,
    updated_at = now()
FROM duplicates d
WHERE a.id = d.keep_id;

-- 2.3 Delete duplicate rows
DELETE FROM analytics_metrics a
USING (
    SELECT 
        tenant_id,
        user_id,
        metric_date,
        metric_period,
        (array_agg(id ORDER BY created_at))[1] as keep_id
    FROM analytics_metrics
    GROUP BY tenant_id, user_id, metric_date, metric_period
    HAVING COUNT(*) > 1
) d
WHERE a.tenant_id = d.tenant_id
  AND a.user_id IS NOT DISTINCT FROM d.user_id
  AND a.metric_date = d.metric_date
  AND a.metric_period = d.metric_period
  AND a.id != d.keep_id;

-- 2.4 Create partial unique indexes for NULL-safe uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique_with_user
ON analytics_metrics(tenant_id, user_id, metric_date, metric_period)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique_without_user
ON analytics_metrics(tenant_id, metric_date, metric_period)
WHERE user_id IS NULL;

-- =====================================================
-- PART 3: UPDATE CORE FUNCTIONS (FINAL VERSIONS)
-- =====================================================

-- 3.1 increment_analytics_metric (FINAL VERSION)
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
    -- Insert record if doesn't exist
    INSERT INTO analytics_metrics (
        tenant_id, 
        user_id, 
        metric_date, 
        metric_period
    )
    VALUES (p_tenant_id, p_user_id, v_today, 'daily')
    ON CONFLICT ON CONSTRAINT idx_analytics_unique_with_user
    DO NOTHING
    ON CONFLICT ON CONSTRAINT idx_analytics_unique_without_user
    DO NOTHING;
    
    -- Update the specific metric using IS NOT DISTINCT FROM for NULL-safe comparison
    EXECUTE format(
        'UPDATE analytics_metrics 
         SET %I = COALESCE(%I, 0) + $1, 
             updated_at = now()
         WHERE tenant_id = $2 
           AND user_id IS NOT DISTINCT FROM $3
           AND metric_date = $4 
           AND metric_period = ''daily''',
        p_metric_name, p_metric_name
    ) USING p_increment, p_tenant_id, p_user_id, v_today;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_analytics_metric IS 
    'FINAL: Handles NULL user_id correctly using IS NOT DISTINCT FROM and partial unique indexes';

-- =====================================================
-- PART 4: UPDATE TRIGGER FUNCTIONS (FINAL VERSIONS)
-- =====================================================

-- 4.1 Message Activity Trigger (FINAL VERSION)
CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_is_campaign BOOLEAN := FALSE;
BEGIN
    -- Only process email messages
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant, user, and campaign flag from conversation
    SELECT c.tenant_id, c.assigned_to, COALESCE(c.is_campaign, FALSE)
    INTO v_tenant_id, v_user_id, v_is_campaign
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    IF NEW.direction = 'outbound' THEN
        -- Outbound email - check if AI or human
        -- Support both 'ai' and 'assistant' roles
        IF NEW.role = 'ai' OR NEW.role = 'assistant' THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
        END IF;
        
        -- ALWAYS increment general total emails sent
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
        
        -- ALSO increment campaign-specific metric if this is a campaign email
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_sent', 1);
        END IF;
        
    ELSIF NEW.direction = 'inbound' THEN
        -- Inbound email - ALWAYS count in general metrics
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
        
        -- Also count in campaign metrics if this is a campaign conversation
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_received', 1);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_message_activity IS 
    'FINAL: Campaign emails counted in BOTH general AND campaign metrics. Supports ai/assistant roles.';

-- 4.2 Phone Call Activity Trigger (FINAL VERSION)
CREATE OR REPLACE FUNCTION trigger_log_phone_call_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_ai BOOLEAN;
BEGIN
    -- Only log when call is completed or missed (and not already processed)
    IF (NEW.status = 'completed' OR NEW.status = 'missed') 
       AND (OLD IS NULL OR OLD.status != NEW.status) THEN
        
        -- Get tenant and assigned user from conversation
        SELECT c.tenant_id, c.assigned_to 
        INTO v_tenant_id, v_user_id
        FROM conversations c
        WHERE c.id = NEW.conversation_id;
        
        -- If no conversation linked yet, use tenant_id from call record
        IF v_tenant_id IS NULL THEN
            v_tenant_id := NEW.tenant_id;
        END IF;
        
        -- Determine if AI based on 'method' column
        -- 'realtime', 'ai', 'convrelay' are AI methods
        v_is_ai := (NEW.method = 'realtime') OR 
                   (NEW.method = 'ai') OR 
                   (NEW.method = 'convrelay');
        
        -- Increment total calls metric
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_total', 1);
        
        IF v_is_ai THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_ai', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_ai_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_human', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_human_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        END IF;
        
        -- Track total duration
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        
        -- Log activity in activity_logs
        PERFORM log_user_activity(
            v_tenant_id,
            v_user_id,
            'phone',
            NEW.status, -- 'completed' or 'missed'
            'Call: ' || COALESCE(NEW.from_number, 'Unknown') || ' → ' || COALESCE(NEW.to_number, 'Unknown'),
            'phone_call',
            NEW.id,
            COALESCE(NEW.from_number, '') || ' → ' || COALESCE(NEW.to_number, '')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_phone_call_activity IS 
    'FINAL: Uses method column for AI detection. Handles completed/missed status.';

-- 4.3 Contact Activity Trigger (FINAL VERSION)
CREATE OR REPLACE FUNCTION trigger_log_contact_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Check if it's from import (metadata has import_id)
        IF NEW.metadata ? 'import_id' THEN
            -- Import: use NULL (system action) for metrics
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
        -- Log delete operation
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
    'FINAL: Uses created_by/updated_by with DELETE support. Handles imports.';

-- 4.4 Lead Activity Trigger (FINAL VERSION)
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
        -- Log delete with owner_id
        PERFORM increment_analytics_metric(OLD.tenant_id, OLD.owner_id, 'leads_deleted', 1);
        
        PERFORM log_user_activity(
            OLD.tenant_id,
            OLD.owner_id,
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

COMMENT ON FUNCTION trigger_log_lead_activity IS 
    'FINAL: Uses created_by/updated_by with DELETE support. Fetches contact name.';

-- 4.5 Contact Group Activity Trigger (FINAL VERSION)
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
        -- Log delete operation
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
    'FINAL: Uses created_by with DELETE support.';

-- 4.6 Campaign Activity Trigger (FINAL VERSION)
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
        -- Campaign deletion
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
    'FINAL: Tracks campaign lifecycle including DELETE.';

-- =====================================================
-- PART 5: NEW TRIGGER FUNCTIONS
-- =====================================================

-- 5.1 Contact Assignment Activity
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
            NEW.assigned_by,
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

COMMENT ON FUNCTION trigger_log_contact_assignment_activity IS 'Log contact assignment activities';

-- 5.2 Lead Assignment Activity
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

COMMENT ON FUNCTION trigger_log_lead_assignment_activity IS 'Log lead assignment activities';

-- 5.3 Contact Group Membership Activity
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
        -- Get tenant_id from contact_groups to prevent NULL when contact deleted first
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
                NULL,
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

-- 5.4 Campaign Response Analytics (AI vs Human tracking)
CREATE OR REPLACE FUNCTION trigger_log_campaign_response()
RETURNS TRIGGER AS $$
DECLARE
    v_campaign_id UUID;
BEGIN
    -- Only care about OUTBOUND messages
    IF NEW.direction != 'outbound' THEN
        RETURN NEW;
    END IF;

    -- Check if this conversation is part of a campaign
    SELECT campaign_id INTO v_campaign_id
    FROM conversations
    WHERE id = NEW.conversation_id AND is_campaign = true;

    -- If not a campaign conversation, exit
    IF v_campaign_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Ensure analytics record exists
    INSERT INTO campaign_analytics (id, campaign_id)
    VALUES (v_campaign_id, v_campaign_id)
    ON CONFLICT (campaign_id) DO NOTHING;

    -- Update counts based on role
    IF NEW.role = 'assistant' THEN
        -- AI Response
        UPDATE campaign_analytics
        SET total_sent_by_ai = total_sent_by_ai + 1,
            last_updated_at = now()
        WHERE campaign_id = v_campaign_id;
    ELSIF NEW.role = 'agent' OR NEW.role = 'system' THEN
        -- Human Response (Includes Automated Campaign Steps & Manual Replies)
        UPDATE campaign_analytics
        SET total_sent_by_human = total_sent_by_human + 1,
            last_updated_at = now()
        WHERE campaign_id = v_campaign_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_log_campaign_response IS 'Track AI vs Human campaign message sends';

-- 5.5 Update Campaign Analytics (recalculates from campaign_contacts)
CREATE OR REPLACE FUNCTION update_campaign_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the analytics for this campaign
    INSERT INTO campaign_analytics (id, campaign_id)
    VALUES (NEW.campaign_id, NEW.campaign_id)
    ON CONFLICT (campaign_id) DO NOTHING;
    
    UPDATE campaign_analytics
    SET
        total_contacts_enrolled = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id
        ),
        total_contacts_skipped = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'skipped_no_email'
        ),
        total_contacts_valid = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status != 'skipped_no_email'
        ),
        -- Total emails sent (all time)
        total_emails_sent = (
            SELECT COUNT(*) 
            FROM campaign_contacts 
            WHERE campaign_id = NEW.campaign_id 
              AND status IN ('sent', 'replied', 'bounced')
              AND current_follow_up_step >= 1
        ),
        -- Emails sent TODAY
        emails_sent_today = (
            SELECT COUNT(*)
            FROM campaign_contacts cc
            WHERE cc.campaign_id = NEW.campaign_id
              AND cc.status IN ('sent', 'replied', 'bounced')
              AND DATE(cc.last_sent_at) = CURRENT_DATE
        ),
        today_date = CURRENT_DATE,
        total_replies = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied'
        ),
        total_emails_bounced = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'bounced'
        ),
        -- Update rates
        delivery_rate = CASE 
            WHEN (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status IN ('sent', 'replied', 'bounced')) > 0
            THEN (((SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status IN ('sent', 'replied')) 
                   )::DECIMAL 
                  / (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status IN ('sent', 'replied', 'bounced')) * 100)
            ELSE 0
        END,
        reply_rate = CASE 
            WHEN (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status != 'skipped_no_email') > 0
            THEN ((SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied')::DECIMAL 
                  / (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status != 'skipped_no_email') * 100)
            ELSE 0
        END,
        skip_rate = CASE 
            WHEN (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) > 0
            THEN ((SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'skipped_no_email')::DECIMAL 
                  / (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) * 100)
            ELSE 0
        END,
        last_updated_at = now()
    WHERE campaign_id = NEW.campaign_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_campaign_analytics IS 
    'FINAL: Recalculates campaign analytics including emails_sent_today from campaign_contacts.last_sent_at';

-- =====================================================
-- PART 6: RE-ATTACH ALL TRIGGERS
-- =====================================================

-- 6.1 Messages trigger
DROP TRIGGER IF EXISTS trigger_messages_analytics ON messages;
CREATE TRIGGER trigger_messages_analytics
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_message_activity();

-- 6.2 Phone calls trigger
DROP TRIGGER IF EXISTS trigger_phone_calls_analytics ON phone_calls;
CREATE TRIGGER trigger_phone_calls_analytics
    AFTER INSERT OR UPDATE ON phone_calls
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_phone_call_activity();

-- 6.3 Leads trigger
DROP TRIGGER IF EXISTS trigger_leads_analytics ON leads;
CREATE TRIGGER trigger_leads_analytics
    AFTER INSERT OR UPDATE OR DELETE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_lead_activity();

-- 6.4 Contacts trigger
DROP TRIGGER IF EXISTS trigger_contacts_analytics ON contacts;
CREATE TRIGGER trigger_contacts_analytics
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_activity();

-- 6.5 Contact groups trigger
DROP TRIGGER IF EXISTS trigger_contact_groups_analytics ON contact_groups;
CREATE TRIGGER trigger_contact_groups_analytics
    AFTER INSERT OR DELETE ON contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_group_activity();

-- 6.6 Campaigns trigger
DROP TRIGGER IF EXISTS trigger_campaigns_analytics ON outreach_campaigns;
CREATE TRIGGER trigger_campaigns_analytics
    AFTER INSERT OR UPDATE OR DELETE ON outreach_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_campaign_activity();

-- 6.7 Tickets trigger (unchanged from core)
DROP TRIGGER IF EXISTS trigger_tickets_analytics ON tickets;
CREATE TRIGGER trigger_tickets_analytics
    AFTER INSERT OR UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_ticket_activity();

-- 6.8 Contact assignments trigger (NEW)
DROP TRIGGER IF EXISTS trigger_contact_assignment_log ON user_contact_assignments;
CREATE TRIGGER trigger_contact_assignment_log
    AFTER INSERT ON user_contact_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_assignment_activity();

-- 6.9 Lead assignments trigger (NEW)
DROP TRIGGER IF EXISTS trigger_lead_assignment_log ON user_lead_assignments;
CREATE TRIGGER trigger_lead_assignment_log
    AFTER INSERT ON user_lead_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_lead_assignment_activity();

-- 6.10 Contact group membership trigger (NEW)
DROP TRIGGER IF EXISTS trigger_contact_group_membership_log ON contact_group_memberships;
CREATE TRIGGER trigger_contact_group_membership_log
    AFTER INSERT OR DELETE ON contact_group_memberships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_contact_group_membership_activity();

-- 6.11 Campaign response trigger (NEW)
DROP TRIGGER IF EXISTS trigger_campaign_response_logging ON messages;
CREATE TRIGGER trigger_campaign_response_logging
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_campaign_response();

-- 6.12 Campaign analytics update trigger (if campaign_contacts table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_contacts') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_campaign_analytics ON campaign_contacts';
        EXECUTE 'CREATE TRIGGER trigger_update_campaign_analytics
            AFTER INSERT OR UPDATE ON campaign_contacts
            FOR EACH ROW
            EXECUTE FUNCTION update_campaign_analytics()';
    END IF;
END $$;

-- =====================================================
-- PART 7: BACKFILL CAMPAIGN RESPONSE DATA (OPTIONAL)
-- =====================================================

-- Backfill AI vs Human counts for existing campaigns
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, campaign_id FROM campaign_analytics LOOP
        -- Count AI
        UPDATE campaign_analytics
        SET total_sent_by_ai = (
            SELECT COUNT(*) 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.campaign_id = r.campaign_id
              AND m.direction = 'outbound'
              AND m.role = 'assistant'
        )
        WHERE campaign_id = r.campaign_id;

        -- Count Human
        UPDATE campaign_analytics
        SET total_sent_by_human = (
            SELECT COUNT(*) 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.campaign_id = r.campaign_id
              AND m.direction = 'outbound'
              AND (m.role = 'agent' OR m.role = 'system')
        )
        WHERE campaign_id = r.campaign_id;
    END LOOP;
END $$;

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Analytics Master Patch Applied Successfully!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Schema Changes:';
    RAISE NOTICE '  ✓ Added user tracking columns (created_by, updated_by, deleted_by)';
    RAISE NOTICE '  ✓ Added campaign_emails_received column';
    RAISE NOTICE '  ✓ Added campaigns_deleted column';
    RAISE NOTICE '  ✓ Added campaign response tracking columns';
    RAISE NOTICE '  ✓ Fixed unique constraints with partial indexes';
    RAISE NOTICE '  ✓ Added message deduplication constraint';
    RAISE NOTICE '';
    RAISE NOTICE 'Function Updates (FINAL VERSIONS):';
    RAISE NOTICE '  ✓ increment_analytics_metric - NULL-safe with partial indexes';
    RAISE NOTICE '  ✓ trigger_log_message_activity - Campaign + AI/assistant support';
    RAISE NOTICE '  ✓ trigger_log_phone_call_activity - Method-based AI detection';
    RAISE NOTICE '  ✓ trigger_log_contact_activity - Full CRUD with user tracking';
    RAISE NOTICE '  ✓ trigger_log_lead_activity - Full CRUD with user tracking';
    RAISE NOTICE '  ✓ trigger_log_contact_group_activity - CREATE/DELETE support';
    RAISE NOTICE '  ✓ trigger_log_campaign_activity - Full lifecycle tracking';
    RAISE NOTICE '';
    RAISE NOTICE 'New Triggers Added:';
    RAISE NOTICE '  ✓ Contact assignment activity logging';
    RAISE NOTICE '  ✓ Lead assignment activity logging';
    RAISE NOTICE '  ✓ Contact group membership activity logging';
    RAISE NOTICE '  ✓ Campaign response analytics (AI vs Human)';
    RAISE NOTICE '  ✓ Campaign analytics auto-update';
    RAISE NOTICE '';
    RAISE NOTICE 'Data Cleanup:';
    RAISE NOTICE '  ✓ Consolidated duplicate analytics records';
    RAISE NOTICE '  ✓ Backfilled campaign response data';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Backend Code Changes Required';
    RAISE NOTICE '  ⚠ Remove direct campaign_analytics updates from:';
    RAISE NOTICE '     - backend/campaign/workers/campaignWorker.js';
    RAISE NOTICE '     - backend/campaign/workers/campaignFollowUpWorker.js';
    RAISE NOTICE '  ⚠ Triggers now handle all analytics updates automatically';
    RAISE NOTICE '';
    RAISE NOTICE 'This patch supersedes ALL 16 individual fix files!';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- END OF MASTER PATCH
-- =====================================================
