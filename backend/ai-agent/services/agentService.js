/**
 * Core AI Agent Service
 * Handles chat processing, context building, guidance application, and escalation
 */

const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { pool } = require('../../config/db');
const {
    Agent,
    Guidance,
    Guardrail,
    EscalationRule,
    EscalationGuidance
} = require('../models');

const { FUNCTION_TOOLS, executeTool, getContactInfo, getConversationHistoryByContact } = require('./functionTools');
const { getKnowledgeContext } = require('./vectorSearchService');

// Initialize LLM clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Get or create agent for a tenant
 */
async function getAgentForTenant(tenantId) {
    let agent = await Agent.findOne({ tenantId });
    
    if (!agent) {
        agent = await Agent.create({ tenantId });
        console.log(`Created new agent for tenant ${tenantId}`);
    }
    
    return agent;
}

/**
 * Build system prompt with all guidance, guardrails, and escalation rules
 */
async function buildSystemPrompt(tenantId, agentId) {
    const [guidances, guardrails, escalationGuidances] = await Promise.all([
        Guidance.find({ tenantId, agentId, isActive: true }).sort({ priority: -1 }),
        Guardrail.find({ tenantId, agentId, isActive: true }).sort({ priority: -1 }),
        EscalationGuidance.find({ tenantId, agentId, isActive: true }).sort({ priority: -1 })
    ]);

    const agent = await Agent.findById(agentId);
    let systemPrompt = agent.systemPrompt || '';

    // Add guidance sections
    if (guidances.length > 0) {
        const guidanceByCategory = {};
        guidances.forEach(g => {
            if (!guidanceByCategory[g.category]) {
                guidanceByCategory[g.category] = [];
            }
            guidanceByCategory[g.category].push(g);
        });

        systemPrompt += '\n\n## GUIDANCE INSTRUCTIONS\n';

        if (guidanceByCategory.communication_style) {
            systemPrompt += '\n### Communication Style\n';
            guidanceByCategory.communication_style.forEach(g => {
                systemPrompt += `- ${g.title}: ${g.content}\n`;
            });
        }

        if (guidanceByCategory.context_clarification) {
            systemPrompt += '\n### Context & Clarification\n';
            guidanceByCategory.context_clarification.forEach(g => {
                systemPrompt += `- ${g.title}: ${g.content}\n`;
            });
        }

        if (guidanceByCategory.content_sources) {
            systemPrompt += '\n### Content Sources\n';
            guidanceByCategory.content_sources.forEach(g => {
                systemPrompt += `- ${g.title}: ${g.content}\n`;
            });
        }
    }

    // Add guardrails
    if (guardrails.length > 0) {
        systemPrompt += '\n\n## GUARDRAILS (MUST FOLLOW)\n';
        guardrails.forEach(g => {
            systemPrompt += `- ${g.name}: ${g.description || g.triggerResponse}\n`;
        });
    }

    // Add escalation guidance
    if (escalationGuidances.length > 0) {
        systemPrompt += '\n\n## ESCALATION GUIDANCE\n';
        escalationGuidances.forEach(g => {
            systemPrompt += `- ${g.title}: ${g.content}\n`;
        });
    }

    return systemPrompt;
}

/**
 * Build context for a conversation
 */
async function buildConversationContext(tenantId, conversationId, contactId) {
    const context = {
        contact: null,
        recentConversations: null,
        knowledgeContext: null
    };

    try {
        // Get contact info if available
        if (contactId) {
            context.contact = await getContactInfo(tenantId, contactId);
        }

        // Get recent conversation history
        if (contactId) {
            context.recentConversations = await getConversationHistoryByContact(tenantId, contactId, 5);
        }
    } catch (error) {
        console.error('Error building context:', error);
    }

    return context;
}

/**
 * Detect attributes in a message
 * Note: Attribute model is not yet implemented - this returns empty for now
 */
async function detectAttributes(tenantId, agentId, message) {
    // TODO: Implement Attribute model for advanced attribute detection
    // For now, return empty attributes to allow the system to function
    return {};
}


/**
 * Check escalation rules against detected attributes
 */
