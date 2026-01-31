-- =====================================================
-- MIGRATION: Refactor Phone/Voice Schema
-- Date: 2026-01-30
-- Description: 
--   1. Create model provider tables (STT, LLM, TTS, Realtime)
--   2. Restructure tenant_phone_config
--   3. Add custom_instruction and call_summary to phone_calls
--   4. Simplify message_phone_metadata
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Create Model Provider Tables
-- =====================================================

-- STT (Speech-to-Text) Models
CREATE TABLE IF NOT EXISTS x_stt (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,              -- 'azure', 'google', 'assemblyai', etc.
    model_name text NOT NULL,            -- 'whisper-1', 'enhanced', etc.
    pricing numeric(10, 6),              -- Price per unit
    pricing_unit text,                   -- 'per_minute', 'per_hour', 'per_second'
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_x_stt_provider ON x_stt(provider);
CREATE INDEX IF NOT EXISTS idx_x_stt_active ON x_stt(is_active);

-- LLM Models
CREATE TABLE IF NOT EXISTS x_llm (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,              -- 'openai', 'anthropic', 'groq', etc.
    model_name text NOT NULL,            -- 'gpt-4', 'claude-3', 'llama-3', etc.
    pricing numeric(10, 6),              -- Price per unit
    pricing_unit text,                   -- 'per_1k_tokens', 'per_1m_tokens'
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_x_llm_provider ON x_llm(provider);
CREATE INDEX IF NOT EXISTS idx_x_llm_active ON x_llm(is_active);

-- TTS (Text-to-Speech) Models
CREATE TABLE IF NOT EXISTS x_tts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,              -- 'azure', 'google', 'elevenlabs', 'openai', etc.
    voice_name text NOT NULL,            -- 'en-US-JennyNeural', 'alloy', etc.
    voice_model text,                    -- Model/engine version
    voice_url text,                      -- Sample audio URL (optional)
    pricing numeric(10, 6),              -- Price per unit
    pricing_unit text,                   -- 'per_character', 'per_1k_characters'
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(provider, voice_name)
);

CREATE INDEX IF NOT EXISTS idx_x_tts_provider ON x_tts(provider);
CREATE INDEX IF NOT EXISTS idx_x_tts_active ON x_tts(is_active);

-- Realtime STT/TTS (for OpenAI Realtime API)
CREATE TABLE IF NOT EXISTS x_realtime_sts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,              -- 'openai', future providers
    model_name text NOT NULL,            -- 'gpt-4o-realtime-preview', 'gpt-realtime-mini'
    voice_name text NOT NULL,            -- 'alloy', 'echo', 'shimmer', etc.
    voice_url text,                      -- Sample audio URL (optional)
    pricing numeric(10, 6),              -- Price per unit
    pricing_unit text,                   -- 'per_minute', 'per_audio_minute'
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(provider, model_name, voice_name)
);

CREATE INDEX IF NOT EXISTS idx_x_realtime_sts_provider ON x_realtime_sts(provider);
CREATE INDEX IF NOT EXISTS idx_x_realtime_sts_active ON x_realtime_sts(is_active);

-- =====================================================
-- STEP 2: Backup and Restructure tenant_phone_config
-- =====================================================

-- Backup existing data
CREATE TABLE IF NOT EXISTS tenant_phone_config_backup AS 
SELECT * FROM tenant_phone_config;

-- Drop existing table
DROP TABLE IF EXISTS tenant_phone_config CASCADE;

-- Recreate with new structure
CREATE TABLE tenant_phone_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Phone number (assigned by admin)
    phone_number text NOT NULL UNIQUE,
    
    -- Model selections (foreign keys to model tables)
    stt_model_id uuid REFERENCES x_stt(id) ON DELETE SET NULL,
    llm_model_id uuid REFERENCES x_llm(id) ON DELETE SET NULL,
    tts_model_id uuid REFERENCES x_tts(id) ON DELETE SET NULL,
    realtime_model_id uuid REFERENCES x_realtime_sts(id) ON DELETE SET NULL,
    
    -- Settings
    is_active boolean NOT NULL DEFAULT true,
    default_method text DEFAULT 'realtime',  -- 'realtime' | 'legacy'
    
    -- Browser calling (optional)
    twiml_app_sid text,                      -- For browser calling via Twilio SDK
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_config_tenant ON tenant_phone_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_config_phone ON tenant_phone_config(phone_number);

