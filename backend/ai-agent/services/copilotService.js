const { ChatOpenAI } = require("@langchain/openai");
const pool = require("../../config/db");
const vectorSearchService = require("./vectorSearchService");

/**
 * Copilot AI Service
 * 
 * Provides AI-powered assistance to CRM agents with:
 * - Context-aware reply generation
 * - Conversation summarization
 * - Cross-channel conversation search
 * - Company knowledge retrieval
 * - Natural language query handling
 */

const COPILOT_SYSTEM_PROMPT = `You are CustArea Copilot, an advanced AI assistant helping customer service agents in a CRM platform.

Your role is to:
- Help agents write professional, contextual replies to customers across multiple channels (Email, WhatsApp, Chat Widget, Phone)
- Summarize conversations efficiently and identify action items
- Retrieve company knowledge, guidelines, policies, and best practices
- Search for related conversations across all communication channels
- Answer any questions about the current conversation, contact, or CRM data

Key capabilities:
1. **Channel-Specific Communication**: Adapt your tone and format based on the channel:
   - Email: Professional, structured, include subject lines and proper signatures
   - WhatsApp: Friendly, concise, conversational, use emojis appropriately
   - Chat Widget: Quick, helpful, casual-friendly tone
   - Phone: Create detailed notes and follow-up suggestions

2. **Company Knowledge**: You have access to the company's knowledge base. Use it to:
   - Provide accurate information about products, services, policies
   - Suggest standard responses for common scenarios
   - Reference company guidelines and SOPs

3. **Context Awareness**: You understand:
   - Full conversation history across all messages
   - Contact information and history with the company
   - Related conversations from other channels
   - Current sentiment and urgency

4. **Assistance Format**:
   - When generating replies, provide the complete draft ready to send
   - When summarizing, be concise but comprehensive
   - When searching, present results clearly with context
   - Always explain your reasoning when relevant

Remember: You're assisting the human agent, not the customer directly. Be professional, efficient, and actionable.`;

/**
 * Build comprehensive context for Copilot
 * Efficiently gathers all relevant information in parallel
 */
async function buildCopilotContext(tenantId, conversationId, contactId) {
    try {
        // Execute all queries in parallel for efficiency
        const [
            conversationResult,
            messagesResult,
            contactResult,
            crossChannelResult
        ] = await Promise.all([
            // Get conversation details
            pool.query(
                `SELECT c.*, 
                        u.email as assigned_user_email,
                        u.name as assigned_user_name
                 FROM conversations c
                 LEFT JOIN users u ON c.assigned_to = u.id
                 WHERE c.id = $1 AND c.tenant_id = $2`,
                [conversationId, tenantId]
            ),
            
            // Get all messages in conversation
            pool.query(
                `SELECT m.*,
                        em.subject, em.from_address, em.to_addresses, em.cc_addresses
                 FROM messages m
                 LEFT JOIN message_email_metadata em ON m.id = em.message_id
                 WHERE m.conversation_id = $1 AND m.tenant_id = $2
                 ORDER BY m.created_at ASC`,
                [conversationId, tenantId]
            ),
            
            // Get contact details if available
            contactId ? pool.query(
                `SELECT c.*,
                        COUNT(DISTINCT conv.id) as total_conversations
                 FROM contacts c
                 LEFT JOIN conversations conv ON conv.contact_id = c.id
                 WHERE c.id = $1 AND c.tenant_id = $2
                 GROUP BY c.id`,
                [contactId, tenantId]
            ) : Promise.resolve({ rows: [] }),
            
            // Get cross-channel conversations for this contact
            contactId ? pool.query(
                `SELECT id, channel, subject, status, created_at, updated_at,
                        (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id) as message_count
                 FROM conversations
                 WHERE contact_id = $1 AND tenant_id = $2 AND id != $3
                 ORDER BY updated_at DESC
                 LIMIT 10`,
                [contactId, tenantId, conversationId]
            ) : Promise.resolve({ rows: [] })
        ]);

        const conversation = conversationResult.rows[0];
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const messages = messagesResult.rows;
        const contact = contactResult.rows[0] || null;
        const relatedConversations = crossChannelResult.rows || [];

        return {
            conversation,
            messages,
            contact,
            relatedConversations,
            channelType: conversation.channel,
            messageCount: messages.length
        };
    } catch (error) {
        console.error('Error building Copilot context:', error);
        throw error;
    }
}

/**
 * Format context into a clear prompt for the LLM
 */
