/**
 * AI Agent Routes
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const controller = require('../controllers/agentController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ================== AGENT CONFIG (Admin only) ==================
router.get('/', requirePermission('ai.configure'), controller.getAgent);
router.put('/', requirePermission('ai.configure'), controller.updateAgent);
router.get('/status', requirePermission('ai.configure'), controller.getStatus);

// ================== KNOWLEDGE BASE (Admin only) ==================
router.get('/knowledge', requirePermission('ai.configure'), controller.getKnowledgeSources);
router.post('/knowledge', requirePermission('ai.configure'), controller.addKnowledgeSource);
router.post('/knowledge/upload', requirePermission('ai.configure'), controller.upload.single('file'), controller.uploadDocument);
router.delete('/knowledge/:id', requirePermission('ai.configure'), controller.deleteKnowledgeSource);

// ================== GUIDANCE (Admin only) ==================
router.get('/guidance', requirePermission('ai.configure'), controller.getGuidances);
router.post('/guidance', requirePermission('ai.configure'), controller.createGuidance);
router.put('/guidance/:id', requirePermission('ai.configure'), controller.updateGuidance);
router.delete('/guidance/:id', requirePermission('ai.configure'), controller.deleteGuidance);


// ================== GUARDRAILS (Admin only) ==================
router.get('/guardrails', requirePermission('ai.configure'), controller.getGuardrails);
router.get('/guardrails/templates', requirePermission('ai.configure'), controller.getGuardrailTemplates);
router.post('/guardrails', requirePermission('ai.configure'), controller.createGuardrail);
router.put('/guardrails/:id', requirePermission('ai.configure'), controller.updateGuardrail);
router.delete('/guardrails/:id', requirePermission('ai.configure'), controller.deleteGuardrail);

// ================== ESCALATION (Admin only) ==================
router.get('/escalation/rules', requirePermission('ai.configure'), controller.getEscalationRules);
router.post('/escalation/rules', requirePermission('ai.configure'), controller.createEscalationRule);
router.delete('/escalation/rules/:id', requirePermission('ai.configure'), controller.deleteEscalationRule);

router.get('/escalation/guidance', requirePermission('ai.configure'), controller.getEscalationGuidances);
router.post('/escalation/guidance', requirePermission('ai.configure'), controller.createEscalationGuidance);
router.delete('/escalation/guidance/:id', requirePermission('ai.configure'), controller.deleteEscalationGuidance);

// ================== DEPLOYMENT (Admin only) ==================
const deploymentController = require('../../controllers/agentDeploymentController');
router.get('/deployments', requirePermission('ai.configure'), deploymentController.getDeployments);
router.put('/deployments/:channel', requirePermission('ai.configure'), deploymentController.updateDeployment);

// ================== CHAT (All authenticated users) ==================
router.post('/chat', controller.chatWithAgent);

// ================== COPILOT (All authenticated users) ==================
const copilotController = require('../controllers/copilotController');
router.post('/copilot/chat', copilotController.chat);
router.post('/copilot/chat-stream', copilotController.chatStream);
router.post('/copilot/generate-reply', copilotController.generateReply);
router.post('/copilot/summarize', copilotController.summarize);
router.get('/copilot/cross-channel-search', copilotController.crossChannelSearch);
router.get('/copilot/session/:conversationId', copilotController.getSession);
router.post('/copilot/session/:conversationId/end', copilotController.endSession);
router.get('/copilot/quick-actions', copilotController.getQuickActions);

module.exports = router;

