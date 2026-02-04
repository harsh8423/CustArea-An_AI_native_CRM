/**
 * Voice Agents Routes
 * Routes for voice agent management, phone number provisioning, and model selection
 */

const express = require('express');
const router = express.Router();

// Middleware
const authenticateToken = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

// Controllers
const voiceAgentController = require('../controllers/voiceAgentController');
const phoneNumberController = require('../controllers/phoneNumberController');
const modelController = require('../controllers/modelController');

// All routes require authentication
router.use(authenticateToken);

// ===== Voice Agent Routes =====
// Voice agent management requires phone access and settings.edit for modifications
router.get('/voice-agents', requirePermission('phone.access'), voiceAgentController.listVoiceAgents);
router.get('/voice-agents/:id', requirePermission('phone.access'), voiceAgentController.getVoiceAgent);
router.post('/voice-agents', requirePermission('settings.edit'), voiceAgentController.createVoiceAgent);
router.put('/voice-agents/:id', requirePermission('settings.edit'), voiceAgentController.updateVoiceAgent);
router.delete('/voice-agents/:id', requirePermission('settings.edit'), voiceAgentController.deleteVoiceAgent);

// ===== Phone Number Routes (Admin Only) =====
// Phone number provisioning is admin-only (requires settings.edit)
router.get('/phone-numbers', requirePermission('settings.edit'), phoneNumberController.listPhoneNumbers);
router.get('/phone-numbers/available', requirePermission('settings.edit'), phoneNumberController.getAvailablePhoneNumbers);
router.get('/phone-numbers/pricing', requirePermission('settings.edit'), phoneNumberController.getPhonePricing);
router.get('/phone-numbers/pricing/:country', requirePermission('settings.edit'), phoneNumberController.getCountryPricing);
router.post('/phone-numbers/request', requirePermission('settings.edit'), phoneNumberController.requestPhoneNumber);
router.delete('/phone-numbers/:id', requirePermission('settings.edit'), phoneNumberController.cancelPhoneNumberRequest);

// ===== Model Routes =====
// Model selection - all phone users can view available models
router.get('/models/stt', requirePermission('phone.access'), modelController.getSTTModels);
router.get('/models/llm', requirePermission('phone.access'), modelController.getLLMModels);
router.get('/models/tts', requirePermission('phone.access'), modelController.getTTSVoices);
router.get('/models/realtime', requirePermission('phone.access'), modelController.getRealtimeModels);

module.exports = router;
