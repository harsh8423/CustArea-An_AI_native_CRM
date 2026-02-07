-- =====================================================
-- FIX: Analytics Deduplication
-- Created: 2026-02-06
-- Description: Adds a unique constraint to the messages table to prevent 
--              duplicate insertions of the same provider message (e.g., from SES retries).
-- =====================================================

BEGIN;

-- 1. Clean up existing duplicates before adding constraint
-- Keep the one with the earliest created_at date
DELETE FROM messages a USING (
    SELECT MIN(ctid) as ctid, provider_message_id, tenant_id
    FROM messages 
    WHERE provider_message_id IS NOT NULL
    GROUP BY provider_message_id, tenant_id
    HAVING COUNT(*) > 1
) b
WHERE a.provider_message_id = b.provider_message_id 
AND a.tenant_id = b.tenant_id 
AND a.ctid <> b.ctid;

-- 2. Add the unique constraint
ALTER TABLE messages 
ADD CONSTRAINT unique_message_provider_id 
UNIQUE (tenant_id, provider_message_id);

-- Notify success
DO $$
BEGIN
    RAISE NOTICE 'Added unique_message_provider_id constraint to messages table.';
END $$;

COMMIT;
