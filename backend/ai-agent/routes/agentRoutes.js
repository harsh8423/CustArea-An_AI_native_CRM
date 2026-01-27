/**
 * AI Agent Routes
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const controller = require('../controllers/agentController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ================== AGENT CONFIG ==================
router.get('/', controller.getAgent);
router.put('/', controller.updateAgent);
router.get('/status', controller.getStatus);

// ================== KNOWLEDGE BASE ==================
router.get('/knowledge', controller.getKnowledgeSources);
router.post('/knowledge', controller.addKnowledgeSource);
router.post('/knowledge/upload', controller.upload.single('file'), controller.uploadDocument);
router.delete('/knowledge/:id', controller.deleteKnowledgeSource);

// ================== GUIDANCE ==================
router.get('/guidance', controller.getGuidances);
router.post('/guidance', controller.createGuidance);
router.put('/guidance/:id', controller.updateGuidance);
router.delete('/guidance/:id', controller.deleteGuidance);


// ================== GUARDRAILS ==================
router.get('/guardrails', controller.getGuardrails);
router.get('/guardrails/templates', controller.getGuardrailTemplates);
router.post('/guardrails', controller.createGuardrail);
router.put('/guardrails/:id', controller.updateGuardrail);
router.delete('/guardrails/:id', controller.deleteGuardrail);

// ================== ESCALATION ==================
router.get('/escalation/rules', controller.getEscalationRules);
router.post('/escalation/rules', controller.createEscalationRule);
router.delete('/escalation/rules/:id', controller.deleteEscalationRule);

router.get('/escalation/guidance', controller.getEscalationGuidances);
router.post('/escalation/guidance', controller.createEscalationGuidance);
router.delete('/escalation/guidance/:id', controller.deleteEscalationGuidance);

// ================== DEPLOYMENT ==================
const deploymentController = require('../../controllers/agentDeploymentController');
router.get('/deployments', deploymentController.getDeployments);
router.put('/deployments/:channel', deploymentController.updateDeployment);

// ================== CHAT ==================
router.post('/chat', controller.chatWithAgent);

module.exports = router;

