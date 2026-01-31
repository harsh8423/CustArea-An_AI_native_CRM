/**
 * Bulk Phone Call Job Processor
 * 
 * Processes bulk calling jobs:
 * 1. Fetches contacts from group with phone numbers
 * 2. Calls each contact sequentially (AI agent)
 * 3. Waits for call completion
 * 4. Saves transcript & summary
 * 5. Updates job progress in real-time
 * 6. Handles pause/resume/cancel
 */

const { pool } = require('../../config/db');
const twilioService = require('../services/twilioService');
const callSessionManager = require('../services/callSessionManager');

/**
 * Main job processor function
 * @param {Object} job - Bull job object
 */
async function processJob(job) {
    const { 
        jobId, 
        tenantId, 
        groupId, 
        groupName, 
        callerPhoneNumber, 
        callMode, 
        customInstruction 
    } = job.data;
    
    console.log(`🚀 [BulkCallProcessor] Starting job ${jobId} for ${groupName}`);
    
    try {
        // 1. Mark job as processing
        await updateJobStatus(jobId, 'processing', { started_at: new Date() });
        
        // 2. Fetch contacts with phone numbers from group
        const contacts = await fetchGroupContacts(groupId, tenantId);
        
        if (contacts.length === 0) {
            throw new Error('No contacts with valid phone numbers found in group');
        }
        
        console.log(`📞 [BulkCallProcessor] Found ${contacts.length} contacts with phone numbers`);
        
        // 3. Update total recipients
        await updateJobProgress(jobId, {
            total_recipients: contacts.length,
            estimated_completion_at: calculateETA(contacts.length)
        });
        
        // 4. Process calls one by one
        const results = {
            callsCompleted: 0,
            callsFailed: 0,
            callRecords: [],
            failedCalls: []
        };
        
        let totalDuration = 0;
        
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            // Check if job should be paused
            const jobStatus = await getJobStatus(jobId);
            if (jobStatus.status === 'paused') {
                console.log(`⏸️ [BulkCallProcessor] Job ${jobId} paused at ${i}/${contacts.length}`);
                
                // Wait for resume signal
                await waitForResume(jobId);
                console.log(`▶️ [BulkCallProcessor] Job ${jobId} resumed`);
            }
            
            // Check if job is cancelled
            if (jobStatus.status === 'cancelled') {
                console.log(`❌ [BulkCallProcessor] Job ${jobId} cancelled at ${i}/${contacts.length}`);
                throw new Error('Job cancelled by user');
            }
            
            // Update current contact
            await updateJobProgress(jobId, {
                current_contact_id: contact.id,
                current_contact_name: contact.name,
                current_contact_phone: contact.phone,
                calls_in_progress: 1,
                progress_percent: Math.floor((i / contacts.length) * 100)
            });
            
            console.log(`📞 [BulkCallProcessor] Calling ${i + 1}/${contacts.length}: ${contact.name} (${contact.phone})`);
            
            try {
                // Make outbound AI call
                const callResult = await makeOutboundCall({
                    toNumber: contact.phone,
                    fromNumber: callerPhoneNumber,
                    contactId: contact.id,
                    contactName: contact.name,
                    tenantId,
                    callMode,
                    customInstruction
                });
                
                // Success
                results.callsCompleted++;
                totalDuration += callResult.duration || 0;
                
                results.callRecords.push({
                    contactId: contact.id,
                    contactName: contact.name,
                    phone: contact.phone,
                    status: 'completed',
                    duration: callResult.duration,
                    callSid: callResult.callSid,
                    startedAt: callResult.startedAt,
                    endedAt: callResult.endedAt,
                    transcript: callResult.transcript,
                    summary: callResult.summary
                });
                
                console.log(`✅ [BulkCallProcessor] Call completed: ${contact.name} (${callResult.duration}s)`);
                
            } catch (error) {
                results.callsFailed++;
                results.failedCalls.push({
                    contactId: contact.id,
                    contactName: contact.name,
                    phone: contact.phone,
                    error: error.code || 'CALL_FAILED',
                    errorMessage: error.message,
                    timestamp: new Date().toISOString()
                });
                
                console.error(`❌ [BulkCallProcessor] Call failed: ${contact.name}:`, error.message);
            }
            
            // Update progress after each call
            const avgDuration = results.callsCompleted > 0 ? Math.floor(totalDuration / results.callsCompleted) : 180;
            
            await updateJobProgress(jobId, {
                calls_completed: results.callsCompleted,
                calls_failed: results.callsFailed,
                calls_in_progress: 0,
                call_records: results.callRecords,
                failed_calls: results.failedCalls,
                total_call_duration_seconds: totalDuration,
                average_call_duration_seconds: avgDuration,
                estimated_completion_at: calculateETARemaining(contacts.length - i - 1, avgDuration)
            });
            
            // Small delay between calls to avoid rate limits
            if (i < contacts.length - 1) {
                await sleep(2000); // 2 second delay between calls
            }
        }
        
        // 5. Mark job as completed
        await updateJobStatus(jobId, 'completed', {
            completed_at: new Date(),
            calls_completed: results.callsCompleted,
            calls_failed: results.callsFailed,
            call_records: results.callRecords,
            failed_calls: results.failedCalls,
            progress_percent: 100,
            current_contact_id: null,
            current_contact_name: null,
            current_contact_phone: null,
            total_call_duration_seconds: totalDuration,
            average_call_duration_seconds: results.callsCompleted > 0 ? Math.floor(totalDuration / results.callsCompleted) : 0
        });
        
        console.log(`🎉 [BulkCallProcessor] Job ${jobId} completed: ${results.callsCompleted} completed, ${results.callsFailed} failed`);
        
        return results;
        
    } catch (error) {
        console.error(`💥 [BulkCallProcessor] Job ${jobId} failed:`, error);
        
        // Check if job was cancelled vs actual failure
        const wasCancelled = error.message === 'Job cancelled by user';
        const finalStatus = wasCancelled ? 'cancelled' : 'failed';
        
        // Save partial progress if any calls were completed
        // This ensures we don't lose data about successful calls
        const partialUpdate = {
            completed_at: new Date(),
            error_message: wasCancelled ? null : error.message
        };
        
        // Only include call data if we have results
        if (typeof results !== 'undefined') {
            partialUpdate.calls_completed = results.callsCompleted || 0;
            partialUpdate.calls_failed = results.callsFailed || 0;
            partialUpdate.call_records = results.callRecords || [];
            partialUpdate.failed_calls = results.failedCalls || [];
            partialUpdate.progress_percent = Math.floor(
                ((results.callsCompleted + results.callsFailed) / contacts.length) * 100
            );
        }
        
        // Mark job with correct status
        await updateJobStatus(jobId, finalStatus, partialUpdate);
        
        throw error;
    }
}

