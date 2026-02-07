/**
 * Phone Storage Service - IN-MEMORY TRANSCRIPTS
 * Handles persisting call transcripts from session memory to PostgreSQL database
 * 
 * Schema Architecture (from migrations 002 & 003):
 * - phone_calls: Main call record with metadata (duration, numbers, status)
 * - conversations: Conversation container
 * - messages: Individual transcript turns
 * - message_phone_metadata: Minimal linking (call_sid, transcription_text)
 * 
 * TRANSCRIPTS NOW STORED IN SESSION.TRANSCRIPTS (in-memory during call)
 * NO Redis - transcripts saved directly to DB at call end
 */

const { pool } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Create conversation record at call start (before tools can execute)
 * This ensures tools like create_ticket have a valid conversationId to link to
 */
async function createConversationForCall(session) {
    try {
        // Determine customer phone number based on direction
        const customerNumber = session.direction === 'outbound' 
            ? session.toNumber 
            : session.fromNumber;
        
        const result = await pool.query(`
            INSERT INTO conversations (
                tenant_id, contact_id, channel, channel_contact_id, 
                status, ai_enabled, ai_mode, subject
            ) VALUES ($1, $2, 'phone', $3, 'open', true, 'auto', $4)
            RETURNING id
        `, [
            session.tenantId,
            session.contactId || null,
            customerNumber,
            `Phone Call - ${new Date().toLocaleDateString()}`
        ]);

        const conversationId = result.rows[0].id;
        console.log('[PhoneStorage] Created conversation at call start:', conversationId);
        return conversationId;

    } catch (error) {
        console.error('[PhoneStorage] Error creating conversation at call start:', error);
        // Don't throw - let call continue even if conversation creation fails
        // Will be retried in persistCallToDatabase
        return null;
    }
}

/**
 * Persist call and transcripts to database when call ends
 * UPDATED to match new schema from migrations 002 & 003
 */
