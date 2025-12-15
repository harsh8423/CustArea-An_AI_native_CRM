-- 2.1 tenants
CREATE TABLE IF NOT EXISTS whatsapp_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_mode TEXT NOT NULL DEFAULT 'AUTO_REPLY' -- 'AUTO_REPLY' | 'OFF' | 'DRAFT'
);

-- 2.2 twilio_whatsapp_accounts
CREATE TABLE IF NOT EXISTS whatsapp_twilio_whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES whatsapp_tenants(id),
  twilio_account_sid TEXT NOT NULL,
  twilio_auth_token TEXT NOT NULL, -- store encrypted at rest
  phone_number TEXT NOT NULL,      -- 'whatsapp:+1415...'
  UNIQUE (phone_number)
);

-- 2.3 contacts
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES whatsapp_tenants(id),
  wa_number TEXT NOT NULL,  -- 'whatsapp:+91...'
  name TEXT,
  metadata JSONB,
  UNIQUE (tenant_id, wa_number)
);

-- 2.4 conversations
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES whatsapp_tenants(id),
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id),
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_tenant_contact
  ON whatsapp_conversations (tenant_id, contact_id, channel);

-- 2.5 messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES whatsapp_tenants(id),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id),
  direction TEXT NOT NULL, -- 'IN' | 'OUT'
  source TEXT NOT NULL,    -- 'USER' | 'AI' | 'HUMAN' | 'SYSTEM'
  content TEXT,
  raw_payload JSONB,
  status TEXT NOT NULL,    -- RECEIVED | PENDING_SEND | SENT | FAILED | DELIVERED | READ
  twilio_message_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv_time
  ON whatsapp_messages (tenant_id, conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_twilio_sid
  ON whatsapp_messages (twilio_message_sid);