async function checkEscalationRules(tenantId, agentId, detectedAttributes) {
    const rules = await EscalationRule.find({ tenantId, agentId, isActive: true })
        .sort({ rulePriority: -1 });

    for (const rule of rules) {
        const matches = rule.conditions.every(condition => {
            const detected = detectedAttributes[condition.attributeName];
            if (!detected) return false;

            switch (condition.operator) {
                case 'equals':
                    return detected === condition.value;
                case 'notEquals':
                    return detected !== condition.value;
                case 'contains':
                    return detected.toLowerCase().includes(condition.value.toLowerCase());
                case 'in':
                    return Array.isArray(condition.value) && condition.value.includes(detected);
                default:
                    return false;
            }
        });

        if (matches) {
            return {
                shouldEscalate: true,
                rule: rule.name,
                action: rule.action,
                targetTeam: rule.targetTeam,
                priority: rule.priority,
                message: rule.escalationMessage
            };
        }
    }

    return { shouldEscalate: false };
}

/**
 * Check guardrails for input/output
 */
async function checkGuardrails(tenantId, agentId, text, isInput = true) {
    const guardrails = await Guardrail.find({ tenantId, agentId, isActive: true })
        .sort({ priority: -1 });

    for (const guardrail of guardrails) {
        let triggered = false;

        switch (guardrail.condition.type) {
            case 'keyword':
                const patterns = guardrail.condition.patterns || [];
                triggered = patterns.some(pattern => 
                    text.toLowerCase().includes(pattern.toLowerCase())
                );
                break;
            case 'regex':
                const regexPatterns = guardrail.condition.patterns || [];
                triggered = regexPatterns.some(pattern => {
                    try {
                        return new RegExp(pattern, 'i').test(text);
                    } catch {
                        return false;
                    }
                });
                break;
            case 'always':
                triggered = true;
                break;
        }

        if (triggered) {
            return {
                triggered: true,
                guardrail: guardrail.name,
                action: guardrail.action,
                response: guardrail.triggerResponse
            };
        }
    }

    return { triggered: false };
}

/**
 * Main chat function - process a message through the agent
 */
