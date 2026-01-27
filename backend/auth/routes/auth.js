const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../../middleware/authMiddleware');

// Public routes
router.post('/signup-with-otp', authController.signupWithOTP);
router.post('/verify-otp', authController.verifyOTPAndSignin);
router.post('/verify-magic-link', authController.verifyMagicLink); // New route for magic link callback
router.post('/resend-otp', authController.resendOTP);

// Protected routes
router.post('/signout', authMiddleware, authController.signout);
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;
