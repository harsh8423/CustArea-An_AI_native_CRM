// WhatsApp Module Entry Point
const whatsappService = require('./services/whatsappService');
const { runWhatsappOutboundWorker } = require('./workers/whatsappOutbound');

// Note: WhatsApp routes are currently in webhookRoutes.js
// TODO: Extract WhatsApp-specific routes to this module

module.exports = {
    whatsappService,
    runWhatsappOutboundWorker
};
