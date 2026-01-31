const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
    createGroup,
    listGroups,
    getGroup,
    updateGroup,
    deleteGroup,
    addContactsToGroup,
    removeContactsFromGroup,
    getGroupContacts,
    getContactGroups
} = require('../controllers/contactGroupController');

router.use(authenticateToken);

// Group management
router.post('/', createGroup);                          // Create group
router.get('/', listGroups);                            // List all groups
router.get('/:id', getGroup);                           // Get single group
router.patch('/:id', updateGroup);                      // Update group
router.delete('/:id', deleteGroup);                     // Delete group

// Group membership management
router.post('/:id/contacts', addContactsToGroup);       // Add contacts to group
router.delete('/:id/contacts', removeContactsFromGroup); // Remove contacts from group
router.get('/:id/contacts', getGroupContacts);          // Get contacts in group

module.exports = router;
