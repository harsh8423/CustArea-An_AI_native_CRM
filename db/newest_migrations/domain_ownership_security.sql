-- =====================================================
-- Domain Ownership Verification Security Migration
-- =====================================================
-- This migration adds DNS-based domain ownership verification
-- to prevent cross-tenant domain claiming vulnerabilities
-- =====================================================

-- 1. Add ownership verification columns to existing table
ALTER TABLE tenant_ses_identities 
ADD COLUMN IF NOT EXISTS ownership_verification_token text,
ADD COLUMN IF NOT EXISTS ownership_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS ownership_verification_method text,  -- 'dns_txt' | 'grandfathered'
ADD COLUMN IF NOT EXISTS claimed_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS verification_attempts int DEFAULT 0;

-- 2. Create domain ownership verifications table
CREATE TABLE IF NOT EXISTS domain_ownership_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain text NOT NULL,
    verification_token text NOT NULL,
    verification_method text NOT NULL DEFAULT 'dns_txt',  -- 'dns_txt' | 'dns_cname' | 'email'
    verification_status text NOT NULL DEFAULT 'pending',   -- 'pending' | 'verified' | 'failed' | 'expired'
    dns_record_name text,                                  -- e.g., '_custarea-verify.example.com'
    dns_record_expected_value text,                        -- The token we expect to find
    dns_record_found_value text,                           -- What we actually found (for debugging)
    error_message text,                                    -- Error details if verification failed
    verified_at timestamptz,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(tenant_id, domain)  -- One verification per tenant per domain
);

CREATE INDEX IF NOT EXISTS idx_domain_ownership_tenant ON domain_ownership_verifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_ownership_domain ON domain_ownership_verifications(domain);
CREATE INDEX IF NOT EXISTS idx_domain_ownership_status ON domain_ownership_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_domain_ownership_expires ON domain_ownership_verifications(expires_at) WHERE verification_status = 'pending';

-- 3. Add global uniqueness constraint for verified domains
-- This prevents multiple tenants from claiming the same verified domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_ses_identities_global_domain
    ON tenant_ses_identities(identity_value)
    WHERE identity_type = 'domain' AND ownership_verified_at IS NOT NULL;

COMMENT ON INDEX idx_ses_identities_global_domain IS 
    'Enforces one owner per domain globally after ownership verification - CRITICAL SECURITY CONSTRAINT';

-- 4. Migration data: grandfather existing domains
-- Mark all existing domains as verified with 'grandfathered' method
-- First claimant (earliest created_at) wins ownership
DO $$
DECLARE
    domain_record RECORD;
    duplicate_count INT;
BEGIN
    -- Process each unique domain
    FOR domain_record IN 
        SELECT DISTINCT ON (identity_value) 
            id, tenant_id, identity_value, created_at
        FROM tenant_ses_identities
        WHERE identity_type = 'domain'
          AND ownership_verified_at IS NULL  -- Only process unverified domains
        ORDER BY identity_value, created_at ASC  -- First claimant wins
    LOOP
        -- Update the winner with grandfathered verification
        UPDATE tenant_ses_identities
        SET 
            ownership_verified_at = created_at,
            ownership_verification_method = 'grandfathered',
            ownership_verification_token = gen_random_uuid()::text,
            claimed_at = created_at
        WHERE id = domain_record.id;
        
        -- Count and delete duplicate claims from other tenants
        SELECT COUNT(*) INTO duplicate_count
        FROM tenant_ses_identities
        WHERE identity_value = domain_record.identity_value
          AND identity_type = 'domain'
          AND id != domain_record.id;
        
        IF duplicate_count > 0 THEN
            RAISE NOTICE 'Domain % claimed by tenant %. Removing % duplicate claim(s) from other tenants.',
                domain_record.identity_value, 
domain_record.tenant_id, 
                duplicate_count;
            
            -- Delete duplicate claims
            DELETE FROM tenant_ses_identities
            WHERE identity_value = domain_record.identity_value
              AND identity_type = 'domain'
              AND id != domain_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Grandfathered existing domain ownership. Check logs for removed duplicates.';
END $$;

-- 5. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_domain_verification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_domain_verification_timestamp ON domain_ownership_verifications;

CREATE TRIGGER trigger_update_domain_verification_timestamp
    BEFORE UPDATE ON domain_ownership_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_domain_verification_timestamp();

-- 6. Add function to clean up expired verifications
CREATE OR REPLACE FUNCTION cleanup_expired_domain_verifications()
RETURNS void AS $$
BEGIN
    UPDATE domain_ownership_verifications
    SET verification_status = 'expired'
    WHERE verification_status = 'pending'
      AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- 7. Comments for documentation
COMMENT ON TABLE domain_ownership_verifications IS 
    'Tracks DNS-based domain ownership verification challenges before SES identity creation';
    
COMMENT ON COLUMN tenant_ses_identities.ownership_verification_token IS 
    'Unique token used for DNS TXT record verification';
    
COMMENT ON COLUMN tenant_ses_identities.ownership_verified_at IS 
    'Timestamp when domain ownership was proven - MUST be set before allowing SES operations';
    
COMMENT ON COLUMN tenant_ses_identities.ownership_verification_method IS 
    'Method used to verify ownership: dns_txt (production), grandfathered (migration), or email (future)';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
