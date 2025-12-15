// AI Agent Module Entry Point
const models = require('./models');
const services = require('./services');
const agentRoutes = require('./routes/agentRoutes');

module.exports = {
    ...models,
    ...services,
    agentRoutes
};