/**
 * Fetch contacts with phone numbers from group
 */
async function fetchGroupContacts(groupId, tenantId) {
    const query = `
        SELECT DISTINCT c.id, c.name, c.phone
        FROM contacts c
        INNER JOIN contact_group_memberships cgm ON c.id = cgm.contact_id
        WHERE cgm.group_id = $1
          AND c.tenant_id = $2
          AND c.phone IS NOT NULL
          AND c.phone != ''
          AND c.phone ~ '^[0-9+() -]+$'
        ORDER BY c.name
    `;
    
    const result = await pool.query(query, [groupId, tenantId]);
    return result.rows;
}

/**
 * Make outbound AI call and wait for completion
 * Returns: { callSid, duration, startedAt, endedAt, transcript, summary }
 */
async function makeOutboundCall({ toNumber, fromNumber, contactId, contactName, tenantId, callMode, customInstruction }) {
    const startTime = Date.now();
    
    // Create call session
    const session = callSessionManager.create(
        tenantId,
        contactId,
        'realtime', // Use realtime for AI calls
        'outbound',
        fromNumber,
        toNumber,
        customInstruction
    );
    
    console.log(`[BulkCallProcessor] Created session ${session.id} for ${contactName}`);
    
    try {
        // Initiate call via Twilio
        const call = await twilioService.makeCall(toNumber, fromNumber, session.id, tenantId);
        
        session.callSid = call.sid;
        console.log(`[BulkCallProcessor] Call initiated: ${call.sid}`);
        
        // Wait for call to complete
        const result = await waitForCallCompletion(session, 600000); // 10 minute timeout
        
        const endTime = Date.now();
const duration = Math.floor((endTime - startTime) / 1000);
        
        return {
            callSid: session.callSid,
            duration,
            startedAt: new Date(startTime).toISOString(),
            endedAt: new Date(endTime).toISOString(),
            transcript: result.transcript || '',
            summary: result.summary || ''
        };
        
    } catch (error) {
        console.error(`[BulkCallProcessor] Call error for ${contactName}:`, error);
        throw error;
    }
}

