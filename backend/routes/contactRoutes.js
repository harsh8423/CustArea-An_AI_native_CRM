const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getContacts, exportContacts, createContact, deleteContacts, updateScore } = require('../controllers/contactController');

router.use(authenticateToken);

router.get('/', getContacts);
router.post('/', createContact);
router.get('/export', exportContacts);
router.delete('/', deleteContacts);  // Bulk delete
router.patch('/:id/score', updateScore);  // Update score

module.exports = router;
