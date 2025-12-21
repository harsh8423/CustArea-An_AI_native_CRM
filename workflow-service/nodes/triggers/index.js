/**
 * Trigger Nodes - Entry points for workflow execution
 * These are handled specially by the event worker, not executed directly
 */

// WhatsApp Message Trigger
const whatsapp_message = {
    async execute({ config, context }) {
        const trigger = context.trigger || {};
        return {
            trigger_type: 'whatsapp_message',
            // Flatten sender fields for easy access
            sender_phone: trigger.sender?.phone || trigger.sender?.wa_number || '',
            sender_name: trigger.sender?.name || '',
            // Flatten message fields
            message_body: trigger.message?.body || trigger.content || '',
            message_id: trigger.message?.id || trigger.message_id || '',
            // Keep full objects for advanced use
            sender: trigger.sender || {},
            message: trigger.message || {},
            contact_id: trigger.contact_id || '',
            conversation_id: trigger.conversation_id || '',
            timestamp: trigger.timestamp || new Date().toISOString()
        };
    }
};

// Email Received Trigger
const email_received = {
    async execute({ config, context }) {
        const trigger = context.trigger || {};
        return {
            trigger_type: 'email_received',
            // Flatten sender fields
            sender_email: trigger.sender?.email || trigger.from || '',
            sender_name: trigger.sender?.name || '',
            // Flatten message fields
            email_subject: trigger.message?.subject || trigger.subject || '',
            email_body: trigger.message?.body || trigger.body || '',
            message_id: trigger.message?.id || trigger.message_id || '',
            // Keep full objects for advanced use
            sender: trigger.sender || {},
            message: trigger.message || {},
            contact_id: trigger.contact_id || '',
            conversation_id: trigger.conversation_id || '',
            timestamp: trigger.timestamp || new Date().toISOString()
        };
    }
};

// Ticket Created Trigger
const ticket_created = {
    async execute({ config, context }) {
        const trigger = context.trigger || {};
        return {
            trigger_type: 'ticket_created',
            ticket_id: trigger.ticket?.id || trigger.ticket_id || '',
            ticket_number: trigger.ticket?.number || trigger.ticket_number || '',
            ticket_title: trigger.ticket?.title || trigger.title || '',
            ticket_description: trigger.ticket?.description || trigger.description || '',
            ticket_priority: trigger.ticket?.priority || trigger.priority || '',
            ticket_status: trigger.ticket?.status || trigger.status || '',
            ticket: trigger.ticket || {},
            contact_id: trigger.contact_id || '',
            timestamp: trigger.timestamp || new Date().toISOString()
        };
    }
};

// Lead Added Trigger
const lead_added = {
    async execute({ config, context }) {
        const trigger = context.trigger || {};
        return {
            trigger_type: 'lead_added',
            lead_id: trigger.lead?.id || trigger.lead_id || '',
            lead_name: trigger.lead?.name || trigger.name || '',
            lead_email: trigger.lead?.email || trigger.email || '',
            lead_phone: trigger.lead?.phone || trigger.phone || '',
            lead_source: trigger.lead?.source || trigger.source || '',
            lead: trigger.lead || {},
            pipeline_id: trigger.pipeline_id || '',
            stage_id: trigger.stage_id || '',
            timestamp: trigger.timestamp || new Date().toISOString()
        };
    }
};

// Missed Call Trigger
const missed_call = {
    async execute({ config, context }) {
        const trigger = context.trigger || {};
        return {
            trigger_type: 'missed_call',
            caller_phone: trigger.caller?.phone || trigger.from || '',
            caller_name: trigger.caller?.name || '',
            call_id: trigger.call?.id || trigger.call_id || '',
            caller: trigger.caller || {},
            call: trigger.call || {},
            contact_id: trigger.contact_id || '',
            timestamp: trigger.timestamp || new Date().toISOString()
        };
    }
};

// Scheduled Trigger
const scheduled_trigger = {
    async execute({ config, context }) {
        const trigger = context.trigger || {};
        return {
            trigger_type: 'scheduled_trigger',
            triggered_at: new Date().toISOString(),
            cron_expression: trigger.cron_expression || '',
            execution_count: trigger.execution_count || 1,
            ...(trigger)
        };
    }
};

// Manual Trigger
const manual_trigger = {
    async execute({ config, context }) {
        const trigger = context.trigger || {};
        return {
            trigger_type: 'manual_trigger',
            triggered_at: new Date().toISOString(),
            triggered_by: trigger.triggered_by || trigger.user_id || '',
            payload: trigger.payload || trigger,
            ...(typeof trigger === 'object' ? trigger : {})
        };
    }
};

module.exports = {
    whatsapp_message,
    email_received,
    ticket_created,
    lead_added,
    missed_call,
    scheduled_trigger,
    manual_trigger
};
