/**
 * Call Session Manager
 * Manages concurrent call sessions with isolated state per call
 */

const { v4: uuidv4 } = require('uuid');

/**
 * CallSession - Represents state for a single phone call
 */
class CallSession {
    constructor(id, tenantId, contactId, method, direction) {
        this.id = id;                     // Unique session ID
        this.tenantId = tenantId;         // Tenant for AI Agent config
        this.contactId = contactId;       // Contact for context loading
        this.conversationId = null;       // Linked conversation (created on first message)
        this.callSid = null;              // Twilio call SID
        this.streamSid = null;            // Twilio stream SID
        this.method = method;             // 'legacy' | 'realtime' | 'convrelay'
        this.direction = direction;       // 'inbound' | 'outbound'
        this.history = [];                // Message history for LLM context
        this.startTime = Date.now();
        this.endTime = null;
        this.status = 'initializing';     // initializing | active | ended
        
        // Method-specific state
        this.openaiWs = null;             // For realtime: OpenAI WebSocket
        this.recognizer = null;           // For legacy: Azure Speech recognizer
        this.pushStream = null;           // For legacy: Audio push stream
        this.isBargeIn = false;           // For legacy: Barge-in detection
        this.twilioWs = null;             // Reference to Twilio WebSocket
    }

    /**
     * Add message to history
     */
    addMessage(role, content) {
        this.history.push({ role, content, timestamp: Date.now() });
    }

    /**
     * Get history formatted for LLM
     */
    getFormattedHistory() {
        return this.history.map(m => ({ role: m.role, content: m.content }));
    }

    /**
     * End the session and cleanup resources
     */
    end() {
        this.status = 'ended';
        this.endTime = Date.now();

        // Close OpenAI WebSocket if exists
        if (this.openaiWs) {
            try {
                this.openaiWs.close();
            } catch (e) {}
            this.openaiWs = null;
        }

        // Stop speech recognizer if exists
        if (this.recognizer) {
            try {
                this.recognizer.stopContinuousRecognitionAsync();
            } catch (e) {}
            this.recognizer = null;
        }

        // Close push stream if exists
        if (this.pushStream) {
            try {
                this.pushStream.close();
            } catch (e) {}
            this.pushStream = null;
        }
    }

    /**
     * Get session duration in seconds
     */
    getDuration() {
        const end = this.endTime || Date.now();
        return Math.floor((end - this.startTime) / 1000);
    }
}

/**
 * Session Manager - Singleton for managing all active sessions
 */
class CallSessionManager {
    constructor() {
        this.sessions = new Map();      // sessionId -> CallSession
        this.callSidMap = new Map();    // callSid -> sessionId (for lookup by call)
        this.cleanupInterval = null;
        
        // Start cleanup interval for stale sessions (every 5 minutes)
        this.startCleanup();
    }

    /**
     * Create a new call session
     */
    create(tenantId, contactId, method, direction = 'outbound') {
        const id = uuidv4();
        const session = new CallSession(id, tenantId, contactId, method, direction);
        this.sessions.set(id, session);
        
        console.log(`[CallSession] Created session ${id} (${method}, ${direction})`);
        return session;
    }

    /**
     * Get session by ID
     */
    get(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Get session by Twilio Call SID
     */
    getByCallSid(callSid) {
        const sessionId = this.callSidMap.get(callSid);
        return sessionId ? this.sessions.get(sessionId) : null;
    }

    /**
     * Link a Twilio Call SID to a session
     */
    linkCallSid(sessionId, callSid) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.callSid = callSid;
            session.status = 'active';
            this.callSidMap.set(callSid, sessionId);
            console.log(`[CallSession] Linked call ${callSid} to session ${sessionId}`);
        }
    }

    /**
     * End and remove a session
     */
    end(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.end();
            
            // Remove from callSidMap if linked
            if (session.callSid) {
                this.callSidMap.delete(session.callSid);
            }
            
            // Keep session data for a bit (for logging/debugging)
            // Will be cleaned up later
            console.log(`[CallSession] Ended session ${sessionId} (duration: ${session.getDuration()}s)`);
        }
    }

    /**
     * Get all active sessions
     */
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active');
    }

    /**
     * Get session count
     */
    getActiveCount() {
        return this.getActiveSessions().length;
    }

    /**
     * Cleanup stale sessions (ended > 10 minutes ago)
     */
    cleanup() {
        const staleThreshold = 10 * 60 * 1000; // 10 minutes
        const now = Date.now();
        
        for (const [id, session] of this.sessions) {
            if (session.status === 'ended' && (now - session.endTime) > staleThreshold) {
                this.sessions.delete(id);
                console.log(`[CallSession] Cleaned up stale session ${id}`);
            }
        }
    }

    /**
     * Start periodic cleanup
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Stop periodic cleanup
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Export singleton instance
module.exports = new CallSessionManager();
