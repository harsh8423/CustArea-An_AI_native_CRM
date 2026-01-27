/**
 * AI Agent Controller
 * Handles API requests for agent configuration, training, and chat
 */

const multer = require('multer');
const {
    Agent,
    KnowledgeSource,
    KnowledgeChunk,
    Guidance,
    Guardrail,
    EscalationRule,
    EscalationGuidance,
    GUARDRAIL_TEMPLATES
} = require('../models');
const {
    processKnowledgeSource,
    chat,
    getAgentForTenant,
    checkVectorIndex
} = require('../services');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// ================== AGENT CONFIG ==================

/**
 * Get agent configuration for tenant
 */
async function getAgent(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);
        res.json(agent);
    } catch (error) {
        console.error('Error getting agent:', error);
        res.status(500).json({ error: 'Failed to get agent configuration' });
    }
}

/**
 * Update agent configuration
 */
async function updateAgent(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const updates = req.body;

        // Filter valid fields - removed LLM config fields (llmProvider, llmModel, temperature, maxTokens, isActive)
        const allowedFields = [
            'name', 'description', 'avatar', 'systemPrompt',
            'enabledChannels', 'autoReply', 'welcomeMessage', 'fallbackMessage'
        ];

        const filteredUpdates = {};
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        });

        const agent = await Agent.findOneAndUpdate(
            { tenantId },
            filteredUpdates,
            { new: true, upsert: true }
        );

        res.json(agent);
    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(500).json({ error: 'Failed to update agent' });
    }
}

// ================== KNOWLEDGE BASE ==================

/**
 * Add knowledge source (URL or text)
 */
async function addKnowledgeSource(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);
        const { type, title, description, sourceUrl, content } = req.body;

        const source = await KnowledgeSource.create({
            tenantId,
            agentId: agent._id,
            type: type || 'text',
            title,
            description,
            sourceUrl,
            metadata: content ? { content } : {}
        });

        // Start processing in background
        processKnowledgeSource(source._id).catch(err => {
            console.error('Background processing failed:', err);
        });

        res.status(201).json(source);
    } catch (error) {
        console.error('Error adding knowledge source:', error);
        res.status(500).json({ error: 'Failed to add knowledge source' });
    }
}

/**
 * Upload PDF document
 */
async function uploadDocument(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, description } = req.body;

        const source = await KnowledgeSource.create({
            tenantId,
            agentId: agent._id,
            type: 'pdf',
            title: title || req.file.originalname,
            description,
            filename: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });

        // Process the PDF
        processKnowledgeSource(source._id, req.file.buffer).catch(err => {
            console.error('PDF processing failed:', err);
        });

        res.status(201).json(source);
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
}

/**
 * Get knowledge sources
 */
async function getKnowledgeSources(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { status, type } = req.query;

        const filter = { tenantId, isDeleted: false };
        if (status) filter.status = status;
        if (type) filter.type = type;

        const sources = await KnowledgeSource.find(filter)
            .sort({ createdAt: -1 })
            .select('-metadata.content'); // Exclude large content field

        res.json(sources);
    } catch (error) {
        console.error('Error getting knowledge sources:', error);
        res.status(500).json({ error: 'Failed to get knowledge sources' });
    }
}

/**
 * Delete knowledge source
 */
async function deleteKnowledgeSource(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        // Soft delete
        await KnowledgeSource.updateOne(
            { _id: id, tenantId },
            { isDeleted: true }
        );

        // Delete associated chunks
        await KnowledgeChunk.deleteMany({ sourceId: id });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting knowledge source:', error);
        res.status(500).json({ error: 'Failed to delete knowledge source' });
    }
}

// ================== GUIDANCE ==================

async function createGuidance(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);
        const { category, title, content, examples, audience, priority } = req.body;

        const guidance = await Guidance.create({
            tenantId,
            agentId: agent._id,
            category,
            title,
            content,
            examples,
            audience,
            priority
        });

        res.status(201).json(guidance);
    } catch (error) {
        console.error('Error creating guidance:', error);
        res.status(500).json({ error: 'Failed to create guidance' });
    }
}

async function getGuidances(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { category, active } = req.query;

        const filter = { tenantId };
        if (category) filter.category = category;
        if (active !== undefined) filter.isActive = active === 'true';

        const guidances = await Guidance.find(filter).sort({ category: 1, priority: -1 });
        res.json(guidances);
    } catch (error) {
        console.error('Error getting guidances:', error);
        res.status(500).json({ error: 'Failed to get guidances' });
    }
}

async function updateGuidance(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const guidance = await Guidance.findOneAndUpdate(
            { _id: id, tenantId },
            req.body,
            { new: true }
        );

        if (!guidance) {
            return res.status(404).json({ error: 'Guidance not found' });
        }

        res.json(guidance);
    } catch (error) {
        console.error('Error updating guidance:', error);
        res.status(500).json({ error: 'Failed to update guidance' });
    }
}

async function deleteGuidance(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        await Guidance.deleteOne({ _id: id, tenantId });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting guidance:', error);
        res.status(500).json({ error: 'Failed to delete guidance' });
    }
}


// ================== GUARDRAILS ==================

