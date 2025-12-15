import { db } from '../client';
import { Contact } from '../../types';

export const ContactsRepo = {
    async findById(id: string): Promise<Contact | null> {
        const res = await db.query(
            'SELECT * FROM whatsapp_contacts WHERE id = $1',
            [id]
        );
        return res.rows[0] || null;
    },

    async findOrCreateByWaNumber({ tenantId, waNumber, name }: { tenantId: string; waNumber: string; name?: string }): Promise<Contact> {
        // Try to find first
        const findRes = await db.query(
            'SELECT * FROM whatsapp_contacts WHERE tenant_id = $1 AND wa_number = $2',
            [tenantId, waNumber]
        );

        if (findRes.rows[0]) {
            return findRes.rows[0];
        }

        // Create if not exists
        // Note: In a high concurrency env, this might need ON CONFLICT handling more robustly
        const createRes = await db.query(
            `INSERT INTO whatsapp_contacts (tenant_id, wa_number, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, wa_number) DO UPDATE SET wa_number = EXCLUDED.wa_number
       RETURNING *`,
            [tenantId, waNumber, name]
        );
        return createRes.rows[0];
    }
};
