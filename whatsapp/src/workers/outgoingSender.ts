import twilio from 'twilio';
import { redis, STREAMS, CONSUMER_GROUPS } from '../redis/client';
import { MessagesRepo } from '../db/repositories/MessagesRepo';
import { ConversationsRepo } from '../db/repositories/ConversationsRepo';
import { ContactsRepo } from '../db/repositories/ContactsRepo';
import { TwilioWhatsappAccountsRepo } from '../db/repositories/TwilioWhatsappAccountsRepo';

export async function runOutgoingSender(consumerName: string) {
    console.log(`Starting Outgoing Sender: ${consumerName}`);

    while (true) {
        try {
            const streams = await (redis.xreadgroup as any)(
                'GROUP', CONSUMER_GROUPS.OUTGOING_SENDERS, consumerName,
                'BLOCK', 5000,
                'COUNT', 10,
                'STREAMS', STREAMS.OUTGOING,
                '>'
            );

            if (!streams) continue;

            for (const [stream, messages] of streams) {
                for (const [id, fields] of messages) {
                    const payload = fieldsToObject(fields);
                    try {
                        await handleOutgoingJob(id, payload);
                        await redis.xack(STREAMS.OUTGOING, CONSUMER_GROUPS.OUTGOING_SENDERS, id);
                    } catch (err) {
                        console.error(`Error processing outgoing message ${id}:`, err);
                    }
                }
            }
        } catch (error) {
            console.error('Error in outgoing sender loop:', error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

function fieldsToObject(fields: string[]): any {
    const obj: any = {};
    for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
    }
    return obj;
}

async function handleOutgoingJob(entryId: string, payload: any) {
    const { message_id, tenant_id } = payload;

    const message = await MessagesRepo.findById(message_id);
    if (!message || message.status !== 'PENDING_SEND') return;

    const conversation = await ConversationsRepo.findById(message.conversation_id);
    if (!conversation) return;

    const contact = await ContactsRepo.findById(conversation.contact_id);
    if (!contact) return;

    const waAccount = await TwilioWhatsappAccountsRepo.findByTenantId(tenant_id);
    if (!waAccount) return;

    const client = twilio(waAccount.twilio_account_sid, waAccount.twilio_auth_token);

    try {
        const twilioResp = await client.messages.create({
            from: waAccount.phone_number,
            to: contact.wa_number,
            body: message.content
            // statusCallback: ... (configured in Twilio console or globally)
        });

        await MessagesRepo.updateTwilioStatus(message.id, {
            status: 'SENT',
            twilioMessageSid: twilioResp.sid
        });
    } catch (error) {
        console.error('Twilio send error:', error);
        await MessagesRepo.updateStatus(message.id, 'FAILED');
    }
}
