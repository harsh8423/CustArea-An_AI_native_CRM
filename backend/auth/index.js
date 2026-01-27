// Auth Module Entry Point
const authRoutes = require('./routes/authRoutes'); // Legacy password-based auth
const newAuthRoutes = require('./routes/auth'); // New Supabase OTP auth

module.exports = {
    authRoutes,      // Legacy auth
    newAuthRoutes    // Supabase auth
};
