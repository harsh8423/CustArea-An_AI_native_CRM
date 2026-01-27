# CustArea CRM - Database Schemas

This directory contains the complete database schema for CustArea CRM, organized into 5 categorized SQL files.

## 📊 Schema Overview

**Total Tables**: 52 tables across 5 categories

### File Organization

| File | Tables | Description | Dependencies |
|------|--------|-------------|--------------|
| **01_core_auth_tenants.sql** | 8 | Foundation layer (tenants, users, features) | None |
| **02_crm_contacts_leads.sql** | 8 | CRM layer (contacts, leads, pipelines) | File 1 |
| **03_messaging_channels.sql** | 18 | Communication layer (conversations, messages, channels) | Files 1, 2 |
| **04_ticketing_workflows.sql** | 13 | Automation layer (tickets, workflows) | Files 1, 2, 3 |
| **05_ai_imports_misc.sql** | 5 | Additional features (AI agents, imports) | File 1 |

## 🚀 Fresh Database Setup

Execute files in order for a fresh database:

```bash
# Using psql
psql -U postgres -d your_database -f 01_core_auth_tenants.sql
psql -U postgres -d your_database -f 02_crm_contacts_leads.sql
psql -U postgres -d your_database -f 03_messaging_channels.sql
psql -U postgres -d your_database -f 04_ticketing_workflows.sql
psql -U postgres -d your_database -f 05_ai_imports_misc.sql
```

Or all at once:
```bash
cat 01_core_auth_tenants.sql \
    02_crm_contacts_leads.sql \
    03_messaging_channels.sql \
    04_ticketing_workflows.sql \
    05_ai_imports_misc.sql | psql -U postgres -d your_database
```

## 📦 Seed Data Included

Each schema file automatically inserts required seed data:

- **File 1**: 8 default features (Dashboard, Sales, Conversation, AI Agent, Ticketing, Workflow, Campaign, Reports)
- **File 3**: 5 email providers (SES, Gmail, Outlook, Workspace, SMTP)
- **File 4**: 33 workflow node definitions (7 triggers, 5 logic, 4 AI, 5 outputs, 5 utilities)

## 📋 Table Breakdown

### File 1: Core/Auth/Tenants (8 tables)
- `tenants` - Multi-tenant foundation
- `tenant_settings` - Key-value tenant configuration
- `users` - Tenant employees (Supabase auth)
- `pending_signups` - OTP signup flow tracking
- `features` - Global feature registry (includes seed data)
- `tenant_features` - Per-tenant feature enablement

### File 2: CRM/Contacts/Leads (8 tables)
- `contacts` - Contact identity records
- `contact_identifiers` - Cross-channel deduplication
- `contact_merge_history` - Deduplication audit trail
- `pipelines` - Sales pipelines
- `pipeline_stages` - Pipeline stages
- `leads` - Sales leads with pipeline tracking
- `lead_assignments` - Lead assignment history
- `accounts` - Post-conversion customers

### File 3: Messaging/Channels (18 tables)

**Core Messaging:**
- `conversations` - Channel-agnostic conversations
- `messages` - Canonical message storage
- `attachments` - Unified attachment storage

**Channel Metadata:**
- `message_email_metadata`
- `message_whatsapp_metadata`
- `message_widget_metadata`
- `message_phone_metadata`

**Email Infrastructure:**
- `email_providers` (includes seed data)
- `tenant_email_connections`
- `tenant_ses_identities`
- `tenant_allowed_from_emails`
- `allowed_inbound_emails`

**Channel Configurations:**
- `tenant_whatsapp_accounts`
- `tenant_widget_config`
- `widget_sessions`
- `widget_visitors`
- `tenant_phone_config`
- `phone_calls`

### File 4: Ticketing/Workflows (13 tables)

**Ticketing:**
- `tickets`
- `ticket_activities`
- `ticket_notes`
- `ticket_macros`
- `ticket_tags`
- `ticket_tag_assignments`

**Workflows:**
- `workflow_node_definitions` (includes 33 node definitions)
- `workflows`
- `workflow_versions`
- `workflow_runs`
- `workflow_run_nodes`
- `workflow_run_logs`
- `workflow_scheduled_jobs`

