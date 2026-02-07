-- =====================================================
-- CONSOLIDATED SCHEMA AND LOGIC FIXES
-- Generated at: 2026-02-07
-- Combines fixes from:
--  - ADD_PHONE_CALL_METADATA.sql
--  - FIX_DB_SCHEMA_VOICE.sql
--  - FIX_CAMPAIGN_ANALYTICS.sql
--  - FIX_DOUBLE_COUNTING_FUNCTION.sql
--  - FIX_CAMPAIGN_ANALYTICS_V2.sql
--  - FIX_ANALYTICS_ROLES_V3.sql
--  - FIX_LEAD_ASSIGNMENT_TRIGGER.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. SCHEMA CHANGES
-- =====================================================

-- 1.1 Phone Calls Metadata
ALTER TABLE phone_calls
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_voice_id TEXT,
ADD COLUMN IF NOT EXISTS ai_model TEXT,
ADD COLUMN IF NOT EXISTS ai_provider TEXT,
ADD COLUMN IF NOT EXISTS stt_provider TEXT,
ADD COLUMN IF NOT EXISTS tts_provider TEXT,
ADD COLUMN IF NOT EXISTS latency_mode TEXT;

CREATE INDEX IF NOT EXISTS idx_phone_calls_user ON phone_calls(user_id);

-- 1.2 Tenant Phone Config
ALTER TABLE tenant_phone_config
ADD COLUMN IF NOT EXISTS voice_model TEXT DEFAULT 'en-US-Neural2-F',
ADD COLUMN IF NOT EXISTS default_method TEXT DEFAULT 'realtime';

CREATE INDEX IF NOT EXISTS idx_phone_config_tenant ON tenant_phone_config(tenant_id);

-- 1.3 Campaign Analytics AI/Human Breakdown
ALTER TABLE campaign_analytics 
ADD COLUMN IF NOT EXISTS emails_sent_by_ai INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS emails_sent_by_human INT DEFAULT 0;

-- =====================================================
-- 2. CORE FUNCTIONS
-- =====================================================

-- 2.1 Increment Analytics Metric (Fixes Double Counting/Constraint Issues)
CREATE OR REPLACE FUNCTION increment_analytics_metric(
    p_tenant_id UUID,
    p_user_id UUID,
    p_metric_name TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_record_exists BOOLEAN;
BEGIN
    -- Check if record exists using IS NOT DISTINCT FROM for NULL-safe comparison
    SELECT EXISTS(
        SELECT 1 FROM analytics_metrics
        WHERE tenant_id = p_tenant_id
          AND user_id IS NOT DISTINCT FROM p_user_id
          AND metric_date = v_today
          AND metric_period = 'daily'
    ) INTO v_record_exists;
    
    -- Insert if doesn't exist
    IF NOT v_record_exists THEN
        INSERT INTO analytics_metrics (
            tenant_id, 
            user_id, 
            metric_date, 
            metric_period
        )
        VALUES (p_tenant_id, p_user_id, v_today, 'daily');
    END IF;
    
    -- Update the specific metric ONCE
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

-- =====================================================
-- 3. TRIGGER FUNCTIONS
-- =====================================================

-- 3.1 Campaign Analytics (V2 Logic - Separation of concerns)
-- Only tracks contact enrollment stats. Email counts handled by message trigger.
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
        total_replies = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied'
        ),
        -- RATES
        delivery_rate = CASE 
            WHEN total_emails_sent > 0
            THEN ((total_emails_sent - (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'bounced'))::DECIMAL 
                  / total_emails_sent * 100)
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

-- 3.2 Message Activity (V3 Logic - Correct Roles)
-- Handles Analytics Increments and Campaign Email Counts
CREATE OR REPLACE FUNCTION trigger_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_is_campaign BOOLEAN := FALSE;
    v_campaign_id UUID;
    v_contact_id UUID;
