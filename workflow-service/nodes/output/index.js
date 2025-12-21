/**
 * Output Nodes - Actions that produce side effects
 */

const { queueWhatsAppMessage, queueEmailMessage } = require('../../config/redis');

// Send WhatsApp Message
const send_whatsapp = {
    async execute({ config, context, run, tenant, pool, log }) {
        await log('debug', 'send_whatsapp raw config:', { config: JSON.stringify(config) });
        
        // Extract 'to' - handle different possible formats
        let to = config.to;
        
        // If 'to' is an object, we need to extract the actual phone number
        if (typeof to === 'object' && to !== null) {
            await log('debug', 'config.to is object:', { to: JSON.stringify(to) });
            // Try common field names - could be { to: "+123", message: "..." } or nested
            to = to.to || to.value || to.phone || to.number || to.recipient;
            
            // If still an object, try to get nested value
            if (typeof to === 'object' && to !== null) {
                to = to.value || to.phone || to.number || to.to;
            }
        }
        
        // Ensure to is a string
        if (typeof to !== 'string') {
            await log('error', 'Could not extract phone number from config.to', { originalTo: JSON.stringify(config.to) });
            throw new Error(`Invalid recipient: expected string but got ${typeof config.to}. Config: ${JSON.stringify(config.to)}`);
        }
        
        const message = config.message;
        
        if (!to || !message) {
            throw new Error('Send WhatsApp requires "to" and "message"');
        }

        await log('info', `Sending WhatsApp to ${to}`, { preview: message.substring(0, 50) });

        // Get or create conversation
        let conversationId = context.trigger?.conversation_id;
        
        if (!conversationId) {
            // First try to find existing conversation
            const existingConv = await pool.query(`
                SELECT id FROM conversations 
                WHERE tenant_id = $1 AND channel = 'whatsapp' AND channel_contact_id = $2
                LIMIT 1
            `, [tenant.id, to]);
            
            if (existingConv.rows.length > 0) {
                conversationId = existingConv.rows[0].id;
            } else {
                // Create new conversation
                const convResult = await pool.query(`
                    INSERT INTO conversations (tenant_id, channel, channel_contact_id, status, ai_mode)
                    VALUES ($1, 'whatsapp', $2, 'open', 'auto')
                    RETURNING id
                `, [tenant.id, to]);
                conversationId = convResult.rows[0].id;
            }
        }

        // Create message record - store recipient in metadata for cross-channel workflows
        const msgResult = await pool.query(`
            INSERT INTO messages (tenant_id, conversation_id, direction, role, channel, content_text, status, metadata)
            VALUES ($1, $2, 'outbound', 'ai', 'whatsapp', $3, 'pending', $4)
            RETURNING id
        `, [tenant.id, conversationId, message, JSON.stringify({ 
            workflow_run_id: run.id,
            recipient: to  // Store configured recipient for worker to use
        })]);

        const messageId = msgResult.rows[0].id;

        // Queue for existing whatsappOutbound worker
        await queueWhatsAppMessage(messageId, tenant.id);

        await log('info', `WhatsApp message queued: ${messageId}`);

        return {
            message_id: messageId,
            status: 'queued',
            conversation_id: conversationId
        };
    }
};

// Send Email
const send_email = {
    async execute({ config, context, run, tenant, pool, log }) {
        const { to, subject, body } = config;
        
        if (!to || !subject || !body) {
            throw new Error('Send Email requires "to", "subject", and "body"');
        }

        await log('info', `Sending email to ${to}`, { subject });

        // Get or create conversation
        let conversationId = context.trigger?.conversation_id;
        
        if (!conversationId) {
            // First try to find existing conversation
            const existingConv = await pool.query(`
                SELECT id FROM conversations 
                WHERE tenant_id = $1 AND channel = 'email' AND channel_contact_id = $2
                LIMIT 1
            `, [tenant.id, to]);
            
            if (existingConv.rows.length > 0) {
                conversationId = existingConv.rows[0].id;
            } else {
                // Create new conversation
                const convResult = await pool.query(`
                    INSERT INTO conversations (tenant_id, channel, channel_contact_id, status, subject, ai_mode)
                    VALUES ($1, 'email', $2, 'open', $3, 'auto')
                    RETURNING id
                `, [tenant.id, to, subject]);
                conversationId = convResult.rows[0].id;
            }
        }

        // Create message record
        const msgResult = await pool.query(`
            INSERT INTO messages (tenant_id, conversation_id, direction, role, channel, content_text, status, metadata)
            VALUES ($1, $2, 'outbound', 'ai', 'email', $3, 'pending', $4)
            RETURNING id
        `, [tenant.id, conversationId, body, JSON.stringify({ 
            workflow_run_id: run.id,
            subject,
            to
        })]);

        const messageId = msgResult.rows[0].id;

        // Queue for existing emailOutbound worker
        await queueEmailMessage(messageId, tenant.id);

        await log('info', `Email queued: ${messageId}`);

        return {
            message_id: messageId,
            status: 'queued',
            conversation_id: conversationId
        };
    }
};

