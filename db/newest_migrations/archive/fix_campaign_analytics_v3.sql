-- =====================================================
-- FIX: Campaign Analytics - Add emails_sent_today tracking
-- =====================================================

BEGIN;

-- Update trigger to also calculate emails_sent_today
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
    'FIXED V3: Recalculates campaign analytics including emails_sent_today from campaign_contacts.last_sent_at';

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Campaign Analytics Trigger Updated';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Added emails_sent_today tracking based on last_sent_at date';
    RAISE NOTICE 'Dashboard "Todays Sends" should now display correctly';
    RAISE NOTICE '=====================================================';
END $$;
