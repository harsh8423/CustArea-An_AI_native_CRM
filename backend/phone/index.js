/**
 * Phone Voice Agent Module
 * Handles voice calls via Twilio with AI Agent integration
 */

const routes = require('./routes/phoneRoutes');
const { setupLegacyHandler } = require('./services/legacyHandler');
const { setupRealtimeHandler } = require('./services/realtimeHandler');
const { setupConvRelayHandler } = require('./services/convRelayHandler');
const callSessionManager = require('./services/callSessionManager');

module.exports = {
    routes,
    setupLegacyHandler,
    setupRealtimeHandler,
    setupConvRelayHandler,
    callSessionManager
};