async function persistCallToDatabase(session) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Validate required session data
        if (!session.tenantId || !session.callSid) {
            throw new Error('Missing required session data (tenantId or callSid)');
        }

        // Get transcripts from session (in-memory)
        const transcripts = session.transcripts || [];
        
        console.log(`[PhoneStorage] Persisting ${transcripts.length} transcript entries for call:`, session.callSid);
        
        if (transcripts.length === 0) {
            console.log('[PhoneStorage] No transcripts to persist for call:', session.callSid);
            await client.query('ROLLBACK');
            return { conversationId: null, phoneCallId: null, messageCount: 0 };
        }

        // Calculate call duration
        const durationSeconds = session.duration || Math.floor((Date.now() - session.startTime) / 1000);

        // 1. CREATE OR GET CONVERSATION
        let conversationId = session.conversationId;
        
        // If conversation wasn't created at call start, create it now (fallback)
        if (!conversationId) {
            console.log('[PhoneStorage] Conversation not found in session, creating now (fallback)');
            // Determine customer phone number based on direction
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
            console.log('[PhoneStorage] Created conversation (fallback):', conversationId);
        } else {
            console.log('[PhoneStorage] Using existing conversation:', conversationId);
            // Update status to resolved now that call is complete
            await client.query(`
                UPDATE conversations 
                SET status = 'resolved', updated_at = now()
                WHERE id = $1
            `, [conversationId]);
        }

        // 2. CREATE PHONE_CALLS RECORD (main call metadata)
        const aiConfig = session.aiConfig || {};
        
        const phoneCallResult = await client.query(`
            INSERT INTO phone_calls (
                tenant_id, conversation_id, call_sid, direction,
                from_number, to_number, status, duration_seconds,
                started_at, ended_at, method, custom_instruction,
                user_id, ai_voice_id, ai_model, ai_provider, 
                stt_provider, tts_provider, latency_mode
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING id
        `, [
            session.tenantId,
            conversationId,
            session.callSid,
            session.direction,
            session.fromNumber || null,
            session.toNumber || null,
            'completed',
            durationSeconds,
            session.startTime ? new Date(session.startTime) : new Date(),
            new Date(),
            session.method || 'realtime',  // Default to 'realtime' if not set
            session.customInstruction || null,  // Save custom instruction
            session.userId || null,
            aiConfig.ai_voice_id || null,
            aiConfig.ai_model || null,
            aiConfig.ai_provider || null,
            aiConfig.stt_provider || null,
            aiConfig.tts_provider || null,
            aiConfig.latency_mode || null
        ]);

        const phoneCallId = phoneCallResult.rows[0].id;
        console.log('[PhoneStorage] Created phone_calls record:', phoneCallId);

        // 2.5 GENERATE CALL SUMMARY using AI
        let callSummary = null;
        if (transcripts.length > 0) {
            try {
                const { generateCallSummary } = require('./summaryService');
                callSummary = await generateCallSummary(transcripts, session.tenantId);
                console.log('[PhoneStorage] Generated call summary:', callSummary);
                
                // Update phone_calls with summary
                await client.query(`
                    UPDATE phone_calls 
                    SET call_summary = $1
                    WHERE id = $2
                `, [callSummary, phoneCallId]);
            } catch (summaryError) {
                console.error('[PhoneStorage] Error generating summary:', summaryError);
                // Continue without summary - not a critical failure
            }
        }

        // 3. CREATE MESSAGES FOR EACH TRANSCRIPT TURN
        // Sort by sequence to ensure chronological order
        const sortedTranscripts = transcripts.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        
        for (const transcript of sortedTranscripts) {
            // Determine direction and content based on speaker type
            let direction, contentText, role;
            
            if (transcript.speaker === 'action') {
                // Action messages (function calls)
                direction = 'outbound';
                contentText = `Action: ${transcript.text}`;
                role = 'ai';  // Actions are performed by AI
            } else {
                // Regular messages (user/assistant)
                direction = transcript.speaker === 'user' ? 'inbound' : 'outbound';
                contentText = transcript.text;
                role = transcript.speaker === 'user' ? 'user' : 'ai';
            }
            
            // Insert message
            const msgResult = await client.query(`
                INSERT INTO messages (
                    tenant_id, conversation_id, direction, role, channel,
                    content_text, provider, provider_message_id, status, created_at
                ) VALUES ($1, $2, $3, $4, 'phone', $5, 'twilio', $6, 'delivered', $7)
                RETURNING id
            `, [
                session.tenantId,
                conversationId,
                direction,
                role,
                contentText,
                `${session.callSid}-${uuidv4().slice(0, 8)}`,
                transcript.created_at || new Date()
            ]);

            // 4. LINK MESSAGE_PHONE_METADATA (minimal - just call_sid)
            try {
                await client.query(`
                    INSERT INTO message_phone_metadata (
                        message_id, call_sid, transcription_text
                    ) VALUES ($1, $2, $3)
                `, [
                    msgResult.rows[0].id,
                    session.callSid,
                    transcript.text  // Store transcript text for reference
                ]);
            } catch (metaErr) {
                // Log but don't fail the transaction if metadata insert fails
                console.warn('[PhoneStorage] Could not insert phone metadata:', metaErr.message);
            }
        }

        // 5. UPDATE CONVERSATION TIMESTAMPS
        await client.query(`
            UPDATE conversations 
            SET last_message_at = now(), updated_at = now()
            WHERE id = $1
        `, [conversationId]);

        await client.query('COMMIT');

        console.log(`[PhoneStorage] ✅ Persisted call ${session.callSid} with ${transcripts.length} messages`);

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
 * Get call record by call SID
 */
async function getCallByCallSid(callSid) {
    try {
        const result = await pool.query(`
            SELECT 
                pc.*,
                c.channel_contact_id,
                c.subject as conversation_subject
            FROM phone_calls pc
            LEFT JOIN conversations c ON pc.conversation_id = c.id
            WHERE pc.call_sid = $1
        `, [callSid]);

        return result.rows[0] || null;
    } catch (error) {
        console.error('[PhoneStorage] Error getting call:', error);
        return null;
    }
}

/**
 * Get all calls for a conversation
 */
async function getCallsForConversation(conversationId) {
    try {
        const result = await pool.query(`
            SELECT * FROM phone_calls
            WHERE conversation_id = $1
            ORDER BY started_at DESC
        `, [conversationId]);

        return result.rows;
    } catch (error) {
        console.error('[PhoneStorage] Error getting calls for conversation:', error);
        return [];
    }
}

module.exports = {
    persistCallToDatabase,
    createConversationForCall,
    getCallByCallSid,
    getCallsForConversation
};
