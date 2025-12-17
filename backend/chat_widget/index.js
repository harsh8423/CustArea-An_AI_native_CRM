/**
 * Chat Widget Module
 * Handles website chat widget with AI Agent integration
 */

const routes = require('./routes/widgetRoutes');
const widgetSiteService = require('./services/widgetSiteService');
const widgetSessionService = require('./services/widgetSessionService');
const widgetAuthService = require('./services/widgetAuthService');

module.exports = {
    routes,
    widgetSiteService,
    widgetSessionService,
    widgetAuthService
};
