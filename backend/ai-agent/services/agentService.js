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
    Attribute,
    Guardrail,
    EscalationRule,
    EscalationGuidance
} = require('../models');
const { FUNCTION_TOOLS, executeTool, getContactInfo, getConversationHistory } = require('./functionTools');
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
            context.recentConversations = await getConversationHistory(tenantId, contactId, 5);
        }
    } catch (error) {
        console.error('Error building context:', error);
    }

    return context;
}

/**
 * Detect attributes in a message
 */
async function detectAttributes(tenantId, agentId, message) {
    const attributes = await Attribute.find({ tenantId, agentId, isActive: true });
    
    if (attributes.length === 0) {
        return {};
    }

    // Build detection prompt
    const attributeDescriptions = attributes.map(attr => {
        const values = attr.values.map(v => `${v.name}: ${v.description}`).join('; ');
        return `${attr.name}: ${attr.description}. Values: [${values}]`;
    }).join('\n');

    const detectionPrompt = `Analyze the following customer message and detect these attributes:

${attributeDescriptions}

Customer Message: "${message}"

Respond in JSON format with attribute names as keys and detected values as values.
Only include attributes you can confidently detect. Example:
{"Sentiment": "Negative", "Issue Type": "Billing", "Urgency": "High"}`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an attribute detector. Respond only with valid JSON.' },
                { role: 'user', content: detectionPrompt }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });

        const detected = JSON.parse(response.choices[0].message.content);
        return detected;
    } catch (error) {
        console.error('Error detecting attributes:', error);
        return {};
    }
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
async function chat(tenantId, conversationId, contactId, userMessage, messageHistory = []) {
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

        const completion = await llmClient.chat.completions.create({
            model,
            messages,
            tools: FUNCTION_TOOLS,
            tool_choice: 'auto',
            temperature: agent.temperature,
            max_tokens: agent.maxTokens
        });

        const assistantMessage = completion.choices[0].message;

        // Handle tool calls if any
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            const toolResults = [];
            
            for (const toolCall of assistantMessage.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments);
                const result = await executeTool(tenantId, toolCall.function.name, args);
                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    content: JSON.stringify(result)
                });

                // Check for escalation from tool
                if (result.action === 'escalate') {
                    return {
                        response: "I'll connect you with a member of our team who can help further.",
                        metadata: {
                            escalate: true,
                            reason: result.reason,
                            priority: result.priority
                        },
                        detectedAttributes
                    };
                }
            }

            // Get final response after tool calls
            messages.push(assistantMessage);
            messages.push(...toolResults);

            const finalCompletion = await llmClient.chat.completions.create({
                model,
                messages,
                temperature: agent.temperature,
                max_tokens: agent.maxTokens
            });

            response = finalCompletion.choices[0].message.content;
        } else {
            response = assistantMessage.content;
        }

        // Check output guardrails
        const outputGuardrail = await checkGuardrails(tenantId, agent._id, response, false);
        if (outputGuardrail.triggered && outputGuardrail.action === 'block') {
            response = outputGuardrail.response;
        }

        // Update agent stats
        await Agent.updateOne(
            { _id: agent._id },
            { $inc: { totalMessages: 1 } }
        );

        return {
            response,
            metadata: {
                model,
                provider: agent.llmProvider,
                knowledgeUsed: !!knowledgeContext
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
