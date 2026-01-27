// Email Module Entry Point
const emailRoutes = require('./routes/emailRoutes');
const gmailOAuthRoutes = require('./routes/gmailOAuth');
const outlookOAuthRoutes = require('./routes/outlookOAuth');
const { runEmailOutboundWorker } = require('./workers/emailOutbound');

module.exports = {
    routes: emailRoutes,
    gmailOAuthRoutes,
    outlookOAuthRoutes,
    runEmailOutboundWorker
};
