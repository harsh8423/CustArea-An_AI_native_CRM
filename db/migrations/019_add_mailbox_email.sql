-- Migration: Add mailbox_email field for RBAC filtering
-- File: 019_add_mailbox_email.sql
-- Purpose: Add mailbox_email field to conversations table to properly filter email conversations by recipient mailbox

-- Add mailbox_email column to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS mailbox_email TEXT;

-- Add index for performance on RBAC filtering
CREATE INDEX IF NOT EXISTS idx_conversations_mailbox_email 
ON conversations(tenant_id, mailbox_email) 
WHERE channel = 'email';

-- Backfill existing email conversations with mailbox email from message metadata
-- This extracts the first recipient email from the first inbound message
UPDATE conversations c
SET mailbox_email = (
    SELECT 
        (mem.to_addresses->0->>'email')::text
    FROM messages m
    JOIN message_email_metadata mem ON mem.message_id = m.id
    WHERE m.conversation_id = c.id
    AND m.direction = 'inbound'
    ORDER BY m.created_at ASC
    LIMIT 1
)
WHERE c.channel = 'email'
AND c.mailbox_email IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN conversations.mailbox_email IS 'For email conversations: the mailbox/recipient email address that received the message (e.g., support@company.com). Used for RBAC filtering to ensure users only see conversations for mailboxes they have access to.';

-- Verify the backfill
-- This query should return the count of email conversations with and without mailbox_email
DO $$
DECLARE
    total_email_convs INTEGER;
    filled_convs INTEGER;
    null_convs INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_email_convs FROM conversations WHERE channel = 'email';
    SELECT COUNT(*) INTO filled_convs FROM conversations WHERE channel = 'email' AND mailbox_email IS NOT NULL;
    SELECT COUNT(*) INTO null_convs FROM conversations WHERE channel = 'email' AND mailbox_email IS NULL;
    
    RAISE NOTICE 'Migration 019 completed:';
    RAISE NOTICE '  Total email conversations: %', total_email_convs;
    RAISE NOTICE '  Conversations with mailbox_email: %', filled_convs;
    RAISE NOTICE '  Conversations without mailbox_email: %', null_convs;
    
    IF null_convs > 0 THEN
        RAISE WARNING '  % email conversations could not be backfilled (likely missing message metadata)', null_convs;
    END IF;
END $$;
