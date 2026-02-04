/**
 * Campaign Routes
 * API endpoints for campaign management
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { requireFeature } = require('../../middleware/featureMiddleware');
const {
    createCampaign,
    getCampaigns,
    getCampaignById,
    updateCampaign,
    deleteCampaign,
    launchCampaign,
    pauseCampaign,
    resumeCampaign,
    generateTemplates,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setEmailRotation,
    getEmailRotation,
    getCampaignAnalytics,
    getCampaignContacts
} = require('../controllers/campaignController');

// All routes require authentication and campaign feature access
router.use(authenticateToken);
router.use(requireFeature('campaign'));

// Campaign CRUD
router.post('/', requirePermission('campaigns.create'), createCampaign);
router.get('/', requirePermission('campaigns.view'), getCampaigns);
router.get('/:id', requirePermission('campaigns.view'), getCampaignById);
router.patch('/:id', requirePermission('campaigns.edit'), updateCampaign);
router.delete('/:id', requirePermission('campaigns.delete'), deleteCampaign);

// Campaign lifecycle
router.post('/:id/launch', requirePermission('campaigns.edit'), launchCampaign);
router.post('/:id/pause', requirePermission('campaigns.edit'), pauseCampaign);
router.post('/:id/resume', requirePermission('campaigns.edit'), resumeCampaign);

// Template management
router.post('/:id/templates/generate', requirePermission('campaigns.edit'), generateTemplates);
router.get('/:id/templates', requirePermission('campaigns.view'), getTemplates);
router.post('/:id/templates', requirePermission('campaigns.edit'), createTemplate);
router.put('/:id/templates/:templateId', requirePermission('campaigns.edit'), updateTemplate);
router.delete('/:id/templates/:templateId', requirePermission('campaigns.edit'), deleteTemplate);

// Email rotation
router.post('/:id/emails/rotation', requirePermission('campaigns.edit'), setEmailRotation);
router.get('/:id/emails/rotation', requirePermission('campaigns.view'), getEmailRotation);

// Analytics & Contacts
router.get('/:id/analytics', requirePermission('campaigns.view'), getCampaignAnalytics);
router.get('/:id/contacts', requirePermission('campaigns.view'), getCampaignContacts);

module.exports = router;

