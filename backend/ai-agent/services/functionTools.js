/**
 * Function calling tools for AI Agent
 * These tools allow the LLM to access contact data, conversations, and more
 */

const { pool } = require('../../config/db');
const { getKnowledgeContext } = require('./vectorSearchService');

/**
 * Tool definitions for OpenAI/Groq function calling
 */
const FUNCTION_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'get_contact_info',
            description: 'Get detailed information about a contact/customer including their profile, metadata, and preferences',
            parameters: {
                type: 'object',
                properties: {
                    contact_id: {
                        type: 'string',
                        description: 'The UUID of the contact to look up'
                    }
                },
                required: ['contact_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_conversation_history_by_contact',
            description: 'Get previous conversations for a specific contact by their contact_id across all channels (email, whatsapp, widget, phone)',
            parameters: {
                type: 'object',
                properties: {
                    contact_id: {
                        type: 'string',
                        description: 'The UUID of the contact'
                    },
                    limit: {
                        type: 'integer',
                        description: 'Maximum number of conversations to return (default 10)',
                        default: 10
                    }
                },
                required: ['contact_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'find_conversations_by_identifier',
            description: 'Find conversations by email address or phone number. Use this when the user provides an email or phone but you dont have their contact_id. This works even for contacts not yet saved in the system.',
            parameters: {
                type: 'object',
                properties: {
                    email: {
                        type: 'string',
                        description: 'Email address to search for'
                    },
                    phone: {
                        type: 'string',
                        description: 'Phone number to search for (any format)'
                    },
                    limit: {
                        type: 'integer',
                        description: 'Maximum number of conversations to return (default 10)',
                        default: 10
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_recent_messages',
            description: 'Get recent messages from the current or a specific conversation',
            parameters: {
                type: 'object',
                properties: {
                    conversation_id: {
                        type: 'string',
                        description: 'The UUID of the conversation'
                    },
                    limit: {
                        type: 'integer',
                        description: 'Maximum number of messages to return (default 20)',
                        default: 20
                    }
                },
                required: ['conversation_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_knowledge_base',
            description: 'Search the knowledge base for relevant information to answer customer questions',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query - what information are you looking for?'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'escalate_to_human',
            description: 'Hand off the conversation to a human agent. Use when you cannot help or the customer explicitly requests human support.',
            parameters: {
                type: 'object',
                properties: {
                    reason: {
                        type: 'string',
                        description: 'Reason for escalation'
                    },
                    priority: {
                        type: 'string',
                        enum: ['low', 'normal', 'high', 'urgent'],
                        description: 'Priority level for the escalation'
                    },
                    summary: {
                        type: 'string',
                        description: 'Brief summary of the conversation for the human agent'
                    }
                },
                required: ['reason']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_ticket',
            description: 'Create a support ticket for follow-up',
            parameters: {
                type: 'object',
                properties: {
                    title: {
                        type: 'string',
                        description: 'Ticket title/subject'
                    },
                    description: {
                        type: 'string',
                        description: 'Detailed description of the issue'
                    },
                    priority: {
                        type: 'string',
                        enum: ['low', 'normal', 'high', 'urgent'],
                        description: 'Priority level for the ticket (default: normal)'
                    }
                },
                required: ['title', 'description']
            }
        }
    }
];

/**
 * Execute a function tool call
 */
async function executeTool(tenantId, toolName, args, context = {}) {
    console.log(`Executing tool: ${toolName}`, args);

    switch (toolName) {
        case 'get_contact_info':
            return await getContactInfo(tenantId, args.contact_id);

        case 'get_conversation_history_by_contact':
            return await getConversationHistoryByContact(tenantId, args.contact_id, args.limit || 10);

        case 'find_conversations_by_identifier':
            return await findConversationsByIdentifier(tenantId, args.email, args.phone, args.limit || 10);

        case 'get_recent_messages':
            return await getRecentMessages(tenantId, args.conversation_id, args.limit || 20);

        case 'search_knowledge_base':
            return await searchKnowledgeBase(tenantId, args.query);

        case 'escalate_to_human':
            return await escalateToHuman(tenantId, args);

        case 'create_ticket':
            return await createTicket(tenantId, args, context.conversationId, context.contactId);

        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}

/**
 * Get contact information
 */
async function getContactInfo(tenantId, contactId) {
    try {
        const result = await pool.query(
            `SELECT id, name, email, phone, company_name, source, 
                    created_at, metadata
             FROM contacts 
             WHERE id = $1 AND tenant_id = $2`,
            [contactId, tenantId]
        );

        if (result.rows.length === 0) {
            return { error: 'Contact not found' };
        }

        const contact = result.rows[0];
        return {
            id: contact.id,
            name: contact.name || 'Unknown',
            email: contact.email,
            phone: contact.phone,
            company: contact.company_name,
            source: contact.source,
            created: contact.created_at,
            metadata: contact.metadata || {}
        };
    } catch (error) {
        console.error('Error getting contact info:', error);
        return { error: 'Failed to get contact information' };
    }
}

/**
 * Get conversation history for a specific contact by contact_id
 */
async function getConversationHistoryByContact(tenantId, contactId, limit = 10) {
    try {
        if (!contactId) {
            return { error: 'contact_id is required' };
        }

        const result = await pool.query(
            `SELECT c.id, c.channel, c.status, c.subject, c.created_at, c.last_message_at,
                    c.sender_display_name, c.sender_identifier_value,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
             FROM conversations c
             WHERE c.contact_id = $1 AND c.tenant_id = $2
             ORDER BY c.last_message_at DESC NULLS LAST
             LIMIT $3`,
            [contactId, tenantId, limit]
        );

        if (result.rows.length === 0) {
            return {
                found: false,
                message: 'No conversations found for this contact'
            };
        }

        return {
            found: true,
            conversations: result.rows.map(c => ({
                id: c.id,
                channel: c.channel,
                status: c.status,
                subject: c.subject || null,
                messageCount: parseInt(c.message_count) || 0,
                senderName: c.sender_display_name,
                senderIdentifier: c.sender_identifier_value,
                created: c.created_at,
                lastMessage: c.last_message_at
            })),
            total: result.rows.length
        };
    } catch (error) {
        console.error('Error getting conversation history by contact:', error);
        return { error: 'Failed to get conversation history', details: error.message };
    }
}

/**
 * Find conversations by email or phone number
 * Searches both contact-linked conversations and unknown sender conversations
 */
async function findConversationsByIdentifier(tenantId, email, phone, limit = 10) {
    try {
        if (!email && !phone) {
            return { error: 'Either email or phone number is required' };
        }

        let query;
        let params;

        if (email && phone) {
            // Search by both
            query = `
                SELECT 
                    c.id, c.channel, c.status, c.subject, c.created_at, c.last_message_at,
                    c.contact_id, c.sender_display_name, c.sender_identifier_type, c.sender_identifier_value,
                    co.name as contact_name, co.email as contact_email, co.phone as contact_phone,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
                    (SELECT content_text FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user' 
                     ORDER BY m.created_at DESC LIMIT 1) as last_message_preview
                FROM conversations c
                LEFT JOIN contacts co ON c.contact_id = co.id
                WHERE c.tenant_id = $1
                AND (
                    (c.sender_identifier_type = 'email' AND LOWER(c.sender_identifier_value) = LOWER($2))
                    OR (c.sender_identifier_type = 'phone' AND c.sender_identifier_value LIKE '%' || $3 || '%')
                    OR (co.email IS NOT NULL AND LOWER(co.email) = LOWER($2))
                    OR (co.phone IS NOT NULL AND co.phone LIKE '%' || $3 || '%')
                )
                ORDER BY c.last_message_at DESC NULLS LAST
                LIMIT $4`;
            params = [tenantId, email, phone, limit];
        } else if (email) {
            // Search by email only
            query = `
                SELECT 
                    c.id, c.channel, c.status, c.subject, c.created_at, c.last_message_at,
                    c.contact_id, c.sender_display_name, c.sender_identifier_type, c.sender_identifier_value,
                    co.name as contact_name, co.email as contact_email, co.phone as contact_phone,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
                    (SELECT content_text FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user' 
                     ORDER BY m.created_at DESC LIMIT 1) as last_message_preview
                FROM conversations c
                LEFT JOIN contacts co ON c.contact_id = co.id
                WHERE c.tenant_id = $1
                AND (
                    (c.sender_identifier_type = 'email' AND LOWER(c.sender_identifier_value) = LOWER($2))
                    OR (co.email IS NOT NULL AND LOWER(co.email) = LOWER($2))
                )
                ORDER BY c.last_message_at DESC NULLS LAST
                LIMIT $3`;
            params = [tenantId, email, limit];
        } else {
            // Search by phone only
            query = `
                SELECT 
                    c.id, c.channel, c.status, c.subject, c.created_at, c.last_message_at,
                    c.contact_id, c.sender_display_name, c.sender_identifier_type, c.sender_identifier_value,
                    co.name as contact_name, co.email as contact_email, co.phone as contact_phone,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
                    (SELECT content_text FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user' 
                     ORDER BY m.created_at DESC LIMIT 1) as last_message_preview
                FROM conversations c
                LEFT JOIN contacts co ON c.contact_id = co.id  
                WHERE c.tenant_id = $1
                AND (
                    (c.sender_identifier_type IN ('phone', 'whatsapp') AND c.sender_identifier_value LIKE '%' || $2 || '%')
                    OR (co.phone IS NOT NULL AND co.phone LIKE '%' || $2 || '%')
                )
                ORDER BY c.last_message_at DESC NULLS LAST
                LIMIT $3`;
            params = [tenantId, phone, limit];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return {
                found: false,
                searchedFor: { email, phone },
                message: `No conversations found for ${email || phone}`
            };
        }

        return {
            found: true,
            searchedFor: { email, phone },
            conversations: result.rows.map(c => ({
                id: c.id,
                channel: c.channel,
                status: c.status,
                subject: c.subject || null,
                messageCount: parseInt(c.message_count) || 0,
                lastMessagePreview: c.last_message_preview ? c.last_message_preview.substring(0, 100) : null,
                // Contact information
                contactId: c.contact_id,
                contactName: c.contact_name || c.sender_display_name,
                contactEmail: c.contact_email || (c.sender_identifier_type === 'email' ? c.sender_identifier_value : null),
                contactPhone: c.contact_phone || (c.sender_identifier_type === 'phone' ? c.sender_identifier_value : null),
                // Timestamps
                created: c.created_at,
                lastMessage: c.last_message_at
            })),
            total: result.rows.length
        };
    } catch (error) {
        console.error('Error finding conversations by identifier:', error);
        return { error: 'Failed to find conversations', details: error.message };
    }
}

/**
 * Get recent messages from a conversation
 */
async function getRecentMessages(tenantId, conversationId, limit = 20) {
    try {
        const result = await pool.query(
            `SELECT id, direction, role, content_text, channel, created_at
             FROM messages
             WHERE conversation_id = $1 AND tenant_id = $2
             ORDER BY created_at DESC
             LIMIT $3`,
            [conversationId, tenantId, limit]
        );

        // Return in chronological order
        const messages = result.rows.reverse().map(m => ({
            id: m.id,
            direction: m.direction,
            role: m.role,
            content: m.content_text,
            channel: m.channel,
            time: m.created_at
        }));

        return { messages, count: messages.length };
    } catch (error) {
        console.error('Error getting messages:', error);
        return { error: 'Failed to get messages' };
    }
}

/**
 * Search knowledge base
 */
async function searchKnowledgeBase(tenantId, query) {
    try {
        const result = await getKnowledgeContext(tenantId, query, { limit: 5 });
        
        if (!result) {
            return { 
                found: false, 
                message: 'No relevant information found in the knowledge base' 
            };
        }

        return {
            found: true,
            context: result.context,
            sourceCount: result.sources.length
        };
    } catch (error) {
        console.error('Error searching knowledge base:', error);
        return { error: 'Failed to search knowledge base' };
    }
}

/**
 * Escalate to human agent
 */
async function escalateToHuman(tenantId, args) {
    // This returns metadata for the agent to process
    // The actual escalation happens in the conversation handler
    return {
        action: 'escalate',
        reason: args.reason,
        priority: args.priority || 'normal',
        summary: args.summary || '',
        timestamp: new Date().toISOString()
    };
}

/**
 * Create a support ticket
 */
async function createTicket(tenantId, args, conversationId = null, contactId = null) {
    try {
        const result = await pool.query(
            `INSERT INTO tickets (
                tenant_id, subject, description, priority, 
                status, source_conversation_id, contact_id
            ) VALUES ($1, $2, $3, $4, 'open', $5, $6)
            RETURNING id, subject, priority, status, created_at`,
            [
                tenantId,
                args.title,
                args.description,
                args.priority || 'normal',
                conversationId,
                contactId
            ]
        );

        const ticket = result.rows[0];
        console.log(`[FunctionTools] Created ticket: ${ticket.id}`);
        
        return {
            success: true,
            ticket: {
                id: ticket.id,
                subject: ticket.subject,
                priority: ticket.priority,
                status: ticket.status,
                createdAt: ticket.created_at
            },
            message: `Ticket #${ticket.id.substring(0, 8)} created successfully`
        };
    } catch (error) {
        console.error('Error creating ticket:', error);
        return { 
            success: false,
            error: 'Failed to create ticket',
            message: 'I encountered an error while creating the ticket. Please try again or contact support.'
        };
    }
}

module.exports = {
    FUNCTION_TOOLS,
    executeTool,
    getContactInfo,
    getConversationHistoryByContact,
    findConversationsByIdentifier,
    getRecentMessages,
    searchKnowledgeBase
};

