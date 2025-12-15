-- Run this in your Supabase SQL Editor

-- 1. Create a Test Tenant
INSERT INTO whatsapp_tenants (name, ai_enabled, ai_mode)
VALUES ('Test Business', true, 'AUTO_REPLY');

-- 2. Link the Twilio Sandbox Number to the Tenant
-- IMPORTANT: Replace the placeholders with your actual Twilio credentials from your .env file.
-- The phone_number MUST be the Twilio Sandbox number (usually whatsapp:+14155238886).
INSERT INTO whatsapp_twilio_whatsapp_accounts (tenant_id, twilio_account_sid, twilio_auth_token, phone_number)
SELECT 
    id, 
    'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', -- REPLACE with your actual TWILIO_ACCOUNT_SID
    'your_auth_token',                    -- REPLACE with your actual TWILIO_AUTH_TOKEN
    'whatsapp:+14155238886'               -- Twilio Sandbox Number
FROM whatsapp_tenants 
WHERE name = 'Test Business'
LIMIT 1;

-- Note: You do NOT need to insert your personal mobile number (+91...).
-- It will be automatically added to the 'whatsapp_contacts' table when you send your first message.
