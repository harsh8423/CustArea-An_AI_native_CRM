import { Request, Response } from 'express';
import { TwilioWhatsappAccountsRepo } from '../../db/repositories/TwilioWhatsappAccountsRepo';
import { ContactsRepo } from '../../db/repositories/ContactsRepo';
import { ConversationsRepo } from '../../db/repositories/ConversationsRepo';
import { MessagesRepo } from '../../db/repositories/MessagesRepo';
import { redis, STREAMS } from '../../redis/client';

export const twilioIncomingHandler = async (req: Request, res: Response) => {
    try {
        const { From, To, Body, MessageSid } = req.body;

        // 1. Resolve tenant
        const waAccount = await TwilioWhatsappAccountsRepo.findByPhoneNumber(To);
        if (!waAccount) {
            console.warn(`Unknown sender number: ${To}`);
            return res.status(404).send('Unknown sender');
        }
        const tenantId = waAccount.tenant_id;

        // 2. Contact
        const contact = await ContactsRepo.findOrCreateByWaNumber({
            tenantId,
            waNumber: From
        });

        // 3. Conversation
        let conversation = await ConversationsRepo.findOpenByContact({
            tenantId,
            contactId: contact.id
        });
        if (!conversation) {
            conversation = await ConversationsRepo.create({
                tenantId,
                contactId: contact.id,
                channel: 'whatsapp'
            });
        }

        // 4. Persist inbound message
        const message = await MessagesRepo.create({
            tenant_id: tenantId,
            conversation_id: conversation.id,
            direction: 'IN',
            source: 'USER',
            content: Body,
            raw_payload: req.body,
            status: 'RECEIVED'
        });

        // 5. Push job to Redis Stream
        await redis.xadd(
            STREAMS.INCOMING,
            '*',
            'message_id', message.id,
            'tenant_id', tenantId,
            'conversation_id', conversation.id
        );

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling incoming webhook:', error);
        res.status(500).send('Internal Server Error');
    }
};