async function chat(tenantId, conversationId, contactId, userMessage, messageHistory = [], channel = 'chat', instruction = '') {
    try {
        // Get agent configuration
        const agent = await getAgentForTenant(tenantId);
        if (!agent.isActive) {
            return {
                response: agent.fallbackMessage,
                metadata: { agentActive: false }
            };
        }

        // Check input guardrails
        const inputGuardrail = await checkGuardrails(tenantId, agent._id, userMessage, true);
        if (inputGuardrail.triggered && inputGuardrail.action === 'block') {
            return {
                response: inputGuardrail.response,
                metadata: { guardrailTriggered: true, guardrail: inputGuardrail.guardrail }
            };
        }

        // Detect attributes
        const detectedAttributes = await detectAttributes(tenantId, agent._id, userMessage);

        // Check escalation rules
        const escalation = await checkEscalationRules(tenantId, agent._id, detectedAttributes);
        if (escalation.shouldEscalate) {
            return {
                response: escalation.message,
                metadata: {
                    escalate: true,
                    escalationRule: escalation.rule,
                    targetTeam: escalation.targetTeam,
                    priority: escalation.priority
                },
                detectedAttributes
            };
        }

        // Build system prompt with guidance
        const systemPrompt = await buildSystemPrompt(tenantId, agent._id);

        // Build conversation context
        const context = await buildConversationContext(tenantId, conversationId, contactId);

        // Search knowledge base for relevant context
        let knowledgeContext = null;
        try {
            knowledgeContext = await getKnowledgeContext(tenantId, userMessage, { limit: 3 });
        } catch (err) {
            console.warn('Knowledge search failed:', err.message);
        }


        // Build messages array
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add Channel Instruction
        if (channel && channel !== 'chat') {
            const channelPrompt = `\n\nCONTEXT: You are responding via ${channel.toUpperCase()}.\n${instruction || ''}`;
            messages.push({ role: 'system', content: channelPrompt });
        }

        // Add context if available
        if (context.contact && context.contact.name) {
            messages.push({
                role: 'system',
                content: `Customer context: Name: ${context.contact.name}, Email: ${context.contact.email || 'N/A'}, Company: ${context.contact.company || 'N/A'}`
            });
        }

        if (knowledgeContext) {
            messages.push({
                role: 'system',
                content: `Relevant knowledge base context:\n${knowledgeContext.context}`
            });
        }

        // Add message history
        messageHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        // Call LLM
        let response;
        const llmClient = agent.llmProvider === 'groq' ? groq : openai;
        const model = agent.llmProvider === 'groq' ? 'llama-3.1-8b-instant' : agent.llmModel;

        console.log(`[AgentService] Calling LLM - Provider: ${agent.llmProvider}, Model: ${model}`);
        console.log(`[AgentService] Message count: ${messages.length}, Tools available: ${FUNCTION_TOOLS.length}`);

        // GPT-5 models only support temperature=1 (default), other models support custom temperature
        const isGPT5 = model.toLowerCase().includes('gpt-5');
        
        const completionParams = {
            model,
            messages,
            tools: FUNCTION_TOOLS,
            tool_choice: 'auto',
            max_completion_tokens: agent.maxTokens
        };
        
        // Only add temperature for non-GPT-5 models
        if (!isGPT5) {
            completionParams.temperature = agent.temperature;
        }

        const completion = await llmClient.chat.completions.create(completionParams);

        const assistantMessage = completion.choices[0].message;
        
        // Log detailed response info
        console.log(`[AgentService] LLM Raw Response:`, JSON.stringify({
            hasToolCalls: !!assistantMessage.tool_calls,
            toolCallCount: assistantMessage.tool_calls?.length || 0,
            contentLength: assistantMessage.content?.length || 0,
            content: assistantMessage.content,
            finishReason: completion.choices[0].finish_reason
        }, null, 2));

        // ... existing code ...
        // Handle tool calls if any
        let toolsUsed = [];
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            console.log(`[AgentService] Processing ${assistantMessage.tool_calls.length} tool call(s)`);
            const toolResults = [];
            
            for (const toolCall of assistantMessage.tool_calls) {
                console.log(`[AgentService] Tool Call: ${toolCall.function.name}`);
                console.log(`[AgentService] Tool Arguments:`, toolCall.function.arguments);
                
                toolsUsed.push(toolCall.function.name); // Track tool name

                const args = JSON.parse(toolCall.function.arguments);
                // ... rest of tool execution logic
                const toolContext = {
                    conversationId,
                    contactId
                };
                const result = await executeTool(tenantId, toolCall.function.name, args, toolContext);
                
                console.log(`[AgentService] Tool Result:`, JSON.stringify(result, null, 2));
                
                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    content: JSON.stringify(result)
                });

                // Check for escalation from tool
                if (result.action === 'escalate') {
                    // ... escalation logic
                    console.log(`[AgentService] Tool requested escalation`);
                    return {
                        response: "I'll connect you with a member of our team who can help further.",
                        metadata: {
                            escalate: true,
                            reason: result.reason,
                            priority: result.priority,
                            toolsUsed // Include tools even on escalation
                        },
                        detectedAttributes
                    };
                }
            }
            // ... rest of logic
            // Get final response after tool calls
            messages.push(assistantMessage);
            messages.push(...toolResults);

            console.log(`[AgentService] Calling LLM again after tool execution with ${messages.length} messages`);
            
            const finalParams = {
                model,
                messages,
                max_completion_tokens: agent.maxTokens
            };
            
            // Only add temperature for non-GPT-5 models
            if (!isGPT5) {
                finalParams.temperature = agent.temperature;
            }
            
            const finalCompletion = await llmClient.chat.completions.create(finalParams);

            response = finalCompletion.choices[0].message.content;
            console.log(`[AgentService] Final response after tools:`, {
                length: response?.length || 0,
                finishReason: finalCompletion.choices[0].finish_reason,
                preview: response?.substring(0, 100)
            });
        } else {
             // ... existing else block
            response = assistantMessage.content;
            console.log(`[AgentService] Direct response (no tools):`, {
                length: response?.length || 0,
                isEmpty: !response || response.trim().length === 0,
                value: response
            });
        }


        // Check output guardrails
        const outputGuardrail = await checkGuardrails(tenantId, agent._id, response, false);
        if (outputGuardrail.triggered && outputGuardrail.action === 'block') {
            console.log(`[AgentService] Output guardrail triggered: ${outputGuardrail.guardrail}`);
            response = outputGuardrail.response;
        }

        // Update agent stats
        await Agent.updateOne(
            { _id: agent._id },
            { $inc: { totalMessages: 1 } }
        );

        console.log(`[AgentService] Returning response - Length: ${response?.length || 0}, Empty: ${!response || response.trim().length === 0}`);

        return {
            response,
            metadata: {
                model,
                provider: agent.llmProvider,
                knowledgeUsed: !!knowledgeContext,
                toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
            },
            detectedAttributes
        };

    } catch (error) {
        console.error('Agent chat error:', error);
        return {
            response: "I apologize, but I encountered an error. Please try again or contact support.",
            metadata: { error: true }
        };
    }
}

module.exports = {
    getAgentForTenant,
    buildSystemPrompt,
    buildConversationContext,
    detectAttributes,
    checkEscalationRules,
    checkGuardrails,
    chat
};
