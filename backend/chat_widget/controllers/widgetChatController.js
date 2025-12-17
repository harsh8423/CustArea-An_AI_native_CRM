/**
 * Widget Chat Controller
 * Handles widget messaging with AI agent integration
 */

const { pool } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const {
    getAgentForTenant,
    buildSystemPrompt,
    buildConversationContext
} = require('../../ai-agent/services/agentService');
const { getKnowledgeContext } = require('../../ai-agent/services/vectorSearchService');
const { shouldAgentRespond } = require('../../controllers/agentDeploymentController');
const { linkSessionToContact } = require('../services/widgetSessionService');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/widget/chat
 * Send a message and get AI response
 */
async function chat(req, res) {
    try {
        const { message, conversationId, metadata = {}, email, phone, name } = req.body || {};
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'message required' });
        }
        
        const tenantId = req.tenantId;
        const config = req.widgetConfig;
        const sessionId = req.widgetToken.sessionId;
        const externalId = req.widgetToken.externalId;
        
        // Link to contact if email/phone provided
        let contactId = null;
        if (email || phone) {
            try {
                const { contact, isNew } = await linkSessionToContact(
                    sessionId, 
                    tenantId, 
                    { email, phone, name }
                );
                contactId = contact.id;
                if (isNew) {
                    console.log(`[Widget Chat] Created contact ${contactId} from widget`);
                }
            } catch (err) {
                console.error('[Widget Chat] Contact linking failed:', err.message);
            }
        }
        
        // Find or create conversation
        const conversation = await findOrCreateConversation(
            tenantId, 
            contactId, 
            sessionId, 
            conversationId
        );
        
        // Save user message
        const userMsgId = uuidv4();
        await pool.query(
            `INSERT INTO messages (id, tenant_id, conversation_id, direction, role, channel, content_text, provider, status, metadata)
             VALUES ($1, $2, $3, 'inbound', 'user', 'widget', $4, 'widget', 'received', $5)`,
            [userMsgId, tenantId, conversation.id, message, JSON.stringify(metadata)]
        );
        
        // Update conversation
        await pool.query(
            `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [conversation.id]
        );
        
        // Check if AI should respond
        const aiEnabled = await shouldAgentRespond(tenantId, 'widget');
        
        if (!aiEnabled) {
            console.log(`[Widget Chat] AI not enabled for widget, returning placeholder`);
            return res.json({
                conversationId: conversation.id,
                reply: "Thanks for your message! Our team will get back to you shortly.",
                aiEnabled: false
            });
        }
        
        // Generate AI response
        const reply = await generateAIResponse(tenantId, conversation.id, message);
        
        // Save AI response
        const aiMsgId = uuidv4();
        await pool.query(
            `INSERT INTO messages (id, tenant_id, conversation_id, direction, role, channel, content_text, provider, status)
             VALUES ($1, $2, $3, 'outbound', 'assistant', 'widget', $4, 'openai', 'sent')`,
            [aiMsgId, tenantId, conversation.id, reply]
        );
        
        console.log(`[Widget Chat] Conversation ${conversation.id}: "${message.substring(0, 30)}..." -> "${reply.substring(0, 30)}..."`);
        
        return res.json({
            conversationId: conversation.id,
            reply,
            aiEnabled: true
        });
        
    } catch (err) {
        console.error('[Widget Chat] Error:', err);
        return res.status(500).json({ error: 'Failed to process message' });
    }
}

/**
 * GET /api/widget/history
 * Get conversation history
 */
async function getHistory(req, res) {
    try {
        const { conversationId } = req.query;
        const tenantId = req.tenantId;
        
        if (!conversationId) {
            return res.status(400).json({ error: 'conversationId required' });
        }
        
        const result = await pool.query(
            `SELECT id, role, content_text, created_at 
             FROM messages 
             WHERE conversation_id = $1 AND tenant_id = $2
             ORDER BY created_at ASC
             LIMIT 100`,
            [conversationId, tenantId]
        );
        
        return res.json({
            conversationId,
            messages: result.rows.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content_text,
                createdAt: m.created_at
            }))
        });
        
    } catch (err) {
        console.error('[Widget History] Error:', err);
        return res.status(500).json({ error: 'Failed to fetch history' });
    }
}

/**
 * Find or create a conversation for the widget session
 */
async function findOrCreateConversation(tenantId, contactId, sessionId, existingConversationId) {
    // If conversation ID provided, verify it exists
    if (existingConversationId) {
        const existing = await pool.query(
            `SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2`,
            [existingConversationId, tenantId]
        );
        if (existing.rows[0]) {
            return existing.rows[0];
        }
    }
    
    // Try to find open conversation for this session
    const sessionConvo = await pool.query(
        `SELECT * FROM conversations 
         WHERE tenant_id = $1 AND channel = 'widget' AND channel_contact_id = $2 AND status = 'open'
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, sessionId]
    );
    
    if (sessionConvo.rows[0]) {
        return sessionConvo.rows[0];
    }
    
    // Create new conversation
    const id = uuidv4();
    const result = await pool.query(
        `INSERT INTO conversations (id, tenant_id, contact_id, channel, channel_contact_id, status, ai_enabled)
         VALUES ($1, $2, $3, 'widget', $4, 'open', true)
         RETURNING *`,
        [id, tenantId, contactId, sessionId]
    );
    
    return result.rows[0];
}

/**
 * Generate AI response using the AI agent
 */
async function generateAIResponse(tenantId, conversationId, userMessage) {
    // Get agent for tenant
    const agent = await getAgentForTenant(tenantId);
    if (!agent) {
        return "I'm sorry, I'm not configured yet. Please try again later.";
    }
    
    // Build system prompt
    const systemPrompt = await buildSystemPrompt(tenantId, agent._id);
    
    // Add widget-specific instructions
    const widgetPrompt = `
## CURRENT CHANNEL: WIDGET (Website Chat)
You are responding via a website chat widget. Keep these in mind:
- Be conversational and friendly
- Keep responses concise (2-3 sentences ideal)
- Use emojis sparingly if appropriate
- Be helpful and proactive
- If you need more information, ask clear questions
`;
    
    // Get conversation history
    const historyResult = await pool.query(
        `SELECT role, content_text FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC 
         LIMIT 20`,
        [conversationId]
    );
    
    // Build messages for GPT
    const messages = [
        { role: 'system', content: systemPrompt + '\n' + widgetPrompt }
    ];
    
    // Add history
    for (const msg of historyResult.rows) {
        messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content_text
        });
    }
    
    // Add current message
    messages.push({ role: 'user', content: userMessage });
    
    // Try to get knowledge context
    try {
        const knowledge = await getKnowledgeContext(tenantId, agent._id, userMessage);
        if (knowledge) {
            messages.splice(1, 0, {
                role: 'system',
                content: `Relevant knowledge:\n${knowledge}`
            });
        }
    } catch (err) {
        // Knowledge context not available, continue without it
    }
    
    // Generate response
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 512
    });
    
    return response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
}

module.exports = { chat, getHistory };
