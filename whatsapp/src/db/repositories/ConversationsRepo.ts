import { db } from '../client';
import { Conversation } from '../../types';

export const ConversationsRepo = {
    async findById(id: string): Promise<Conversation | null> {
        const res = await db.query(
            'SELECT * FROM whatsapp_conversations WHERE id = $1',
            [id]
        );
        return res.rows[0] || null;
    },

    async findOpenByContact({ tenantId, contactId }: { tenantId: string; contactId: string }): Promise<Conversation | null> {
        const res = await db.query(
            `SELECT * FROM whatsapp_conversations 
       WHERE tenant_id = $1 AND contact_id = $2 AND status = 'OPEN'
       ORDER BY last_message_at DESC LIMIT 1`,
            [tenantId, contactId]
        );
        return res.rows[0] || null;
    },

    async create({ tenantId, contactId, channel = 'whatsapp' }: { tenantId: string; contactId: string; channel?: string }): Promise<Conversation> {
        const res = await db.query(
            `INSERT INTO whatsapp_conversations (tenant_id, contact_id, channel)
       VALUES ($1, $2, $3) RETURNING *`,
            [tenantId, contactId, channel]
        );
        return res.rows[0];
    }
};
