import { redis, STREAMS, CONSUMER_GROUPS } from '../redis/client';
import { TenantsRepo } from '../db/repositories/TenantsRepo';
import { ConversationsRepo } from '../db/repositories/ConversationsRepo';
import { MessagesRepo } from '../db/repositories/MessagesRepo';
import { Agent } from '../ai/agent';

export async function runIncomingProcessor(consumerName: string) {
    console.log(`Starting Incoming Processor: ${consumerName}`);

    while (true) {
        try {
            const streams = await (redis.xreadgroup as any)(
                'GROUP', CONSUMER_GROUPS.INCOMING_PROCESSORS, consumerName,
                'BLOCK', 5000,
                'COUNT', 10,
                'STREAMS', STREAMS.INCOMING,
                '>'
            );

            if (!streams) continue;

            for (const [stream, messages] of streams) {
                for (const [id, fields] of messages) {
                    const payload = fieldsToObject(fields);
                    try {
                        await handleIncomingJob(id, payload);
                        await redis.xack(STREAMS.INCOMING, CONSUMER_GROUPS.INCOMING_PROCESSORS, id);
                    } catch (err) {
                        console.error(`Error processing incoming message ${id}:`, err);
                        // TODO: DLQ logic
                    }
                }
            }
        } catch (error) {
            console.error('Error in incoming processor loop:', error);
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

async function handleIncomingJob(entryId: string, payload: any) {
    const { message_id, tenant_id, conversation_id } = payload;

    const tenant = await TenantsRepo.findById(tenant_id);
    if (!tenant || tenant.ai_mode === 'OFF') return;

    const conversation = await ConversationsRepo.findById(conversation_id);
    if (!conversation) return;

    // Load history
    const messages = await MessagesRepo.getRecentForConversation(tenant_id, conversation_id, 20);

    const aiReply = await Agent.generateReply({
        tenant,
        conversation,
        history: messages
    });

    if (!aiReply) return;

    const outgoingMessage = await MessagesRepo.create({
        tenant_id,
        conversation_id,
        direction: 'OUT',
        source: 'AI',
        content: aiReply,
        raw_payload: null,
        status: 'PENDING_SEND'
    });

    await redis.xadd(
        STREAMS.OUTGOING,
        '*',
        'message_id', outgoingMessage.id,
        'tenant_id', tenant_id
    );
}
