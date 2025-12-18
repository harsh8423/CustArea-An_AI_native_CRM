const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
    listMacros,
    createMacro,
    updateMacro,
    deleteMacro
} = require('../controllers/ticketController');

// All routes require authentication
router.use(authenticateToken);

// ===== MACRO ROUTES =====
router.get('/', listMacros);
router.post('/', createMacro);
router.patch('/:id', updateMacro);
router.delete('/:id', deleteMacro);

module.exports = router;
