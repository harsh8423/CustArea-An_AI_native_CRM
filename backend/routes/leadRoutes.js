const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { 
    getPipeline, 
    getLeads, 
    createLeadsFromContacts, 
    updateLeadStage,
    updateLeadStatus,
    updateLeadScore,
    deleteLeads,
    assignLead
} = require('../controllers/leadController');

router.use(authenticateToken);

router.get('/pipeline', requirePermission('leads.view'), getPipeline);
router.get('/', requirePermission('leads.view'), getLeads);
router.post('/', requirePermission('leads.create'), createLeadsFromContacts);
router.patch('/:id/stage', requirePermission('leads.edit'), updateLeadStage);
router.patch('/:id/status', requirePermission('leads.edit'), updateLeadStatus);
router.patch('/:id/score', requirePermission('leads.edit'), updateLeadScore);
router.post('/:id/assign', requirePermission('leads.edit'), assignLead);
router.delete('/', requirePermission('leads.delete'), deleteLeads);

module.exports = router;
