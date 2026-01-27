-- Migration: Link existing conversations to their contacts
-- This fixes conversations that were created BEFORE contacts existed
-- by matching channel_contact_id (email address) to contact.email

-- Step 1: Link conversations to contacts based on matching email addresses
UPDATE conversations conv
SET 
    contact_id = c.id,
    sender_display_name = NULL,
    sender_identifier_type = NULL,
    sender_identifier_value = NULL,
    updated_at = now()
FROM contacts c
WHERE 
    conv.tenant_id = c.tenant_id
    AND conv.channel = 'email'
    AND conv.contact_id IS NULL  -- Only update conversations without contact
    AND conv.channel_contact_id = c.email  -- Match email address
    AND c.email IS NOT NULL;

-- Step 2: Link WhatsApp conversations
UPDATE conversations conv
SET 
    contact_id = c.id,
    sender_display_name = NULL,
    sender_identifier_type = NULL,
    sender_identifier_value = NULL,
    updated_at = now()
FROM contacts c
WHERE 
    conv.tenant_id = c.tenant_id
    AND conv.channel = 'whatsapp'
    AND conv.contact_id IS NULL
    AND REPLACE(conv.channel_contact_id, 'whatsapp:', '') = c.phone
    AND c.phone IS NOT NULL;

-- Log results
DO $$
DECLARE
    email_count INTEGER;
    whatsapp_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO email_count 
    FROM conversations conv
    JOIN contacts c ON conv.tenant_id = c.tenant_id 
        AND conv.channel_contact_id = c.email
    WHERE conv.channel = 'email' AND conv.contact_id IS NOT NULL;
    
    SELECT COUNT(*) INTO whatsapp_count 
    FROM conversations conv  
    JOIN contacts c ON conv.tenant_id = c.tenant_id
        AND REPLACE(conv.channel_contact_id, 'whatsapp:', '') = c.phone
    WHERE conv.channel = 'whatsapp' AND conv.contact_id IS NOT NULL;
    
    RAISE NOTICE 'Linked % email conversations to contacts', email_count;
    RAISE NOTICE 'Linked % WhatsApp conversations to contacts', whatsapp_count;
END $$;