COMMENT ON TABLE tenant_phone_config IS 'Per-tenant phone configuration with model selections';
COMMENT ON COLUMN tenant_phone_config.default_method IS 'Default call processing method: realtime (OpenAI) or legacy (Azure STT+LLM+TTS)';
COMMENT ON COLUMN tenant_phone_config.twiml_app_sid IS 'Optional: Twilio TwiML App SID for browser calling';

-- Restore data from backup (only phone_number and is_active)
INSERT INTO tenant_phone_config (tenant_id, phone_number, is_active, default_method)
SELECT 
    tenant_id, 
    phone_number, 
    is_active,
    COALESCE(default_call_method, 'realtime')
FROM tenant_phone_config_backup
ON CONFLICT (tenant_id) DO NOTHING;

-- =====================================================
-- STEP 3: Add Fields to phone_calls
-- =====================================================

-- Add custom_instruction column
ALTER TABLE phone_calls 
ADD COLUMN IF NOT EXISTS custom_instruction text;

-- Add call_summary column
ALTER TABLE phone_calls 
ADD COLUMN IF NOT EXISTS call_summary text;

COMMENT ON COLUMN phone_calls.custom_instruction IS 'Per-call custom AI instructions (optional)';
COMMENT ON COLUMN phone_calls.call_summary IS 'AI-generated summary of the call';

-- =====================================================
-- STEP 4: Simplify message_phone_metadata
-- =====================================================

-- Backup existing data
CREATE TABLE IF NOT EXISTS message_phone_metadata_backup AS 
SELECT * FROM message_phone_metadata;

-- Drop columns that duplicate phone_calls data
ALTER TABLE message_phone_metadata 
DROP COLUMN IF EXISTS call_status,
DROP COLUMN IF EXISTS call_direction,
DROP COLUMN IF EXISTS from_number,
DROP COLUMN IF EXISTS to_number,
DROP COLUMN IF EXISTS call_duration_seconds,
DROP COLUMN IF EXISTS recording_url,
DROP COLUMN IF EXISTS recording_sid,
DROP COLUMN IF EXISTS twilio_account_sid,
DROP COLUMN IF EXISTS raw_payload;

-- Keep only message-specific fields:
-- - message_id (references messages)
-- - call_sid (references phone_calls)
-- - transcription_text (the actual spoken text)
-- - transcription_confidence (STT confidence score)

COMMENT ON TABLE message_phone_metadata IS 'Phone message metadata - stores transcription for each message turn';
COMMENT ON COLUMN message_phone_metadata.transcription_text IS 'Transcribed text from speech';
COMMENT ON COLUMN message_phone_metadata.transcription_confidence IS 'STT confidence score (0-1)';

-- =====================================================
-- STEP 5: Seed Initial Model Data
-- =====================================================

-- Insert common STT models
INSERT INTO x_stt (provider, model_name, pricing, pricing_unit) VALUES
    ('openai', 'whisper-1', 0.006, 'per_minute'),
    ('azure', 'standard', 0.017, 'per_minute'),
    ('azure', 'neural', 0.024, 'per_minute'),
    ('google', 'default', 0.016, 'per_minute'),
    ('google', 'enhanced', 0.024, 'per_minute')
ON CONFLICT (provider, model_name) DO NOTHING;

-- Insert common LLM models
INSERT INTO x_llm (provider, model_name, pricing, pricing_unit) VALUES
    ('openai', 'gpt-4o', 0.005, 'per_1k_tokens'),
    ('openai', 'gpt-4o-mini', 0.00015, 'per_1k_tokens'),
    ('openai', 'gpt-4-turbo', 0.01, 'per_1k_tokens'),
    ('anthropic', 'claude-3-5-sonnet', 0.003, 'per_1k_tokens'),
    ('anthropic', 'claude-3-5-haiku', 0.001, 'per_1k_tokens'),
    ('groq', 'llama-3.3-70b', 0.00059, 'per_1k_tokens'),
    ('groq', 'llama-3.1-8b', 0.00005, 'per_1k_tokens')
