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
    },
    // ===== COPILOT-SPECIFIC FUNCTION TOOLS =====
    {
        type: 'function',
        function: {
            name: 'generate_reply_draft',
            description: 'Generate a contextual reply draft for the agent to send. Use this when the agent asks for help writing a response.',
            parameters: {
                type: 'object',
                properties: {
                    conversation_id: {
                        type: 'string',
                        description: 'UUID of the conversation to generate reply for'
                    },
                    instructions: {
                        type: 'string',
                        description: 'Specific instructions or points to include in the reply (e.g., "apologize for delay and offer 20% discount")'
                    },
                    tone: {
                        type: 'string',
                        enum: ['professional', 'friendly', 'formal', 'empathetic'],
                        description: 'Tone of the reply (default: professional)'
                    }
                },
                required: ['conversation_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'summarize_conversation',
            description: 'Summarize the conversation thread. Use when agent asks for a summary or overview.',
            parameters: {
                type: 'object',
                properties: {
                    conversation_id: {
                        type: 'string',
                        description: 'UUID of the conversation to summarize'
                    },
                    summary_type: {
                        type: 'string',
                        enum: ['brief', 'detailed', 'action_items'],
                        description: 'Type of summary: brief (2-3 sentences), detailed (with key points), or action_items (checklist of next steps)'
                    },
                    include_sentiment: {
                        type: 'boolean',
                        description: 'Whether to include sentiment analysis (default: false)'
                    }
                },
                required: ['conversation_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_cross_channel_conversations',
            description: 'Search for all conversations with a contact across different communication channels (email, WhatsApp, chat, phone)',
            parameters: {
                type: 'object',
                properties: {
                    contact_id: {
                        type: 'string',
                        description: 'UUID of the contact (optional if email or phone provided)'
                    },
                    email: {
                        type: 'string',
                        description: 'Email address to search for'
                    },
                    phone: {
                        type: 'string',
                        description: 'Phone number to search for'
                    },
                    channels: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['email', 'whatsapp', 'widget', 'phone']
                        },
                        description: 'Specific channels to search (leave empty for all channels)'
                    },
                    limit: {
                        type: 'integer',
                        description: 'Maximum number of conversations to return (default: 20)',
                        default: 20
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_company_guidelines',
            description: 'Retrieve company guidelines, policies, SOPs, or standard response templates from knowledge base',
            parameters: {
                type: 'object',
                properties: {
                    topic: {
                        type: 'string',
                        description: 'Topic to search for (e.g., "refund policy", "response time SLA", "greeting template")'
                    },
                    category: {
                        type: 'string',
                        enum: ['policy', 'sla', 'template', 'procedure', 'faq'],
                        description: 'Specific category of guideline (optional)'
                    }
                },
                required: ['topic']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_conversation_metadata',
            description: 'Get detailed metadata and analytics about a conversation including tags, sentiment, response times, and engagement metrics',
            parameters: {
                type: 'object',
                properties: {
                    conversation_id: {
                        type: 'string',
                        description: 'UUID of the conversation'
                    },
                    include_analytics: {
                        type: 'boolean',
                        description: 'Include detailed analytics like response times and engagement metrics (default: true)'
                    }
                },
                required: ['conversation_id']
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

        // Copilot-specific tools
        case 'generate_reply_draft':
            return await generateReplyDraft(tenantId, args.conversation_id, args.instructions, args.tone);

        case 'summarize_conversation':
            return await summarizeConversationTool(tenantId, args.conversation_id, args.summary_type, args.include_sentiment);

        case 'search_cross_channel_conversations':
            return await searchCrossChannelConversations(tenantId, args.contact_id, args.email, args.phone, args.channels, args.limit);

        case 'get_company_guidelines':
            return await getCompanyGuidelines(tenantId, args.topic, args.category);

        case 'get_conversation_metadata':
            return await getConversationMetadata(tenantId, args.conversation_id, args.include_analytics);

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

// ===== COPILOT-SPECIFIC TOOL IMPLEMENTATIONS =====
const copilotService = require('./copilotService');

/**
 * Generate reply draft (Copilot tool)
 */
async function generateReplyDraft(tenantId, conversationId, instructions = '', tone = 'professional') {
    try {
        const result = await copilotService.generateReplyDraft(tenantId, conversationId, {
            instructions,
            tone
        });
        
        return {
            success: true,
            draft: result.draft,
            channel: result.channel,
            tone: result.tone
        };
    } catch (error) {
        console.error('Error generating reply draft:', error);
        return {
            success: false,
            error: 'Failed to generate reply draft'
        };
    }
}

/**
 * Summarize conversation (Copilot tool)
 */
async function summarizeConversationTool(tenantId, conversationId, summaryType = 'brief', includeSentiment = false) {
    try {
        const result = await copilotService.summarizeConversation(tenantId, conversationId, summaryType);
        
        return {
            success: true,
            summary: result.summary,
            summaryType: result.summaryType,
            messageCount: result.messageCount
        };
    } catch (error) {
        console.error('Error summarizing conversation:', error);
        return {
            success: false,
            error: 'Failed to summarize conversation'
        };
    }
}

/**
 * Search cross-channel conversations (Copilot tool)
 */
async function searchCrossChannelConversations(tenantId, contactId, email, phone, channels = [], limit = 20) {
    try {
        let query = `
            SELECT DISTINCT c.id, c.channel, c.subject, c.status, c.created_at, c.updated_at,
                   c.channel_contact_id,
                   (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
                   con.full_name as contact_name, con.email as contact_email
            FROM conversations c
            LEFT JOIN contacts con ON c.contact_id = con.id
            WHERE c.tenant_id = $1
        `;
        
        const params = [tenantId];
        let paramIndex = 2;
        
        // Build WHERE clause based on provided parameters
        const conditions = [];
        
        if (contactId) {
            conditions.push(`c.contact_id = $${paramIndex}`);
            params.push(contactId);
            paramIndex++;
        }
        
        if (email) {
            conditions.push(`(con.email ILIKE $${paramIndex} OR c.channel_contact_id ILIKE $${paramIndex})`);
            params.push(`%${email}%`);
            paramIndex++;
        }
        
        if (phone) {
            conditions.push(`(con.phone ILIKE $${paramIndex} OR c.channel_contact_id ILIKE $${paramIndex})`);
            params.push(`%${phone}%`);
            paramIndex++;
        }
        
        if (channels && channels.length > 0) {
            conditions.push(`c.channel = ANY($${paramIndex})`);
            params.push(channels);
            paramIndex++;
        }
        
        if (conditions.length > 0) {
            query += ` AND (${conditions.join(' OR ')})`;
        }
        
        query += ` ORDER BY c.updated_at DESC LIMIT $${paramIndex}`;
        params.push(limit);
        
        const result = await pool.query(query, params);
        
        // Group by channel
        const groupedByChannel = {};
        result.rows.forEach(conv => {
            if (!groupedByChannel[conv.channel]) {
                groupedByChannel[conv.channel] = [];
            }
            groupedByChannel[conv.channel].push(conv);
        });
        
        return {
            success: true,
            conversations: result.rows,
            groupedByChannel,
            totalCount: result.rows.length
        };
    } catch (error) {
        console.error('Error searching cross-channel conversations:', error);
        return {
            success: false,
            error: 'Failed to search conversations'
        };
    }
}

/**
 * Get company guidelines (Copilot tool)
 */
async function getCompanyGuidelines(tenantId, topic, category = null) {
    try {
        // Search knowledge base for guidelines
        const searchQuery = category ? `${category}: ${topic}` : topic;
        const guidelines = await getKnowledgeContext(tenantId, searchQuery, { limit: 5 });
        
        if (!guidelines || guidelines.length === 0) {
            return {
                success: true,
                found: false,
                message: `No guidelines found for "${topic}". Consider adding this to the knowledge base.`
            };
        }
        
        return {
            success: true,
            found: true,
            guidelines: guidelines.map(g => ({
                title: g.title,
                content: g.content,
                relevance: g.score || 0
            })),
            count: guidelines.length
        };
    } catch (error) {
        console.error('Error getting company guidelines:', error);
        return {
            success: false,
            error: 'Failed to retrieve guidelines'
        };
    }
}

/**
 * Get conversation metadata (Copilot tool)
 */
async function getConversationMetadata(tenantId, conversationId, includeAnalytics = true) {
    try {
        const convResult = await pool.query(
            `SELECT c.*,
                    con.full_name as contact_name,
                    con.email as contact_email,
                    con.phone as contact_phone,
                    u.full_name as assigned_user_name
             FROM conversations c
             LEFT JOIN contacts con ON c.contact_id = con.id
             LEFT JOIN users u ON c.assigned_to = u.id
             WHERE c.id = $1 AND c.tenant_id = $2`,
            [conversationId, tenantId]
        );
        
        if (convResult.rows.length === 0) {
            return { success: false, error: 'Conversation not found' };
        }
        
        const conversation = convResult.rows[0];
        const metadata = {
            id: conversation.id,
            channel: conversation.channel,
            status: conversation.status,
            priority: conversation.priority,
            subject: conversation.subject,
            createdAt: conversation.created_at,
            updatedAt: conversation.updated_at,
            contact: {
                name: conversation.contact_name,
                email: conversation.contact_email,
                phone: conversation.contact_phone
            },
            assignedTo: conversation.assigned_user_name,
            aiEnabled: conversation.ai_enabled,
            aiMode: conversation.ai_mode
        };
        
        if (includeAnalytics) {
            // Get message statistics
            const stats = await pool.query(
                `SELECT 
                    COUNT(*) as total_messages,
                    COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_count,
                    COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_count,
                    MIN(created_at) as first_message_at,
                    MAX(created_at) as last_message_at
                 FROM messages
                 WHERE conversation_id = $1 AND tenant_id = $2`,
                [conversationId, tenantId]
            );
            
            metadata.analytics = stats.rows[0];
        }
        
        return {
            success: true,
            metadata
        };
    } catch (error) {
        console.error('Error getting conversation metadata:', error);
        return {
            success: false,
            error: 'Failed to retrieve conversation metadata'
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