BEGIN
    -- Only process email messages
    IF NEW.channel != 'email' THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant, user, campaign info AND contact_id
    SELECT c.tenant_id, c.assigned_to, COALESCE(c.is_campaign, FALSE), c.campaign_id, c.contact_id
    INTO v_tenant_id, v_user_id, v_is_campaign, v_campaign_id, v_contact_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    IF NEW.direction = 'outbound' THEN
        -- Outbound logic REVISED (V3):
        -- AI = 'assistant', 'ai'
        -- Human = 'agent' (manual), 'system' (automated), 'user', etc.
        
        IF NEW.role IN ('ai', 'assistant') THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_ai', 1);
             IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_ai = emails_sent_by_ai + 1,
                    total_emails_sent = total_emails_sent + 1,
                    emails_sent_today = emails_sent_today + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        ELSE
            -- Treat 'agent' as Human
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_by_human', 1);
             IF v_is_campaign AND v_campaign_id IS NOT NULL THEN
                UPDATE campaign_analytics 
                SET emails_sent_by_human = emails_sent_by_human + 1,
                    total_emails_sent = total_emails_sent + 1,
                    emails_sent_today = emails_sent_today + 1
                WHERE campaign_id = v_campaign_id;
            END IF;
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_sent_total', 1);
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'messages_sent', 1);
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_sent', 1);
        END IF;
        
    ELSIF NEW.direction = 'inbound' THEN
        -- Inbound logic
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'emails_received', 1);
        
        IF v_is_campaign THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'campaign_emails_received', 1);
            
            -- Mark Contact as REPLIED (Stop sequence)
            IF v_campaign_id IS NOT NULL AND v_contact_id IS NOT NULL THEN
                UPDATE campaign_contacts
                SET status = 'replied',
                    next_send_at = NULL,
                    updated_at = now()
                WHERE campaign_id = v_campaign_id
                  AND contact_id = v_contact_id
                  AND status != 'replied';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.3 Lead Assignment Logging (Fix)
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

-- 3.4 Phone Call Logging (Metadata support)
CREATE OR REPLACE FUNCTION trigger_log_phone_call_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_ai BOOLEAN;
BEGIN
    -- Only log when call is completed (and not already logged)
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        
        -- Determine Tenant ID
        v_tenant_id := NEW.tenant_id;
        
        -- Determine User ID: Prefer direct user_id, fallback to conversation
        IF NEW.user_id IS NOT NULL THEN
            v_user_id := NEW.user_id;
        ELSE
            SELECT assigned_to INTO v_user_id
            FROM conversations
            WHERE id = NEW.conversation_id;
        END IF;

        -- Determine if AI
        v_is_ai := (NEW.metadata ? 'realtime_session_id') OR 
                   (NEW.metadata ? 'ai_agent_id') OR
                   (NEW.method = 'realtime') OR 
                   (NEW.method = 'legacy' AND NEW.direction = 'inbound');
        
        -- Increment metrics
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_total', 1);
        
        IF v_is_ai THEN
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_ai', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_ai_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        ELSE
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_by_human', 1);
            PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_human_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        END IF;
        
        PERFORM increment_analytics_metric(v_tenant_id, v_user_id, 'calls_duration_seconds', COALESCE(NEW.duration_seconds, 0));
        
        -- Log activity
        PERFORM log_user_activity(
            v_tenant_id,
            v_user_id,
            'phone',
            'completed',
            'Call: ' || COALESCE(NEW.from_number, '') || ' -> ' || COALESCE(NEW.to_number, ''),
            'phone_call',
            NEW.id,
            COALESCE(NEW.from_number, '') || ' -> ' || COALESCE(NEW.to_number, '')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. APPLY TRIGGERS
-- =====================================================

-- Lead Assignment
DROP TRIGGER IF EXISTS trigger_lead_assignment_log ON user_lead_assignments;
CREATE TRIGGER trigger_lead_assignment_log
    AFTER INSERT ON user_lead_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_lead_assignment_activity();

-- Message Activity
DROP TRIGGER IF EXISTS trigger_messages_analytics ON messages;
CREATE TRIGGER trigger_messages_analytics
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_message_activity();

COMMIT;
