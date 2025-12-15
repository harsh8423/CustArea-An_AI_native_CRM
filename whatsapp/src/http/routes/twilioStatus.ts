import { Request, Response } from 'express';
import { MessagesRepo } from '../../db/repositories/MessagesRepo';

export const twilioStatusHandler = async (req: Request, res: Response) => {
    try {
        const { MessageSid, MessageStatus } = req.body;

        const message = await MessagesRepo.findByTwilioSid(MessageSid);
        if (!message) {
            // ignore unknown or older messages not in our DB
            return res.status(200).send('OK');
        }

        const statusMap: Record<string, string> = {
            queued: 'PENDING_SEND',
            sent: 'SENT',
            delivered: 'DELIVERED',
            read: 'READ',
            failed: 'FAILED',
            undelivered: 'FAILED'
        };

        const newStatus = statusMap[MessageStatus] || message.status;

        if (newStatus !== message.status) {
            await MessagesRepo.updateStatus(message.id, newStatus);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling status webhook:', error);
        res.status(500).send('Internal Server Error');
    }
};