// Create Lead - Fully automatic from trigger payload
const create_lead = {
    async execute({ config, context, tenant, pool, log }) {
        // Get trigger info
        const trigger = context.trigger || {};
        const channel = trigger.channel || 'workflow';
        const sender = trigger.sender || {};
        
        // Helper functions
        const isValidUUID = (str) => {
            if (!str || typeof str !== 'string') return false;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return uuidRegex.test(str);
        };
        
        const getCleanPhone = (phoneStr) => {
            if (!phoneStr) return null;
            return phoneStr.replace(/^whatsapp:/i, '').trim();
        };

        await log('debug', 'Creating lead from trigger', { channel, sender });

        // STEP 1: Find or create contact from trigger payload
        let contact_id = trigger.contact_id;
        
        // Try to get from conversation if not in trigger
        if (!isValidUUID(contact_id) && trigger.conversation_id) {
            const convResult = await pool.query(
                `SELECT contact_id FROM conversations WHERE id = $1`,
                [trigger.conversation_id]
            );
            if (convResult.rows.length > 0 && convResult.rows[0].contact_id) {
                contact_id = convResult.rows[0].contact_id;
                await log('debug', `Got contact_id from conversation: ${contact_id}`);
            }
        }
        
        // If still no contact, find or create from sender info
        if (!isValidUUID(contact_id)) {
            const phone = getCleanPhone(sender.phone || sender.wa_number || trigger.channel_contact_id);
            const email = channel === 'email' 
                ? (sender.email || trigger.channel_contact_id)
                : (sender.email && sender.email !== sender.phone ? sender.email : null);
            const name = sender.name || 'Unknown Contact';
            
            if (phone || email) {
                // Check if contact exists by phone
                let existingContact = null;
                if (phone) {
                    existingContact = await pool.query(
                        `SELECT id FROM contacts WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,
                        [tenant.id, phone]
                    );
                }
                // Check by email if not found
                if ((!existingContact || existingContact.rows.length === 0) && email) {
                    existingContact = await pool.query(
                        `SELECT id FROM contacts WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
                        [tenant.id, email]
                    );
                }
                
                if (existingContact && existingContact.rows.length > 0) {
                    contact_id = existingContact.rows[0].id;
                    await log('debug', `Found existing contact: ${contact_id}`);
                } else {
                    // Create new contact with all available data
                    const newContact = await pool.query(`
                        INSERT INTO contacts (tenant_id, name, phone, email, source)
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING id
                    `, [tenant.id, name, phone, email, channel]);
                    
                    contact_id = newContact.rows[0].id;
                    await log('info', `Created new contact: ${contact_id} (name: ${name}, phone: ${phone}, email: ${email}, source: ${channel})`);
                }
            }
        }
        
        if (!isValidUUID(contact_id)) {
            throw new Error('Could not find or create contact from trigger data');
        }

        // STEP 2: Get pipeline for tenant (use default or first available)
        let pipelineId = null;
        
        const pipelineResult = await pool.query(`
            SELECT id FROM pipelines WHERE tenant_id = $1 AND is_default = true LIMIT 1
        `, [tenant.id]);
        
        if (pipelineResult.rows.length > 0) {
            pipelineId = pipelineResult.rows[0].id;
        } else {
            // Fallback to any pipeline
            const anyPipeline = await pool.query(`
                SELECT id FROM pipelines WHERE tenant_id = $1 ORDER BY created_at LIMIT 1
            `, [tenant.id]);
            if (anyPipeline.rows.length > 0) {
                pipelineId = anyPipeline.rows[0].id;
            } else {
                throw new Error('No pipeline found for tenant');
            }
        }
        
        await log('debug', `Using pipeline: ${pipelineId}`);

        // STEP 3: Get first stage (typically "New" stage) for the pipeline
        let stageId = null;
        
        const stageResult = await pool.query(`
            SELECT id, name FROM pipeline_stages 
            WHERE pipeline_id = $1 
            ORDER BY order_index ASC 
            LIMIT 1
        `, [pipelineId]);
        
        if (stageResult.rows.length > 0) {
            stageId = stageResult.rows[0].id;
            await log('debug', `Using stage: ${stageResult.rows[0].name} (${stageId})`);
        } else {
            throw new Error('No stages found in pipeline');
        }

        // STEP 4: Check if lead already exists for this contact
        const existingLead = await pool.query(`
            SELECT id FROM leads 
            WHERE tenant_id = $1 AND contact_id = $2 AND status = 'open'
            LIMIT 1
        `, [tenant.id, contact_id]);
        
        if (existingLead.rows.length > 0) {
            const leadId = existingLead.rows[0].id;
            await log('info', `Lead already exists: ${leadId}`);
            return { lead_id: leadId, contact_id: contact_id, created: false };
        }

        // STEP 5: Create lead
        const leadResult = await pool.query(`
            INSERT INTO leads (tenant_id, contact_id, pipeline_id, stage_id, status)
            VALUES ($1, $2, $3, $4, 'open')
            RETURNING id
        `, [tenant.id, contact_id, pipelineId, stageId]);

        const leadId = leadResult.rows[0].id;
        await log('info', `Lead created: ${leadId}`);

        return { 
            lead_id: leadId, 
            contact_id: contact_id,
            pipeline_id: pipelineId,
            stage_id: stageId,
            created: true 
        };
    }
};

