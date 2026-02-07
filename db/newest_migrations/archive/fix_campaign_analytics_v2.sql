-- =====================================================
-- COMPREHENSIVE FIX V2: Campaign Analytics Double Counting
-- Created: 2026-02-06
-- 
-- ROOT CAUSES IDENTIFIED:
-- 1. Backend increments campaign_analytics.emails_sent_today directly
-- 2. Trigger update_campaign_analytics ALSO recalculates from campaign_contacts
-- 3. Result: Every email counted TWICE (3 emails = 6 shown)
--
-- SOLUTION:
-- Remove direct increments from campaign_analytics
-- Let ONLY the trigger handle updates by recalculating from campaign_contacts
-- =====================================================

BEGIN;

-- =====================================================
-- FIX: Remove emails_sent column tracking from campaign_contacts
-- The trigger was using SUM(emails_sent) which doesn't exist anymore
-- Instead, use COUNT of sent messages
-- =====================================================

-- Update the trigger to count actual status changes, notsum non-existent columns
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
        -- FIXED: Count contacts with status 'sent' or 'replied' (they've received at least initial email)
        -- Don't sum a non-existent emails_sent column
        total_emails_sent = (
            SELECT COUNT(*) 
            FROM campaign_contacts 
            WHERE campaign_id = NEW.campaign_id 
              AND status IN ('sent', 'replied', 'bounced')
              AND current_follow_up_step >= 1
        ),
        total_replies = (
            SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = NEW.campaign_id AND status = 'replied'
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
    'FIXED V2: Recalculates campaign analytics from campaign_contacts table. Counts status changes, not non-existent columns.';

-- The trigger is already created, no need to recreate

COMMIT;

-- =====================================================
-- BACKEND CODE CHANGES REQUIRED
-- =====================================================
-- YOU MUST REMOVE THE FOLLOWING CODE FROM:
-- backend/campaign/workers/campaignWorker.js (lines 310-318)
-- backend/campaign/workers/campaignFollowUpWorker.js (similar location)
--
-- REMOVE THIS CODE:
/*
    await client.query(
        `UPDATE campaign_analytics
         SET total_emails_sent = total_emails_sent + 1,
             emails_sent_today = emails_sent_today + 1,
             last_updated_at = now()
         WHERE campaign_id = $1`,
        [campaignId]
    );
*/
--
-- The trigger will handle this automatically when campaign_contacts.status
-- is updated to 'sent'
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Campaign Analytics Fix V2 Applied';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Database changes completed.';
    RAISE NOTICE '';
    RAISE NOTICE 'CRITICAL: You MUST now update your backend code:';
    RAISE NOTICE '';
    RAISE NOTICE '1. File: backend/campaign/workers/campaignWorker.js';
    RAISE NOTICE '   Action: REMOVE lines 310-318 (direct campaign_analytics UPDATE)';
    RAISE NOTICE '';
    RAISE NOTICE '2. File: backend/campaign/workers/campaignFollowUpWorker.js';  
    RAISE NOTICE '   Action: REMOVE similar direct campaign_analytics UPDATE';
    RAISE NOTICE '';
    RAISE NOTICE '3. File: backend/campaign/services/emailRotationService.js';
    RAISE NOTICE '   Action: REMOVE any direct campaign_analytics.emails_sent_today increments';
    RAISE NOTICE '';
    RAISE NOTICE 'The database trigger will handle ALL campaign analytics updates';
    RAISE NOTICE 'automatically when campaign_contacts status changes.';
    RAISE NOTICE '';
    RAISE NOTICE 'After making these changes, restart your backend server.';
    RAISE NOTICE '=====================================================';
END $$;
