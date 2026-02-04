/**
 * Campaign AI Agent Service
 * Handles AI-powered responses for campaign replies
 */

const { pool } = require('../../config/db');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Process campaign reply with AI agent
 */
async function processCampaignReply(messageId, tenantId, conversationId, campaignId) {
    const client = await pool.connect();

    try {
        // Get campaign details
        const campaignResult = await client.query(
            `SELECT * FROM outreach_campaigns WHERE id = $1 AND tenant_id = $2`,
            [campaignId, tenantId]
        );

        if (campaignResult.rows.length === 0) {
            throw new Error('Campaign not found');
        }

        const campaign = campaignResult.rows[0];

        // Get conversation and contact details
        const conversationResult = await client.query(
            `SELECT c.*, con.name, con.email, con.company_name as company, con.phone
             FROM conversations c
             LEFT JOIN contacts con ON c.contact_id = con.id
             WHERE c.id = $1`,
            [conversationId]
        );

        const conversation = conversationResult.rows[0];

        // Get conversation history (last 10 messages)
        const messagesResult = await client.query(
            `SELECT * FROM messages 
             WHERE conversation_id = $1 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [conversationId]
        );

        const messages = messagesResult.rows.reverse(); // Oldest first

        // Build conversation context
        const conversationHistory = messages.map(msg => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.content_text || msg.content_html || ''
        }));

        // Generate AI response
        const aiResponse = await generateCampaignResponse(
            campaign,
            conversation,
            conversationHistory
        );

        // Save AI response as outbound message
        const responseResult = await client.query(
            `INSERT INTO messages (
                tenant_id, conversation_id, direction, role, channel,
                content_text, content_html, status
            ) VALUES ($1, $2, 'outbound', 'agent', $3, $4, $5, 'pending')
            RETURNING *`,
            [
                tenantId,
                conversationId,
                conversation.channel,
                aiResponse.text,
                aiResponse.html || aiResponse.text
            ]
        );

        const aiMessage = responseResult.rows[0];

        // Queue message for sending
        const { queueOutgoingMessage } = require('../../config/redis');
        await queueOutgoingMessage(aiMessage.id, tenantId, conversation.channel);

        console.log(`Campaign AI response generated and queued for conversation ${conversationId}`);

        return {
            success: true,
            message: aiMessage
        };

    } catch (error) {
        console.error('Campaign AI processing error:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Generate AI response for campaign conversation
 */
async function generateCampaignResponse(campaign, conversation, conversationHistory) {
    const systemPrompt = `You are a helpful sales assistant representing ${campaign.company_name}.

Campaign Context:
- Objective: ${campaign.campaign_objective}
- Value Proposition: ${campaign.value_proposition}
- Pain Points Addressed: ${campaign.pain_points}
- Selling Points: ${campaign.selling_points}
${campaign.proof_points ? `- Proof Points: ${campaign.proof_points}` : ''}

Your Goals:
1. Respond helpfully and professionally to the prospect's inquiry
2. Address their questions with relevant information
3. Guide them towards the campaign objective
4. Be conversational and authentic, not overly salesy
5. If they're interested, suggest next steps (demo, call, meeting)
6. If they're not interested, be gracious and ask if you can follow up later

Contact Information:
- Name: ${conversation.name || 'there'}
- Email: ${conversation.email}
${conversation.company ? `- Company: ${conversation.company}` : ''}

Instructions:
- Keep responses concise and to-the-point (2-3 paragraphs max)
- Be helpful and answer questions directly
- Use a warm, professional tone
- Don't be pushy or aggressive
- If they ask to be removed or aren't interested, acknowledge politely
${campaign.ai_instructions ? `- Additional Instructions: ${campaign.ai_instructions}` : ''}`;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversationHistory
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const aiText = response.choices[0].message.content;

        // Convert to HTML (simple paragraph formatting)
        const aiHtml = `<p>${aiText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;

        return {
            text: aiText,
            html: aiHtml
        };

    } catch (error) {
        console.error('AI response generation error:', error);
        throw new Error('Failed to generate AI response: ' + error.message);
    }
}

/**
 * Handle unsubscribe/opt-out requests
 */
async function handleOptOut(conversationId, campaignId, contactId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Update campaign contact status
        await client.query(
            `UPDATE campaign_contacts 
             SET status = 'unsubscribed', 
                 next_send_at = NULL, 
                 updated_at = now()
             WHERE campaign_id = $1 AND contact_id = $2`,
            [campaignId, contactId]
        );

        // Mark conversation
        await client.query(
            `UPDATE conversations 
             SET status = 'closed', 
                 updated_at = now()
             WHERE id = $1`,
            [conversationId]
        );

        await client.query('COMMIT');

        console.log(`Contact ${contactId} opted out of campaign ${campaignId}`);

        return { success: true };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    processCampaignReply,
    generateCampaignResponse,
    handleOptOut
};
