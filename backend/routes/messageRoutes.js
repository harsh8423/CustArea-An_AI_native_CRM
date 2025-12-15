const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getMessage, updateMessageStatus } = require('../controllers/messageController');

// Authenticated routes
router.use(authenticateToken);

router.get('/:id', getMessage);
router.patch('/:id/status', updateMessageStatus);

module.exports = router;
