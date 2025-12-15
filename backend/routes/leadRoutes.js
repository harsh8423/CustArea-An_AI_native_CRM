const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { 
    getPipeline, 
    getLeads, 
    createLeadsFromContacts, 
    updateLeadStage,
    updateLeadStatus,
    updateLeadScore
} = require('../controllers/leadController');

router.use(authenticateToken);

router.get('/pipeline', getPipeline);
router.get('/', getLeads);
router.post('/', createLeadsFromContacts);
router.patch('/:id/stage', updateLeadStage);
router.patch('/:id/status', updateLeadStatus);
router.patch('/:id/score', updateLeadScore);

module.exports = router;
