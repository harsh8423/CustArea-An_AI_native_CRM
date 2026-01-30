/**
 * Copilot AI Controller
 * API endpoints for agent-facing AI assistance
 */

const copilotService = require('../services/copilotService');
const { ChatOpenAI } = require("@langchain/openai");
const { FUNCTION_TOOLS, executeTool } = require('../services/functionTools');

/**
 * POST /api/copilot/chat
 * Handle natural language query from Copilot UI
 */
exports.chat = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const { conversationId, query, contactId } = req.body;

        if (!conversationId || !query) {
            return res.status(400).json({
                error: 'conversationId and query are required'
            });
        }

        // Use the Copilot service to handle the query
        const result = await copilotService.handleCopilotQuery(
            userId,
            tenantId,
            conversationId,
            query,
            { contactId }
        );

        res.json({
            success: true,
            response: result.response,
            context: result.context
        });
    } catch (error) {
        console.error('[CopilotController] Error in chat:', error);
        res.status(500).json({
            error: 'Failed to process Copilot query',
            message: error.message
        });
    }
};

/**
 * POST /api/copilot/chat-stream
 * Handle natural language query with streaming response (for future implementation)
 */
exports.chatStream = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const { conversationId, query, contactId, useTools = false } = req.body;

        if (!conversationId || !query) {
            return res.status(400).json({
                error: 'conversationId and query are required'
            });
        }

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Build context
        const context = await copilotService.buildCopilotContext(tenantId, conversationId, contactId);
        
        // Initialize LLM with streaming
        const llm = new ChatOpenAI({
            modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.7,
            openAIApiKey: process.env.OPENAI_API_KEY,
            streaming: true
        });

        // Get Copilot-specific function tools if requested
        const tools = useTools ? FUNCTION_TOOLS : undefined;

        // Create system prompt (simplified for streaming)
        const systemPrompt = `You are CustArea Copilot, an AI assistant helping customer service agents.
Channel: ${context.channelType.toUpperCase()}
Contact: ${context.contact?.full_name || context.conversation.channel_contact_id}
Messages: ${context.messageCount}

Provide helpful, actionable responses to assist the agent.`;

        // Stream response
        const stream = await llm.stream([
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
        ], tools ? { tools } : {});

        for await (const chunk of stream) {
            const content = chunk.content;
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('[CopilotController] Error in chat stream:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};

/**
 * POST /api/copilot/generate-reply
 * Generate a reply draft for the current conversation
 */
exports.generateReply = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const { conversationId, instructions, tone, contactId } = req.body;

        if (!conversationId) {
            return res.status(400).json({
                error: 'conversationId is required'
            });
        }

        const result = await copilotService.generateReplyDraft(
            tenantId,
            conversationId,
            {
                instructions: instructions || '',
                tone: tone || 'professional',
                contactId
            }
        );

        // Track this action in the session
        await copilotService.buildCopilotContext(tenantId, conversationId, contactId).then(async (context) => {
            const session = await copilotService.getCopilotSession(userId, conversationId);
            if (session) {
        const pool = require('../../config/db');
                await pool.query(
                    'UPDATE copilot_sessions SET replies_generated_count = replies_generated_count + 1 WHERE id = $1',
                    [session.id]
                );
            }
        });

        res.json({
            success: true,
            draft: result.draft,
            channel: result.channel,
            tone: result.tone,
            metadata: {
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[CopilotController] Error generating reply:', error);
        res.status(500).json({
            error: 'Failed to generate reply draft',
            message: error.message
        });
    }
};

/**
 * POST /api/copilot/summarize
 * Summarize a conversation
 */
exports.summarize = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const { conversationId, summaryType, contactId } = req.body;

        if (!conversationId) {
            return res.status(400).json({
                error: 'conversationId is required'
            });
        }

        const validSummaryTypes = ['brief', 'detailed', 'action_items'];
        const type = validSummaryTypes.includes(summaryType) ? summaryType : 'brief';

        const result = await copilotService.summarizeConversation(
            tenantId,
            conversationId,
            type,
            contactId
        );

        // Track this action in the session
        await copilotService.buildCopilotContext(tenantId, conversationId, contactId).then(async (context) => {
            const session = await copilotService.getCopilotSession(userId, conversationId);
            if (session) {
        const pool = require('../../config/db');
                await pool.query(
                    'UPDATE copilot_sessions SET summaries_requested_count = summaries_requested_count + 1 WHERE id = $1',
                    [session.id]
                );
            }
        });

        res.json({
            success: true,
            summary: result.summary,
            summaryType: result.summaryType,
            messageCount: result.messageCount,
            metadata: {
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[CopilotController] Error summarizing:', error);
        res.status(500).json({
            error: 'Failed to summarize conversation',
            message: error.message
        });
    }
};

/**
 * GET /api/copilot/cross-channel-search
 * Search for conversations across all channels for a contact
 */
exports.crossChannelSearch = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { contactId, email, phone, channels, limit } = req.query;

        if (!contactId && !email && !phone) {
            return res.status(400).json({
                error: 'At least one of contactId, email, or phone must be provided'
            });
        }

        const pool = require('../../config/db');
        
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
        
        if (channels) {
            const channelArray = Array.isArray(channels) ? channels : [channels];
            conditions.push(`c.channel = ANY($${paramIndex})`);
            params.push(channelArray);
            paramIndex++;
        }
        
        if (conditions.length > 0) {
            query += ` AND (${conditions.join(' OR ')})`;
        }
        
        query += ` ORDER BY c.updated_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit) || 20);
        
        const result = await pool.query(query, params);
        
        // Group by channel
        const groupedByChannel = {};
        result.rows.forEach(conv => {
            if (!groupedByChannel[conv.channel]) {
                groupedByChannel[conv.channel] = [];
            }
            groupedByChannel[conv.channel].push(conv);
        });
        
        res.json({
            success: true,
            conversations: result.rows,
            groupedByChannel,
            totalCount: result.rows.length,
            channels: Object.keys(groupedByChannel)
        });

    } catch (error) {
        console.error('[CopilotController] Error in cross-channel search:', error);
        res.status(500).json({
            error: 'Failed to search conversations',
            message: error.message
        });
    }
};

/**
 * GET /api/copilot/session/:conversationId
 * Get Copilot session history for a conversation
 */
exports.getSession = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const { conversationId } = req.params;

        if (!conversationId) {
            return res.status(400).json({
                error: 'conversationId is required'
            });
        }

        const session = await copilotService.getCopilotSession(userId, conversationId);

        if (!session) {
            return res.json({
                success: true,
                session: null,
                messages: []
            });
        }

        res.json({
            success: true,
            session: {
                id: session.id,
                conversationId: session.conversation_id,
                sessionStartedAt: session.session_started_at,
                queriesCount: session.queries_count,
                repliesGeneratedCount: session.replies_generated_count,
                summariesRequestedCount: session.summaries_requested_count
            },
            messages: session.messages || []
        });

    } catch (error) {
        console.error('[CopilotController] Error getting session:', error);
        res.status(500).json({
            error: 'Failed to get Copilot session',
            message: error.message
        });
    }
};

/**
 * POST /api/copilot/session/:conversationId/end
 * End the current Copilot session
 */
exports.endSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;

        if (!conversationId) {
            return res.status(400).json({
                error: 'conversationId is required'
            });
        }

        const session = await copilotService.getCopilotSession(userId, conversationId);
        
        if (session) {
            await copilotService.endCopilotSession(session.id);
        }

        res.json({
            success: true,
            message: 'Session ended successfully'
        });

    } catch (error) {
        console.error('[CopilotController] Error ending session:', error);
        res.status(500).json({
            error: 'Failed to end session',
            message: error.message
        });
    }
};

/**
 * GET /api/copilot/quick-actions
 * Get contextual quick action suggestions for Copilot
 */
exports.getQuickActions = async (req, res) => {
    try {
        const { conversationId } = req.query;
        const tenantId = req.user.tenantId;

        if (!conversationId) {
            return res.status(400).json({
                error: 'conversationId is required'
            });
        }

        // Build context to determine relevant actions
        const context = await copilotService.buildCopilotContext(tenantId, conversationId, null);

        const quickActions = [
            {
                id: 'summarize_brief',
                label: 'Quick Summary',
                icon: 'document-text',
                description: 'Get a brief 2-3 sentence summary'
            },
            {
                id: 'generate_professional_reply',
                label: 'Generate Professional Reply',
                icon: 'sparkles',
                description: 'Create a professional response to this conversation'
            },
            {
                id: 'find_related',
                label: 'Find Related Conversations',
                icon: 'search',
                description: 'Search for other conversations with this contact'
            }
        ];

        // Add channel-specific actions
        if (context.channelType === 'email') {
            quickActions.push({
                id: 'generate_email_reply',
                label: 'Draft Email Reply',
                icon: 'mail',
                description: 'Generate a complete email response with subject'
            });
        }

        // Add action items extraction if conversation has multiple messages
        if (context.messageCount >= 3) {
            quickActions.push({
                id: 'extract_action_items',
                label: 'Extract Action Items',
                icon: 'clipboard-list',
                description: 'Get a checklist of next steps'
            });
        }

        res.json({
            success: true,
            quickActions,
            context: {
                channel: context.channelType,
                messageCount: context.messageCount
            }
        });

    } catch (error) {
        console.error('[CopilotController] Error getting quick actions:', error);
        res.status(500).json({
            error: 'Failed to get quick actions',
            message: error.message
        });
    }
};

module.exports = exports;
