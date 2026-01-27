-- =====================================================
-- CustArea CRM - Messaging & Channels Schema
-- File 3 of 5: Communication Layer
-- =====================================================
-- This file contains omnichannel messaging infrastructure
-- for Email, WhatsApp, Chat Widget, and Phone communications.
-- 
-- Tables: 18
-- Dependencies: File 1 (tenants, users), File 2 (contacts)
-- =====================================================

-- =====================================================
-- CORE MESSAGING TABLES
-- =====================================================

-- 1. CONVERSATIONS (Channel-Agnostic)
CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Channel info
    channel text NOT NULL,              -- 'email' | 'whatsapp' | 'widget' | 'phone'
    channel_contact_id text,            -- External ID (wa_number, widget_session, phone, email)
    
    -- Sender information (for unknown contacts)
    sender_display_name text,
    sender_identifier_type text,        -- 'email', 'phone', 'whatsapp', 'visitor_id'
    sender_identifier_value text,       -- Actual identifier value
    
    -- Status & ownership
    status text NOT NULL DEFAULT 'open', -- 'open' | 'pending' | 'resolved' | 'closed'
    priority text DEFAULT 'normal',      -- 'low' | 'normal' | 'high' | 'urgent'
    assigned_to uuid REFERENCES users(id),
    
    -- AI involvement
    ai_enabled boolean NOT NULL DEFAULT true,
    ai_mode text DEFAULT 'auto',         -- 'auto' | 'assist' | 'off'
    
    -- Timestamps
    subject text,                        -- For email threads
    last_message_at timestamptz,
    first_response_at timestamptz,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Metadata
    metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_sender_identifier 
    ON conversations(tenant_id, sender_identifier_type, sender_identifier_value);

