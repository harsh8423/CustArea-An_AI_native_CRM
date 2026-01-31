/**
 * Voice Agents Routes
 * Routes for voice agent management, phone number provisioning, and model selection
 */

const express = require('express');
const router = express.Router();

// Middleware
const authenticateToken = require('../../middleware/authMiddleware');

// Controllers
const voiceAgentController = require('../controllers/voiceAgentController');
const phoneNumberController = require('../controllers/phoneNumberController');
const modelController = require('../controllers/modelController');

// All routes require authentication
router.use(authenticateToken);

// ===== Voice Agent Routes =====
router.get('/voice-agents', voiceAgentController.listVoiceAgents);
router.get('/voice-agents/:id', voiceAgentController.getVoiceAgent);
router.post('/voice-agents', voiceAgentController.createVoiceAgent);
router.put('/voice-agents/:id', voiceAgentController.updateVoiceAgent);
router.delete('/voice-agents/:id', voiceAgentController.deleteVoiceAgent);

// ===== Phone Number Routes =====
router.get('/phone-numbers', phoneNumberController.listPhoneNumbers);
router.get('/phone-numbers/available', phoneNumberController.getAvailablePhoneNumbers);
router.get('/phone-numbers/pricing', phoneNumberController.getPhonePricing);
router.get('/phone-numbers/pricing/:country', phoneNumberController.getCountryPricing);
router.post('/phone-numbers/request', phoneNumberController.requestPhoneNumber);
router.delete('/phone-numbers/:id', phoneNumberController.cancelPhoneNumberRequest);

// ===== Model Routes =====
router.get('/models/stt', modelController.getSTTModels);
router.get('/models/llm', modelController.getLLMModels);
router.get('/models/tts', modelController.getTTSVoices);
router.get('/models/realtime', modelController.getRealtimeModels);

module.exports = router;
