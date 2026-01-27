-- =====================================================
-- Remove Password-based Auth, Add Supabase Integration
-- Run this migration to transition to Supabase OTP auth
-- =====================================================

-- 1. Add Supabase user ID column to users table
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS supabase_user_id uuid,
    ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'supabase';

-- 2. Create a unique index on supabase_user_id (after it's populated)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_user_id 
    ON users(supabase_user_id) 
    WHERE supabase_user_id IS NOT NULL;

-- 3. Add company name to tenants if not exists (for signup flow)
-- This ensures we can capture company name during OTP signup
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS email text;  -- Primary contact email for the tenant

-- 4. Make password_hash nullable (transition period)
-- We'll keep it for backward compatibility but make it optional
ALTER TABLE users 
    ALTER COLUMN password_hash DROP NOT NULL;

-- 5. Add index on email for faster OTP lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- NOTE: We're NOT dropping password_hash column yet to allow for gradual migration
-- After all users have migrated to Supabase OTP, run the following:
-- ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- 6. Create a pending_signups table for tracking OTP signup flows
CREATE TABLE IF NOT EXISTS pending_signups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,  -- UNIQUE constraint added for ON CONFLICT
    company_name text NOT NULL,
    supabase_user_id uuid,
    verification_status text DEFAULT 'pending',  -- 'pending', 'verified', 'expired'
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
    created_at timestamptz NOT NULL DEFAULT now(),
    verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_supabase_user ON pending_signups(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_signups_status ON pending_signups(verification_status);

-- 7. Cleanup expired pending signups (optional, can be run by cron)
-- DELETE FROM pending_signups WHERE expires_at < now() AND verification_status != 'verified';
