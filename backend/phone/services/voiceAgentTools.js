/**
 * Voice Agent Function Tools
 * Subset of function tools available for voice agents during realtime calls
 * Only includes the first 7 tools from functionTools.js (lines 13-168)
 */

const { executeTool } = require('../../ai-agent/services/functionTools');

/**
 * Voice agent specific tools (read-only operations for voice calls)
 * Excludes copilot-specific tools like generate_reply_draft, summarize_conversation, etc.
 */
const VOICE_AGENT_TOOLS = [
    {
        type: 'function',
        name: 'get_contact_info',
        description: 'Get detailed information about a contact/customer including their profile, metadata, and preferences',
        parameters: {
            type: 'object',
            properties: {
                contact_id: {
                    type: 'string',
                    description: 'The UUID of the contact to look up'
                }
            },
            required: ['contact_id']
        }
    },
    {
        type: 'function',
        name: 'get_conversation_history_by_contact',
        description: 'Get previous conversations for a specific contact by their contact_id across all channels (email, whatsapp, widget, phone)',
        parameters: {
            type: 'object',
            properties: {
                contact_id: {
                    type: 'string',
                    description: 'The UUID of the contact'
                },
                limit: {
                    type: 'integer',
                    description: 'Maximum number of conversations to return (default 10)',
                    default: 10
                }
            },
            required: ['contact_id']
        }
    },
    {
        type: 'function',
        name: 'find_conversations_by_identifier',
        description: 'Find conversations by email address or phone number. Use this when the user provides an email or phone but you dont have their contact_id. This works even for contacts not yet saved in the system.',
        parameters: {
            type: 'object',
            properties: {
                email: {
                    type: 'string',
                    description: 'Email address to search for'
                },
                phone: {
                    type: 'string',
                    description: 'Phone number to search for (any format)'
                },
                limit: {
                    type: 'integer',
                    description: 'Maximum number of conversations to return (default 10)',
                    default: 10
                }
            },
            required: []
        }
    },
    {
        type: 'function',
        name: 'get_recent_messages',
        description: 'Get recent messages from the current or a specific conversation',
        parameters: {
            type: 'object',
            properties: {
                conversation_id: {
                    type: 'string',
                    description: 'The UUID of the conversation'
                },
                limit: {
                    type: 'integer',
                    description: 'Maximum number of messages to return (default 20)',
                    default: 20
                }
            },
            required: ['conversation_id']
        }
    },
    {
        type: 'function',
        name: 'search_knowledge_base',
        description: 'Search the knowledge base for relevant information to answer customer questions',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query - what information are you looking for?'
                }
            },
            required: ['query']
        }
    },
    {
        type: 'function',
        name: 'escalate_to_human',
        description: 'Hand off the conversation to a human agent. Use when you cannot help or the customer explicitly requests human support.',
        parameters: {
            type: 'object',
            properties: {
                reason: {
                    type: 'string',
                    description: 'Reason for escalation'
                },
                priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high', 'urgent'],
                    description: 'Priority level for the escalation'
                },
                summary: {
                    type: 'string',
                    description: 'Brief summary of the conversation for the human agent'
                }
            },
            required: ['reason']
        }
    },
    {
        type: 'function',
        name: 'create_ticket',
        description: 'Create a support ticket for follow-up',
        parameters: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Ticket title/subject'
                },
                description: {
                    type: 'string',
                    description: 'Detailed description of the issue'
                },
                priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high', 'urgent'],
                    description: 'Priority level for the ticket (default: normal)'
                }
            },
            required: ['title', 'description']
        }
    }
];

/**
 * Execute a tool call from voice agent
 * Wraps the main executeTool function with voice-specific context
 * 
 * @param {string} tenantId - Tenant ID
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Tool arguments
 * @param {Object} context - Additional context (conversationId, contactId, sessionId)
 * @returns {Promise<Object>} Tool execution result
 */
async function executeVoiceAgentTool(tenantId, toolName, args, context = {}) {
    try {
        console.log(`[VoiceAgentTools] Executing tool: ${toolName}`);
        console.log(`[VoiceAgentTools] Args:`, JSON.stringify(args, null, 2));

        // Validate tool is allowed for voice agents
        const allowedTools = VOICE_AGENT_TOOLS.map(t => t.name);
        if (!allowedTools.includes(toolName)) {
            console.error(`[VoiceAgentTools] Tool ${toolName} not allowed for voice agents`);
            return {
                error: true,
                message: 'This tool is not available during voice calls'
            };
        }

        // Execute the tool
        const result = await executeTool(tenantId, toolName, args, context);
        
        console.log(`[VoiceAgentTools] Tool result:`, JSON.stringify(result, null, 2));
        return result;

    } catch (error) {
        console.error(`[VoiceAgentTools] Error executing tool ${toolName}:`, error);
        return {
            error: true,
            message: 'I encountered an error executing that action. Please try again or ask me to do something else.'
        };
    }
}

module.exports = {
    VOICE_AGENT_TOOLS,
    executeVoiceAgentTool
};