ON CONFLICT (provider, model_name) DO NOTHING;

-- Insert common TTS voices
INSERT INTO x_tts (provider, voice_name, voice_model, pricing, pricing_unit) VALUES
    ('azure', 'en-US-JennyNeural', 'Neural', 0.016, 'per_1k_characters'),
    ('azure', 'en-US-GuyNeural', 'Neural', 0.016, 'per_1k_characters'),
    ('azure', 'en-US-AriaNeural', 'Neural', 0.016, 'per_1k_characters'),
    ('openai', 'alloy', 'tts-1', 0.015, 'per_1k_characters'),
    ('openai', 'echo', 'tts-1', 0.015, 'per_1k_characters'),
    ('openai', 'nova', 'tts-1', 0.015, 'per_1k_characters'),
    ('openai', 'alloy-hd', 'tts-1-hd', 0.030, 'per_1k_characters'),
    ('google', 'en-US-Neural2-F', 'Neural2', 0.016, 'per_1k_characters'),
    ('elevenlabs', 'rachel', 'eleven_multilingual_v2', 0.30, 'per_1k_characters')
ON CONFLICT (provider, voice_name) DO NOTHING;

-- Insert OpenAI Realtime models
INSERT INTO x_realtime_sts (provider, model_name, voice_name, pricing, pricing_unit) VALUES
    ('openai', 'gpt-4o-realtime-preview', 'alloy', 0.06, 'per_audio_minute'),
    ('openai', 'gpt-4o-realtime-preview', 'echo', 0.06, 'per_audio_minute'),
    ('openai', 'gpt-4o-realtime-preview', 'shimmer', 0.06, 'per_audio_minute'),
    ('openai', 'gpt-realtime-mini', 'alloy', 0.01, 'per_audio_minute'),
    ('openai', 'gpt-realtime-mini', 'echo', 0.01, 'per_audio_minute'),
    ('openai', 'gpt-realtime-mini', 'shimmer', 0.01, 'per_audio_minute'),
    ('openai', 'gpt-realtime-mini', 'coral', 0.01, 'per_audio_minute'),
    ('openai', 'gpt-realtime-mini', 'sage', 0.01, 'per_audio_minute')
ON CONFLICT (provider, model_name, voice_name) DO NOTHING;

-- =====================================================
-- STEP 6: Update Triggers
-- =====================================================

-- Ensure updated_at trigger exists for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_x_stt_updated_at ON x_stt;
CREATE TRIGGER update_x_stt_updated_at 
    BEFORE UPDATE ON x_stt 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_x_llm_updated_at ON x_llm;
CREATE TRIGGER update_x_llm_updated_at 
    BEFORE UPDATE ON x_llm 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_x_tts_updated_at ON x_tts;
CREATE TRIGGER update_x_tts_updated_at 
    BEFORE UPDATE ON x_tts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_x_realtime_sts_updated_at ON x_realtime_sts;
CREATE TRIGGER update_x_realtime_sts_updated_at 
    BEFORE UPDATE ON x_realtime_sts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_phone_config_updated_at ON tenant_phone_config;
CREATE TRIGGER update_tenant_phone_config_updated_at 
    BEFORE UPDATE ON tenant_phone_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after migration to verify:

-- Check new model tables
-- SELECT * FROM x_stt;
-- SELECT * FROM x_llm;
-- SELECT * FROM x_tts;
-- SELECT * FROM x_realtime_sts;

-- Check tenant_phone_config structure
-- \d tenant_phone_config

-- Check phone_calls has new columns
-- \d phone_calls

-- Check message_phone_metadata simplified
-- \d message_phone_metadata

-- Check data preservation
-- SELECT COUNT(*) FROM tenant_phone_config;
-- SELECT COUNT(*) FROM phone_calls;
