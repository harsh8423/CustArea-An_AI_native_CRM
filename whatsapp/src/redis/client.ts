import Redis from 'ioredis';
import { config } from '../config/env';

export const redis = new Redis(config.redisUrl);

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

export const STREAMS = {
    INCOMING: 'stream:incoming_messages',
    OUTGOING: 'stream:outgoing_messages',
};

export const CONSUMER_GROUPS = {
    INCOMING_PROCESSORS: 'incoming_processors',
    OUTGOING_SENDERS: 'outgoing_senders',
};

export async function initRedisStreams() {
    try {
        await redis.xgroup('CREATE', STREAMS.INCOMING, CONSUMER_GROUPS.INCOMING_PROCESSORS, '0', 'MKSTREAM');
        console.log(`Created consumer group ${CONSUMER_GROUPS.INCOMING_PROCESSORS}`);
    } catch (err: any) {
        if (err.message.includes('BUSYGROUP')) {
            // Group already exists, ignore
        } else {
            console.error('Error creating incoming stream group:', err);
        }
    }

    try {
        await redis.xgroup('CREATE', STREAMS.OUTGOING, CONSUMER_GROUPS.OUTGOING_SENDERS, '0', 'MKSTREAM');
        console.log(`Created consumer group ${CONSUMER_GROUPS.OUTGOING_SENDERS}`);
    } catch (err: any) {
        if (err.message.includes('BUSYGROUP')) {
            // Group already exists, ignore
        } else {
            console.error('Error creating outgoing stream group:', err);
        }
    }
}
