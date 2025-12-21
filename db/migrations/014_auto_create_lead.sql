-- Migration: Update create_lead node to be fully automatic (no user input required)
-- The node now extracts all data from trigger payload automatically

-- Update create_lead node definition - remove required fields, update description
UPDATE node_definitions 
SET 
    description = 'Automatically create a lead from trigger data. Finds or creates contact from phone/email, uses default pipeline and first stage.',
    input_schema = '{"type": "object", "properties": {}, "required": []}',
    default_config = '{}',
    output_schema = '{"type": "object", "properties": {"lead_id": {"type": "string", "description": "Created lead ID"}, "contact_id": {"type": "string", "description": "Contact ID (found or created)"}, "pipeline_id": {"type": "string", "description": "Pipeline ID used"}, "stage_id": {"type": "string", "description": "Stage ID used"}, "created": {"type": "boolean", "description": "True if new lead was created, false if existing lead returned"}}}'
WHERE type = 'create_lead';

-- Also update the trigger nodes output_schema to include all available fields
UPDATE node_definitions 
SET output_schema = '{"type": "object", "properties": {"trigger_type": {"type": "string"}, "sender_phone": {"type": "string"}, "sender_name": {"type": "string"}, "message_body": {"type": "string"}, "message_id": {"type": "string"}, "contact_id": {"type": "string"}, "conversation_id": {"type": "string"}, "channel": {"type": "string"}, "timestamp": {"type": "string"}}}'
WHERE type = 'whatsapp_message';

UPDATE node_definitions 
SET output_schema = '{"type": "object", "properties": {"trigger_type": {"type": "string"}, "sender_email": {"type": "string"}, "sender_name": {"type": "string"}, "email_subject": {"type": "string"}, "email_body": {"type": "string"}, "message_id": {"type": "string"}, "contact_id": {"type": "string"}, "conversation_id": {"type": "string"}, "channel": {"type": "string"}, "timestamp": {"type": "string"}}}'
WHERE type = 'email_received';
