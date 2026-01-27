const express = require('express');
const router = express.Router();
const { registerTenant, loginUser } = require('../controllers/authController');

router.post('/register', registerTenant);
router.post('/login', loginUser);

module.exports = router;
