const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
    listTags,
    createTag,
    updateTag,
    deleteTag
} = require('../controllers/ticketController');

// All routes require authentication
router.use(authenticateToken);

// ===== TICKET TAG ROUTES =====
router.get('/', listTags);
router.post('/', createTag);
router.patch('/:id', updateTag);
router.delete('/:id', deleteTag);

module.exports = router;
