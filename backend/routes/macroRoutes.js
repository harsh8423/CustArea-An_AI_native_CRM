const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const {
    listMacros,
    createMacro,
    updateMacro,
    deleteMacro
} = require('../controllers/ticketController');

// All routes require authentication
router.use(authenticateToken);

// ===== MACRO ROUTES =====
router.get('/', requirePermission('ticketing.view'), listMacros);
router.post('/', requirePermission('ticketing.manage'), createMacro);
router.patch('/:id', requirePermission('ticketing.manage'), updateMacro);
router.delete('/:id', requirePermission('ticketing.manage'), deleteMacro);

module.exports = router;