/**
 * Wait for call to complete
 * Polls session status until call ends
 */
async function waitForCallCompletion(session, timeout = 600000) {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds
    
    return new Promise((resolve, reject) => {
        const checkStatus = setInterval(async () => {
            const elapsed = Date.now() - startTime;
            
            // Timeout check
            if (elapsed > timeout) {
                clearInterval(checkStatus);
                reject(new Error('Call timeout'));
                return;
            }
            
            // Get updated session
            const currentSession = callSessionManager.get(session.id);
            
            if (!currentSession) {
                clearInterval(checkStatus);
                reject(new Error('Session not found'));
                return;
            }
            
            // Check if call ended
            if (currentSession.status === 'ended') {
                clearInterval(checkStatus);
                
                // Collect transcript and summary
                const transcriptText = currentSession.transcripts
                    ?.map(t => `${t.speaker}: ${t.text}`)
                    .join('\n') || '';
                
                resolve({
                    transcript: transcriptText,
                    summary: currentSession.summary || 'Call completed'
                });
            }
        }, pollInterval);
    });
}

/**
 * Update job status in database
 */
async function updateJobStatus(jobId, status, additionalFields = {}) {
    const fields = { status, ...additionalFields };
    
    // Build SET clause with proper JSONB casting
    const setClause = Object.keys(fields)
        .map((key, idx) => {
            // Handle JSONB fields
            if (key === 'call_records' || key === 'failed_calls') {
                return `${key} = $${idx + 2}::jsonb`;
            }
            return `${key} = $${idx + 2}`;
        })
        .join(', ');
    
    // Stringify objects for JSONB fields
    const values = [
        jobId,
        ...Object.values(fields).map(v => 
            typeof v === 'object' && v !== null && !(v instanceof Date) 
                ? JSON.stringify(v) 
                : v
        )
    ];
    
    const query = `
        UPDATE bulk_phone_call_jobs
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
    `;
    
    await pool.query(query, values);
}

/**
 * Update job progress fields
 */
async function updateJobProgress(jobId, fields) {
    const setClause = Object.keys(fields)
        .map((key, idx) => {
            // Handle JSONB fields
            if (key === 'call_records' || key === 'failed_calls') {
                return `${key} = $${idx + 2}::jsonb`;
            }
            return `${key} = $${idx + 2}`;
        })
        .join(', ');
    
    const values = [
        jobId,
        ...Object.values(fields).map(v => 
            typeof v === 'object' && v !== null ? JSON.stringify(v) : v
        )
    ];
    
    const query = `
        UPDATE bulk_phone_call_jobs
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
    `;
    
    await pool.query(query, values);
}

/**
 * Get current job status
 */
async function getJobStatus(jobId) {
    const result = await pool.query(
        'SELECT status FROM bulk_phone_call_jobs WHERE id = $1',
        [jobId]
    );
    return result.rows[0] || { status: 'unknown' };
}

/**
 * Wait for job to be resumed (polls database)
 */
async function waitForResume(jobId, checkInterval = 5000) {
    return new Promise((resolve) => {
        const checkStatus = setInterval(async () => {
            const job = await getJobStatus(jobId);
            
            if (job.status === 'processing') {
                clearInterval(checkStatus);
                resolve();
            } else if (job.status === 'cancelled') {
                clearInterval(checkStatus);
                resolve(); // Will be caught in main loop
            }
        }, checkInterval);
    });
}

/**
 * Calculate estimated completion time
 */
function calculateETA(totalContacts, avgCallDuration = 180) {
    // Assume 3 minutes per call + 2 seconds between calls
    const totalSeconds = (totalContacts * avgCallDuration) + (totalContacts * 2);
    const eta = new Date(Date.now() + totalSeconds * 1000);
    return eta;
}

/**
 * Calculate ETA for remaining calls
 */
function calculateETARemaining(remainingContacts, avgCallDuration = 180) {
    const totalSeconds = (remainingContacts * avgCallDuration) + (remainingContacts * 2);
    const eta = new Date(Date.now() + totalSeconds * 1000);
    return eta;
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    processJob,
    fetchGroupContacts,
    makeOutboundCall,
    updateJobProgress,
    updateJobStatus
};
