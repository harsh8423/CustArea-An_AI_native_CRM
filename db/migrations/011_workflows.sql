-- =====================================================
-- Workflow Automation System Migration
-- Run this AFTER 010_support_tickets.sql
-- =====================================================

-- =====================================================
-- LEVEL 1: NODE DEFINITIONS (GLOBAL REGISTRY)
-- =====================================================

-- Node definitions - global registry of available node types
-- Frontend fetches this to populate the node palette
CREATE TABLE IF NOT EXISTS workflow_node_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Node identification
    type text UNIQUE NOT NULL,           -- unique identifier: 'send_whatsapp', 'if_else', etc.
    name text NOT NULL,                  -- display name
    category text NOT NULL,              -- 'trigger' | 'logic' | 'ai' | 'output' | 'utility'
    description text,                    -- help text for users
    
    -- UI appearance
    icon text,                           -- icon name or URL
    color text DEFAULT '#6B7280',        -- hex color for node styling
    
    -- Schema definitions (JSON Schema format)
    input_schema jsonb NOT NULL DEFAULT '{}',   -- defines required inputs
    output_schema jsonb NOT NULL DEFAULT '{}',  -- defines output structure
    default_config jsonb DEFAULT '{}',          -- default values for inputs
    
    -- Metadata
    is_active boolean NOT NULL DEFAULT true,
    sort_order int DEFAULT 0,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_node_definitions_category ON workflow_node_definitions(category);
CREATE INDEX IF NOT EXISTS idx_node_definitions_active ON workflow_node_definitions(is_active) WHERE is_active = true;

-- =====================================================
-- LEVEL 2: WORKFLOW DEFINITIONS
-- =====================================================

-- Main workflows table - one record per workflow per tenant
CREATE TABLE IF NOT EXISTS workflows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Workflow identification
    name text NOT NULL,
    description text,
    
    -- Status management
    status text NOT NULL DEFAULT 'draft',  -- 'draft' | 'active' | 'paused' | 'archived'
    
    -- Cached trigger config for quick event matching
    trigger_type text,                     -- e.g., 'whatsapp_message', 'ticket_created'
    trigger_config jsonb DEFAULT '{}',     -- cached from published version
    
    -- Template support
    is_template boolean DEFAULT false,
    template_source_id uuid REFERENCES workflows(id) ON DELETE SET NULL,
    
    -- Audit
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure unique workflow names per tenant
    UNIQUE(tenant_id, name)
);

-- Indexes for workflows
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(tenant_id, trigger_type) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_workflows_templates ON workflows(is_template) WHERE is_template = true;

-- =====================================================
-- LEVEL 3: WORKFLOW VERSIONS
-- =====================================================

-- Versioned workflow definitions - stores React Flow graph
CREATE TABLE IF NOT EXISTS workflow_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    
    -- Version tracking
    version_number int NOT NULL,
    
    -- React Flow graph data
    nodes jsonb NOT NULL DEFAULT '[]',   -- React Flow nodes array
    edges jsonb NOT NULL DEFAULT '[]',   -- React Flow edges array
    
    -- Workflow variables (user-defined)
    variables jsonb DEFAULT '[]',        -- [{name, type, default_value}]
    
    -- Execution settings
    settings jsonb DEFAULT '{}',         -- {max_execution_time, retry_policy, etc.}
    
    -- Publication status
    is_published boolean NOT NULL DEFAULT false,
    published_at timestamptz,
    
    -- Audit
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure unique version numbers per workflow
    UNIQUE(workflow_id, version_number)
);

-- Indexes for versions
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_published ON workflow_versions(workflow_id, is_published) WHERE is_published = true;

-- =====================================================
-- LEVEL 4: WORKFLOW RUNS (EXECUTION INSTANCES)
-- =====================================================

-- Individual workflow execution instances
CREATE TABLE IF NOT EXISTS workflow_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version_id uuid NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Execution status
    status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'
    
    -- Trigger data (initial event payload)
    trigger_data jsonb NOT NULL DEFAULT '{}',
    
    -- Execution context (accumulated node outputs)
    -- Structure: { "node_id": { ...output_data }, ... }
    context jsonb NOT NULL DEFAULT '{}',
    
    -- Current position (for resume after delay)
    current_node_id text,
    executed_node_count int DEFAULT 0,
    
    -- Error information
    error_message text,
    error_node_id text,
    
    -- Timing
    started_at timestamptz,
    completed_at timestamptz,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for runs
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_waiting ON workflow_runs(status) WHERE status = 'waiting';

