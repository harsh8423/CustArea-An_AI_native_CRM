/**
 * Email Threading Helper
 * Utilities for managing email threading headers (Message-ID, In-Reply-To, References)
 * across different email providers (SES, Gmail, Outlook)
 */

const { pool } = require('../../config/db');

/**
 * Generate a unique Message-ID for campaign emails
 * Format: <campaign-{campaignId}-contact-{contactId}-step-{step}-{timestamp}@custarea.com>
 */
function generateCampaignMessageId(campaignId, contactId, step = 0) {
    const timestamp = Date.now();
    const stepPart = step > 0 ? `-step-${step}` : '';
    return `<campaign-${campaignId}-contact-${contactId}${stepPart}-${timestamp}@custarea.com>`;
}

/**
 * Get threading headers for a conversation
 * Returns the previous Message-ID and all Message-IDs in the thread for References header
 */
async function getConversationThreadingHeaders(conversationId) {
    try {
        const result = await pool.query(
            `SELECT mem.message_id_header, mem.in_reply_to, mem.references_header
             FROM messages m
             JOIN message_email_metadata mem ON m.id = mem.message_id
             WHERE m.conversation_id = $1
             AND m.direction = 'outbound'
             ORDER BY m.created_at DESC
             LIMIT 1`,
            [conversationId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const lastMsg = result.rows[0];
        
        // Build References header by combining existing references with the last message ID
        let allMessageIds = [];
        if (lastMsg.references_header) {
            // Parse existing references (space-separated list)
            allMessageIds = lastMsg.references_header.split(' ').filter(id => id.trim());
        }
        // Add the last message ID if not already in references
        if (lastMsg.message_id_header && !allMessageIds.includes(lastMsg.message_id_header)) {
            allMessageIds.push(lastMsg.message_id_header);
        }

        return {
            lastMessageId: lastMsg.message_id_header,
            references: allMessageIds.join(' ')
        };
    } catch (error) {
        console.error('Error getting conversation threading headers:', error);
        return null;
    }
}

/**
 * Add threading headers to email parameters based on provider type
 * Different providers handle custom headers differently
 */
function addThreadingHeaders(emailParams, headers, providerType) {
    if (!headers) return emailParams;

    // Create headers object if it doesn't exist
    if (!emailParams.headers) {
        emailParams.headers = {};
    }

    // Add Message-ID (always included)
    if (headers.messageId) {
        emailParams.headers['Message-ID'] = headers.messageId;
    }

    // Add In-Reply-To (for replies and follow-ups)
    if (headers.inReplyTo) {
        emailParams.headers['In-Reply-To'] = headers.inReplyTo;
    }

    // Add References (for maintaining thread history)
    if (headers.references) {
        emailParams.headers['References'] = headers.references;
    }

    // Add custom campaign tracking headers
    if (headers.campaignId) {
        emailParams.headers['X-Campaign-ID'] = headers.campaignId;
    }
    if (headers.contactId) {
        emailParams.headers['X-Contact-ID'] = headers.contactId;
    }

    return emailParams;
}

/**
 * Store email metadata with threading information
 */
async function storeEmailMetadata(messageId, metadata) {
    try {
        await pool.query(
            `INSERT INTO message_email_metadata (
                message_id, from_address, to_addresses, 
                message_id_header, in_reply_to, references_header,
                subject
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (message_id) DO UPDATE SET
                message_id_header = EXCLUDED.message_id_header,
                in_reply_to = EXCLUDED.in_reply_to,
                references_header = EXCLUDED.references_header`,
            [
                messageId,
                metadata.fromAddress,
                JSON.stringify(metadata.toAddresses || []),
                metadata.messageIdHeader || null,
                metadata.inReplyTo || null,
                metadata.references || null,
                metadata.subject || null
            ]
        );
    } catch (error) {
        console.error('Error storing email metadata:', error);
        throw error;
    }
}

module.exports = {
    generateCampaignMessageId,
    getConversationThreadingHeaders,
    addThreadingHeaders,
    storeEmailMetadata
};