### File 5: AI/Imports/Misc (5 tables)
- `ai_agent_deployments`
- `import_jobs`
- `import_columns`
- `import_rows`

## 🔗 Key Relationships

- **Multi-Tenancy**: All tables reference `tenants.id` for isolation
- **Users**: Authenticated via Supabase (`users.supabase_user_id`)
- **Contacts**: Deduplicated via `contact_identifiers` table
- **Conversations**: Link to `contacts`, can spawn `tickets`
- **Messages**: Always belong to a `conversation`
- **Workflows**: Execute based on triggers, create `workflow_runs`

## 🛡️ Features & Capabilities

### Auto-Enabled Features
When a new tenant is created, these features are automatically enabled:
- Dashboard
- Sales CRM
- Conversations
- AI Agent

### Manual Features
These must be explicitly enabled:
- Ticketing
- Workflow Automation
- Marketing Campaigns
- Reports & Analytics

### Workflow Nodes
33 pre-configured workflow nodes across 5 categories:
- **7 Trigger Nodes**: WhatsApp, Email, Ticket Created, Lead Added, Missed Call, Scheduled, Manual
- **5 Logic Nodes**: If/Else, Switch, Wait/Delay, Loop, Stop
- **4 AI Nodes**: Intent Detection, Sentiment Detection, Extract Entity, LLM Agent
- **5 Output Nodes**: Send WhatsApp, Send Email, Create Lead, Create Ticket, Assign User
- **5 Utility Nodes**: Set Variable, JSON Parser, HTTP Request, Assert, Error Handler

## 🔧 Triggers & Functions

Each file includes necessary PostgreSQL triggers and functions:

- **Auto-update timestamps**: `update_updated_at_column()`
- **Auto-enable features**: `auto_enable_default_features()` on tenant creation
- **Conversation tracking**: `update_conversation_last_message()` on message insert
- **Ticket audit**: `log_ticket_status_change()`, `log_ticket_creation()`
- **Workflow updates**: `update_workflow_updated_at()`

## 📝 Important Notes

### Deprecated Tables Removed
The following legacy email tables have been **removed** from this schema:
- `inbound_emails` → Modern: `messages` + `message_email_metadata`
- `outbound_emails` → Modern: `messages` + `message_email_metadata`
- `inbound_attachments` → Modern: `attachments`

All email functionality now uses the canonical messaging tables.

### Email Providers
5 providers are pre-configured:
- **SES**: AWS Simple Email Service (domain verification required)
- **Gmail**: Personal/business Gmail (OAuth required)
- **Outlook**: Microsoft Office 365 (OAuth required)
- **Workspace**: Google Workspace (service account)
- **SMTP**: Custom SMTP server

### Channel Support
The system supports 4 communication channels:
- **Email**: Multi-provider (SES, Gmail, Outlook, etc.)
- **WhatsApp**: Via Twilio
- **Chat Widget**: Embedded website chat
- **Phone**: Voice calls via Twilio

## 🧪 Verification

After running all schema files, verify with:

```sql
-- Count tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 52 tables

-- Verify seed data
SELECT COUNT(*) FROM features;                    -- Expected: 8
SELECT COUNT(*) FROM email_providers;             -- Expected: 5
SELECT COUNT(*) FROM workflow_node_definitions;   -- Expected: 33
```

## 📚 Additional Resources

- **Implementation Plan**: See `implementation_plan.md` for detailed schema analysis
- **Task Tracking**: See `task.md` for development checklist
- **Original Migrations**: See `db/migrations/` for schema evolution history

## 🎯 Next Steps

1. **Environment Setup**: Configure email providers (SES, Gmail, Outlook)
2. **Data Migration**: If upgrading from old schema, migrate data from deprecated tables
3. **Feature Configuration**: Enable optional features per tenant as needed
4. **Workflow Setup**: Create custom workflows using the 33 pre-configured nodes
5. **Channel Integration**: Connect WhatsApp, Widget, and Phone channels

---

**Generated**: 2026-01-26  
**Schema Version**: 1.0  
**Total Tables**: 52  
**Seed Data**: Features (8), Email Providers (5), Workflow Nodes (33)
