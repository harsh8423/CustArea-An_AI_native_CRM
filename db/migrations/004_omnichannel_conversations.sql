-- =====================================================
-- Omnichannel Conversation & Messaging Schema
-- Run this AFTER 003_email_tables.sql
-- =====================================================

-- =====================================================
-- LEVEL 1: CANONICAL CONVERSATIONS & MESSAGES
-- =====================================================

-- 1. Conversations (channel-agnostic)
CREATE TABLE IF NOT EXISTS conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Channel info
    channel text NOT NULL,              -- 'email' | 'whatsapp' | 'widget' | 'phone'
    channel_contact_id text,            -- External ID (wa_number, widget_session, phone, email)
    
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

-- 2. Messages (canonical payload)
CREATE TABLE IF NOT EXISTS messages (
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

-- 3. Attachments (unified)
CREATE TABLE IF NOT EXISTS attachments (
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

-- =====================================================
-- LEVEL 2: CHANNEL CONFIGURATION TABLES
-- =====================================================

-- WhatsApp/Twilio Account Config (per tenant)
CREATE TABLE IF NOT EXISTS tenant_whatsapp_accounts (
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
CREATE TABLE IF NOT EXISTS tenant_widget_config (
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

-- Phone/Voice Config (per tenant)
CREATE TABLE IF NOT EXISTS tenant_phone_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Twilio credentials
    twilio_account_sid text NOT NULL,
    twilio_auth_token text NOT NULL,
    phone_number text NOT NULL,
    
    -- Settings
    is_active boolean NOT NULL DEFAULT true,
    voice_model text DEFAULT 'en-US-Neural2-F',
    transcription_enabled boolean DEFAULT true,
    recording_enabled boolean DEFAULT false,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_config_tenant ON tenant_phone_config(tenant_id);

-- =====================================================
-- LEVEL 3: CHANNEL-SPECIFIC EXTENSION TABLES
-- =====================================================

-- Email-specific message metadata
CREATE TABLE IF NOT EXISTS message_email_metadata (
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
CREATE TABLE IF NOT EXISTS message_whatsapp_metadata (
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
CREATE TABLE IF NOT EXISTS message_widget_metadata (
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
CREATE TABLE IF NOT EXISTS message_phone_metadata (
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
-- WIDGET VISITORS (for tracking anonymous users)
-- =====================================================

CREATE TABLE IF NOT EXISTS widget_visitors (
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

-- =====================================================
-- HELPER: Update conversation last_message_at trigger
-- =====================================================

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
