-- =====================================================
-- MIGRATION 018: Conversation Enhancements
-- Created: 2026-02-06
-- Description: Add read/unread tracking and star functionality
--              for conversations (email inbox improvements)
-- =====================================================
-- This migration creates:
--   - conversation_read_status table (per-user read tracking)
--   - conversation_stars table (per-user starred conversations)
--   - Appropriate indexes for efficient filtering
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE 1: CONVERSATION READ STATUS
-- =====================================================

CREATE TABLE IF NOT EXISTS conversation_read_status (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    
    PRIMARY KEY (user_id, conversation_id)
);

-- Index for efficient unread queries
CREATE INDEX IF NOT EXISTS idx_conversation_read_status_user_unread 
    ON conversation_read_status(user_id, is_read) 
    WHERE is_read = false;

-- Index for read conversations with timestamp
CREATE INDEX IF NOT EXISTS idx_conversation_read_status_user_read 
    ON conversation_read_status(user_id, read_at DESC) 
    WHERE is_read = true;

-- Index for conversation-based lookups
CREATE INDEX IF NOT EXISTS idx_conversation_read_status_conversation 
    ON conversation_read_status(conversation_id);

COMMENT ON TABLE conversation_read_status IS 'Tracks read/unread status of conversations per user';
COMMENT ON COLUMN conversation_read_status.user_id IS 'User who read/unread the conversation';
COMMENT ON COLUMN conversation_read_status.conversation_id IS 'The conversation being tracked';
COMMENT ON COLUMN conversation_read_status.is_read IS 'Whether the user has read this conversation';
COMMENT ON COLUMN conversation_read_status.read_at IS 'Timestamp when conversation was marked as read';

-- =====================================================
-- TABLE 2: CONVERSATION STARS
-- =====================================================

CREATE TABLE IF NOT EXISTS conversation_stars (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    starred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, conversation_id)
);

-- Index for user's starred conversations (ordered by most recent)
CREATE INDEX IF NOT EXISTS idx_conversation_stars_user 
    ON conversation_stars(user_id, starred_at DESC);

-- Index for conversation-based lookups
CREATE INDEX IF NOT EXISTS idx_conversation_stars_conversation 
    ON conversation_stars(conversation_id);

COMMENT ON TABLE conversation_stars IS 'Tracks starred conversations per user for quick access';
COMMENT ON COLUMN conversation_stars.user_id IS 'User who starred the conversation';
COMMENT ON COLUMN conversation_stars.conversation_id IS 'The starred conversation';
COMMENT ON COLUMN conversation_stars.starred_at IS 'Timestamp when conversation was starred';

COMMIT;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Conversation Enhancements Migration Complete!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Created 2 tables:';
    RAISE NOTICE '  ✓ conversation_read_status - Per-user read tracking';
    RAISE NOTICE '  ✓ conversation_stars - Per-user starred conversations';
    RAISE NOTICE '';
    RAISE NOTICE 'Created 5 indexes for optimal query performance:';
    RAISE NOTICE '  ✓ idx_conversation_read_status_user_unread';
    RAISE NOTICE '  ✓ idx_conversation_read_status_user_read';
    RAISE NOTICE '  ✓ idx_conversation_read_status_conversation';
    RAISE NOTICE '  ✓ idx_conversation_stars_user';
    RAISE NOTICE '  ✓ idx_conversation_stars_conversation';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
