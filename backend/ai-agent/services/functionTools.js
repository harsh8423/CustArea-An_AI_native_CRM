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
            name: 'get_conversation_history',
            description: 'Get previous conversations with a contact across all channels (email, whatsapp, widget, phone)',
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
                        description: 'Ticket title'
                    },
                    description: {
                        type: 'string',
                        description: 'Detailed description of the issue'
                    },
                    priority: {
                        type: 'string',
                        enum: ['low', 'normal', 'high', 'urgent']
                    },
                    category: {
                        type: 'string',
                        description: 'Category of the ticket (billing, technical, account, etc.)'
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
async function executeTool(tenantId, toolName, args) {
    console.log(`Executing tool: ${toolName}`, args);

    switch (toolName) {
        case 'get_contact_info':
            return await getContactInfo(tenantId, args.contact_id);

        case 'get_conversation_history':
            return await getConversationHistory(tenantId, args.contact_id, args.limit || 10);

        case 'get_recent_messages':
            return await getRecentMessages(tenantId, args.conversation_id, args.limit || 20);

        case 'search_knowledge_base':
            return await searchKnowledgeBase(tenantId, args.query);

        case 'escalate_to_human':
            return await escalateToHuman(tenantId, args);

        case 'create_ticket':
            return await createTicket(tenantId, args);

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
                    created_at, metadata, score
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
            score: contact.score,
            metadata: contact.metadata || {}
        };
    } catch (error) {
        console.error('Error getting contact info:', error);
        return { error: 'Failed to get contact information' };
    }
}

/**
 * Get conversation history for a contact
 */
async function getConversationHistory(tenantId, contactId, limit = 10) {
    try {
        const result = await pool.query(
            `SELECT c.id, c.channel, c.status, c.subject, c.created_at, c.last_message_at,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
             FROM conversations c
             WHERE c.contact_id = $1 AND c.tenant_id = $2
             ORDER BY c.last_message_at DESC
             LIMIT $3`,
            [contactId, tenantId, limit]
        );

        return {
            conversations: result.rows.map(c => ({
                id: c.id,
                channel: c.channel,
                status: c.status,
                subject: c.subject,
                messageCount: parseInt(c.message_count),
                created: c.created_at,
                lastMessage: c.last_message_at
            })),
            total: result.rows.length
        };
    } catch (error) {
        console.error('Error getting conversation history:', error);
        return { error: 'Failed to get conversation history' };
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
async function createTicket(tenantId, args) {
    // For now, return ticket metadata
    // In production, this would create a ticket in your ticketing system
    return {
        action: 'create_ticket',
        ticket: {
            title: args.title,
            description: args.description,
            priority: args.priority || 'normal',
            category: args.category || 'general',
            createdAt: new Date().toISOString()
        }
    };
}

module.exports = {
    FUNCTION_TOOLS,
    executeTool,
    getContactInfo,
    getConversationHistory,
    getRecentMessages,
    searchKnowledgeBase
};
