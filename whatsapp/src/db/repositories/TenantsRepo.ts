import { db } from '../client';
import { Tenant } from '../../types';

export const TenantsRepo = {
    async findById(id: string): Promise<Tenant | null> {
        const res = await db.query(
            'SELECT * FROM whatsapp_tenants WHERE id = $1',
            [id]
        );
        return res.rows[0] || null;
    },

    async create(name: string): Promise<Tenant> {
        const res = await db.query(
            'INSERT INTO whatsapp_tenants (name) VALUES ($1) RETURNING *',
            [name]
        );
        return res.rows[0];
    }
};
