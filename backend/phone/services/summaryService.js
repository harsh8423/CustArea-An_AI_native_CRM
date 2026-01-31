/**
 * Summary Service
 * Generates AI-powered call summaries
 */

const { chat } = require('../../ai-agent/services/agentService');

/**
 * Generate a summary of the phone call using AI
 * @param {Array} transcripts - Array of transcript objects with {role, text, timestamp}
 * @param {String} tenantId - Tenant ID for LLM selection
 * @returns {String} Generated summary
 */
async function generateCallSummary(transcripts, tenantId) {
    if (!transcripts || transcripts.length === 0) {
        return 'No conversation occurred during this call.';
    }

    try {
        // Build conversation transcript for summary
        // Handle both old format (role) and new format (speaker)
        const conversationText = transcripts
            .map(t => {
                const speaker = t.speaker || t.role;  // Support both formats
                const speakerLabel = speaker === 'user' ? 'Customer' : 
                                   speaker === 'action' ? 'Action' : 'AI Agent';
                return `${speakerLabel}: ${t.text}`;
            })
            .join('\n');

        // Create prompt for summary generation - MUST BE CONCISE
        const summaryPrompt = `Generate a SHORT summary (2-3 sentences MAX) of this phone call.

Focus on:
- Main purpose of the call
- Key outcome or action taken

Conversation:
${conversationText}

Summary (2-3 sentences):`;

        // Call LLM to generate summary
        const result = await chat(
            tenantId,
            null, // no conversation_id needed for summary
            null, // no contact_id needed
            summaryPrompt,
            [], // no history
            { skipStorage: true } // Don't store this internal summary request
        );

        return result.response || 'Summary could not be generated.';
        
    } catch (error) {
        console.error('[SummaryService] Error generating summary:', error);
        return 'Error generating summary. See logs for details.';
    }
}

module.exports = {
    generateCallSummary
};