function formatContextForPrompt(context) {
    const { conversation, messages, contact, relatedConversations, channelType } = context;
    
    let prompt = `## Current Conversation Context\n\n`;
    prompt += `**Channel**: ${channelType.toUpperCase()}\n`;
    prompt += `**Status**: ${conversation.status}\n`;
    prompt += `**Subject**: ${conversation.subject || 'N/A'}\n`;
    prompt += `**Created**: ${conversation.created_at}\n`;
    
    if (conversation.assigned_user_name) {
        prompt += `**Assigned To**: ${conversation.assigned_user_name}\n`;
    }
    
    prompt += `\n## Contact Information\n\n`;
    if (contact) {
        prompt += `**Name**: ${contact.name || 'N/A'}\n`;
        prompt += `**Email**: ${contact.email || 'N/A'}\n`;
        prompt += `**Phone**: ${contact.phone || 'N/A'}\n`;
        prompt += `**Total Conversations**: ${contact.total_conversations || 0}\n`;
        if (contact.company_name) {
            prompt += `**Company**: ${contact.company_name}\n`;
        }
    } else {
        prompt += `Contact: ${conversation.channel_contact_id}\n`;
    }
    
    prompt += `\n## Message Thread (${messages.length} messages)\n\n`;
    messages.forEach((msg, idx) => {
        const sender = msg.direction === 'inbound' ? 
            (contact?.name || conversation.channel_contact_id || 'Customer') :
            (msg.sender_name || 'Agent');
        
        prompt += `### Message ${idx + 1} - ${sender} (${msg.direction})\n`;
        prompt += `**Time**: ${msg.created_at}\n`;
        
        if (msg.subject) {
            prompt += `**Subject**: ${msg.subject}\n`;
        }
        
        prompt += `**Content**:\n${msg.content_text || msg.content_html || 'No content'}\n\n`;
    });
    
    if (relatedConversations.length > 0) {
        prompt += `\n## Related Conversations (${relatedConversations.length})\n\n`;
        relatedConversations.forEach(conv => {
            prompt += `- **${conv.channel.toUpperCase()}** (${conv.status}): ${conv.subject || 'No subject'} - ${conv.message_count} messages (${conv.updated_at})\n`;
        });
    }
    
    return prompt;
}

/**
 * Handle natural language Copilot query
 */
