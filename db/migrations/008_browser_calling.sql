-- =====================================================
-- Add TwiML App SID to tenant_phone_config
-- Run this to enable browser calling
-- =====================================================

ALTER TABLE tenant_phone_config 
ADD COLUMN IF NOT EXISTS twiml_app_sid TEXT;

-- Add comment
COMMENT ON COLUMN tenant_phone_config.twiml_app_sid IS 'Twilio TwiML App SID for browser calling';
