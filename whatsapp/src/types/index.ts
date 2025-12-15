export interface Tenant {
    id: string;
    name: string;
    ai_enabled: boolean;
    ai_mode: 'AUTO_REPLY' | 'OFF' | 'DRAFT';
}

export interface TwilioWhatsappAccount {
    id: string;
    tenant_id: string;
    twilio_account_sid: string;
    twilio_auth_token: string;
    phone_number: string;
}

export interface Contact {
    id: string;
    tenant_id: string;
    wa_number: string;
    name?: string;
    metadata?: any;
}

export interface Conversation {
    id: string;
    tenant_id: string;
    contact_id: string;
    status: 'OPEN' | 'CLOSED';
    channel: string;
    last_message_at: Date;
}

export interface Message {
    id: string;
    tenant_id: string;
    conversation_id: string;
    direction: 'IN' | 'OUT';
    source: 'USER' | 'AI' | 'HUMAN' | 'SYSTEM';
    content: string;
    raw_payload: any;
    status: 'RECEIVED' | 'PENDING_SEND' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ';
    twilio_message_sid?: string;
    created_at: Date;
}
