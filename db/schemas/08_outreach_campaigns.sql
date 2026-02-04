-- =====================================================
-- Outreach Campaigns Migration (CONSOLIDATED)
-- Created: 2026-02-01
-- Consolidated: 2026-02-02
-- Description: Complete email outreach campaigns schema
--              Includes migrations 004-009 merged into single script
-- =====================================================

-- =====================================================
-- 1. OUTREACH CAMPAIGNS (Main Configuration)
-- =====================================================

CREATE TABLE IF NOT EXISTS outreach_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Campaign identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Target contact group
    contact_group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE RESTRICT,
    
    -- Campaign details (for AI context)
    company_name VARCHAR(255) NOT NULL,
    website_url TEXT,
    campaign_objective TEXT NOT NULL,
    selling_points TEXT NOT NULL,       -- What are you selling
    pain_points TEXT NOT NULL,          -- Customer pain points
    value_proposition TEXT NOT NULL,
    proof_points TEXT,                  -- Social proof, case studies, etc.
    
    -- Configuration
    language VARCHAR(10) DEFAULT 'en',
    ai_instructions TEXT,               -- Custom instructions for AI agent
    
    -- Reply handling
    reply_handling VARCHAR(20) NOT NULL DEFAULT 'human',  -- 'human' | 'ai'
    
    -- CTA configuration
    cta_links JSONB DEFAULT '[]'::jsonb,  -- [{ text, url }]
    
    -- Daily send limit (max 200 per day as per requirement)
    daily_send_limit INT DEFAULT 200 CHECK (daily_send_limit <= 200),
    
    -- Max contacts per campaign (500 as per requirement)
    max_contacts_limit INT DEFAULT 500 CHECK (max_contacts_limit <= 500),
    
    -- Channel type (for future phone campaigns)
    channel_type VARCHAR(20) NOT NULL DEFAULT 'email',  -- 'email' | 'phone'
    
    -- Status and metrics
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft' | 'active' | 'paused' | 'completed' | 'archived'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    launched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_reply_handling CHECK (reply_handling IN ('human', 'ai')),
    CONSTRAINT valid_channel_type CHECK (channel_type IN ('email', 'phone')),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_tenant ON outreach_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_group ON outreach_campaigns(contact_group_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_created_by ON outreach_campaigns(created_by);

-- =====================================================
-- 2. CAMPAIGN EMAIL ROTATION
-- =====================================================
-- Supports both Gmail/Outlook (connections) and SES (identities)
-- Email rotation is OPTIONAL - user can:
--   1. Select single email (only 1 row, rotation_order = 1)
--   2. Select multiple emails for rotation (multiple rows, different rotation_order)
-- Daily limit of 200 emails enforced at CAMPAIGN level, not per email

CREATE TABLE IF NOT EXISTS campaign_email_rotation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
    
    -- Email source configuration (supports both Gmail/Outlook and SES)
    email_type VARCHAR(20) DEFAULT 'connection',  -- 'connection' | 'identity'
    tenant_email_connection_id UUID REFERENCES tenant_email_connections(id) ON DELETE CASCADE,
    ses_identity_id UUID REFERENCES tenant_ses_identities(id) ON DELETE CASCADE,
    allowed_email_id UUID REFERENCES tenant_allowed_from_emails(id) ON DELETE CASCADE,
    
    -- Rotation configuration
    rotation_order INT NOT NULL,  -- Order in rotation (1, 2, 3, ...)
    is_active BOOLEAN DEFAULT true,
    
    -- Daily tracking (resets every day for 200/day limit)
    current_daily_sent INT DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT unique_campaign_rotation_order UNIQUE(campaign_id, rotation_order),
    CONSTRAINT valid_email_type CHECK (email_type IN ('connection', 'identity')),
    CONSTRAINT check_email_id_set CHECK (
        (email_type = 'connection' AND tenant_email_connection_id IS NOT NULL AND ses_identity_id IS NULL) OR
        (email_type = 'identity' AND ses_identity_id IS NOT NULL AND tenant_email_connection_id IS NULL)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_email_rotation_campaign ON campaign_email_rotation(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_email_rotation_active ON campaign_email_rotation(campaign_id, rotation_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaign_email_rotation_identity ON campaign_email_rotation(ses_identity_id) WHERE ses_identity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_email_rotation_type ON campaign_email_rotation(campaign_id, email_type);
CREATE INDEX IF NOT EXISTS idx_campaign_email_rotation_allowed_email ON campaign_email_rotation(allowed_email_id) WHERE allowed_email_id IS NOT NULL;

-- Unique constraints for preventing duplicate emails per campaign
CREATE UNIQUE INDEX IF NOT EXISTS unique_campaign_connection
    ON campaign_email_rotation(campaign_id, tenant_email_connection_id)
    WHERE tenant_email_connection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_campaign_allowed_email
    ON campaign_email_rotation(campaign_id, allowed_email_id)
    WHERE allowed_email_id IS NOT NULL;

-- =====================================================
-- 3. CAMPAIGN EMAIL TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
    
    -- Template details
    template_type VARCHAR(20) NOT NULL DEFAULT 'initial',  -- 'initial' | 'follow_up'
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    
    -- Timing for follow-up templates (Migration 009)
    wait_period_value INT DEFAULT 3,
    wait_period_unit VARCHAR(10) DEFAULT 'days',
    
    -- Personalization (e.g., {{name}}, {{company}})
    personalization_fields JSONB DEFAULT '{}'::jsonb,  
    -- { "name": { "default": "there" }, "company": { "default": "your company" } }
    
    -- AI generation metadata
    is_ai_generated BOOLEAN DEFAULT false,
    ai_generation_prompt TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_template_type CHECK (template_type IN ('initial', 'follow_up')),
    CONSTRAINT valid_wait_period_unit CHECK (wait_period_unit IN ('minutes', 'hours', 'days'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_email_templates_campaign ON campaign_email_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_email_templates_type ON campaign_email_templates(campaign_id, template_type);

-- =====================================================
-- 4. CAMPAIGN FOLLOW-UPS
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
    template_id UUID REFERENCES campaign_email_templates(id) ON DELETE SET NULL,
    
    -- Sequence configuration
    sequence_order INT NOT NULL,  -- 1st follow-up, 2nd follow-up, etc.
    
    -- Timing (wait period after previous email)
    wait_period_value INT NOT NULL,  -- Numeric value
    wait_period_unit VARCHAR(10) NOT NULL DEFAULT 'days',  -- 'minutes' | 'hours' | 'days'
    
    -- Conditions for sending
    send_condition VARCHAR(20) DEFAULT 'no_reply',  -- 'no_reply' | 'always'
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_wait_period_unit CHECK (wait_period_unit IN ('minutes', 'hours', 'days')),
    CONSTRAINT valid_send_condition CHECK (send_condition IN ('no_reply', 'always')),
    CONSTRAINT unique_campaign_sequence UNIQUE(campaign_id, sequence_order)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_follow_ups_campaign ON campaign_follow_ups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_follow_ups_sequence ON campaign_follow_ups(campaign_id, sequence_order);

-- =====================================================
-- 5. CAMPAIGN CONTACTS 
-- (Tracks individual contact progress through campaign)
-- =====================================================
-- This table is ESSENTIAL for:
-- - Tracking which contacts from the group are enrolled
-- - Individual status (pending, sent, replied, bounced, skipped)
-- - Follow-up progress per contact
-- - Daily send limit enforcement (only process pending contacts)
-- - Graceful skip tracking for contacts without email

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Enrollment
    enrolled_at TIMESTAMPTZ DEFAULT now(),
    enrolled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  
    -- 'pending' | 'queued' | 'sending' | 'sent' | 'skipped_no_email' | 'bounced' | 'replied' | 'completed'
    
    -- Progress tracking
    current_follow_up_step INT DEFAULT 0,  -- 0 = initial email not sent, 1 = initial sent, 2+ = follow-up number
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,  -- When to send next follow-up (NULL if not scheduled)
    
    -- Engagement metrics
    emails_sent INT DEFAULT 0,
    replied_at TIMESTAMPTZ,
    
    -- Conversation tracking
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- Skip reason (for analytics)
    skip_reason TEXT,  -- e.g., "No email address", "Unsubscribed", "Bounced previously"
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,  -- Personalization data from contact
    
    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_campaign_contact UNIQUE(campaign_id, contact_id),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'queued', 'sending', 'sent', 'skipped_no_email', 'bounced', 'replied', 'completed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact ON campaign_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_next_send ON campaign_contacts(next_send_at) WHERE next_send_at IS NOT NULL AND status IN ('sent', 'queued');
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_conversation ON campaign_contacts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_pending ON campaign_contacts(campaign_id, status) WHERE status = 'pending';

-- =====================================================
-- 6. CAMPAIGN ANALYTICS (Aggregated Stats)
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_analytics (
    id UUID PRIMARY KEY,  -- Same as campaign_id (1-to-1)
    campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE UNIQUE,
    
    -- Contact metrics
    total_contacts_enrolled INT DEFAULT 0,
    total_contacts_skipped INT DEFAULT 0,  -- Contacts without email
    total_contacts_valid INT DEFAULT 0,    -- Contacts with email
    
    -- Email metrics
    total_emails_sent INT DEFAULT 0,
    total_emails_delivered INT DEFAULT 0,
    total_emails_bounced INT DEFAULT 0,
    
    -- Engagement metrics
    total_replies INT DEFAULT 0,
    
    -- Daily tracking
    emails_sent_today INT DEFAULT 0,
    today_date DATE DEFAULT CURRENT_DATE,
    
    -- Calculated rates (updated via trigger)
    delivery_rate DECIMAL(5,2) DEFAULT 0.0,
    reply_rate DECIMAL(5,2) DEFAULT 0.0,
    skip_rate DECIMAL(5,2) DEFAULT 0.0,
    
    -- Timestamps
    last_updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign ON campaign_analytics(campaign_id);

-- =====================================================
-- 7. MODIFY CONVERSATIONS TABLE
-- =====================================================

-- Add campaign-related columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_campaign BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS campaign_id UUID,
ADD COLUMN IF NOT EXISTS has_reply BOOLEAN DEFAULT FALSE;

-- Add foreign key constraint with CASCADE delete (Migration 006)
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_campaign_id_fkey' 
        AND table_name = 'conversations'
    ) THEN
        ALTER TABLE conversations DROP CONSTRAINT conversations_campaign_id_fkey;
    END IF;
    
    -- Add new constraint with CASCADE
    ALTER TABLE conversations
        ADD CONSTRAINT conversations_campaign_id_fkey
            FOREIGN KEY (campaign_id)
            REFERENCES outreach_campaigns(id)
            ON DELETE CASCADE;
END $$;

-- Create indexes for campaign conversations
CREATE INDEX IF NOT EXISTS idx_conversations_campaign ON conversations(campaign_id) WHERE is_campaign = true;
CREATE INDEX IF NOT EXISTS idx_conversations_campaign_reply ON conversations(tenant_id, is_campaign, has_reply);


-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Trigger to update campaign analytics when campaign_contacts changes
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
        total_emails_sent = (
            SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id
        ),
        total_replies = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied'
        ),
        -- Update rates
        delivery_rate = CASE 
            WHEN (SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) > 0
            THEN (((SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) 
                   - (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'bounced'))::DECIMAL 
                  / (SELECT COALESCE(SUM(emails_sent), 0) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id) * 100)
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

DROP TRIGGER IF EXISTS trigger_update_campaign_analytics ON campaign_contacts;
CREATE TRIGGER trigger_update_campaign_analytics
    AFTER INSERT OR UPDATE ON campaign_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_analytics();

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_campaign_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outreach_campaigns_updated_at ON outreach_campaigns;
CREATE TRIGGER outreach_campaigns_updated_at
    BEFORE UPDATE ON outreach_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_tables_timestamp();

DROP TRIGGER IF EXISTS campaign_email_templates_updated_at ON campaign_email_templates;
CREATE TRIGGER campaign_email_templates_updated_at
    BEFORE UPDATE ON campaign_email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_tables_timestamp();

DROP TRIGGER IF EXISTS campaign_follow_ups_updated_at ON campaign_follow_ups;
CREATE TRIGGER campaign_follow_ups_updated_at
    BEFORE UPDATE ON campaign_follow_ups
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_tables_timestamp();

DROP TRIGGER IF EXISTS campaign_contacts_updated_at ON campaign_contacts;
CREATE TRIGGER campaign_contacts_updated_at
    BEFORE UPDATE ON campaign_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_tables_timestamp();

-- Function to reset daily email counters (to be called by cron job daily)
CREATE OR REPLACE FUNCTION reset_daily_campaign_counters()
RETURNS void AS $$
BEGIN
    -- Reset campaign email rotation daily counters
    UPDATE campaign_email_rotation
    SET current_daily_sent = 0,
        last_reset_date = CURRENT_DATE
    WHERE last_reset_date < CURRENT_DATE;
    
    -- Reset campaign analytics daily counters
    UPDATE campaign_analytics
    SET emails_sent_today = 0,
        today_date = CURRENT_DATE
    WHERE today_date < CURRENT_DATE;
    
    RAISE NOTICE 'Daily campaign counters reset for %', CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE outreach_campaigns IS 'Email outreach campaign configurations - user selects contact_group, email rotation is OPTIONAL';
COMMENT ON TABLE campaign_email_rotation IS 'OPTIONAL email rotation - supports both Gmail/Outlook connections and SES identities (200 emails/day total at campaign level)';
COMMENT ON TABLE campaign_email_templates IS 'AI-generated email templates with personalization fields like {{name}}, {{company}} and timing configuration';
COMMENT ON TABLE campaign_follow_ups IS 'Automated follow-up sequence configuration with waiting periods';
COMMENT ON TABLE campaign_contacts IS 'Individual contact enrollment and progress - NEW CONVERSATION created per outreach email';
COMMENT ON TABLE campaign_analytics IS 'Aggregated campaign statistics and metrics with daily tracking';

COMMENT ON COLUMN outreach_campaigns.contact_group_id IS 'Target contact group - contacts without email will be gracefully skipped';
COMMENT ON COLUMN outreach_campaigns.daily_send_limit IS 'Maximum 200 emails per day (default and max), enforced at campaign level';
COMMENT ON COLUMN outreach_campaigns.max_contacts_limit IS 'Maximum 500 contacts per campaign (default and max)';
COMMENT ON COLUMN outreach_campaigns.reply_handling IS 'How to handle replies: human (show in inbox) or ai (automated response)';

COMMENT ON COLUMN campaign_email_rotation.email_type IS 'Type of email source: connection (Gmail/Outlook) or identity (SES)';
COMMENT ON COLUMN campaign_email_rotation.tenant_email_connection_id IS 'Reference to Gmail/Outlook connection (NULL if using SES)';
COMMENT ON COLUMN campaign_email_rotation.ses_identity_id IS 'Reference to SES identity (NULL if using Gmail/Outlook)';
COMMENT ON COLUMN campaign_email_rotation.allowed_email_id IS 'Specific allowed email address for SES domain identities (e.g., harsh@custarea.com vs aftaab@custarea.com)';
COMMENT ON COLUMN campaign_email_rotation.rotation_order IS 'Order in rotation (1,2,3...) OR just 1 if single email selected';

COMMENT ON COLUMN campaign_email_templates.wait_period_value IS 'Time to wait after previous email (1 minute to 30 days)';
COMMENT ON COLUMN campaign_email_templates.wait_period_unit IS 'Unit of time: minutes, hours, or days';

COMMENT ON COLUMN campaign_follow_ups.wait_period_unit IS 'Time unit for waiting period: minutes, hours, or days';

COMMENT ON COLUMN campaign_contacts.current_follow_up_step IS '0 = initial email not sent, 1 = initial sent, 2+ = follow-up number';
COMMENT ON COLUMN campaign_contacts.status IS 'skipped_no_email = contact has no email address, queued = waiting for daily limit reset';
COMMENT ON COLUMN campaign_contacts.skip_reason IS 'Why contact was skipped (e.g., No email address)';
COMMENT ON COLUMN campaign_contacts.conversation_id IS 'NEW conversation created for EACH outreach - replies handled in same thread via Message-ID';

COMMENT ON COLUMN campaign_analytics.emails_sent_today IS 'Emails sent today (resets daily) for enforcing 200/day limit';

COMMENT ON COLUMN conversations.is_campaign IS 'TRUE if conversation originated from outreach campaign';
COMMENT ON COLUMN conversations.has_reply IS 'TRUE when contact replies to campaign email - triggers inbox display if reply_handling=human';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'CONSOLIDATED Migration 004-009 completed successfully!';
    RAISE NOTICE 'Created 6 core tables for outreach campaigns:';
    RAISE NOTICE '  - outreach_campaigns (with contact_group_id)';
    RAISE NOTICE '  - campaign_email_rotation (supports Gmail/Outlook + SES)';
    RAISE NOTICE '  - campaign_email_templates (with timing fields)';
    RAISE NOTICE '  - campaign_follow_ups';
    RAISE NOTICE '  - campaign_contacts (tracks skipped contacts)';
    RAISE NOTICE '  - campaign_analytics (with daily tracking)';
    RAISE NOTICE '';
    RAISE NOTICE 'Modified conversations table with campaign columns';
    RAISE NOTICE 'Created triggers for analytics and timestamps';
    RAISE NOTICE 'Added daily counter reset function';
    RAISE NOTICE '';
    RAISE NOTICE 'Key Features (All Migrations 004-009):';
    RAISE NOTICE '  ✓ Contact group selection';
    RAISE NOTICE '  ✓ Graceful skip for contacts without email';
    RAISE NOTICE '  ✓ 200 emails/day campaign limit';
    RAISE NOTICE '  ✓ 500 contacts/campaign max';
    RAISE NOTICE '  ✓ Email rotation (Gmail/Outlook + SES support)';
    RAISE NOTICE '  ✓ SES domain identity with allowed email addresses';
    RAISE NOTICE '  ✓ AI-generated templates with timing configuration';
    RAISE NOTICE '  ✓ Cascade delete for conversations';
    RAISE NOTICE '  ✓ Granular timing (1 minute to 30 days)';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- END OF CONSOLIDATED MIGRATION
-- =====================================================
