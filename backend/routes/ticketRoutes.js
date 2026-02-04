const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const {
    // Tickets
    listTickets,
    getTicketStats,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    // Notes
    listNotes,
    addNote,
    updateNote,
    deleteNote,
    // Activities
    getActivities,
    // Tags
    listTags,
    createTag,
    updateTag,
    deleteTag,
    addTagsToTicket,
    removeTagFromTicket,
    // Macros
    listMacros,
    createMacro,
    updateMacro,
    deleteMacro,
    applyMacro
} = require('../controllers/ticketController');

// All routes require authentication and ticketing feature access
router.use(authenticateToken);
router.use(requireFeature('ticketing'));

// ===== TICKET ROUTES =====
router.get('/', requirePermission('ticketing.view'), listTickets);
router.get('/stats', requirePermission('ticketing.view'), getTicketStats);
router.get('/:id', requirePermission('ticketing.view'), getTicket);
router.post('/', requirePermission('ticketing.create'), createTicket);
router.patch('/:id', requirePermission('ticketing.manage'), updateTicket);
router.delete('/:id', requirePermission('ticketing.manage'), deleteTicket);

// ===== TICKET NOTES =====
router.get('/:id/notes', requirePermission('ticketing.view'), listNotes);
router.post('/:id/notes', requirePermission('ticketing.create'), addNote);
router.patch('/:ticketId/notes/:noteId', requirePermission('ticketing.manage'), updateNote);
router.delete('/:ticketId/notes/:noteId', requirePermission('ticketing.manage'), deleteNote);

// ===== TICKET ACTIVITIES =====
router.get('/:id/activities', requirePermission('ticketing.view'), getActivities);

// ===== TICKET TAGS (for specific ticket) =====
router.post('/:id/tags', requirePermission('ticketing.manage'), addTagsToTicket);
router.delete('/:ticketId/tags/:tagId', requirePermission('ticketing.manage'), removeTagFromTicket);

// ===== APPLY MACRO =====
router.post('/:id/apply-macro', requirePermission('ticketing.manage'), applyMacro);

module.exports = router;