-- 2. MESSAGES (Canonical Payload)
CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Direction & role
    direction text NOT NULL,             -- 'inbound' | 'outbound'
    role text NOT NULL,                  -- 'user' | 'agent' | 'ai' | 'system'
    
    -- Channel (redundant but intentional for querying)
    channel text NOT NULL,               -- 'email' | 'whatsapp' | 'widget' | 'phone'
    
    -- Content (normalized)
    content_text text,                   -- Plain text content
    content_html text,                   -- Rich HTML (for email)
    content_blocks jsonb,                -- Structured content (buttons, cards, etc.)
    
    -- Provider references
    provider text,                       -- 'ses' | 'twilio' | 'widget' | 'custom'
    provider_message_id text,            -- External message ID (SES, Twilio SID, etc.)
    
    -- Status
    status text NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
    error_message text,
    
    -- Timestamps
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- For threading
    reply_to_message_id uuid REFERENCES messages(id),
    
    -- Metadata
    metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(tenant_id, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_provider_id ON messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- 3. ATTACHMENTS (Unified)
CREATE TABLE attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
    
    -- File info
    filename text NOT NULL,
    content_type text,
    size_bytes bigint,
    
    -- Storage
    storage_type text NOT NULL DEFAULT 's3', -- 's3' | 'url' | 'inline'
    storage_key text,                    -- S3 key or URL
    
    -- For inline attachments (email CID)
    cid text,
    is_inline boolean DEFAULT false,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant ON attachments(tenant_id);

-- Helper: Update conversation last_message_at trigger
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at,
        updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_last_message ON messages;
CREATE TRIGGER trg_update_conversation_last_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- =====================================================
-- CHANNEL-SPECIFIC METADATA TABLES
-- =====================================================

-- Email-specific message metadata
CREATE TABLE message_email_metadata (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE UNIQUE,
    
    -- Email headers
    from_address text,
    to_addresses jsonb,                  -- [{email, name}]
    cc_addresses jsonb,
    bcc_addresses jsonb,
    reply_to text,
    
    -- SES-specific
    ses_message_id text,
    raw_message_id text,
    s3_key text,                         -- Raw email storage
    
    -- Threading
    message_id_header text,              -- Email Message-ID header
    in_reply_to text,
    references_header text,
    
    -- Metadata
    ses_metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_meta_message ON message_email_metadata(message_id);
CREATE INDEX IF NOT EXISTS idx_email_meta_ses ON message_email_metadata(ses_message_id);

-- WhatsApp-specific message metadata
CREATE TABLE message_whatsapp_metadata (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE UNIQUE,
    
    -- WhatsApp identifiers
    wa_message_id text,
    wa_number text,                      -- 'whatsapp:+1234...'
    
    -- Twilio-specific
    twilio_message_sid text,
    twilio_account_sid text,
    
    -- WhatsApp-specific content
    wa_message_type text,                -- 'text' | 'image' | 'template' | 'interactive' | 'location'
    template_name text,
    template_params jsonb,
    interactive_payload jsonb,           -- Button responses, list selections
    
    -- Status callbacks
    status_callback_data jsonb,
    
    -- Raw payload
    raw_payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_wa_meta_message ON message_whatsapp_metadata(message_id);
CREATE INDEX IF NOT EXISTS idx_wa_meta_twilio ON message_whatsapp_metadata(twilio_message_sid);
CREATE INDEX IF NOT EXISTS idx_wa_meta_wa_id ON message_whatsapp_metadata(wa_message_id);

-- Widget-specific message metadata
CREATE TABLE message_widget_metadata (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE UNIQUE,
    
    -- Session info
    widget_session_id text,
    visitor_id text,
    
    -- Page context
    page_url text,
    page_title text,
    referrer text,
    
    -- Browser info
    user_agent text,
    ip_address inet,
    
    -- Metadata
    custom_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_widget_meta_message ON message_widget_metadata(message_id);
CREATE INDEX IF NOT EXISTS idx_widget_meta_session ON message_widget_metadata(widget_session_id);

-- Phone/Voice-specific message metadata
CREATE TABLE message_phone_metadata (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE UNIQUE,
    
    -- Call info
    call_sid text,
    call_status text,                    -- 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed'
    call_direction text,                 -- 'inbound' | 'outbound'
    
    -- Phone numbers
    from_number text,
    to_number text,
    
    -- Duration
    call_duration_seconds int,
    
    -- Recording
    recording_url text,
    recording_sid text,
    
    -- Transcription
    transcription_text text,
    transcription_confidence float,
    
    -- Twilio
    twilio_account_sid text,
    
    -- Raw data
    raw_payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_phone_meta_message ON message_phone_metadata(message_id);
CREATE INDEX IF NOT EXISTS idx_phone_meta_call ON message_phone_metadata(call_sid);

-- =====================================================
-- EMAIL PROVIDER INFRASTRUCTURE
-- =====================================================

-- Email Providers lookup table (supported providers)
CREATE TABLE email_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type text UNIQUE NOT NULL,  -- 'ses', 'gmail', 'outlook', 'workspace', 'smtp'
    display_name text NOT NULL,
    description text,
    requires_oauth boolean NOT NULL DEFAULT false,
    requires_domain_verification boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant Email Connections (per-tenant email account with credentials)
CREATE TABLE tenant_email_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id uuid NOT NULL REFERENCES email_providers(id),
    provider_type text NOT NULL,           -- denormalized for quick access
    
    -- Connection identity
    email_address text NOT NULL,           -- The email address for this connection
    display_name text,                     -- Optional display name for outbound emails
    
    -- Encrypted credentials (OAuth tokens, API keys, SMTP passwords, etc.)
    credentials_encrypted text,            -- TEXT not JSONB for encrypted strings
    
    -- OAuth specific (if applicable)
    oauth_scopes text[],                   -- Scopes granted ['gmail.send', 'gmail.readonly']
    oauth_expires_at timestamptz,          -- When access token expires
    
    -- Status
    is_active boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,  -- Default connection for sending
    last_sync_at timestamptz,              -- Last time we synced emails from this connection
    last_error text,                       -- Last error message if connection failed
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, email_address, provider_type)
);

CREATE INDEX IF NOT EXISTS idx_email_connections_tenant ON tenant_email_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_provider ON tenant_email_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_active ON tenant_email_connections(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_email_connections_default ON tenant_email_connections(tenant_id, is_default) WHERE is_default = true;

-- Trigger for tenant_email_connections updated_at
DROP TRIGGER IF EXISTS update_tenant_email_connections_updated_at ON tenant_email_connections;
CREATE TRIGGER update_tenant_email_connections_updated_at 
    BEFORE UPDATE ON tenant_email_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- SES-specific tables (domain verification)
CREATE TABLE tenant_ses_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    identity_type text NOT NULL,           -- 'domain' or 'email'
    identity_value text NOT NULL,          -- 'companyA.com' or 'support@companyA.com'
    verification_status text NOT NULL DEFAULT 'PENDING',  -- 'PENDING' | 'SUCCESS' | 'FAILED' | 'TEMPORARY_FAILURE'
    dkim_status text,                      -- 'PENDING', 'SUCCESS', etc.
    dkim_tokens jsonb,                     -- ["abc._domainkey.companyA.com", ...] tokens
    spf_instructions text,                 -- optional helper text for SPF
    last_checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, identity_type, identity_value)
);

CREATE INDEX IF NOT EXISTS idx_ses_identities_tenant ON tenant_ses_identities(tenant_id);

-- Allowed outbound sender emails per tenant
CREATE TABLE tenant_allowed_from_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ses_identity_id uuid NOT NULL REFERENCES tenant_ses_identities(id) ON DELETE CASCADE,
    email_address text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_allowed_from_tenant ON tenant_allowed_from_emails(tenant_id);

-- Allowed inbound emails (emails that can forward to tenant)
CREATE TABLE allowed_inbound_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_address text NOT NULL,           -- e.g. support@tenant-domain.com
    description text,                      -- optional description/label
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_allowed_inbound_tenant ON allowed_inbound_emails(tenant_id);

-- =====================================================
-- CHANNEL CONFIGURATION TABLES
-- =====================================================

-- WhatsApp/Twilio Account Config (per tenant)
CREATE TABLE tenant_whatsapp_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Twilio credentials
    twilio_account_sid text NOT NULL,
    twilio_auth_token text NOT NULL,     -- Store encrypted at rest
    phone_number text NOT NULL,          -- 'whatsapp:+1415...'
    
    -- Settings
    is_active boolean NOT NULL DEFAULT true,
    webhook_url text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(phone_number)
);

CREATE INDEX IF NOT EXISTS idx_wa_accounts_tenant ON tenant_whatsapp_accounts(tenant_id);

-- Widget Embed Config (per tenant)
CREATE TABLE tenant_widget_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Widget identification
    public_key text UNIQUE NOT NULL,     -- For embed script
    secret_key text NOT NULL,            -- For backend auth
    
    -- Allowed domains
    allowed_domains text[] DEFAULT '{}',
    
    -- Appearance
    theme jsonb DEFAULT '{}',            -- colors, position, etc.
    welcome_message text,
    
    -- Settings
    is_active boolean NOT NULL DEFAULT true,
    require_email boolean DEFAULT false,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_widget_config_tenant ON tenant_widget_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_widget_config_public_key ON tenant_widget_config(public_key);

-- Widget Sessions (anonymous visitors)
CREATE TABLE widget_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES tenant_widget_config(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Anonymous identifier (from browser localStorage)
    external_id TEXT NOT NULL,
    
    -- Link to contact when email/phone provided
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Visitor info
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_widget_sessions_site_external 
    ON widget_sessions(site_id, external_id);
CREATE INDEX IF NOT EXISTS idx_widget_sessions_tenant ON widget_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_widget_sessions_contact ON widget_sessions(contact_id);

-- Widget Visitors (for tracking anonymous users)
CREATE TABLE widget_visitors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    visitor_token text NOT NULL,         -- Stored in browser
    contact_id uuid REFERENCES contacts(id), -- Linked after identification
    
    -- Info
    email text,
    name text,
    
    -- Tracking
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    page_views int DEFAULT 0,
    
    -- Browser
    user_agent text,
    
    metadata jsonb DEFAULT '{}',
    
    UNIQUE(tenant_id, visitor_token)
);

CREATE INDEX IF NOT EXISTS idx_widget_visitors_tenant ON widget_visitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_widget_visitors_contact ON widget_visitors(contact_id);

-- Phone/Voice Config (per tenant)
CREATE TABLE tenant_phone_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Twilio credentials
    twilio_account_sid text NOT NULL,
    twilio_auth_token text NOT NULL,
    phone_number text NOT NULL,
    twiml_app_sid TEXT,                  -- For browser calling
    
    -- Settings
    is_active boolean NOT NULL DEFAULT true,
    voice_model text DEFAULT 'en-US-Neural2-F',
    transcription_enabled boolean DEFAULT true,
    recording_enabled boolean DEFAULT false,
    default_call_method text DEFAULT 'realtime',
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_config_tenant ON tenant_phone_config(tenant_id);

COMMENT ON COLUMN tenant_phone_config.twiml_app_sid IS 'Twilio TwiML App SID for browser calling';

-- =====================================================
-- PHONE CALLS TABLE
-- =====================================================

CREATE TABLE phone_calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Twilio identifiers
    call_sid text UNIQUE NOT NULL,
    stream_sid text,
    
    -- Call details
    direction text NOT NULL,              -- 'inbound' | 'outbound'
    method text NOT NULL,                 -- 'realtime' | 'legacy' | 'convrelay'
    status text NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'failed' | 'no-answer'
    
    -- Phone numbers
    from_number text,
    to_number text,
    
    -- Timing
    started_at timestamptz NOT NULL DEFAULT now(),
    answered_at timestamptz,
    ended_at timestamptz,
    duration_seconds int,
    
    -- Transcript stats
    message_count int DEFAULT 0,
    
    -- Recording (if enabled)
    recording_url text,
    recording_sid text,
    
    -- Metadata
    metadata jsonb DEFAULT '{}',
    
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_calls_tenant ON phone_calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_conversation ON phone_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_contact ON phone_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_call_sid ON phone_calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_phone_calls_status ON phone_calls(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_phone_calls_started ON phone_calls(tenant_id, started_at DESC);

COMMENT ON TABLE phone_calls IS 'Stores phone call records with transcript references';
COMMENT ON COLUMN phone_calls.call_sid IS 'Twilio Call SID - unique identifier for the call';
COMMENT ON COLUMN phone_calls.method IS 'Voice processing method: realtime (OpenAI), legacy (Azure), convrelay (Twilio)';

-- =====================================================
-- SEED DATA: Email Providers
-- =====================================================

INSERT INTO email_providers (provider_type, display_name, description, requires_oauth, requires_domain_verification) VALUES
    ('ses', 'Amazon SES', 'AWS Simple Email Service for domain-based email', false, true),
    ('gmail', 'Gmail', 'Personal or business Gmail account via OAuth', true, false),
    ('outlook', 'Outlook', 'Microsoft Outlook/Office 365 via OAuth', true, false),
    ('workspace', 'Google Workspace', 'Google Workspace domain with service account', false, true),
    ('smtp', 'Custom SMTP', 'Custom SMTP server configuration', false, false)
ON CONFLICT (provider_type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    requires_oauth = EXCLUDED.requires_oauth,
    requires_domain_verification = EXCLUDED.requires_domain_verification;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE conversations IS 'Omnich annel conversations - links all messages across channels';
COMMENT ON TABLE messages IS 'Canonical message storage for all channels';
COMMENT ON TABLE attachments IS 'Unified attachment storage for all message types';
COMMENT ON TABLE email_providers IS 'Lookup table for supported email providers';
COMMENT ON TABLE tenant_email_connections IS 'Per-tenant email account connections with encrypted credentials';
COMMENT ON TABLE tenant_ses_identities IS 'SES-specific table for domain verification';

-- =====================================================
-- END OF FILE 3: Messaging/Channels
-- =====================================================
