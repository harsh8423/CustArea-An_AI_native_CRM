-- Migration: Populate contact_identifiers from existing contacts
-- This fixes contacts created through contactController that bypassed the identifier system

-- Step 1: Add email identifiers for all contacts that have an email
INSERT INTO contact_identifiers (tenant_id, contact_id, identifier_type, identifier_value, source, is_primary)
SELECT 
    c.tenant_id,
    c.id,
    'email',
    c.email,
    COALESCE(c.source, 'manual'),
    true
FROM contacts c
WHERE c.email IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM contact_identifiers ci 
    WHERE ci.contact_id = c.id 
    AND ci.identifier_type = 'email'
    AND ci.identifier_value = c.email
);

-- Step 2: Add phone identifiers for all contacts that have a phone
INSERT INTO contact_identifiers (tenant_id, contact_id, identifier_type, identifier_value, source, is_primary)
SELECT 
    c.tenant_id,
    c.id,
    'phone',
    c.phone,
    COALESCE(c.source, 'manual'),
    true
FROM contacts c
WHERE c.phone IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM contact_identifiers ci 
    WHERE ci.contact_id = c.id 
    AND ci.identifier_type = 'phone'
    AND ci.identifier_value = c.phone
);

-- Step 3: Now link conversations to contacts
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
    AND conv.contact_id IS NULL
    AND conv.channel_contact_id = c.email
    AND c.email IS NOT NULL;

-- Step 4: Link WhatsApp conversations
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
    email_identifiers INTEGER;
    phone_identifiers INTEGER;
    linked_convos INTEGER;
BEGIN
    SELECT COUNT(*) INTO email_identifiers FROM contact_identifiers WHERE identifier_type = 'email';
    SELECT COUNT(*) INTO phone_identifiers FROM contact_identifiers WHERE identifier_type = 'phone';
    SELECT COUNT(*) INTO linked_convos FROM conversations WHERE contact_id IS NOT NULL;
    
    RAISE NOTICE '✅ Total email identifiers: %', email_identifiers;
    RAISE NOTICE '✅ Total phone identifiers: %', phone_identifiers;
    RAISE NOTICE '✅ Total linked conversations: %', linked_convos;
END $$;
