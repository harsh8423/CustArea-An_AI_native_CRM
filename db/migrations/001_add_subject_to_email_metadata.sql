-- Migration: Add subject column to message_email_metadata table
-- Description: Stores the email subject separately in metadata to handle thread variations

ALTER TABLE message_email_metadata 
ADD COLUMN IF NOT EXISTS subject text;

-- Optional: Backfill subject from conversations for existing messages (best effort)
-- UPDATE message_email_metadata mem
-- SET subject = c.subject
-- FROM messages m
-- JOIN conversations c ON m.conversation_id = c.id
-- WHERE mem.message_id = m.id AND mem.subject IS NULL;