async function createGuardrail(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);
        const { type, name, description, condition, action, triggerResponse, priority } = req.body;

        const guardrail = await Guardrail.create({
            tenantId,
            agentId: agent._id,
            type,
            name,
            description,
            condition,
            action,
            triggerResponse,
            priority
        });

        res.status(201).json(guardrail);
    } catch (error) {
        console.error('Error creating guardrail:', error);
        res.status(500).json({ error: 'Failed to create guardrail' });
    }
}

async function getGuardrails(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { type } = req.query;

        const filter = { tenantId };
        if (type) filter.type = type;

        const guardrails = await Guardrail.find(filter).sort({ priority: -1 });
        res.json(guardrails);
    } catch (error) {
        console.error('Error getting guardrails:', error);
        res.status(500).json({ error: 'Failed to get guardrails' });
    }
}

async function getGuardrailTemplates(req, res) {
    res.json(GUARDRAIL_TEMPLATES);
}

async function updateGuardrail(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        const guardrail = await Guardrail.findOneAndUpdate(
            { _id: id, tenantId },
            req.body,
            { new: true }
        );

        if (!guardrail) {
            return res.status(404).json({ error: 'Guardrail not found' });
        }

        res.json(guardrail);
    } catch (error) {
        console.error('Error updating guardrail:', error);
        res.status(500).json({ error: 'Failed to update guardrail' });
    }
}

async function deleteGuardrail(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        await Guardrail.deleteOne({ _id: id, tenantId });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting guardrail:', error);
        res.status(500).json({ error: 'Failed to delete guardrail' });
    }
}

// ================== ESCALATION ==================

async function createEscalationRule(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);
        const { name, description, conditions, matchMode, action, targetTeam, priority, escalationMessage } = req.body;

        const rule = await EscalationRule.create({
            tenantId,
            agentId: agent._id,
            name,
            description,
            conditions,
            matchMode,
            action,
            targetTeam,
            priority,
            escalationMessage
        });

        res.status(201).json(rule);
    } catch (error) {
        console.error('Error creating escalation rule:', error);
        res.status(500).json({ error: 'Failed to create escalation rule' });
    }
}

async function getEscalationRules(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const rules = await EscalationRule.find({ tenantId }).sort({ rulePriority: -1 });
        res.json(rules);
    } catch (error) {
        console.error('Error getting escalation rules:', error);
        res.status(500).json({ error: 'Failed to get escalation rules' });
    }
}

async function deleteEscalationRule(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        await EscalationRule.deleteOne({ _id: id, tenantId });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting escalation rule:', error);
        res.status(500).json({ error: 'Failed to delete escalation rule' });
    }
}

async function createEscalationGuidance(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);
        const { title, content, examples, priority } = req.body;

        const guidance = await EscalationGuidance.create({
            tenantId,
            agentId: agent._id,
            title,
            content,
            examples,
            priority
        });

        res.status(201).json(guidance);
    } catch (error) {
        console.error('Error creating escalation guidance:', error);
        res.status(500).json({ error: 'Failed to create escalation guidance' });
    }
}

async function getEscalationGuidances(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const guidances = await EscalationGuidance.find({ tenantId }).sort({ priority: -1 });
        res.json(guidances);
    } catch (error) {
        console.error('Error getting escalation guidances:', error);
        res.status(500).json({ error: 'Failed to get escalation guidances' });
    }
}

async function deleteEscalationGuidance(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { id } = req.params;

        await EscalationGuidance.deleteOne({ _id: id, tenantId });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting escalation guidance:', error);
        res.status(500).json({ error: 'Failed to delete escalation guidance' });
    }
}

// ================== CHAT ==================

async function chatWithAgent(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { conversationId, contactId, message, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await chat(tenantId, conversationId, contactId, message, history || []);
        res.json(result);
    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
}

// ================== STATUS ==================

async function getStatus(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const agent = await getAgentForTenant(tenantId);

        const [sourceCount, chunkCount, guidanceCount, guardrailCount] = await Promise.all([
            KnowledgeSource.countDocuments({ tenantId, isDeleted: false }),
            KnowledgeChunk.countDocuments({ tenantId }),
            Guidance.countDocuments({ tenantId, isActive: true }),
            Guardrail.countDocuments({ tenantId, isActive: true })
        ]);

        let vectorIndexStatus = 'unknown';
        try {
            const hasIndex = await checkVectorIndex();
            vectorIndexStatus = hasIndex ? 'ready' : 'not_created';
        } catch (e) {
            vectorIndexStatus = 'error';
        }

        res.json({
            agent: {
                isActive: agent.isActive,
                name: agent.name,
                llmProvider: agent.llmProvider
            },
            stats: {
                knowledgeSources: sourceCount,
                knowledgeChunks: chunkCount,
                guidances: guidanceCount,
                guardrails: guardrailCount
            },
            vectorIndex: vectorIndexStatus
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
}

module.exports = {
    upload,
    getAgent,
    updateAgent,
    addKnowledgeSource,
    uploadDocument,
    getKnowledgeSources,
    deleteKnowledgeSource,
    createGuidance,
    getGuidances,
    updateGuidance,
    deleteGuidance,
    createGuardrail,
    getGuardrails,
    getGuardrailTemplates,
    updateGuardrail,
    deleteGuardrail,
    createEscalationRule,
    getEscalationRules,
    deleteEscalationRule,
    createEscalationGuidance,
    getEscalationGuidances,
    deleteEscalationGuidance,
    chatWithAgent,
    getStatus
};
