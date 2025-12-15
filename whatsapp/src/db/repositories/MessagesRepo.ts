import { db } from '../client';
import { Message } from '../../types';

export const MessagesRepo = {
    async findById(id: string): Promise<Message | null> {
        const res = await db.query(
            'SELECT * FROM whatsapp_messages WHERE id = $1',
            [id]
        );
        return res.rows[0] || null;
    },

    async findByTwilioSid(sid: string): Promise<Message | null> {
        const res = await db.query(
            'SELECT * FROM whatsapp_messages WHERE twilio_message_sid = $1',
            [sid]
        );
        return res.rows[0] || null;
    },

    async create(data: Omit<Message, 'id' | 'created_at' | 'twilio_message_sid'>): Promise<Message> {
        const { tenant_id, conversation_id, direction, source, content, raw_payload, status } = data;
        const res = await db.query(
            `INSERT INTO whatsapp_messages 
       (tenant_id, conversation_id, direction, source, content, raw_payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [tenant_id, conversation_id, direction, source, content, raw_payload, status]
        );
        return res.rows[0];
    },

    async updateStatus(id: string, status: string): Promise<Message | null> {
        const res = await db.query(
            'UPDATE whatsapp_messages SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return res.rows[0] || null;
    },

    async updateTwilioStatus(id: string, { status, twilioMessageSid }: { status: string; twilioMessageSid: string }): Promise<Message | null> {
        const res = await db.query(
            'UPDATE whatsapp_messages SET status = $1, twilio_message_sid = $2 WHERE id = $3 RETURNING *',
            [status, twilioMessageSid, id]
        );
        return res.rows[0] || null;
    },

    async getRecentForConversation(tenantId: string, conversationId: string, limit: number = 20): Promise<Message[]> {
        const res = await db.query(
            `SELECT * FROM whatsapp_messages 
       WHERE tenant_id = $1 AND conversation_id = $2
       ORDER BY created_at ASC
       LIMIT $3`, // Note: Usually we want DESC for "recent" but for chat history context we want chronological order. 
            // If we want the *last* 20, we should order by DESC limit 20 then reverse, or just take them.
            // Let's assume we want the last 20 messages in chronological order.
            [tenantId, conversationId, limit]
        );
        // If we simply query ASC with limit, we get the *first* 20 messages.
        // We want the *last* 20.
        // So: SELECT * FROM (SELECT * FROM msgs ORDER BY created_at DESC LIMIT 20) sub ORDER BY created_at ASC

        const realRes = await db.query(
            `SELECT * FROM (
         SELECT * FROM whatsapp_messages 
         WHERE tenant_id = $1 AND conversation_id = $2
         ORDER BY created_at DESC
         LIMIT $3
       ) sub ORDER BY created_at ASC`,
            [tenantId, conversationId, limit]
        );

        return realRes.rows;
    }
};
