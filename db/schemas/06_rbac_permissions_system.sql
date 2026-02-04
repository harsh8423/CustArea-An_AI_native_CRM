-- =====================================================
-- CONSOLIDATED MIGRATION 001: RBAC & Permissions System
-- Created: 2026-02-05
-- Description: Complete Role-Based Access Control infrastructure
--              Consolidates: 010_rbac, 012_role_tenant_isolation, 
--              grant_super_admin_permissions scripts
-- =====================================================
-- This migration creates:
--   - Global permission registry (50+ permissions)
--   - Tenant-specific roles with permission assignments
--   - User-role assignments with permission overrides
--   - Email, Phone, WhatsApp access control per user
--   - Lead/Contact assignment system
--   - User invitation system with role pre-assignment
-- =====================================================

-- =====================================================
-- 1. GLOBAL PERMISSIONS REGISTRY
-- =====================================================

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,  -- 'features', 'channels', 'crm', 'admin', 'settings'
    resource_type TEXT,      -- 'campaign', 'workflow', 'ticket', 'lead', 'contact', etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource_type);

COMMENT ON TABLE permissions IS 'Global registry of all available permissions in the system';
COMMENT ON COLUMN permissions.permission_key IS 'Unique key like campaigns.view, email.send, leads.create';
COMMENT ON COLUMN permissions.category IS 'Permission category for grouping in UI';

