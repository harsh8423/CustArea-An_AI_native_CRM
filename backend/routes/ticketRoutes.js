const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
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

// All routes require authentication
router.use(authenticateToken);

// ===== TICKET ROUTES =====
router.get('/', listTickets);
router.get('/stats', getTicketStats);
router.get('/:id', getTicket);
router.post('/', createTicket);
router.patch('/:id', updateTicket);
router.delete('/:id', deleteTicket);

// ===== TICKET NOTES =====
router.get('/:id/notes', listNotes);
router.post('/:id/notes', addNote);
router.patch('/:ticketId/notes/:noteId', updateNote);
router.delete('/:ticketId/notes/:noteId', deleteNote);

// ===== TICKET ACTIVITIES =====
router.get('/:id/activities', getActivities);

// ===== TICKET TAGS (for specific ticket) =====
router.post('/:id/tags', addTagsToTicket);
router.delete('/:ticketId/tags/:tagId', removeTagFromTicket);

// ===== APPLY MACRO =====
router.post('/:id/apply-macro', applyMacro);

module.exports = router;
