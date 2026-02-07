-- =====================================================
-- FIX: Add missing voice_model column to tenant_phone_config
-- =====================================================

ALTER TABLE tenant_phone_config
ADD COLUMN IF NOT EXISTS voice_model TEXT DEFAULT 'en-US-Neural2-F';

-- Also ensure default_method exists (it should, but just in case)
ALTER TABLE tenant_phone_config
ADD COLUMN IF NOT EXISTS default_method TEXT DEFAULT 'realtime';

-- Ensure we have the indexes
CREATE INDEX IF NOT EXISTS idx_phone_config_tenant ON tenant_phone_config(tenant_id);