-- =====================================================
-- LEVEL 5: WORKFLOW RUN NODES (PER-NODE RESULTS)
-- =====================================================

-- Per-node execution results for a run
CREATE TABLE IF NOT EXISTS workflow_run_nodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    
    -- Node identification
    node_id text NOT NULL,               -- matches nodes[].id in version
    node_type text NOT NULL,             -- e.g., 'if_else', 'send_whatsapp'
    
    -- Execution status
    status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    
    -- Input/Output data
    input_data jsonb DEFAULT '{}',       -- resolved inputs (after variable substitution)
    output_data jsonb DEFAULT '{}',      -- execution result
    
    -- Performance
    execution_ms int,
    
    -- Error information
    error_message text,
    
    -- Timing
    started_at timestamptz,
    completed_at timestamptz,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for run nodes
CREATE INDEX IF NOT EXISTS idx_run_nodes_run ON workflow_run_nodes(run_id);
CREATE INDEX IF NOT EXISTS idx_run_nodes_status ON workflow_run_nodes(run_id, status);

-- =====================================================
-- LEVEL 6: WORKFLOW RUN LOGS (DEBUGGING)
-- =====================================================

-- Execution logs for debugging and display
CREATE TABLE IF NOT EXISTS workflow_run_logs (
    id bigserial PRIMARY KEY,
    run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Log context
    node_id text,                        -- optional, null for run-level logs
    
    -- Log content
    level text NOT NULL DEFAULT 'info',  -- 'debug' | 'info' | 'warn' | 'error'
    message text NOT NULL,
    data jsonb DEFAULT '{}',             -- additional structured data
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_run_logs_run ON workflow_run_logs(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_run_logs_tenant ON workflow_run_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_logs_level ON workflow_run_logs(run_id, level);

-- =====================================================
-- LEVEL 7: SCHEDULED JOBS (DELAY/RESUME)
-- =====================================================

-- Scheduled jobs for delay nodes and cron triggers
CREATE TABLE IF NOT EXISTS workflow_scheduled_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid REFERENCES workflow_runs(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
    
    -- Job type
    job_type text NOT NULL,              -- 'delay_resume' | 'scheduled_trigger'
    
    -- Resume information (for delay nodes)
    resume_node_id text,
    
    -- Schedule information (for cron triggers)
    cron_expression text,
    
    -- Timing
    resume_at timestamptz NOT NULL,
    
    -- Status
    status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'processed' | 'cancelled' | 'failed'
    processed_at timestamptz,
    error_message text,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for scheduled jobs
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_pending ON workflow_scheduled_jobs(resume_at, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_run ON workflow_scheduled_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow ON workflow_scheduled_jobs(workflow_id);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update workflows.updated_at on change
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_workflow_updated_at ON workflows;
CREATE TRIGGER trg_update_workflow_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_updated_at();

-- Update workflow_node_definitions.updated_at on change
DROP TRIGGER IF EXISTS trg_update_node_def_updated_at ON workflow_node_definitions;
CREATE TRIGGER trg_update_node_def_updated_at
    BEFORE UPDATE ON workflow_node_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_updated_at();

-- =====================================================
-- INITIAL NODE DEFINITIONS (SEED DATA)
-- =====================================================

-- Insert default node definitions
INSERT INTO workflow_node_definitions (type, name, category, description, icon, color, input_schema, output_schema, default_config, sort_order) VALUES

-- TRIGGER NODES
('whatsapp_message', 'WhatsApp Message', 'trigger', 'Triggered when a WhatsApp message is received', 'message-circle', '#25D366', 
 '{"type": "object", "properties": {"channels": {"type": "array", "items": {"type": "string"}, "default": ["whatsapp"]}}}',
 '{"type": "object", "properties": {"message_id": {"type": "string"}, "content": {"type": "string"}, "contact": {"type": "object"}, "conversation_id": {"type": "string"}}}',
 '{}', 1),

('email_received', 'Email Received', 'trigger', 'Triggered when an email is received', 'mail', '#EA4335',
 '{"type": "object", "properties": {"mailbox": {"type": "string"}}}',
 '{"type": "object", "properties": {"message_id": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}, "from": {"type": "object"}, "contact": {"type": "object"}}}',
 '{}', 2),

('ticket_created', 'Ticket Created', 'trigger', 'Triggered when a support ticket is created', 'ticket', '#F59E0B',
 '{"type": "object", "properties": {"priority_filter": {"type": "array", "items": {"type": "string"}}}}',
 '{"type": "object", "properties": {"ticket_id": {"type": "string"}, "subject": {"type": "string"}, "priority": {"type": "string"}, "contact": {"type": "object"}}}',
 '{}', 3),

('lead_added', 'Lead Added', 'trigger', 'Triggered when a new lead is created', 'user-plus', '#10B981',
 '{"type": "object", "properties": {"pipeline_filter": {"type": "string"}}}',
 '{"type": "object", "properties": {"lead_id": {"type": "string"}, "contact": {"type": "object"}, "pipeline_id": {"type": "string"}, "source": {"type": "string"}}}',
 '{}', 4),

('missed_call', 'Missed Call', 'trigger', 'Triggered when a phone call is missed', 'phone-missed', '#EF4444',
 '{"type": "object", "properties": {}}',
 '{"type": "object", "properties": {"call_sid": {"type": "string"}, "from_number": {"type": "string"}, "contact": {"type": "object"}}}',
 '{}', 5),

('scheduled_trigger', 'Scheduled', 'trigger', 'Runs on a schedule (cron)', 'clock', '#8B5CF6',
 '{"type": "object", "properties": {"cron_expression": {"type": "string", "title": "Cron Expression"}, "timezone": {"type": "string", "default": "UTC"}}, "required": ["cron_expression"]}',
 '{"type": "object", "properties": {"triggered_at": {"type": "string"}}}',
 '{"cron_expression": "0 9 * * *", "timezone": "UTC"}', 6),

('manual_trigger', 'Manual Trigger', 'trigger', 'Triggered manually via API or UI', 'play', '#6366F1',
 '{"type": "object", "properties": {"input_schema": {"type": "object"}}}',
 '{"type": "object", "properties": {"payload": {"type": "object"}}}',
 '{}', 7),

-- LOGIC NODES
('if_else', 'If/Else', 'logic', 'Branch based on a condition', 'git-branch', '#3B82F6',
 '{"type": "object", "properties": {"condition": {"type": "string", "title": "Condition", "description": "JavaScript expression that evaluates to true/false"}}, "required": ["condition"]}',
 '{"type": "object", "properties": {"branch": {"type": "string", "enum": ["true", "false"]}}}',
 '{"condition": ""}', 1),

('switch', 'Switch', 'logic', 'Multi-way branch based on a value', 'shuffle', '#3B82F6',
 '{"type": "object", "properties": {"value": {"type": "string", "title": "Value to match"}, "cases": {"type": "array", "items": {"type": "object", "properties": {"value": {"type": "string"}, "label": {"type": "string"}}}}}, "required": ["value", "cases"]}',
 '{"type": "object", "properties": {"matched_case": {"type": "string"}}}',
 '{"value": "", "cases": []}', 2),

('wait', 'Wait/Delay', 'logic', 'Pause execution for a specified duration', 'clock', '#3B82F6',
 '{"type": "object", "properties": {"duration": {"type": "number", "title": "Duration"}, "unit": {"type": "string", "enum": ["seconds", "minutes", "hours", "days"], "default": "minutes"}}, "required": ["duration", "unit"]}',
 '{"type": "object", "properties": {"resumed_at": {"type": "string"}}}',
 '{"duration": 5, "unit": "minutes"}', 3),

('loop', 'Loop', 'logic', 'Iterate over an array (max 100 iterations)', 'repeat', '#3B82F6',
 '{"type": "object", "properties": {"array": {"type": "string", "title": "Array to iterate"}, "max_iterations": {"type": "number", "default": 100, "maximum": 100}}, "required": ["array"]}',
 '{"type": "object", "properties": {"current_item": {"type": "object"}, "index": {"type": "number"}, "is_last": {"type": "boolean"}}}',
 '{"array": "", "max_iterations": 100}', 4),

('stop', 'Stop', 'logic', 'Stop workflow execution', 'square', '#EF4444',
 '{"type": "object", "properties": {"reason": {"type": "string", "title": "Stop reason"}}}',
 '{"type": "object", "properties": {}}',
 '{"reason": ""}', 5),

-- AI NODES
('intent_detection', 'Intent Detection', 'ai', 'Detect the intent of a message', 'brain', '#8B5CF6',
 '{"type": "object", "properties": {"text": {"type": "string", "title": "Text to analyze"}, "intents": {"type": "array", "items": {"type": "string"}, "title": "Possible intents"}}, "required": ["text", "intents"]}',
 '{"type": "object", "properties": {"intent": {"type": "string"}, "confidence": {"type": "number"}}}',
 '{"text": "{{trigger.content}}", "intents": ["inquiry", "complaint", "purchase", "support", "other"]}', 1),

('sentiment_detection', 'Sentiment Detection', 'ai', 'Analyze sentiment of text', 'heart', '#8B5CF6',
 '{"type": "object", "properties": {"text": {"type": "string", "title": "Text to analyze"}}, "required": ["text"]}',
 '{"type": "object", "properties": {"sentiment": {"type": "string", "enum": ["positive", "neutral", "negative", "frustrated"]}, "score": {"type": "number"}}}',
 '{"text": "{{trigger.content}}"}', 2),

('extract_entity', 'Extract Entity', 'ai', 'Extract structured data from text', 'search', '#8B5CF6',
 '{"type": "object", "properties": {"text": {"type": "string", "title": "Text to analyze"}, "entities": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "type": {"type": "string"}}}, "title": "Entities to extract"}}, "required": ["text", "entities"]}',
 '{"type": "object", "properties": {"entities": {"type": "object"}}}',
 '{"text": "{{trigger.content}}", "entities": []}', 3),

('llm_agent', 'LLM Agent', 'ai', 'Generate a response using AI', 'sparkles', '#8B5CF6',
 '{"type": "object", "properties": {"prompt": {"type": "string", "title": "System prompt"}, "message": {"type": "string", "title": "User message"}, "max_tokens": {"type": "number", "default": 500, "maximum": 2000}}, "required": ["prompt", "message"]}',
 '{"type": "object", "properties": {"response": {"type": "string"}, "tokens_used": {"type": "number"}}}',
 '{"prompt": "You are a helpful assistant.", "message": "{{trigger.content}}", "max_tokens": 500}', 4),

-- OUTPUT NODES
('send_whatsapp', 'Send WhatsApp', 'output', 'Send a WhatsApp message', 'message-circle', '#25D366',
 '{"type": "object", "properties": {"to": {"type": "string", "title": "Recipient phone"}, "message": {"type": "string", "title": "Message body"}}, "required": ["to", "message"]}',
 '{"type": "object", "properties": {"message_id": {"type": "string"}, "status": {"type": "string"}}}',
 '{"to": "{{trigger.contact.phone}}", "message": ""}', 1),

('send_email', 'Send Email', 'output', 'Send an email message', 'mail', '#EA4335',
 '{"type": "object", "properties": {"to": {"type": "string", "title": "Recipient email"}, "subject": {"type": "string", "title": "Subject"}, "body": {"type": "string", "title": "Email body"}}, "required": ["to", "subject", "body"]}',
 '{"type": "object", "properties": {"message_id": {"type": "string"}, "status": {"type": "string"}}}',
 '{"to": "{{trigger.contact.email}}", "subject": "", "body": ""}', 2),

('create_lead', 'Create Lead', 'output', 'Create a new lead from contact', 'user-plus', '#10B981',
 '{"type": "object", "properties": {"contact_id": {"type": "string"}, "pipeline_id": {"type": "string"}, "stage_id": {"type": "string"}, "source": {"type": "string"}}, "required": ["contact_id", "pipeline_id"]}',
 '{"type": "object", "properties": {"lead_id": {"type": "string"}}}',
 '{"contact_id": "{{trigger.contact.id}}", "source": "workflow"}', 3),

('create_ticket', 'Create Ticket', 'output', 'Create a support ticket', 'ticket', '#F59E0B',
 '{"type": "object", "properties": {"contact_id": {"type": "string"}, "subject": {"type": "string"}, "description": {"type": "string"}, "priority": {"type": "string", "enum": ["low", "normal", "high", "urgent"]}}, "required": ["subject"]}',
 '{"type": "object", "properties": {"ticket_id": {"type": "string"}, "ticket_number": {"type": "number"}}}',
 '{"contact_id": "{{trigger.contact.id}}", "subject": "", "priority": "normal"}', 4),

('assign_user', 'Assign User', 'output', 'Assign a user to a lead, ticket, or conversation', 'user-check', '#6366F1',
 '{"type": "object", "properties": {"entity_type": {"type": "string", "enum": ["lead", "ticket", "conversation"]}, "entity_id": {"type": "string"}, "user_id": {"type": "string"}, "assignment_type": {"type": "string", "enum": ["specific", "round_robin"]}}, "required": ["entity_type", "entity_id"]}',
 '{"type": "object", "properties": {"assigned_to": {"type": "string"}}}',
 '{"entity_type": "lead", "assignment_type": "round_robin"}', 5),

-- UTILITY NODES
('set_variable', 'Set Variable', 'utility', 'Set or modify a workflow variable', 'edit', '#6B7280',
 '{"type": "object", "properties": {"name": {"type": "string", "title": "Variable name"}, "value": {"type": "string", "title": "Value"}}, "required": ["name", "value"]}',
 '{"type": "object", "properties": {"value": {}}}',
 '{"name": "", "value": ""}', 1),

('json_parser', 'JSON Parser', 'utility', 'Parse a JSON string into an object', 'code', '#6B7280',
 '{"type": "object", "properties": {"json_string": {"type": "string", "title": "JSON string to parse"}}, "required": ["json_string"]}',
 '{"type": "object", "properties": {"parsed": {"type": "object"}}}',
 '{"json_string": ""}', 2),

('http_request', 'HTTP Request', 'utility', 'Make an HTTP request to an external API', 'globe', '#6B7280',
 '{"type": "object", "properties": {"url": {"type": "string"}, "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]}, "headers": {"type": "object"}, "body": {"type": "string"}}, "required": ["url", "method"]}',
 '{"type": "object", "properties": {"status": {"type": "number"}, "body": {}, "headers": {"type": "object"}}}',
 '{"url": "", "method": "GET", "headers": {}, "body": ""}', 3),

('assert', 'Assert', 'utility', 'Fail the workflow if a condition is not met', 'alert-triangle', '#EF4444',
 '{"type": "object", "properties": {"condition": {"type": "string", "title": "Condition that must be true"}, "error_message": {"type": "string", "title": "Error message if assertion fails"}}, "required": ["condition"]}',
 '{"type": "object", "properties": {"passed": {"type": "boolean"}}}',
 '{"condition": "", "error_message": "Assertion failed"}', 4),

('error_handler', 'Error Handler', 'utility', 'Catch and handle errors from previous nodes', 'shield', '#6B7280',
 '{"type": "object", "properties": {"on_error": {"type": "string", "enum": ["continue", "stop", "retry"], "default": "continue"}}}',
 '{"type": "object", "properties": {"had_error": {"type": "boolean"}, "error_message": {"type": "string"}}}',
 '{"on_error": "continue"}', 5)

ON CONFLICT (type) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    default_config = EXCLUDED.default_config,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE workflow_node_definitions IS 'Global registry of available node types for workflow builder';
COMMENT ON TABLE workflows IS 'Workflow definitions per tenant';
COMMENT ON TABLE workflow_versions IS 'Versioned workflow graphs (React Flow format)';
COMMENT ON TABLE workflow_runs IS 'Individual workflow execution instances';
COMMENT ON TABLE workflow_run_nodes IS 'Per-node execution results within a run';
COMMENT ON TABLE workflow_run_logs IS 'Execution logs for debugging and display';
COMMENT ON TABLE workflow_scheduled_jobs IS 'Scheduled jobs for delay nodes and cron triggers';