-- =====================================================
-- 2. TENANT ROLES
-- =====================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL for system roles
    role_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,  -- true for built-in roles, false for custom
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(tenant_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_system ON roles(is_system_role) WHERE is_system_role = true;
CREATE INDEX IF NOT EXISTS idx_roles_tenant_custom ON roles(tenant_id) WHERE is_system_role = false;

COMMENT ON TABLE roles IS 'Tenant-specific roles (both system defaults and custom roles)';
COMMENT ON COLUMN roles.is_system_role IS 'System roles are auto-created for each tenant, custom roles are user-created';
COMMENT ON COLUMN roles.tenant_id IS 'NULL for system/universal roles, specific tenant ID for custom roles';

-- Constraint: System roles must have NULL tenant_id, custom roles must have tenant_id
ALTER TABLE roles ADD CONSTRAINT IF NOT EXISTS check_role_tenant_isolation 
CHECK (
    (is_system_role = true AND tenant_id IS NULL) OR 
    (is_system_role = false AND tenant_id IS NOT NULL)
);

COMMENT ON CONSTRAINT check_role_tenant_isolation ON roles IS 
'Ensures system roles are universal (NULL tenant) and custom roles are tenant-specific';

-- =====================================================
-- 3. ROLE-PERMISSION ASSIGNMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS 'Many-to-many relationship between roles and permissions';

-- =====================================================
-- 4. USER-ROLE ASSIGNMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON user_roles(assigned_by);

COMMENT ON TABLE user_roles IS 'Assigns roles to users - users can have multiple roles';

-- =====================================================
-- 5. USER DIRECT PERMISSION OVERRIDES
-- =====================================================

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT true,  -- true = grant, false = explicit revoke
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted ON user_permissions(user_id, granted);

COMMENT ON TABLE user_permissions IS 'Direct permission grants/revokes for users (overrides role permissions)';
COMMENT ON COLUMN user_permissions.granted IS 'true = explicitly granted, false = explicitly revoked (overrides role)';

-- =====================================================
-- 6. EMAIL ACCESS CONTROL - INBOUND
-- =====================================================

CREATE TABLE IF NOT EXISTS user_inbound_email_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    allowed_inbound_email_id UUID NOT NULL REFERENCES allowed_inbound_emails(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, allowed_inbound_email_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inbound_email_user ON user_inbound_email_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inbound_email_address ON user_inbound_email_access(allowed_inbound_email_id);

COMMENT ON TABLE user_inbound_email_access IS 'Controls which inbound email addresses user can see in their inbox';
COMMENT ON COLUMN user_inbound_email_access.allowed_inbound_email_id IS 'Reference to allowed_inbound_emails - user only sees emails TO these addresses';

-- =====================================================
-- 7. EMAIL ACCESS CONTROL - OUTBOUND
-- =====================================================

CREATE TABLE IF NOT EXISTS user_outbound_email_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL DEFAULT 'connection',  -- 'connection' | 'identity'
    
    -- For Gmail/Outlook OAuth connections
    email_connection_id UUID REFERENCES tenant_email_connections(id) ON DELETE CASCADE,
    
    -- For SES identities (domain or specific email)
    ses_identity_id UUID REFERENCES tenant_ses_identities(id) ON DELETE CASCADE,
    allowed_from_email_id UUID REFERENCES tenant_allowed_from_emails(id) ON DELETE CASCADE,
    
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_outbound_email_type CHECK (email_type IN ('connection', 'identity')),
    CONSTRAINT check_outbound_email_source CHECK (
        (email_type = 'connection' AND email_connection_id IS NOT NULL AND ses_identity_id IS NULL) OR
        (email_type = 'identity' AND ses_identity_id IS NOT NULL AND email_connection_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_user_outbound_email_user ON user_outbound_email_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outbound_email_connection ON user_outbound_email_access(email_connection_id) WHERE email_connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_outbound_email_identity ON user_outbound_email_access(ses_identity_id) WHERE ses_identity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_outbound_email_allowed ON user_outbound_email_access(allowed_from_email_id) WHERE allowed_from_email_id IS NOT NULL;

-- Prevent duplicate assignments
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_outbound_connection
    ON user_outbound_email_access(user_id, email_connection_id)
    WHERE email_connection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_outbound_allowed_email
    ON user_outbound_email_access(user_id, allowed_from_email_id)
    WHERE allowed_from_email_id IS NOT NULL;

COMMENT ON TABLE user_outbound_email_access IS 'Controls which email addresses user can send FROM';
COMMENT ON COLUMN user_outbound_email_access.email_type IS 'Type: connection (Gmail/Outlook) or identity (SES)';
COMMENT ON COLUMN user_outbound_email_access.email_connection_id IS 'Gmail/Outlook connection user can send from';
COMMENT ON COLUMN user_outbound_email_access.allowed_from_email_id IS 'Specific SES email address user can send from';

-- =====================================================
-- 8. PHONE NUMBER ACCESS CONTROL
-- =====================================================

CREATE TABLE IF NOT EXISTS user_phone_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_config_id UUID NOT NULL REFERENCES tenant_phone_config(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, phone_config_id)
);

CREATE INDEX IF NOT EXISTS idx_user_phone_user ON user_phone_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_config ON user_phone_access(phone_config_id);

COMMENT ON TABLE user_phone_access IS 'Controls which phone numbers user can make/receive calls from';
COMMENT ON COLUMN user_phone_access.phone_config_id IS 'Phone configuration - user can only use assigned phone numbers';

-- =====================================================
-- 9. WHATSAPP ACCESS CONTROL
-- =====================================================

CREATE TABLE IF NOT EXISTS user_whatsapp_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_account_id UUID NOT NULL REFERENCES tenant_whatsapp_accounts(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, whatsapp_account_id)
);

CREATE INDEX IF NOT EXISTS idx_user_whatsapp_user ON user_whatsapp_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_account ON user_whatsapp_access(whatsapp_account_id);

COMMENT ON TABLE user_whatsapp_access IS 'Controls which WhatsApp accounts user can access';

-- =====================================================
-- 10. LEAD ASSIGNMENTS (Data Access)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_lead_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_user_lead_user ON user_lead_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lead_lead ON user_lead_assignments(lead_id);

COMMENT ON TABLE user_lead_assignments IS 'Explicit lead assignments - users can only access assigned leads';

-- =====================================================
-- 11. CONTACT ASSIGNMENTS (Data Access)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_contact_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contact_user ON user_contact_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_contact ON user_contact_assignments(contact_id);

COMMENT ON TABLE user_contact_assignments IS 'Explicit contact assignments - users can only access assigned contacts';

-- =====================================================
-- 12. USER INVITATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Pre-assigned configuration
    role_ids UUID[],                    -- Roles to assign on acceptance
    permission_overrides JSONB,         -- Direct permissions {permissionId: granted}
    assigned_lead_ids UUID[],           -- Leads to assign
    assigned_contact_ids UUID[],        -- Contacts to assign
    
    -- Invitation token
    invitation_token TEXT UNIQUE NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'expired' | 'cancelled'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant ON user_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_pending ON user_invitations(status, expires_at) WHERE status = 'pending';

COMMENT ON TABLE user_invitations IS 'User invitation system with pre-configured roles and permissions';
COMMENT ON COLUMN user_invitations.role_ids IS 'Array of role IDs to assign when user accepts invitation';
COMMENT ON COLUMN user_invitations.permission_overrides IS 'JSON object of direct permissions to grant';

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Trigger function for roles table
CREATE OR REPLACE FUNCTION update_roles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS roles_updated_at ON roles;
CREATE TRIGGER roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_roles_timestamp();

-- =====================================================
-- SEED DATA: PERMISSIONS (50+ permissions)
-- =====================================================

INSERT INTO permissions (permission_key, display_name, description, category, resource_type) VALUES
    -- FEATURE ACCESS PERMISSIONS (15)
    ('dashboard.view', 'View Dashboard', 'Access to main dashboard and analytics', 'features', 'dashboard'),
    ('campaigns.view', 'View Campaigns', 'View email/outreach campaigns', 'features', 'campaign'),
    ('campaigns.create', 'Create Campaigns', 'Create new campaigns', 'features', 'campaign'),
    ('campaigns.edit', 'Edit Campaigns', 'Edit existing campaigns', 'features', 'campaign'),
    ('campaigns.delete', 'Delete Campaigns', 'Delete campaigns', 'features', 'campaign'),
    ('campaigns.launch', 'Launch Campaigns', 'Start/pause/stop campaigns', 'features', 'campaign'),
    ('workflows.view', 'View Workflows', 'View workflow automations', 'features', 'workflow'),
    ('workflows.create', 'Create Workflows', 'Create new workflows', 'features', 'workflow'),
    ('workflows.edit', 'Edit Workflows', 'Edit existing workflows', 'features', 'workflow'),
    ('workflows.delete', 'Delete Workflows', 'Delete workflows', 'features', 'workflow'),
    ('ticketing.view', 'View Tickets', 'View support tickets', 'features', 'ticket'),
    ('ticketing.create', 'Create Tickets', 'Create new tickets', 'features', 'ticket'),
    ('ticketing.edit', 'Edit Tickets', 'Edit and update tickets', 'features', 'ticket'),
    ('ticketing.delete', 'Delete Tickets', 'Delete tickets', 'features', 'ticket'),
    ('ticketing.assign', 'Assign Tickets', 'Assign tickets to users', 'features', 'ticket'),
    
    -- CHANNEL ACCESS PERMISSIONS (8)
    ('email.access', 'Access Email', 'Access email channel and inbox', 'channels', 'email'),
    ('email.send', 'Send Emails', 'Send emails from assigned addresses', 'channels', 'email'),
    ('whatsapp.access', 'Access WhatsApp', 'Access WhatsApp channel', 'channels', 'whatsapp'),
    ('whatsapp.send', 'Send WhatsApp Messages', 'Send WhatsApp messages', 'channels', 'whatsapp'),
    ('phone.access', 'Access Phone', 'Access phone/calling features', 'channels', 'phone'),
    ('phone.make_calls', 'Make Calls', 'Make outbound phone calls', 'channels', 'phone'),
    ('widget.access', 'Access Chat Widget', 'View and respond to chat widget conversations', 'channels', 'widget'),
    ('widget.respond', 'Respond to Widget Chats', 'Reply to widget conversations', 'channels', 'widget'),
    
    -- CRM PERMISSIONS (12)
    ('leads.view', 'View Leads', 'View leads in CRM', 'crm', 'lead'),
    ('leads.view_all', 'View All Leads', 'View all tenant leads (bypass assignment)', 'crm', 'lead'),
    ('leads.create', 'Create Leads', 'Create new leads', 'crm', 'lead'),
    ('leads.edit', 'Edit Leads', 'Edit lead information', 'crm', 'lead'),
    ('leads.delete', 'Delete Leads', 'Delete leads', 'crm', 'lead'),
    ('leads.assign', 'Assign Leads', 'Assign leads to other users', 'crm', 'lead'),
    ('contacts.view', 'View Contacts', 'View contacts', 'crm', 'contact'),
    ('contacts.view_all', 'View All Contacts', 'View all tenant contacts (bypass assignment)', 'crm', 'contact'),
    ('contacts.create', 'Create Contacts', 'Create new contacts', 'crm', 'contact'),
    ('contacts.edit', 'Edit Contacts', 'Edit contact information', 'crm', 'contact'),
    ('contacts.delete', 'Delete Contacts', 'Delete contacts', 'crm', 'contact'),
    ('contacts.assign', 'Assign Contacts', 'Assign contacts to other users', 'crm', 'contact'),
    
    -- CONVERSATION PERMISSIONS (4)
    ('conversations.view', 'View Conversations', 'View conversations (filtered by channel access)', 'crm', 'conversation'),
    ('conversations.reply', 'Reply to Conversations', 'Send replies in conversations', 'crm', 'conversation'),
    ('conversations.assign', 'Assign Conversations', 'Assign conversations to users', 'crm', 'conversation'),
    ('conversations.forward', 'Forward Conversations', 'Forward emails/messages to other users', 'crm', 'conversation'),
    
    -- ADMIN & USER MANAGEMENT PERMISSIONS (8)
    ('users.view', 'View Users', 'View user list and details', 'admin', 'user'),
    ('users.invite', 'Invite Users', 'Send user invitations', 'admin', 'user'),
    ('users.manage', 'Manage Users', 'Edit user details, assign roles, deactivate users', 'admin', 'user'),
    ('roles.view', 'View Roles', 'View roles and their permissions', 'admin', 'role'),
    ('roles.manage', 'Manage Roles', 'Create/edit/delete custom roles', 'admin', 'role'),
    ('settings.view', 'View Settings', 'Access settings page', 'admin', 'settings'),
    ('settings.edit', 'Edit Settings', 'Modify tenant settings and integrations', 'admin', 'settings'),
    ('reports.view', 'View Reports', 'Access reports and analytics', 'features', 'report'),
    
    -- AI & IMPORTS (5)
    ('ai.configure', 'Configure AI Agent', 'Configure AI agent settings and deployments', 'features', 'ai'),
    ('ai.deploy', 'Deploy AI Agents', 'Deploy and manage AI agents on delegated resources', 'features', 'ai'),
    ('ai.deploy_all', 'Deploy AI Agents (All Resources)', 'Manage AI deployments across all tenant resources without delegation', 'features', 'ai'),
    ('imports.create', 'Import Data', 'Upload and import CSV/Excel files', 'features', 'import'),
    ('imports.view', 'View Imports', 'View import history', 'features', 'import')
    
ON CONFLICT (permission_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    resource_type = EXCLUDED.resource_type;

-- =====================================================
-- SEED DATA: DEFAULT ROLE TEMPLATES
-- =====================================================

-- Helper function to create system roles for a tenant
CREATE OR REPLACE FUNCTION create_system_roles_for_tenant(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
    v_super_admin_role_id UUID;
    v_admin_role_id UUID;
    v_sales_manager_role_id UUID;
    v_sales_agent_role_id UUID;
    v_support_agent_role_id UUID;
    v_view_only_role_id UUID;
BEGIN
    -- 1. Super Admin (Owner) - ALL PERMISSIONS
    INSERT INTO roles (tenant_id, role_name, display_name, description, is_system_role)
    VALUES (p_tenant_id, 'super_admin', 'Super Admin', 'Full access to all features and settings', true)
    RETURNING id INTO v_super_admin_role_id;
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_super_admin_role_id, id FROM permissions;
    
    -- 2. Admin - Most permissions except some sensitive ones
    INSERT INTO roles (tenant_id, role_name, display_name, description, is_system_role)
    VALUES (p_tenant_id, 'admin', 'Admin', 'Administrative access with user management', true)
    RETURNING id INTO v_admin_role_id;
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_admin_role_id, id FROM permissions
    WHERE permission_key IN (
        'dashboard.view', 'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.launch',
        'workflows.view', 'workflows.create', 'workflows.edit',
        'ticketing.view', 'ticketing.create', 'ticketing.edit', 'ticketing.assign',
        'email.access', 'email.send', 'whatsapp.access', 'whatsapp.send', 'phone.access', 'phone.make_calls',
        'widget.access', 'widget.respond',
        'leads.view_all', 'leads.create', 'leads.edit', 'leads.assign',
        'contacts.view_all', 'contacts.create', 'contacts.edit', 'contacts.assign',
        'conversations.view', 'conversations.reply', 'conversations.assign', 'conversations.forward',
        'users.view', 'users.invite', 'users.manage', 'roles.view',
        'settings.view', 'settings.edit', 'reports.view',
        'ai.configure', 'ai.deploy_all', 'imports.create', 'imports.view'
    );
    
    -- 3. Sales Manager - Sales + limited admin
    INSERT INTO roles (tenant_id, role_name, display_name, description, is_system_role)
    VALUES (p_tenant_id, 'sales_manager', 'Sales Manager', 'Manage sales team and leads', true)
    RETURNING id INTO v_sales_manager_role_id;
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_sales_manager_role_id, id FROM permissions
    WHERE permission_key IN (
        'dashboard.view',
        'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.launch',
        'email.access', 'email.send', 'phone.access', 'phone.make_calls',
        'leads.view_all', 'leads.create', 'leads.edit', 'leads.assign',
        'contacts.view_all', 'contacts.create', 'contacts.edit', 'contacts.assign',
        'conversations.view', 'conversations.reply', 'conversations.assign',
        'users.view', 'reports.view', 'imports.create', 'ai.deploy'
    );
    
    -- 4. Sales Agent - Individual sales access
    INSERT INTO roles (tenant_id, role_name, display_name, description, is_system_role)
    VALUES (p_tenant_id, 'sales_agent', 'Sales Agent', 'Individual sales contributor', true)
    RETURNING id INTO v_sales_agent_role_id;
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_sales_agent_role_id, id FROM permissions
    WHERE permission_key IN (
        'dashboard.view',
        'campaigns.view',
        'email.access', 'email.send', 'phone.access', 'phone.make_calls',
        'leads.view', 'leads.create', 'leads.edit',
        'contacts.view', 'contacts.create', 'contacts.edit',
        'conversations.view', 'conversations.reply',
        'reports.view'
    );
    
    -- 5. Support Agent - Ticketing + communication
    INSERT INTO roles (tenant_id, role_name, display_name, description, is_system_role)
    VALUES (p_tenant_id, 'support_agent', 'Support Agent', 'Customer support representative', true)
    RETURNING id INTO v_support_agent_role_id;
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_support_agent_role_id, id FROM permissions
    WHERE permission_key IN (
        'dashboard.view',
        'ticketing.view', 'ticketing.create', 'ticketing.edit',
        'email.access', 'email.send', 'whatsapp.access', 'whatsapp.send',
        'widget.access', 'widget.respond', 'phone.access',
        'contacts.view', 'contacts.edit',
        'conversations.view', 'conversations.reply',
        'reports.view'
    );
    
    -- 6. View Only - Read-only access
    INSERT INTO roles (tenant_id, role_name, display_name, description, is_system_role)
    VALUES (p_tenant_id, 'view_only', 'View Only', 'Read-only access to data', true)
    RETURNING id INTO v_view_only_role_id;
    
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_view_only_role_id, id FROM permissions
    WHERE permission_key IN (
        'dashboard.view',
        'campaigns.view', 'workflows.view', 'ticketing.view',
        'leads.view', 'contacts.view',
        'conversations.view',
        'reports.view', 'users.view', 'roles.view', 'settings.view'
    );
    
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create system roles for new tenants
CREATE OR REPLACE FUNCTION auto_create_system_roles()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_system_roles_for_tenant(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_system_roles ON tenants;
CREATE TRIGGER trigger_auto_create_system_roles
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_system_roles();

-- Create system roles for existing tenants
DO $$
DECLARE
    tenant_record RECORD;
BEGIN
    FOR tenant_record IN SELECT id FROM tenants LOOP
        PERFORM create_system_roles_for_tenant(tenant_record.id);
    END LOOP;
END $$;

-- =====================================================
-- DATA MIGRATION: Assign Roles to Existing Users
-- =====================================================

DO $$
DECLARE
    user_record RECORD;
    target_role_id UUID;
BEGIN
    FOR user_record IN SELECT id, tenant_id, role FROM users WHERE role IS NOT NULL LOOP
        -- Map old role to new system role
        SELECT id INTO target_role_id
        FROM roles
        WHERE tenant_id = user_record.tenant_id
        AND (
            (user_record.role = 'owner' AND role_name = 'super_admin') OR
            (user_record.role = 'admin' AND role_name = 'admin') OR
            (user_record.role = 'manager' AND role_name = 'sales_manager') OR
            (user_record.role = 'agent' AND role_name = 'sales_agent')
        )
        LIMIT 1;
        
        -- Assign role if found
        IF target_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id, assigned_by)
            VALUES (user_record.id, target_role_id, user_record.id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migrated existing users to new role system';
END $$;

-- =====================================================
-- HELPER VIEWS FOR EASY QUERYING
-- =====================================================

-- View to get all permissions for a user (combines role + direct permissions)
CREATE OR REPLACE VIEW user_effective_permissions AS
SELECT DISTINCT
    u.id as user_id,
    u.tenant_id,
    p.id as permission_id,
    p.permission_key,
    p.display_name as permission_name,
    p.category,
    CASE 
        WHEN up.granted IS NOT NULL THEN up.granted
        ELSE true
    END as is_granted
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
LEFT JOIN permissions p ON p.id = rp.permission_id
LEFT JOIN user_permissions up ON up.user_id = u.id AND up.permission_id = p.id
WHERE up.granted IS NULL OR up.granted = true
UNION
SELECT
    u.id as user_id,
    u.tenant_id,
    p.id as permission_id,
    p.permission_key,
    p.display_name as permission_name,
    p.category,
    up.granted as is_granted
FROM users u
JOIN user_permissions up ON up.user_id = u.id
JOIN permissions p ON p.id = up.permission_id
WHERE up.granted = true;

COMMENT ON VIEW user_effective_permissions IS 'Materialized view of all effective permissions per user (role-based + overrides)';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'RBAC System Migration Completed Successfully!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Created 12 tables:';
    RAISE NOTICE '  ✓ permissions (52 permissions seeded)';
    RAISE NOTICE '  ✓ roles (6 system roles per tenant)';
    RAISE NOTICE '  ✓ role_permissions';
    RAISE NOTICE '  ✓ user_roles';
    RAISE NOTICE '  ✓ user_permissions';
    RAISE NOTICE '  ✓ user_inbound_email_access';
    RAISE NOTICE '  ✓ user_outbound_email_access';
    RAISE NOTICE '  ✓ user_phone_access';
    RAISE NOTICE '  ✓ user_whatsapp_access';
    RAISE NOTICE '  ✓ user_lead_assignments';
    RAISE NOTICE '  ✓ user_contact_assignments';
    RAISE NOTICE '  ✓ user_invitations';
    RAISE NOTICE '';
    RAISE NOTICE 'System Roles Created:';
    RAISE NOTICE '  1. Super Admin - Full access';
    RAISE NOTICE '  2. Admin - Administrative access';
    RAISE NOTICE '  3. Sales Manager - Sales team lead';
    RAISE NOTICE '  4. Sales Agent - Individual contributor';
    RAISE NOTICE '  5. Support Agent - Customer support';
    RAISE NOTICE '  6. View Only - Read-only access';
    RAISE NOTICE '';
    RAISE NOTICE 'Migrated existing users to new role system';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
