import { db } from '../client';
import { TwilioWhatsappAccount } from '../../types';

export const TwilioWhatsappAccountsRepo = {
    async findByPhoneNumber(phoneNumber: string): Promise<TwilioWhatsappAccount | null> {
        const res = await db.query(
            'SELECT * FROM whatsapp_twilio_whatsapp_accounts WHERE phone_number = $1',
            [phoneNumber]
        );
        return res.rows[0] || null;
    },

    async findByTenantId(tenantId: string): Promise<TwilioWhatsappAccount | null> {
        const res = await db.query(
            'SELECT * FROM whatsapp_twilio_whatsapp_accounts WHERE tenant_id = $1',
            [tenantId]
        );
        return res.rows[0] || null;
    },

    async create(data: Omit<TwilioWhatsappAccount, 'id'>): Promise<TwilioWhatsappAccount> {
        const { tenant_id, twilio_account_sid, twilio_auth_token, phone_number } = data;
        const res = await db.query(
            `INSERT INTO whatsapp_twilio_whatsapp_accounts 
       (tenant_id, twilio_account_sid, twilio_auth_token, phone_number)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [tenant_id, twilio_account_sid, twilio_auth_token, phone_number]
        );
        return res.rows[0];
    }
};
