-- Sites
CREATE TABLE IF NOT EXISTS sites (
  id              UUID PRIMARY KEY,
  name            TEXT NOT NULL,
  public_key      TEXT UNIQUE NOT NULL,
  secret          TEXT NOT NULL,
  api_key         TEXT UNIQUE NOT NULL,
  allowed_domains TEXT[] NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- End Users
CREATE TABLE IF NOT EXISTS end_users (
  id             UUID PRIMARY KEY,
  site_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  external_id    TEXT,
  email          TEXT,
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata       JSONB NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS end_users_site_external_id_uq
  ON end_users(site_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS end_users_site_email_uq
  ON end_users(site_id, email)
  WHERE email IS NOT NULL;

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id             UUID PRIMARY KEY,
  site_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  end_user_id    UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  title          TEXT,
  status         TEXT NOT NULL DEFAULT 'open',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata       JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS conversations_site_user_idx
  ON conversations(site_id, end_user_id, created_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS messages_site_created_idx
  ON messages(site_id, created_at DESC);
