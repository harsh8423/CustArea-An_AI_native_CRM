-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenants (Canonical Tenant Model)
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,                 -- for subdomain / URLs
  status text NOT NULL DEFAULT 'active', -- active | suspended | trial | cancelled
  plan text,                        -- free | starter | pro | enterprise
  timezone text DEFAULT 'UTC',
  locale text DEFAULT 'en',
  ai_enabled boolean DEFAULT true,
  ai_mode text DEFAULT 'assist',    -- assist | auto | off
  max_users int,
  max_leads int,
  max_ai_tokens_per_month bigint,
  metadata jsonb,                   -- industry, size, custom flags
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tenant Settings
CREATE TABLE tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  key text,
  value jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Users (Tenant Employees)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL, -- Added for authentication
  name text,
  role text,     -- owner | admin | manager | agent
  status text,   -- active | invited | disabled
  created_at timestamptz DEFAULT now()
);

-- 4. Contacts (Identity Only)
CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text,                 -- person | company
  name text,
  email text,
  phone text,
  company_name text,
  source text,               -- website, import, whatsapp, campaign
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- 5. Pipelines & Stages
CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text,
  is_default boolean
);

CREATE TABLE pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  name text,
  order_index int,
  is_terminal boolean
);

-- 6. Leads (Pipeline + Ownership)
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id),
  stage_id uuid NOT NULL REFERENCES pipeline_stages(id),
  owner_id uuid REFERENCES users(id),   -- assigned agent
  created_by uuid REFERENCES users(id),
  status text,           -- open | won | lost | disqualified
  score int,
  expected_value numeric,
  last_activity_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 7. Lead Assignments (History)
CREATE TABLE lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users(id),
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now()
);

-- 8. Customers / Accounts (Post-Conversion)
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id),
  lead_id uuid REFERENCES leads(id),
  lifecycle_stage text,    -- active | churned | paused
  created_at timestamptz DEFAULT now()
);
