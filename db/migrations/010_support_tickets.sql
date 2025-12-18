-- =====================================================
-- Support Ticket System Migration
-- Run this AFTER 009_chat_widget.sql
-- =====================================================

-- =====================================================
-- LEVEL 1: CORE TICKET TABLES
-- =====================================================

-- 1. Main tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Ticket identification
    ticket_number serial,                    -- Human-readable ticket number
    subject text NOT NULL,
    description text,
    
    -- Status & Priority
    status text NOT NULL DEFAULT 'new',      -- new|open|pending|on_hold|resolved|closed
    priority text NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
    
    -- Assignment
    assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
    assigned_team text,                      -- Team name for escalation
    
    -- Source conversation (optional - ticket can be created from conversation)
    source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
    
    -- AI/Manual Insights (can be set manually or by AI in future)
    sentiment text,                          -- positive|neutral|negative|frustrated
    intent text,                             -- complaint|inquiry|feedback|request|support
    summary text,                            -- Brief summary of the ticket
    insights_metadata jsonb DEFAULT '{}',    -- Additional insights data
    
    -- SLA tracking
    due_at timestamptz,
    first_response_at timestamptz,
    resolution_at timestamptz,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    
    -- Soft delete
    is_deleted boolean DEFAULT false,
    
    -- Additional metadata
    metadata jsonb DEFAULT '{}',
    
    -- Ensure unique ticket numbers per tenant
    UNIQUE(tenant_id, ticket_number)
);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_contact ON tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_source_conv ON tickets(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_not_deleted ON tickets(tenant_id) WHERE is_deleted = false;

-- =====================================================
-- LEVEL 2: TICKET ACTIVITIES (AUDIT LOG)
-- =====================================================

-- 2. Ticket activities - audit trail for all ticket actions
CREATE TABLE IF NOT EXISTS ticket_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Activity type
    activity_type text NOT NULL,             -- created|status_change|priority_change|assignment|note_added|note_updated|tag_added|tag_removed|macro_applied|updated|closed|reopened
    
    -- Who performed the action
    performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    
    -- Change details
    old_value jsonb,                         -- Previous value(s)
    new_value jsonb,                         -- New value(s)
    description text,                        -- Human-readable description
    
    -- Timestamp
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for activities
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_type ON ticket_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_user ON ticket_activities(performed_by);

-- =====================================================
-- LEVEL 3: TICKET MACROS (REUSABLE ACTIONS)
-- =====================================================

-- 3. Ticket macros - reusable action templates
CREATE TABLE IF NOT EXISTS ticket_macros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Macro identification
    name text NOT NULL,
    description text,
    
    -- Macro type for categorization
    macro_type text NOT NULL DEFAULT 'custom', -- customer_input_required|team_escalation|inform|schedule_followup|custom
    
    -- Actions to perform (JSONB array)
    -- Example: [
    --   {"type": "set_status", "value": "pending"},
    --   {"type": "set_priority", "value": "high"},
    --   {"type": "add_tag", "tag_id": "uuid"},
    --   {"type": "set_team", "value": "billing"},
    --   {"type": "send_message", "template": "We are looking into this..."}
    -- ]
    actions jsonb NOT NULL DEFAULT '[]',
    
    -- Scheduling (for "handle after X hours/days" scenarios)
    schedule_delay_hours int,                -- Delay before executing scheduled actions
    
    -- Status
    is_active boolean DEFAULT true,
    
    -- Audit
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for macros
CREATE INDEX IF NOT EXISTS idx_ticket_macros_tenant ON ticket_macros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_macros_type ON ticket_macros(tenant_id, macro_type);
CREATE INDEX IF NOT EXISTS idx_ticket_macros_active ON ticket_macros(tenant_id) WHERE is_active = true;

-- =====================================================
-- LEVEL 4: TICKET NOTES (INTERNAL NOTES)
-- =====================================================

-- 4. Ticket notes - internal notes not visible to customers
CREATE TABLE IF NOT EXISTS ticket_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Note content
    content text NOT NULL,
    
    -- Note features
    is_pinned boolean DEFAULT false,         -- Pinned notes appear at top
    
    -- Audit
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for notes
CREATE INDEX IF NOT EXISTS idx_ticket_notes_ticket ON ticket_notes(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_notes_pinned ON ticket_notes(ticket_id) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_ticket_notes_user ON ticket_notes(created_by);

-- =====================================================
-- LEVEL 5: TICKET TAGS (CATEGORIZATION)
-- =====================================================

-- 5. Ticket tags - tenant-level tag definitions
CREATE TABLE IF NOT EXISTS ticket_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Tag details
    name text NOT NULL,
    color text DEFAULT '#6B7280',            -- Hex color for UI display
    description text,
    
    -- Timestamp
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure unique tag names per tenant
    UNIQUE(tenant_id, name)
);

-- Index for tags
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tenant ON ticket_tags(tenant_id);

-- 6. Junction table for ticket-tag many-to-many relationship
CREATE TABLE IF NOT EXISTS ticket_tag_assignments (
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES ticket_tags(id) ON DELETE CASCADE,
    
    -- Audit
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
    
    -- Composite primary key
    PRIMARY KEY (ticket_id, tag_id)
);

-- Indexes for tag assignments
CREATE INDEX IF NOT EXISTS idx_ticket_tag_assign_ticket ON ticket_tag_assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tag_assign_tag ON ticket_tag_assignments(tag_id);

-- =====================================================
-- LEVEL 6: LINK CONVERSATIONS TO TICKETS
-- =====================================================

-- Add ticket reference to conversations table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'ticket_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_ticket ON conversations(ticket_id);

-- =====================================================
-- HELPER: Update ticket updated_at trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ticket_updated_at ON tickets;
CREATE TRIGGER trg_update_ticket_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_updated_at();

-- =====================================================
-- HELPER: Auto-create activity on ticket status change
-- =====================================================

CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO ticket_activities (ticket_id, activity_type, old_value, new_value, description)
        VALUES (
            NEW.id,
            'status_change',
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status),
            'Status changed from ' || OLD.status || ' to ' || NEW.status
        );
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO ticket_activities (ticket_id, activity_type, old_value, new_value, description)
        VALUES (
            NEW.id,
            'priority_change',
            jsonb_build_object('priority', OLD.priority),
            jsonb_build_object('priority', NEW.priority),
            'Priority changed from ' || OLD.priority || ' to ' || NEW.priority
        );
    END IF;
    
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO ticket_activities (ticket_id, activity_type, old_value, new_value, description)
        VALUES (
            NEW.id,
            'assignment',
            jsonb_build_object('assigned_to', OLD.assigned_to),
            jsonb_build_object('assigned_to', NEW.assigned_to),
            'Ticket assignment changed'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_ticket_changes ON tickets;
CREATE TRIGGER trg_log_ticket_changes
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION log_ticket_status_change();

-- =====================================================
-- HELPER: Auto-create activity on ticket creation
-- =====================================================

CREATE OR REPLACE FUNCTION log_ticket_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ticket_activities (ticket_id, activity_type, new_value, description)
    VALUES (
        NEW.id,
        'created',
        jsonb_build_object('subject', NEW.subject, 'status', NEW.status, 'priority', NEW.priority),
        'Ticket created'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_ticket_creation ON tickets;
CREATE TRIGGER trg_log_ticket_creation
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION log_ticket_creation();
