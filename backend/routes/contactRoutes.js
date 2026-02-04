const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { getContacts, getContactById, exportContacts, createContact, deleteContacts, updateContact, updateScore } = require('../controllers/contactController');
const { getContactGroups } = require('../controllers/contactGroupController');
const { bulkAssignContacts, bulkAssignContactGroups } = require('../controllers/bulkAssignController');

router.use(authenticateToken);

router.get('/', requirePermission('contacts.view'), getContacts);
router.post('/', requirePermission('contacts.create'), createContact);
router.get('/export', requirePermission('contacts.export'), exportContacts);
router.post('/bulk-assign', requirePermission('contacts.edit'), bulkAssignContacts);  // Bulk assign contacts
router.post('/groups/bulk-assign', requirePermission('contacts.edit'), bulkAssignContactGroups);  // Bulk assign contact groups
router.get('/:id', requirePermission('contacts.view'), getContactById); // Get single contact
router.get('/:id/groups', requirePermission('contacts.view'), getContactGroups);  // Get contact's groups
router.patch('/:id', requirePermission('contacts.edit'), updateContact);  // Update contact
router.delete('/', requirePermission('contacts.delete'), deleteContacts);  // Bulk delete
router.patch('/:id/score', requirePermission('contacts.edit'), updateScore);  // Update score

module.exports = router;
