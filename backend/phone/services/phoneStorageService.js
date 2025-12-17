/**
 * Phone Storage Service
 * Handles persisting call transcripts to Redis cache and PostgreSQL database
 */

const { pool } = require('../../config/db');
const { redis } = require('../../config/redis');
const { v4: uuidv4 } = require('uuid');

// Redis key patterns
const TRANSCRIPT_KEY = (sessionId) => `phone:call:${sessionId}:transcripts`;
const METADATA_KEY = (sessionId) => `phone:call:${sessionId}:metadata`;
const TTL_SECONDS = 3600; // 1 hour TTL for Redis cache

/**
 * Append a transcript entry to Redis cache
 */
async function appendTranscript(sessionId, role, text) {
    if (!sessionId || !text) return;

    const entry = {
        role,      // 'user' | 'assistant'
        text,
        timestamp: new Date().toISOString()
    };

    try {
        await redis.rpush(TRANSCRIPT_KEY(sessionId), JSON.stringify(entry));
        await redis.expire(TRANSCRIPT_KEY(sessionId), TTL_SECONDS);
    } catch (error) {
        console.error('[PhoneStorage] Error appending transcript:', error);
    }
}

/**
 * Get all transcripts from Redis cache
 */
async function getTranscripts(sessionId) {
    try {
        const entries = await redis.lrange(TRANSCRIPT_KEY(sessionId), 0, -1);
        return entries.map(e => JSON.parse(e));
    } catch (error) {
        console.error('[PhoneStorage] Error getting transcripts:', error);
        return [];
    }
}

/**
 * Store call metadata in Redis
 */
async function setCallMetadata(sessionId, metadata) {
    try {
        await redis.set(METADATA_KEY(sessionId), JSON.stringify(metadata));
        await redis.expire(METADATA_KEY(sessionId), TTL_SECONDS);
    } catch (error) {
        console.error('[PhoneStorage] Error setting metadata:', error);
    }
}

/**
 * Get call metadata from Redis
 */
async function getCallMetadata(sessionId) {
    try {
        const data = await redis.get(METADATA_KEY(sessionId));
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('[PhoneStorage] Error getting metadata:', error);
        return null;
    }
}

/**
 * Persist call and transcripts to database when call ends
 */