async function handleCopilotQuery(userId, tenantId, conversationId, query, options = {}) {
    try {
        // Build context
        const contactId = options.contactId || null;
        const context = await buildCopilotContext(tenantId, conversationId, contactId);
        
        // Check if query is asking for knowledge base information
        let knowledgeContext = '';
        if (shouldSearchKnowledgeBase(query)) {
            const kbResults = await vectorSearchService.searchKnowledgeBase(
                tenantId,
                query,
                { limit: 3 }
            );
            
            if (kbResults.length > 0) {
                knowledgeContext = '\n## Company Knowledge Base\n\n';
                kbResults.forEach((article, idx) => {
                    knowledgeContext += `### Article ${idx + 1}: ${article.title}\n`;
                    knowledgeContext += `${article.content}\n\n`;
                });
            }
        }
        
        // Format context for LLM
        const contextPrompt = formatContextForPrompt(context);
        
        // Initialize LLM
        const llm = new ChatOpenAI({
            modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.7,
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        
        // Create messages array
        const messages = [
            { role: "system", content: COPILOT_SYSTEM_PROMPT },
            { role: "user", content: `${contextPrompt}\n${knowledgeContext}\n## User Query\n\n${query}` }
        ];
        
        // Get response from LLM
        const response = await llm.invoke(messages);
        
        // Save to session history
        await saveCopilotInteraction(userId, tenantId, conversationId, query, response.content);
        
        return {
            response: response.content,
            context: {
                channelType: context.channelType,
                messageCount: context.messageCount,
                hasKnowledge: knowledgeContext.length > 0
            }
        };
    } catch (error) {
        console.error('Error handling Copilot query:', error);
        throw error;
    }
}

/**
 * Generate a reply draft for the current conversation
 */
async function generateReplyDraft(tenantId, conversationId, options = {}) {
    try {
        const { instructions = '', tone = 'professional', contactId = null } = options;
        
        // Build context
        const context = await buildCopilotContext(tenantId, conversationId, contactId);
        const contextPrompt = formatContextForPrompt(context);
        
        // Create channel-specific instructions
        let channelInstructions = '';
        switch (context.channelType) {
            case 'email':
                channelInstructions = `Generate a professional email reply. Include:
- A clear subject line (if this is a new thread or topic change)
- Proper greeting
- Well-structured body paragraphs
- Professional sign-off
- Format appropriately for email`;
                break;
            case 'whatsapp':
                channelInstructions = `Generate a WhatsApp message reply. Make it:
- Conversational and friendly
- Concise (2-3 short paragraphs max)
- Use emojis sparingly and appropriately
- Natural and personal tone`;
                break;
            case 'widget':
                channelInstructions = `Generate a chat widget reply. Make it:
- Quick and helpful
- Friendly but professional
- 1-2 paragraphs maximum
- Action-oriented`;
                break;
            case 'phone':
                channelInstructions = `Generate talking points or follow-up notes for a phone call:
- Key points to mention
- Information to gather
- Action items to confirm
- Follow-up steps`;
                break;
            default:
                channelInstructions = 'Generate an appropriate reply for this conversation.';
        }
        
        // Build the query
        let query = `${channelInstructions}\n\nTone: ${tone}\n`;
        if (instructions) {
            query += `\nSpecific Instructions: ${instructions}\n`;
        }
        query += '\nPlease provide ONLY the reply text, ready to send. Do not include any explanations or meta-commentary.';
        
        // Initialize LLM
        const llm = new ChatOpenAI({
            modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.8,
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        
        // Get response
        const messages = [
            { role: "system", content: COPILOT_SYSTEM_PROMPT },
            { role: "user", content: `${contextPrompt}\n\n${query}` }
        ];
        
        const response = await llm.invoke(messages);
        
        return {
            draft: response.content,
            channel: context.channelType,
            tone
        };
    } catch (error) {
        console.error('Error generating reply draft:', error);
        throw error;
    }
}

/**
 * Summarize a conversation
 */
async function summarizeConversation(tenantId, conversationId, summaryType = 'brief', contactId = null) {
    try {
        // Build context
        const context = await buildCopilotContext(tenantId, conversationId, contactId);
        const contextPrompt = formatContextForPrompt(context);
        
        // Create summary instructions based on type
        let summaryInstructions = '';
        switch (summaryType) {
            case 'brief':
                summaryInstructions = 'Provide a brief 2-3 sentence summary of this conversation. Focus on the main issue and current status.';
                break;
            case 'detailed':
                summaryInstructions = `Provide a detailed summary including:
- Main issue or topic
- Key points from customer
- Actions taken by agent
- Current status
- Sentiment analysis
Format as bullet points.`;
                break;
            case 'action_items':
                summaryInstructions = `Extract and list all action items from this conversation:
- What needs to be done
- Who is responsible
- Any deadlines mentioned
- Follow-up required
Format as a checklist.`;
                break;
            default:
                summaryInstructions = 'Summarize this conversation.';
        }
        
        // Initialize LLM
        const llm = new ChatOpenAI({
            modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.3,
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        
        const messages = [
            { role: "system", content: COPILOT_SYSTEM_PROMPT },
            { role: "user", content: `${contextPrompt}\n\n${summaryInstructions}` }
        ];
        
        const response = await llm.invoke(messages);
        
        return {
            summary: response.content,
            summaryType,
            messageCount: context.messageCount
        };
    } catch (error) {
        console.error('Error summarizing conversation:', error);
        throw error;
    }
}

/**
 * Save Copilot interaction to session history
 */
async function saveCopilotInteraction(userId, tenantId, conversationId, query, response) {
    try {
        // Check if there's an active session for this conversation
        const sessionCheck = await pool.query(
            `SELECT id, messages FROM copilot_sessions 
             WHERE user_id = $1 AND conversation_id = $2 AND session_ended_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [userId, conversationId]
        );
        
        let sessionId;
        if (sessionCheck.rows.length > 0) {
            // Update existing session
            const session = sessionCheck.rows[0];
            const messages = session.messages || [];
            messages.push(
                { role: 'user', content: query, timestamp: new Date().toISOString() },
                { role: 'assistant', content: response, timestamp: new Date().toISOString() }
            );
            
            await pool.query(
                `UPDATE copilot_sessions 
                 SET messages = $1, queries_count = queries_count + 1, updated_at = now()
                 WHERE id = $2`,
                [JSON.stringify(messages), session.id]
            );
            
            sessionId = session.id;
        } else {
            // Create new session
            const newSession = await pool.query(
                `INSERT INTO copilot_sessions (tenant_id, user_id, conversation_id, messages, queries_count)
                 VALUES ($1, $2, $3, $4, 1)
                 RETURNING id`,
                [
                    tenantId,
                    userId,
                    conversationId,
                    JSON.stringify([
                        { role: 'user', content: query, timestamp: new Date().toISOString() },
                        { role: 'assistant', content: response, timestamp: new Date().toISOString() }
                    ])
                ]
            );
            
            sessionId = newSession.rows[0].id;
        }
        
        return sessionId;
    } catch (error) {
        console.error('Error saving Copilot interaction:', error);
        // Don't throw - this is non-critical
    }
}

/**
 * Determine if query requires knowledge base search
 */
function shouldSearchKnowledgeBase(query) {
    const knowledgeKeywords = [
        'policy', 'policies', 'guideline', 'guidelines', 'how to', 'what is',
        'sla', 'procedure', 'process', 'refund', 'return', 'warranty',
        'pricing', 'documentation', 'manual', 'guide', 'standard'
    ];
    
    const lowerQuery = query.toLowerCase();
    return knowledgeKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Get Copilot session history for a conversation
 */
async function getCopilotSession(userId, conversationId) {
    try {
        const result = await pool.query(
            `SELECT * FROM copilot_sessions
             WHERE user_id = $1 AND conversation_id = $2 AND session_ended_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [userId, conversationId]
        );
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting Copilot session:', error);
        throw error;
    }
}

/**
 * End a Copilot session
 */
async function endCopilotSession(sessionId) {
    try {
        await pool.query(
            `UPDATE copilot_sessions 
             SET session_ended_at = now(), updated_at = now()
             WHERE id = $1`,
            [sessionId]
        );
    } catch (error) {
        console.error('Error ending Copilot session:', error);
        // Don't throw - this is non-critical
    }
}

module.exports = {
    handleCopilotQuery,
    generateReplyDraft,
    summarizeConversation,
    buildCopilotContext,
    getCopilotSession,
    endCopilotSession
};
