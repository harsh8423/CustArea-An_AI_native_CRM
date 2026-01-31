const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getContacts, getContactById, exportContacts, createContact, deleteContacts, updateContact, updateScore } = require('../controllers/contactController');
const { getContactGroups } = require('../controllers/contactGroupController');

router.use(authenticateToken);

router.get('/', getContacts);
router.post('/', createContact);
router.get('/export', exportContacts);
router.get('/:id', getContactById); // Get single contact
router.get('/:id/groups', getContactGroups);  // Get contact's groups
router.patch('/:id', updateContact);  // Update contact
router.delete('/', deleteContacts);  // Bulk delete
router.patch('/:id/score', updateScore);  // Update score

module.exports = router;