async function persistCallToDatabase(session) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Create or get conversation
        let conversationId = session.conversationId;
        if (!conversationId) {
            // For outbound: customer is toNumber; for inbound: customer is fromNumber
            const customerNumber = session.direction === 'outbound' 
                ? session.toNumber 
                : session.fromNumber;
            
            const convResult = await client.query(`
                INSERT INTO conversations (
                    tenant_id, contact_id, channel, channel_contact_id, 
                    status, ai_enabled, ai_mode, subject
                ) VALUES ($1, $2, 'phone', $3, 'resolved', true, 'auto', $4)
                RETURNING id
            `, [
                session.tenantId,
                session.contactId || null,
                customerNumber,
                `Phone Call - ${new Date().toLocaleDateString()}`
            ]);
            conversationId = convResult.rows[0].id;
        }

        // 2. Calculate duration
        const durationSeconds = session.startedAt 
            ? Math.floor((Date.now() - session.startedAt.getTime()) / 1000)
            : 0;

        // 3. Insert phone_calls record
        const callResult = await client.query(`
            INSERT INTO phone_calls (
                tenant_id, conversation_id, contact_id, call_sid, stream_sid,
                direction, method, status, from_number, to_number,
                started_at, ended_at, duration_seconds, message_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (call_sid) DO UPDATE SET
                status = EXCLUDED.status,
                ended_at = EXCLUDED.ended_at,
                duration_seconds = EXCLUDED.duration_seconds,
                message_count = EXCLUDED.message_count
            RETURNING id
        `, [
            session.tenantId,
            conversationId,
            session.contactId || null,
            session.callSid,
            session.streamSid || null,
            session.direction,
            session.method,
            'completed',
            session.fromNumber || null,
            session.toNumber || null,
            session.startedAt || new Date(),
            new Date(),
            durationSeconds,
            session.history?.length || 0
        ]);

        const phoneCallId = callResult.rows[0].id;

        // 4. Get transcripts from Redis
        const transcripts = await getTranscripts(session.id);

        // 5. Insert messages for each transcript turn
        for (const transcript of transcripts) {
            // Insert message
            const msgResult = await client.query(`
                INSERT INTO messages (
                    tenant_id, conversation_id, direction, role, channel,
                    content_text, provider, provider_message_id, status, sent_at
                ) VALUES ($1, $2, $3, $4, 'phone', $5, 'twilio', $6, 'delivered', $7)
                RETURNING id
            `, [
                session.tenantId,
                conversationId,
                transcript.role === 'user' ? 'inbound' : 'outbound',
                transcript.role === 'user' ? 'user' : 'ai',
                transcript.text,
                `${session.callSid}-${uuidv4().slice(0, 8)}`,
                new Date(transcript.timestamp)
            ]);

            // Insert phone metadata for message
            await client.query(`
                INSERT INTO message_phone_metadata (
                    message_id, call_sid, call_status, call_direction,
                    from_number, to_number, call_duration_seconds
                ) VALUES ($1, $2, 'completed', $3, $4, $5, $6)
            `, [
                msgResult.rows[0].id,
                session.callSid,
                session.direction,
                session.fromNumber || null,
                session.toNumber || null,
                durationSeconds
            ]);
        }

        // 6. Update conversation last_message_at
        await client.query(`
            UPDATE conversations 
            SET last_message_at = now(), updated_at = now()
            WHERE id = $1
        `, [conversationId]);

        await client.query('COMMIT');

        console.log(`[PhoneStorage] Persisted call ${session.callSid} with ${transcripts.length} messages`);

        // 7. Cleanup Redis
        await cleanupRedisCache(session.id);

        return { conversationId, phoneCallId, messageCount: transcripts.length };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PhoneStorage] Error persisting call:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Cleanup Redis cache after persisting
 */
async function cleanupRedisCache(sessionId) {
    try {
        await redis.del(TRANSCRIPT_KEY(sessionId));
        await redis.del(METADATA_KEY(sessionId));
    } catch (error) {
        console.error('[PhoneStorage] Error cleaning up Redis:', error);
    }
}

/**
 * Get call record by call SID
 */
async function getCallBySid(callSid) {
    const result = await pool.query(`
        SELECT pc.*, 
               c.name as contact_name, c.phone as contact_phone,
               conv.status as conversation_status
        FROM phone_calls pc
        LEFT JOIN contacts c ON c.id = pc.contact_id
        LEFT JOIN conversations conv ON conv.id = pc.conversation_id
        WHERE pc.call_sid = $1
    `, [callSid]);

    return result.rows[0] || null;
}

/**
 * Get calls for tenant with pagination
 */
async function getCallsForTenant(tenantId, options = {}) {
    const { limit = 50, offset = 0, status, direction } = options;

    let query = `
        SELECT pc.*, 
               c.name as contact_name, c.phone as contact_phone,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = pc.conversation_id) as message_count
        FROM phone_calls pc
        LEFT JOIN contacts c ON c.id = pc.contact_id
        WHERE pc.tenant_id = $1
    `;
    const params = [tenantId];

    if (status) {
        params.push(status);
        query += ` AND pc.status = $${params.length}`;
    }

    if (direction) {
        params.push(direction);
        query += ` AND pc.direction = $${params.length}`;
    }

    query += ` ORDER BY pc.started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
}

module.exports = {
    appendTranscript,
    getTranscripts,
    setCallMetadata,
    getCallMetadata,
    persistCallToDatabase,
    cleanupRedisCache,
    getCallBySid,
    getCallsForTenant
};