// Create Ticket
const create_ticket = {
    async execute({ config, context, tenant, pool, log }) {
        const { contact_id, subject, description, priority } = config;
        
        if (!subject) {
            throw new Error('Create Ticket requires subject');
        }

        await log('debug', 'Creating ticket', { subject, priority });

        const ticketResult = await pool.query(`
            INSERT INTO tickets (tenant_id, contact_id, subject, description, priority, status, source_conversation_id)
            VALUES ($1, $2, $3, $4, $5, 'new', $6)
            RETURNING id, ticket_number
        `, [tenant.id, contact_id || null, subject, description || '', priority || 'normal', 
            context.trigger?.conversation_id || null]);

        const ticket = ticketResult.rows[0];
        await log('info', `Ticket created: #${ticket.ticket_number}`);

        return {
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number
        };
    }
};

// Assign User (Round Robin or Specific)
const assign_user = {
    async execute({ config, context, tenant, pool, log }) {
        const { entity_type, entity_id, user_id, assignment_type } = config;
        
        if (!entity_type || !entity_id) {
            throw new Error('Assign User requires entity_type and entity_id');
        }

        let assignedUserId = user_id;

        if (assignment_type === 'round_robin') {
            // Get next user in round robin
            const usersResult = await pool.query(`
                SELECT id FROM users 
                WHERE tenant_id = $1 AND status = 'active' AND role IN ('agent', 'admin', 'manager')
                ORDER BY id
            `, [tenant.id]);

            if (usersResult.rows.length === 0) {
                throw new Error('No active users available for assignment');
            }

            // Simple round robin based on current assignments
            const countResult = await pool.query(`
                SELECT u.id, COUNT(l.id) as assignment_count
                FROM users u
                LEFT JOIN ${entity_type}s l ON l.assigned_to = u.id AND l.status != 'closed'
                WHERE u.tenant_id = $1 AND u.status = 'active'
                GROUP BY u.id
                ORDER BY assignment_count ASC, u.id ASC
                LIMIT 1
            `, [tenant.id]);

            assignedUserId = countResult.rows[0]?.id || usersResult.rows[0].id;
        }

        if (!assignedUserId) {
            throw new Error('No user specified for assignment');
        }

        // Update the entity
        const table = entity_type === 'lead' ? 'leads' : 
                      entity_type === 'ticket' ? 'tickets' : 'conversations';
        
        await pool.query(`
            UPDATE ${table} SET assigned_to = $1, updated_at = now() WHERE id = $2
        `, [assignedUserId, entity_id]);

        await log('info', `Assigned ${entity_type} to user ${assignedUserId}`);

        return { assigned_to: assignedUserId };
    }
};

module.exports = {
    send_whatsapp,
    send_email,
    create_lead,
    create_ticket,
    assign_user
};
